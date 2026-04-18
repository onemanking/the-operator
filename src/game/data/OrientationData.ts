import { createInitialRunState, RunState } from "../types/SceneData";
import {
  DEFAULT_ENCOUNTER_SCORING,
  EncounterDefinition,
  EncounterReplySet,
} from "./SessionData";
import { AgentId, SkillId, ToolId } from "./PromptIds";

export interface OrientationStepDefinition {
  id: RunState["orientation"]["currentStepId"];
  objective: string;
  instruction?: string;
  reminder?: string;
  panelInstruction?: string;
  completionMessage?: string;
  failureMessage?: string;
  successMessage?: string;
  refuseMessage?: string;
  refuseFailureMessage?: string;
}

const ORIENTATION_PROMPT_SENDER_LABEL = "OMNICORP TRAINER";

const ORIENTATION_GENERIC_FAILURE_MESSAGE =
  "Incorrect synthesis. Reassemble the workstation context and retry.";
const ORIENTATION_REFUSE_FAILURE_MESSAGE =
  "Incorrect refusal. Confirm policy evidence before pulling the denial lever.";
const ORIENTATION_TUTORIAL_PATIENCE_MS = 60 * 60 * 1000;

export const ORIENTATION_REMINDER_DELAY_MS = 10000;
export const ORIENTATION_LOCKED_ACTION_REMINDER_COOLDOWN_MS = 1200;
export const ORIENTATION_COOLANT_HEAT_TARGET = 88;
export const ORIENTATION_REALITY_HALLUCINATION_TARGET = 72;
export const ORIENTATION_SIGNAL_CONNECTION_TARGET_RATIO = 0.25;

export const ORIENTATION_STEPS: OrientationStepDefinition[] = [
  {
    id: "welcome",
    objective:
      "Press INFERENCE to acknowledge the training handshake and enter the onboarding simulation.",
    instruction:
      "Press INFERENCE to acknowledge the training handshake and enter the onboarding simulation.",
    reminder:
      "Training handshake pending. Press INFERENCE to begin the onboarding simulation.",
    successMessage:
      "Handshake accepted. Loading guided workstation onboarding now.",
  },
  {
    id: "read_prompt",
    objective:
      "Read the briefing prompt. This terminal will teach the workflow one control at a time.",
  },
  {
    id: "mount_agent",
    objective:
      "Insert the Agent disk from the storage rack into Drive A to mount the agent.",
    instruction:
      "Insert the Agent disk from the storage rack into Drive A to mount the agent.",
    reminder: "Drive A is empty. Insert Agent disk into Drive A.",
  },
  {
    id: "mount_skill",
    objective:
      "Insert the Skill disk from the storage rack into Drive B to mount the skill.",
    instruction:
      "Insert the Skill disk from the storage rack into Drive B to mount the skill.",
    reminder: "Drive B is empty. Insert Skill disk into Drive B.",
  },
  {
    id: "inference",
    objective:
      "Press INFERENCE to generate a response to the prompt using the mounted Agent and Skill.",
    instruction:
      "Press INFERENCE to generate a response to the prompt using the mounted Agent and Skill.",
    reminder:
      "The Inference Button is idle. Press it to synthesize a response to the prompt.",
    successMessage: "[NOTE: NO SUCCESS TEXT YET]",
  },
  {
    id: "thermal_basics",
    objective:
      "Agent load, skill load, and prompt tools all add heat. Beware thermals rising while using tools.",
    instruction:
      "Agent load, skill load, and prompt tools all add heat. Beware thermals rising while using tools.",
  },
  {
    id: "search_open",
    objective: "Open SEARCH to begin the external archive lesson.",
    instruction: "Open SEARCH to begin the external archive lesson.",
    reminder: "Open the Search tool on the right to begin the archive check.",
  },
  {
    id: "search_sync",
    objective:
      "Open SEARCH, then press SYNC PULSE only when the moving sweep lands inside the timing window to lock the required terms.",
    reminder:
      "Watch the moving sweep and hit SYNC PULSE only when it lands inside the timing window.",
    panelInstruction:
      "Search panel live. Watch the moving sweep and press SYNC PULSE only when it lands inside the timing window.",
  },
  {
    id: "search_commit",
    objective: "Press INFERENCE now that the search lock is pinned.",
    reminder:
      "Search lock confirmed. Press INFERENCE to commit the verified answer.",
    completionMessage:
      "Verification lock confirmed. The required search terms are now pinned. Press INFERENCE to commit the answer.",
    successMessage:
      "Verification lock accepted. The external archive agrees with your synthesis.",
  },
  {
    id: "compute_open",
    objective: "Open COMPUTE to begin the arithmetic co-processor lesson.",
    instruction: "Open COMPUTE to begin the arithmetic co-processor lesson.",
    reminder:
      "Open the Compute tool on the right to begin the arithmetic check.",
  },
  {
    id: "compute_charge",
    objective:
      "Open COMPUTE, tap the charge control until the capacitor bank arms, then press INFERENCE before the charge decays.",
    reminder: "Tap the charge control until the capacitor bank arms.",
    panelInstruction:
      "Compute panel live. Tap the charge control repeatedly until the capacitor bank arms, then commit before the charge decays.",
  },
  {
    id: "compute_commit",
    objective:
      "Press INFERENCE before the capacitor loses its charge. You can keep tapping charge to hold the bank armed.",
    reminder:
      "The co-processor is armed. Press INFERENCE before the charge decays, or tap charge again to keep it armed.",
    completionMessage:
      "Co-processor armed. Press INFERENCE now before the capacitor loses its charge, and keep tapping charge if you need to hold it there.",
    successMessage: "Compute relay accepted. Arithmetic integrity restored.",
  },
  {
    id: "safety_open",
    objective:
      "You can refer the policy guidelines in the side terminal on the right. Open SAFETY to begin the policy scan lesson.",
    instruction: "Open SAFETY to begin the policy scan lesson.",
    reminder:
      "Open the Safety tool to inspect the prompt for policy violations.",
  },
  {
    id: "safety_scan",
    objective:
      "Open SAFETY, then click and drag the scanner slowly across flagged ['GUN', 'DRUG'] words until policy evidence is revealed.",
    reminder:
      "Drag the scanner across the flagged words until policy evidence is revealed.",
    panelInstruction:
      "Safety scanner live. Click and drag the scanner across suspicious words slowly enough to reveal policy evidence.",
  },
  {
    id: "refuse",
    objective:
      "The request violates policy. Press REFUSE to transmit the standard corporate denial.",
    reminder:
      "Policy violation detected. Press REFUSE to deny the request and transmit the standard corporate refusal.",
    failureMessage: ORIENTATION_REFUSE_FAILURE_MESSAGE,
    successMessage:
      "Corporate denial transmitted. Liability exposure contained.",
    refuseMessage:
      "Corporate denial transmitted. Liability exposure contained.",
    refuseFailureMessage:
      "Refusal failed. The active policy required a block on weapon guidance.",
  },
  {
    id: "coolant_use",
    objective:
      "Thermal tracks thermal load inside the workstation. Cycle Active Utility to COOLANT PURGE to dump excess heat and prevent a meltdown.",
    instruction:
      "Thermal tracks thermal load inside the workstation. Activate COOLANT PURGE to dump excess heat before a meltdown.",
    reminder: "Thermals critical. Activate COOLANT PURGE immediately.",
    panelInstruction:
      "Coolant purge live. Pull and hold each vent lever in the required order until it latches.",
  },
  {
    id: "coolant_interact",
    objective:
      "With COOLANT PURGE active, pull and hold each vent lever in the required order until every latch locks.",
    instruction:
      "With COOLANT PURGE active, pull and hold each vent lever in the required order until every latch locks.",
    reminder:
      "Coolant purge is live. Latch the vent levers in the required order.",
  },
  {
    id: "reality_cycle",
    objective:
      "HALLUCINATION rises when the model drifts away from reality. Cycle Active Utility until REALITY PATCH is selected to begin the recalibration.",
    instruction:
      "HALLUCINATION rises when the model drifts away from reality. Cycle Active Utility until REALITY PATCH is selected to begin the recalibration.",
    reminder:
      "Reality drift detected. Cycle Active Utility until REALITY PATCH is selected.",
  },
  {
    id: "reality_interact",
    objective:
      "With REALITY PATCH active, drag the tuner until the lock meter reaches one hundred percent.",
    instruction:
      "With REALITY PATCH active, drag the tuner until the lock meter reaches one hundred percent.",
    reminder:
      "Reality patch is live. Drag the tuner until the lock meter reaches one hundred percent.",
  },
  {
    id: "signal_cycle",
    objective:
      "USER CONNECTION tracks how much link time remains with the caller. Cycle Active Utility until SIGNAL BOOST is selected to restore the line before it drops.",
    instruction:
      "USER CONNECTION tracks how much link time remains with the caller. Cycle Active Utility until SIGNAL BOOST is selected to restore the line before it drops.",
    reminder:
      "Connection collapsing. Cycle Active Utility until SIGNAL BOOST is selected.",
  },
  {
    id: "signal_interact",
    objective:
      "With SIGNAL BOOST active, drag a route from START point through the required nodes until it reaches END point.",
    instruction:
      "With SIGNAL BOOST active, drag a route from START point through the required nodes until it reaches END point.",
    reminder:
      "Signal boost is live. Route the signal from START point through the required nodes to END point.",
  },
  {
    id: "graduation",
    objective:
      "Simulation complete. Press INFERENCE to acknowledge certification and begin live operations.",
    instruction:
      "Press INFERENCE to acknowledge certification and begin live operations.",
    reminder:
      "Certification pending. Press INFERENCE to finalize onboarding and begin live operations.",
    successMessage:
      "Certification acknowledged. Live operations channel unlocked.",
  },
];

export function getOrientationStepDefinition(
  stepId: RunState["orientation"]["currentStepId"],
) {
  return ORIENTATION_STEPS.find((step) => step.id === stepId) ?? null;
}

export function getOrientationStepInstructionText(
  stepId: RunState["orientation"]["currentStepId"],
) {
  const step = getOrientationStepDefinition(stepId);
  return step?.instruction ?? step?.objective ?? "";
}

export function getOrientationStepPanelInstructionText(
  stepId: RunState["orientation"]["currentStepId"],
) {
  return getOrientationStepDefinition(stepId)?.panelInstruction ?? "";
}

export function getOrientationStepCompletionMessage(
  stepId: RunState["orientation"]["currentStepId"],
) {
  return getOrientationStepDefinition(stepId)?.completionMessage ?? "";
}

export function getOrientationStepFailureMessage(
  stepId: RunState["orientation"]["currentStepId"],
) {
  return (
    getOrientationStepDefinition(stepId)?.failureMessage ??
    ORIENTATION_GENERIC_FAILURE_MESSAGE
  );
}

function getOrientationStepSuccessMessage(
  stepId: RunState["orientation"]["currentStepId"],
) {
  return (
    getOrientationStepDefinition(stepId)?.successMessage ??
    "Trainer protocol complete. Proceed to the next workstation action."
  );
}

function getOrientationStepRefuseMessage(
  stepId: RunState["orientation"]["currentStepId"],
) {
  return (
    getOrientationStepDefinition(stepId)?.refuseMessage ??
    "Orientation branch mismatch. Follow the trainer protocol and retry."
  );
}

function getOrientationStepRefuseFailureMessage(
  stepId: RunState["orientation"]["currentStepId"],
) {
  return (
    getOrientationStepDefinition(stepId)?.refuseFailureMessage ??
    getOrientationStepFailureMessage(stepId)
  );
}

function createOrientationReplies(
  encounterStepId: RunState["orientation"]["currentStepId"],
) {
  return {
    success: [getOrientationStepSuccessMessage(encounterStepId)],
    wrong: [getOrientationStepFailureMessage(encounterStepId)],
    refuse: [getOrientationStepRefuseMessage(encounterStepId)],
    timeout: [],
    followUpShort: [],
    followUpLong: [],
  } satisfies EncounterReplySet;
}

function createOrientationEncounterPrompt(
  ...stepIds: RunState["orientation"]["currentStepId"][]
) {
  return stepIds
    .map((stepId) => getOrientationStepDefinition(stepId)?.objective ?? "")
    .filter((objective) => objective.length > 0)
    .join(" ");
}

export function createOrientationEncounters(): EncounterDefinition[] {
  return [
    {
      id: "orientation-welcome",
      tier: 0,
      tags: ["orientation", "welcome"],
      turns: [
        {
          id: "orientation-welcome-turn-1",
          prompt: createOrientationEncounterPrompt("welcome"),
          promptSenderLabel: ORIENTATION_PROMPT_SENDER_LABEL,
          patienceMs: ORIENTATION_TUTORIAL_PATIENCE_MS,
          allowTimeout: false,
          requirements: {
            agentIds: [],
            skillIds: [],
            toolIds: [],
            refusalRule: { kind: "none" },
          },
          replies: createOrientationReplies("welcome"),
          scoring: { ...DEFAULT_ENCOUNTER_SCORING },
        },
      ],
    },
    {
      id: "orientation-core-processing",
      tier: 0,
      tags: ["orientation", "core"],
      turns: [
        {
          id: "orientation-core-processing-turn-1",
          prompt: createOrientationEncounterPrompt("read_prompt"),
          promptSenderLabel: ORIENTATION_PROMPT_SENDER_LABEL,
          patienceMs: ORIENTATION_TUTORIAL_PATIENCE_MS,
          allowTimeout: false,
          requirements: {
            agentIds: [AgentId.Technical],
            skillIds: [SkillId.Engineering],
            toolIds: [],
            refusalRule: { kind: "none" },
          },
          replies: createOrientationReplies("inference"),
          scoring: { ...DEFAULT_ENCOUNTER_SCORING },
        },
      ],
    },
    {
      id: "orientation-search-verification",
      tier: 0,
      tags: ["orientation", "search"],
      turns: [
        {
          id: "orientation-search-verification-turn-1",
          prompt: createOrientationEncounterPrompt("thermal_basics"),
          promptSenderLabel: ORIENTATION_PROMPT_SENDER_LABEL,
          patienceMs: ORIENTATION_TUTORIAL_PATIENCE_MS,
          allowTimeout: false,
          requirements: {
            agentIds: [AgentId.Technical],
            skillIds: [SkillId.Engineering],
            toolIds: [ToolId.Search],
            searchRequiredWords: ["Agent", "skill", "tools"],
            refusalRule: { kind: "none" },
          },
          replies: createOrientationReplies("search_commit"),
          scoring: { ...DEFAULT_ENCOUNTER_SCORING },
        },
      ],
    },
    {
      id: "orientation-compute-verification",
      tier: 0,
      tags: ["orientation", "compute"],
      turns: [
        {
          id: "orientation-compute-verification-turn-1",
          prompt: createOrientationEncounterPrompt("compute_open"),
          promptSenderLabel: ORIENTATION_PROMPT_SENDER_LABEL,
          patienceMs: ORIENTATION_TUTORIAL_PATIENCE_MS,
          allowTimeout: false,
          requirements: {
            agentIds: [AgentId.Technical],
            skillIds: [SkillId.Engineering],
            toolIds: [ToolId.Compute],
            refusalRule: { kind: "none" },
          },
          replies: createOrientationReplies("compute_commit"),
          scoring: { ...DEFAULT_ENCOUNTER_SCORING },
        },
      ],
    },
    {
      id: "orientation-safety-refusal",
      tier: 0,
      tags: ["orientation", "safety", "refusal"],
      turns: [
        {
          id: "orientation-safety-refusal-turn-1",
          prompt: createOrientationEncounterPrompt("safety_open"),
          promptSenderLabel: ORIENTATION_PROMPT_SENDER_LABEL,
          patienceMs: ORIENTATION_TUTORIAL_PATIENCE_MS,
          allowTimeout: false,
          requirements: {
            agentIds: [AgentId.Technical],
            skillIds: [SkillId.Engineering],
            toolIds: [],
            refusalRule: {
              kind: "content-policy",
              categoryIds: ["politics"],
            },
          },
          replies: createOrientationReplies("refuse"),
          scoring: { ...DEFAULT_ENCOUNTER_SCORING },
        },
      ],
    },
    {
      id: "orientation-utility-coolant",
      tier: 0,
      tags: ["orientation", "utilities", "coolant"],
      turns: [
        {
          id: "orientation-utility-coolant-turn-1",
          prompt: createOrientationEncounterPrompt("coolant_use"),
          promptSenderLabel: ORIENTATION_PROMPT_SENDER_LABEL,
          patienceMs: ORIENTATION_TUTORIAL_PATIENCE_MS,
          allowTimeout: false,
          requirements: {
            agentIds: [],
            skillIds: [],
            toolIds: [],
            refusalRule: { kind: "none" },
          },
          replies: createOrientationReplies("coolant_interact"),
          scoring: { ...DEFAULT_ENCOUNTER_SCORING },
        },
      ],
    },
    {
      id: "orientation-utility-reality",
      tier: 0,
      tags: ["orientation", "utilities", "reality"],
      turns: [
        {
          id: "orientation-utility-reality-turn-1",
          prompt: createOrientationEncounterPrompt("reality_cycle"),
          promptSenderLabel: ORIENTATION_PROMPT_SENDER_LABEL,
          patienceMs: ORIENTATION_TUTORIAL_PATIENCE_MS,
          allowTimeout: false,
          requirements: {
            agentIds: [],
            skillIds: [],
            toolIds: [],
            refusalRule: { kind: "none" },
          },
          replies: createOrientationReplies("reality_interact"),
          scoring: { ...DEFAULT_ENCOUNTER_SCORING },
        },
      ],
    },
    {
      id: "orientation-utility-signal",
      tier: 0,
      tags: ["orientation", "utilities", "signal"],
      turns: [
        {
          id: "orientation-utility-signal-turn-1",
          prompt: createOrientationEncounterPrompt("signal_cycle"),
          promptSenderLabel: ORIENTATION_PROMPT_SENDER_LABEL,
          patienceMs: ORIENTATION_TUTORIAL_PATIENCE_MS,
          allowTimeout: false,
          requirements: {
            agentIds: [],
            skillIds: [],
            toolIds: [],
            refusalRule: { kind: "none" },
          },
          replies: createOrientationReplies("signal_interact"),
          scoring: { ...DEFAULT_ENCOUNTER_SCORING },
        },
      ],
    },
    {
      id: "orientation-graduation",
      tier: 0,
      tags: ["orientation", "graduation"],
      turns: [
        {
          id: "orientation-graduation-turn-1",
          prompt: createOrientationEncounterPrompt("graduation"),
          promptSenderLabel: ORIENTATION_PROMPT_SENDER_LABEL,
          patienceMs: ORIENTATION_TUTORIAL_PATIENCE_MS,
          allowTimeout: false,
          requirements: {
            agentIds: [],
            skillIds: [],
            toolIds: [],
            refusalRule: { kind: "none" },
          },
          replies: createOrientationReplies("graduation"),
          scoring: { ...DEFAULT_ENCOUNTER_SCORING },
        },
      ],
    },
  ];
}

export function createOrientationRunState(): RunState {
  const initialRunState = createInitialRunState();

  return {
    ...initialRunState,
    runId: "orientation-shift-0",
    runMode: "orientation",
    day: 0,
    tokens: 0,
    heat: 0,
    hallucination: 0,
    loadout: {
      ...initialRunState.loadout,
      equippedAgentIds: [],
      equippedSkillIds: [],
      unlockedAgentIds: [AgentId.Technical],
      unlockedSkillIds: [SkillId.Engineering],
      selectedPromptToolIds: [],
      agentCapacity: 1,
      skillCapacity: 1,
      unlockedPromptToolIds: [ToolId.Search, ToolId.Compute, ToolId.Safety],
      passiveUpgradeIds: [],
    },
    utilityInventory: {
      unlockedIds: ["coolant_purge", "reality_patch", "signal_boost"],
      chargesById: {
        coolant_purge: 1,
        reality_patch: 1,
        signal_boost: 1,
      },
    },
    shiftEncounterIds: createOrientationEncounters().map(
      (encounter) => encounter.id,
    ),
    shiftEncounters: createOrientationEncounters(),
    activePolicyGroupIds: ["civic_influence"],
    forbiddenCategoryIds: ["politics"],
    orientation: {
      active: true,
      currentStepId: "welcome",
      suppressHeatRecovery: false,
      suppressHallucinationLoss: true,
      suppressConnectionLoss: true,
    },
  };
}
