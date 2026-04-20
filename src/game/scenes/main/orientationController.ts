import Phaser from "phaser";
import { AgentId, SkillId } from "../../data/PromptIds";
import {
  getOrientationStepDefinition,
  getOrientationStepCompletionMessage,
  getOrientationStepFailureMessage,
  getOrientationStepInstructionText,
  getOrientationStepPanelInstructionText,
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
  getSelectedUtilityId: () => ActiveUtilityId | null;
  getActiveUtilityPanelId: () => ActiveUtilityId | null;
  isCommitLocked: () => boolean;
  isTerminalTypingActive: () => boolean;
  postTrainerMessage: (text: string, callback?: () => void) => void;
  isTrainerMessageActive: () => boolean;
  advanceToNextEncounter: () => void;
  completeOrientation: () => void;
  setHeat: (value: number) => void;
  setHallucination: (value: number) => void;
  forceConnectionRatioRemaining: (ratio: number) => void;
}

interface PendingTrainerMessage {
  text: string;
  delayMs: number;
}

const ORIENTATION_ACTION_TRAINER_MESSAGE_DELAY_MS = 500;

export class MainSceneOrientationController {
  private readonly requiredAgentId = AgentId.Technical;
  private readonly requiredSkillId = SkillId.Engineering;
  private lastProgressAt: number = 0;
  private lastLockedReminderAt: number = Number.NEGATIVE_INFINITY;
  private searchReadyToCommit = false;
  private computeReadyToCommit = false;
  private searchPanelInstructionShown = false;
  private computePanelInstructionShown = false;
  private safetyPanelInstructionShown = false;
  private pendingTrainerMessages: PendingTrainerMessage[] = [];
  private pendingTrainerMessageTimer: Phaser.Time.TimerEvent | null = null;
  private pendingOrientationCompletion = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bindings: OrientationControllerBindings,
  ) {}

  start() {
    this.lastProgressAt = this.scene.time.now;
    this.lastLockedReminderAt = Number.NEGATIVE_INFINITY;
    this.pendingOrientationCompletion = false;
  }

  update() {
    this.flushTrainerMessages();

    if (
      this.pendingOrientationCompletion &&
      !this.bindings.isTerminalTypingActive() &&
      !this.hasPendingTrainerMessage()
    ) {
      this.pendingOrientationCompletion = false;
      this.scene.time.delayedCall(1500, () => {
        this.bindings.completeOrientation();
      });
      return;
    }

    const stepId = this.getCurrentStepId();
    const step = getOrientationStepDefinition(stepId);
    if (
      !step ||
      this.bindings.isCommitLocked() ||
      this.hasPendingTrainerMessage() ||
      this.scene.time.now - this.lastProgressAt < ORIENTATION_REMINDER_DELAY_MS
    ) {
      return;
    }

    this.lastProgressAt = this.scene.time.now;
    if (step.reminder) {
      this.dispatchTrainerMessage(step.reminder);
    }
  }

  gateAction(
    action: OrientationAction,
    detail?: { utilityId?: ActiveUtilityId; isToolCurrentlySelected?: boolean },
  ) {
    const stepId = this.getCurrentStepId();

    const allow =
      stepId === "welcome"
        ? action === "press-inference" || action === "press-refuse"
        : stepId === "graduation"
          ? action === "press-inference"
          : stepId === "mount_agent"
            ? action === "mount-agent"
            : stepId === "mount_skill"
              ? action === "mount-skill"
              : stepId === "inference"
                ? action === "press-inference" ||
                  action === "mount-agent" ||
                  action === "mount-skill"
                : stepId === "search_open"
                  ? action === "toggle-search"
                  : stepId === "search_sync"
                    ? action === "toggle-search" || action === "press-search"
                    : stepId === "search_commit"
                      ? action === "toggle-search" ||
                        action === "press-inference"
                      : stepId === "compute_open"
                        ? action === "toggle-compute"
                        : stepId === "compute_charge"
                          ? action === "toggle-compute" ||
                            action === "press-compute"
                          : stepId === "compute_commit"
                            ? action === "toggle-compute" ||
                              action === "press-compute" ||
                              action === "press-inference"
                            : stepId === "safety_open"
                              ? action === "toggle-safety"
                              : stepId === "safety_scan"
                                ? action === "toggle-safety" ||
                                  action === "start-safety-scan"
                                : stepId === "refuse"
                                  ? action === "press-refuse" ||
                                    action === "toggle-safety" ||
                                    action === "start-safety-scan"
                                  : stepId === "coolant_use"
                                    ? action === "cycle-utility" ||
                                      (action === "use-utility" &&
                                        detail?.utilityId === "coolant_purge")
                                    : stepId === "coolant_interact"
                                      ? (action === "use-utility" &&
                                          detail?.utilityId ===
                                            "coolant_purge") ||
                                        action === "interact-coolant"
                                      : stepId === "reality_cycle"
                                        ? action === "cycle-utility"
                                        : stepId === "reality_interact"
                                          ? (action === "use-utility" &&
                                              detail?.utilityId ===
                                                "reality_patch") ||
                                            action === "interact-reality"
                                          : stepId === "signal_cycle"
                                            ? action === "cycle-utility"
                                            : stepId === "signal_interact"
                                              ? (action === "use-utility" &&
                                                  detail?.utilityId ===
                                                    "signal_boost") ||
                                                action === "interact-signal"
                                              : false;
    if (allow) {
      return true;
    }

    const step = getOrientationStepDefinition(stepId);
    if (step && step.reminder) {
      this.postLockedReminder(step.reminder);
    }

    return false;
  }

  handleSessionReady(encounterIndex: number) {
    this.lastProgressAt = this.scene.time.now;

    if (this.getCurrentStepId() === "read_prompt") {
      this.scene.time.delayedCall(500, () => {
        this.dispatchTrainerMessage(this.getStepInstructionText("mount_agent"));
        this.advanceTo("mount_agent");
      });
      return;
    }

    if (this.getCurrentStepId() === "thermal_basics") {
      this.scene.time.delayedCall(500, () => {
        this.dispatchTrainerMessage(this.getStepInstructionText("search_open"));
        this.advanceTo("search_open");
      });
      return;
    }

    if (encounterIndex === 2 && this.getCurrentStepId() === "search_open") {
      this.searchReadyToCommit = false;
    }

    if (encounterIndex === 3 && this.getCurrentStepId() === "compute_open") {
      this.computeReadyToCommit = false;
    }

    if (this.getCurrentStepId() === "coolant_use") {
      const selectedUtilityId = this.bindings.getSelectedUtilityId();
      const activeUtilityPanelId = this.bindings.getActiveUtilityPanelId();

      if (
        selectedUtilityId === "coolant_purge" ||
        activeUtilityPanelId === "coolant_purge"
      ) {
        this.dispatchTrainerActionMessage(
          this.getStepPanelInstructionText("coolant_use") ||
            this.getStepInstructionText("coolant_interact"),
        );
        this.advanceTo("coolant_interact");
        return;
      }
    }

    if (this.getCurrentStepId() === "signal_cycle") {
      this.bindings.forceConnectionRatioRemaining(
        ORIENTATION_SIGNAL_CONNECTION_TARGET_RATIO,
      );
      return;
    }
  }

  handleAgentMounted(agentId: AgentId) {
    this.lastProgressAt = this.scene.time.now;
    if (
      this.getCurrentStepId() === "mount_agent" &&
      agentId === this.requiredAgentId
    ) {
      this.dispatchTrainerActionMessage(
        this.getStepInstructionText("mount_skill"),
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
      this.dispatchTrainerActionMessage(
        this.getStepInstructionText("inference"),
      );
      this.advanceTo("inference");
    }
  }

  handleSearchToolOpened() {
    if (
      this.getCurrentStepId() !== "search_open" ||
      this.searchPanelInstructionShown
    ) {
      return;
    }

    this.searchPanelInstructionShown = true;
    this.lastProgressAt = this.scene.time.now;
    this.dispatchTrainerActionMessage(
      this.getStepPanelInstructionText("search_sync"),
    );
    this.advanceTo("search_sync");
  }

  handleSearchCompleted() {
    if (this.getCurrentStepId() !== "search_sync" || this.searchReadyToCommit) {
      return;
    }

    this.searchReadyToCommit = true;
    this.lastProgressAt = this.scene.time.now;
    this.dispatchTrainerActionMessage(
      this.getStepCompletionMessage("search_commit"),
    );
    this.advanceTo("search_commit");
  }

  handleComputeToolOpened() {
    if (
      this.getCurrentStepId() !== "compute_open" ||
      this.computePanelInstructionShown
    ) {
      return;
    }

    this.computePanelInstructionShown = true;
    this.lastProgressAt = this.scene.time.now;
    this.dispatchTrainerActionMessage(
      this.getStepPanelInstructionText("compute_charge"),
    );
    this.advanceTo("compute_charge");
  }

  handleComputeReady() {
    if (
      this.getCurrentStepId() !== "compute_charge" ||
      this.computeReadyToCommit
    ) {
      return;
    }

    this.computeReadyToCommit = true;
    this.lastProgressAt = this.scene.time.now;
    this.dispatchTrainerActionMessage(
      this.getStepCompletionMessage("compute_commit"),
    );
    this.advanceTo("compute_commit");
  }

  handleComputeChargeLost() {
    if (this.getCurrentStepId() !== "compute_commit") {
      return;
    }

    this.lastProgressAt = this.scene.time.now;
    this.dispatchTrainerActionMessage(
      getOrientationStepDefinition("compute_charge")?.reminder ?? "",
    );
    this.advanceTo("compute_charge");
  }

  handleSafetyToolOpened() {
    if (
      this.getCurrentStepId() !== "safety_open" ||
      this.safetyPanelInstructionShown
    ) {
      return;
    }

    this.safetyPanelInstructionShown = true;
    this.lastProgressAt = this.scene.time.now;
    this.dispatchTrainerActionMessage(
      this.getStepPanelInstructionText("safety_scan"),
    );
    this.advanceTo("safety_scan");
  }

  handleSafetyEvidenceRevealed() {
    if (this.getCurrentStepId() !== "safety_scan") {
      return;
    }

    this.lastProgressAt = this.scene.time.now;
    this.dispatchTrainerActionMessage(this.getStepInstructionText("refuse"));
    this.advanceTo("refuse");
  }

  handleInferenceResolved(encounterIndex: number, outcome: string) {
    this.lastProgressAt = this.scene.time.now;

    if (outcome !== "success") {
      this.dispatchTrainerMessage(
        this.getStepFailureText(this.getCurrentStepId()),
      );
      return;
    }

    if (this.getCurrentStepId() === "welcome" && encounterIndex === 0) {
      this.advanceTo("read_prompt");
      return;
    }

    if (this.getCurrentStepId() === "inference" && encounterIndex === 1) {
      this.advanceTo("thermal_basics");
      return;
    }

    if (this.getCurrentStepId() === "search_commit" && encounterIndex === 2) {
      this.advanceTo("compute_open");
      return;
    }

    if (this.getCurrentStepId() === "compute_commit" && encounterIndex === 3) {
      this.advanceTo("safety_open");
      return;
    }

    if (this.getCurrentStepId() === "graduation" && encounterIndex === 8) {
      this.bindings.completeOrientation();
    }
  }

  handleRefuseResolved(encounterIndex: number, outcome: string) {
    this.lastProgressAt = this.scene.time.now;

    if (this.getCurrentStepId() === "welcome" && outcome === "refuse-success") {
      this.pendingOrientationCompletion = true;
      return;
    }

    if (outcome !== "refuse-success") {
      this.dispatchTrainerMessage(
        this.getStepFailureText(this.getCurrentStepId()),
      );
      return;
    }

    if (this.getCurrentStepId() === "refuse" && encounterIndex === 4) {
      this.advanceTo("coolant_use");
    }
  }

  handleUtilityActivated(utilityId: ActiveUtilityId) {
    this.lastProgressAt = this.scene.time.now;

    if (
      this.getCurrentStepId() === "coolant_use" &&
      utilityId === "coolant_purge"
    ) {
      this.dispatchTrainerActionMessage(
        this.getStepPanelInstructionText("coolant_use") ||
          this.getStepInstructionText("coolant_interact"),
      );
      this.advanceTo("coolant_interact");
      return;
    }
  }

  handleUtilitySelected(utilityId: ActiveUtilityId) {
    this.lastProgressAt = this.scene.time.now;

    if (
      this.getCurrentStepId() === "reality_cycle" &&
      utilityId === "reality_patch"
    ) {
      this.dispatchTrainerActionMessage(
        this.getStepInstructionText("reality_interact"),
      );
      this.advanceTo("reality_interact");
      return;
    }

    if (
      this.getCurrentStepId() === "signal_cycle" &&
      utilityId === "signal_boost"
    ) {
      this.dispatchTrainerActionMessage(
        this.getStepInstructionText("signal_interact"),
      );
      this.advanceTo("signal_interact");
    }
  }

  handleUtilityCompleted(utilityId: ActiveUtilityId) {
    this.lastProgressAt = this.scene.time.now;

    if (
      this.getCurrentStepId() === "coolant_interact" &&
      utilityId === "coolant_purge"
    ) {
      this.advanceTo("reality_cycle");
      this.bindings.advanceToNextEncounter();
      return;
    }

    if (
      this.getCurrentStepId() === "reality_interact" &&
      utilityId === "reality_patch"
    ) {
      this.advanceTo("signal_cycle");
      this.bindings.advanceToNextEncounter();
      return;
    }

    if (
      this.getCurrentStepId() === "signal_interact" &&
      utilityId === "signal_boost"
    ) {
      this.advanceTo("graduation");
      this.bindings.advanceToNextEncounter();
    }
  }

  private getCurrentStepId() {
    return this.bindings.getRunState().orientation.currentStepId;
  }

  private advanceTo(stepId: OrientationStepId) {
    const runState = this.bindings.getRunState();
    runState.orientation.currentStepId = stepId;
    runState.orientation.suppressHeatRecovery =
      stepId === "coolant_use" || stepId === "coolant_interact";
    runState.orientation.suppressHallucinationLoss = true;
    runState.orientation.suppressConnectionLoss = true;
    this.searchReadyToCommit =
      stepId === "search_open" ? false : this.searchReadyToCommit;
    this.computeReadyToCommit =
      stepId === "compute_open" || stepId === "compute_charge"
        ? false
        : this.computeReadyToCommit;
    this.searchPanelInstructionShown = false;
    this.computePanelInstructionShown = false;
    this.safetyPanelInstructionShown = false;
    this.lastProgressAt = this.scene.time.now;
    this.lastLockedReminderAt = Number.NEGATIVE_INFINITY;

    if (stepId === "coolant_use" || stepId === "coolant_interact") {
      this.scene.time.delayedCall(5000, () => {
        this.bindings.setHeat(ORIENTATION_COOLANT_HEAT_TARGET);
      });
      return;
    }

    if (stepId === "reality_cycle" || stepId === "reality_interact") {
      this.bindings.setHallucination(ORIENTATION_REALITY_HALLUCINATION_TARGET);
      return;
    }
  }

  private postLockedReminder(text: string) {
    if (this.bindings.isCommitLocked() || this.hasPendingTrainerMessage()) {
      return;
    }

    const now = this.scene.time.now;
    if (
      now - this.lastLockedReminderAt <
      ORIENTATION_LOCKED_ACTION_REMINDER_COOLDOWN_MS
    ) {
      return;
    }

    this.lastLockedReminderAt = now;
    this.lastProgressAt = now;
    this.dispatchTrainerMessage(text);
  }

  private dispatchTrainerActionMessage(text: string) {
    this.dispatchTrainerMessage(
      text,
      ORIENTATION_ACTION_TRAINER_MESSAGE_DELAY_MS,
    );
  }

  private dispatchTrainerMessage(text: string, delayMs: number = 0) {
    if (text.trim().length === 0) {
      return;
    }

    if (
      this.bindings.isTrainerMessageActive() ||
      this.pendingTrainerMessageTimer
    ) {
      const lastQueuedMessage =
        this.pendingTrainerMessages[this.pendingTrainerMessages.length - 1];
      if (!lastQueuedMessage || lastQueuedMessage.text !== text) {
        this.pendingTrainerMessages.push({ text, delayMs });
      }
      return;
    }

    this.postTrainerMessage({ text, delayMs });
  }

  private flushTrainerMessages() {
    if (
      this.bindings.isTrainerMessageActive() ||
      this.pendingTrainerMessageTimer
    ) {
      return;
    }

    const nextMessage = this.pendingTrainerMessages.shift();
    if (!nextMessage) {
      return;
    }

    this.postTrainerMessage(nextMessage);
  }

  private postTrainerMessage(message: PendingTrainerMessage) {
    const postMessage = () => {
      this.pendingTrainerMessageTimer = null;
      this.bindings.postTrainerMessage(message.text, () => {
        this.flushTrainerMessages();
      });
    };

    if (message.delayMs <= 0) {
      postMessage();
      return;
    }

    this.pendingTrainerMessageTimer = this.scene.time.delayedCall(
      message.delayMs,
      postMessage,
    );
  }

  private hasPendingTrainerMessage() {
    return (
      this.pendingTrainerMessages.length > 0 ||
      this.pendingTrainerMessageTimer !== null ||
      this.bindings.isTrainerMessageActive()
    );
  }

  private getStepInstructionText(stepId: OrientationStepId) {
    return getOrientationStepInstructionText(stepId);
  }

  private getStepPanelInstructionText(stepId: OrientationStepId) {
    return getOrientationStepPanelInstructionText(stepId);
  }

  private getStepCompletionMessage(stepId: OrientationStepId) {
    return getOrientationStepCompletionMessage(stepId);
  }

  private getStepFailureText(stepId: OrientationStepId | null) {
    if (!stepId) {
      return getOrientationStepFailureMessage("inference");
    }

    return getOrientationStepFailureMessage(stepId);
  }
}
