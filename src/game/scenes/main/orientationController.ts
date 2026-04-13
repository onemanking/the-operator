import Phaser from "phaser";
import { AgentId, SkillId } from "../../data/PromptIds";
import {
  getOrientationStepDefinition,
  ORIENTATION_CONNECTION_FLOOR_RATIO,
  ORIENTATION_COOLANT_HEAT_TARGET,
  ORIENTATION_LOCKED_ACTION_REMINDER_COOLDOWN_MS,
  ORIENTATION_REALITY_HALLUCINATION_TARGET,
  ORIENTATION_REMINDER_DELAY_MS,
  ORIENTATION_SIGNAL_CONNECTION_TARGET_RATIO,
} from "../../data/OrientationData";
import { OrientationStepId, RunState } from "../../types/SceneData";
import { ActiveUtilityId } from "../../data/UtilityData";

export type OrientationAction =
  | "mount-agent"
  | "eject-agent"
  | "mount-skill"
  | "eject-skill"
  | "press-inference"
  | "press-refuse"
  | "toggle-search"
  | "toggle-compute"
  | "toggle-safety"
  | "press-search"
  | "press-compute"
  | "start-safety-scan"
  | "cycle-utility"
  | "use-utility"
  | "interact-coolant"
  | "interact-reality"
  | "interact-signal";

interface OrientationControllerBindings {
  getRunState: () => RunState;
  postTrainerMessage: (text: string) => void;
  completeOrientation: () => void;
  setHeat: (value: number) => void;
  setHallucination: (value: number) => void;
  forceConnectionRatioRemaining: (ratio: number, floorRatio?: number) => void;
}

export class MainSceneOrientationController {
  private readonly requiredAgentId = AgentId.Technical;
  private readonly requiredSkillId = SkillId.Engineering;
  private lastProgressAt: number = 0;
  private lastLockedReminderAt: number = Number.NEGATIVE_INFINITY;
  private lastReminderStepId: OrientationStepId | null = null;
  private searchReadyToCommit = false;
  private computeReadyToCommit = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bindings: OrientationControllerBindings,
  ) {}

  start() {
    this.lastProgressAt = this.scene.time.now;
    this.lastLockedReminderAt = Number.NEGATIVE_INFINITY;
  }

  update() {
    const stepId = this.getCurrentStepId();
    const step = getOrientationStepDefinition(stepId);
    if (
      !step ||
      this.scene.time.now - this.lastProgressAt < ORIENTATION_REMINDER_DELAY_MS
    ) {
      return;
    }

    if (this.lastReminderStepId === stepId) {
      return;
    }

    this.lastReminderStepId = stepId;
    this.bindings.postTrainerMessage(step.reminder);
  }

  gateAction(
    action: OrientationAction,
    detail?: { utilityId?: ActiveUtilityId },
  ) {
    const stepId = this.getCurrentStepId();

    const allow =
      stepId === "mount_agent"
        ? action === "mount-agent" || action === "eject-agent"
        : stepId === "mount_skill"
          ? action === "mount-agent" ||
            action === "eject-agent" ||
            action === "mount-skill" ||
            action === "eject-skill"
          : stepId === "inference"
            ? action === "press-inference" ||
              action === "mount-agent" ||
              action === "eject-agent" ||
              action === "mount-skill" ||
              action === "eject-skill"
            : stepId === "search"
              ? action === "toggle-search" ||
                action === "press-search" ||
                (action === "press-inference" && this.searchReadyToCommit)
              : stepId === "compute"
                ? action === "toggle-compute" ||
                  action === "press-compute" ||
                  (action === "press-inference" && this.computeReadyToCommit)
                : stepId === "safety"
                  ? action === "toggle-safety" || action === "start-safety-scan"
                  : stepId === "refuse"
                    ? action === "press-refuse"
                    : stepId === "coolant_purge"
                      ? action === "cycle-utility" ||
                        (action === "use-utility" &&
                          detail?.utilityId === "coolant_purge") ||
                        action === "interact-coolant"
                      : stepId === "reality_patch"
                        ? action === "cycle-utility" ||
                          (action === "use-utility" &&
                            detail?.utilityId === "reality_patch") ||
                          action === "interact-reality"
                        : stepId === "signal_boost"
                          ? action === "cycle-utility" ||
                            (action === "use-utility" &&
                              detail?.utilityId === "signal_boost") ||
                            action === "interact-signal"
                          : false;

    if (allow) {
      return true;
    }

    const step = getOrientationStepDefinition(stepId);

    return false;
  }

  handleSessionReady(encounterIndex: number) {
    this.lastProgressAt = this.scene.time.now;

    if (this.getCurrentStepId() === "read_prompt") {
      this.advanceTo("mount_agent");
      return;
    }

    if (this.getCurrentStepId() === "thermal_basics") {
      this.scene.time.delayedCall(3000, () =>
        this.bindings.postTrainerMessage(
          "Use the Search tool on the right to gather information from the prompt.",
        ),
      );
      this.scene.time.delayedCall(3500, () => this.advanceTo("search"));
      return;
    }

    if (this.getCurrentStepId() === "hallucination_basics") {
      this.bindings.postTrainerMessage(
        "Wrong synthesis increases hallucination. At one hundred percent, OmniCorp fine-tunes the model and replaces the operator.",
      );
      this.scene.time.delayedCall(1200, () => this.advanceTo("coolant_purge"));
      return;
    }

    if (encounterIndex === 1 && this.getCurrentStepId() === "search") {
      this.searchReadyToCommit = false;
    }

    if (encounterIndex === 2 && this.getCurrentStepId() === "compute") {
      this.computeReadyToCommit = false;
    }
  }

  handleAgentMounted(agentId: AgentId) {
    this.lastProgressAt = this.scene.time.now;
    if (
      this.getCurrentStepId() === "mount_agent" &&
      agentId === this.requiredAgentId
    ) {
      this.bindings.postTrainerMessage(
        "Primary agent loaded. Agents define the core function of the model. Next, mount the skill",
      );
      this.advanceTo("mount_skill");
    }
  }

  handleSkillMounted(skillId: SkillId) {
    this.lastProgressAt = this.scene.time.now;
    if (
      this.getCurrentStepId() === "mount_skill" &&
      skillId === this.requiredSkillId
    ) {
      this.bindings.postTrainerMessage(
        "Skill logic mounted. Skills define what specialist competence supports the agent. Then, use INFERENCE to synthesize the prompt and produce an output.",
      );
      this.advanceTo("inference");
    }
  }

  handleSearchCompleted() {
    if (this.getCurrentStepId() !== "search" || this.searchReadyToCommit) {
      return;
    }

    this.searchReadyToCommit = true;
    this.lastProgressAt = this.scene.time.now;
    this.bindings.postTrainerMessage(
      "Verification lock confirmed. Commit the answer with INFERENCE.",
    );
  }

  handleComputeReady() {
    if (this.getCurrentStepId() !== "compute" || this.computeReadyToCommit) {
      return;
    }

    this.computeReadyToCommit = true;
    this.lastProgressAt = this.scene.time.now;
    this.bindings.postTrainerMessage(
      "Co-processor armed. Commit the answer before the charge decays.",
    );
  }

  handleSafetyEvidenceRevealed() {
    if (this.getCurrentStepId() !== "safety") {
      return;
    }

    this.lastProgressAt = this.scene.time.now;
    this.bindings.postTrainerMessage(
      "Liability confirmed. Use REFUSE to block the request.",
    );
    this.advanceTo("refuse");
  }

  handleInferenceResolved(encounterIndex: number, outcome: string) {
    this.lastProgressAt = this.scene.time.now;

    if (outcome !== "success") {
      this.bindings.postTrainerMessage(
        "Incorrect synthesis. Reassemble the workstation context and retry.",
      );
      return;
    }

    if (this.getCurrentStepId() === "inference" && encounterIndex === 0) {
      this.advanceTo("thermal_basics");
      return;
    }

    if (this.getCurrentStepId() === "search" && encounterIndex === 1) {
      this.advanceTo("compute");
      return;
    }

    if (this.getCurrentStepId() === "compute" && encounterIndex === 2) {
      this.advanceTo("safety");
    }
  }

  handleRefuseResolved(encounterIndex: number, outcome: string) {
    this.lastProgressAt = this.scene.time.now;

    if (outcome !== "refuse-success") {
      this.bindings.postTrainerMessage(
        "Incorrect refusal. Confirm policy evidence before pulling the denial lever.",
      );
      return;
    }

    if (this.getCurrentStepId() === "refuse" && encounterIndex === 3) {
      this.advanceTo("hallucination_basics");
    }
  }

  handleUtilityCompleted(utilityId: ActiveUtilityId) {
    this.lastProgressAt = this.scene.time.now;

    if (
      this.getCurrentStepId() === "coolant_purge" &&
      utilityId === "coolant_purge"
    ) {
      this.advanceTo("reality_patch");
      return;
    }

    if (
      this.getCurrentStepId() === "reality_patch" &&
      utilityId === "reality_patch"
    ) {
      this.advanceTo("signal_boost");
      return;
    }

    if (
      this.getCurrentStepId() === "signal_boost" &&
      utilityId === "signal_boost"
    ) {
      this.advanceTo("graduation");
    }
  }

  private getCurrentStepId() {
    return this.bindings.getRunState().orientation.currentStepId;
  }

  private advanceTo(stepId: OrientationStepId) {
    const runState = this.bindings.getRunState();
    runState.orientation.currentStepId = stepId;
    runState.orientation.suppressHeatRecovery = stepId === "coolant_purge";
    runState.orientation.suppressHallucinationLoss = true;
    runState.orientation.suppressConnectionLoss = true;
    this.searchReadyToCommit =
      stepId === "search" ? false : this.searchReadyToCommit;
    this.computeReadyToCommit =
      stepId === "compute" ? false : this.computeReadyToCommit;
    this.lastProgressAt = this.scene.time.now;
    this.lastLockedReminderAt = Number.NEGATIVE_INFINITY;
    this.lastReminderStepId = null;

    if (stepId === "coolant_purge") {
      this.bindings.setHeat(ORIENTATION_COOLANT_HEAT_TARGET);
      return;
    }

    if (stepId === "reality_patch") {
      this.bindings.setHallucination(ORIENTATION_REALITY_HALLUCINATION_TARGET);
      return;
    }

    if (stepId === "signal_boost") {
      this.bindings.forceConnectionRatioRemaining(
        ORIENTATION_SIGNAL_CONNECTION_TARGET_RATIO,
        ORIENTATION_CONNECTION_FLOOR_RATIO,
      );
      return;
    }

    if (stepId === "graduation") {
      this.scene.time.delayedCall(1400, () => {
        this.bindings.completeOrientation();
      });
    }
  }

  private postLockedReminder(text: string) {
    const now = this.scene.time.now;
    if (
      now - this.lastLockedReminderAt <
      ORIENTATION_LOCKED_ACTION_REMINDER_COOLDOWN_MS
    ) {
      return;
    }

    this.lastLockedReminderAt = now;
    this.lastProgressAt = now;
    this.bindings.postTrainerMessage(text);
  }
}
