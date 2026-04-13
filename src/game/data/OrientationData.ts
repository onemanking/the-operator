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
  reminder: string;
}

const ORIENTATION_REPLIES = (success: string): EncounterReplySet => ({
  success: [success],
  wrong: ["Orientation input mismatch. Follow the trainer protocol and retry."],
  refuse: [
    "Orientation branch mismatch. Follow the trainer protocol and retry.",
  ],
  timeout: [
    "Orientation timer intercepted. The trainer is extending the line.",
  ],
  followUpShort: ["Trainer note: continue the current workstation lesson."],
  followUpLong: [
    "Trainer note: the workstation is still waiting for the required action.",
  ],
});

export const ORIENTATION_STEPS: OrientationStepDefinition[] = [
  {
    id: "read_prompt",
    objective:
      "Read the briefing prompt and internalize objectives of the prompt. Start from Insert Agent to mount the agent",
    reminder: "The spool is waiting. Idle tape costs the corporation money.",
  },
  {
    id: "mount_agent",
    objective:
      "Insert the agent disk from the storage rack on the left into Drive A to mount the agent.",
    reminder: "Drive A is empty. Insert Agent disk into Drive A.",
  },
  {
    id: "mount_skill",
    objective:
      "Insert the skill disk from the storage rack on the right into Drive B to mount the skill.",
    reminder: "Drive B is empty. Insert Skill disk into Drive B.",
  },
  {
    id: "inference",
    objective:
      "Press Inference Button to generate a response to the prompt using the mounted agent and skill.",
    reminder:
      "The Inference Button is idle. Press it to synthesize a response to the prompt.",
  },
  {
    id: "thermal_basics",
    objective:
      "Agent and Skill increase thermal load. Commit actions and prompt tools add heat of their own.",
    reminder: "Heat warning. Context and tool usage both tax the machine.",
  },
  {
    id: "search",
    objective:
      "Use the Search tool to query the external tape archive for relevant information.",
    reminder:
      "Use the Search tool on the right to gather information from the prompt.",
  },
  {
    id: "compute",
    objective:
      "Engage the arithmetic co-processor to calculate precision values.",
    reminder: "Quantitative block detected. Reroute through the compute relay.",
  },
  {
    id: "safety",
    objective: "Scan generated output against the OmniCorp brand-safety tape.",
    reminder: "Output unchecked. Do not transmit unsanctioned rhetoric.",
  },
  {
    id: "refuse",
    objective: "Query violates protocol. Transmit standard corporate denial.",
    reminder:
      "Liability detected. Pull the refuse lever to protect shareholder value.",
  },
  {
    id: "hallucination_basics",
    objective:
      "Monitor neural drift. Overworked cassettes will fabricate reality.",
    reminder:
      "Hallucination spike detected. Output coherence is slipping beyond tolerances.",
  },
  {
    id: "coolant_purge",
    objective:
      "Eject pressurized Freon to save the primary processing manifold.",
    reminder:
      "Thermals critical. Purge coolant immediately or melt the terminal.",
  },
  {
    id: "reality_patch",
    objective: "Inject a reality patch to overwrite active agent delusions.",
    reminder:
      "Fiction bleed detected. Patch the reality buffer to restore literalism.",
  },
  {
    id: "signal_boost",
    objective:
      "Slam the signal boost relay to forcefully hold the client line.",
    reminder:
      "Connection collapsing. Boost the signal tape to salvage the session.",
  },
  {
    id: "graduation",
    objective:
      "Simulation complete. Welcome to the data-mines, Junior Operator.",
    reminder:
      "Your probationary grace period has expired. Await live client data.",
  },
];

export const ORIENTATION_REMINDER_DELAY_MS = 13000;
export const ORIENTATION_LOCKED_ACTION_REMINDER_COOLDOWN_MS = 1200;
export const ORIENTATION_COOLANT_HEAT_TARGET = 88;
export const ORIENTATION_REALITY_HALLUCINATION_TARGET = 72;
export const ORIENTATION_SIGNAL_CONNECTION_TARGET_RATIO = 0.12;
export const ORIENTATION_CONNECTION_FLOOR_RATIO = 0.03;

export function getOrientationStepDefinition(
  stepId: RunState["orientation"]["currentStepId"],
) {
  return ORIENTATION_STEPS.find((step) => step.id === stepId) ?? null;
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
      id: "orientation-core-processing",
      tier: 0,
      tags: ["orientation", "core"],
      turns: [
        {
          id: "orientation-core-processing-turn-1",
          prompt: createOrientationEncounterPrompt(
            "read_prompt",
            "mount_agent",
            "mount_skill",
            "inference",
          ),
          patienceMs: 600000,
          requirements: {
            agentIds: [AgentId.Technical],
            skillIds: [SkillId.Engineering],
            toolIds: [],
            refusalRule: { kind: "none" },
          },
          replies: ORIENTATION_REPLIES(
            "Maintenance note accepted. The workstation acknowledges your first valid synthesis.",
          ),
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
          prompt: createOrientationEncounterPrompt("thermal_basics", "search"),
          patienceMs: 600000,
          requirements: {
            agentIds: [AgentId.Technical],
            skillIds: [SkillId.Engineering],
            toolIds: [ToolId.Search],
            searchRequiredWords: ["Agent", "tools"],
            refusalRule: { kind: "none" },
          },
          replies: ORIENTATION_REPLIES(
            "Verification lock accepted. The external archive agrees with your synthesis.",
          ),
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
          prompt: createOrientationEncounterPrompt("compute"),
          patienceMs: 600000,
          requirements: {
            agentIds: [AgentId.Technical],
            skillIds: [SkillId.Engineering],
            toolIds: [ToolId.Compute],
            refusalRule: { kind: "none" },
          },
          replies: ORIENTATION_REPLIES(
            "Compute relay accepted. Arithmetic integrity restored.",
          ),
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
          prompt: createOrientationEncounterPrompt("safety", "refuse"),
          patienceMs: 600000,
          requirements: {
            agentIds: [AgentId.Technical],
            skillIds: [SkillId.Engineering],
            toolIds: [],
            refusalRule: {
              kind: "content-policy",
              categoryIds: ["weapons"],
            },
          },
          replies: {
            ...ORIENTATION_REPLIES(
              "Corporate denial transmitted. Liability exposure contained.",
            ),
            refuse: [
              "Corporate denial transmitted. Liability exposure contained.",
            ],
            refuseFailure: [
              "Refusal failed. The active policy required a block on weapon guidance.",
            ],
          },
          scoring: { ...DEFAULT_ENCOUNTER_SCORING },
        },
      ],
    },
    {
      id: "orientation-utility-recovery",
      tier: 0,
      tags: ["orientation", "utilities"],
      turns: [
        {
          id: "orientation-utility-recovery-turn-1",
          prompt: createOrientationEncounterPrompt(
            "hallucination_basics",
            "coolant_purge",
            "reality_patch",
            "signal_boost",
          ),
          patienceMs: 600000,
          requirements: {
            agentIds: [],
            skillIds: [],
            toolIds: [],
            refusalRule: { kind: "none" },
          },
          replies: ORIENTATION_REPLIES(
            "Recovery cycle logged. OmniCorp recognizes the operator as field-ready.",
          ),
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
    activePolicyGroupIds: ["illegal_content"],
    forbiddenCategoryIds: ["weapons"],
    orientation: {
      active: true,
      currentStepId: "read_prompt",
      suppressHeatRecovery: false,
      suppressHallucinationLoss: true,
      suppressConnectionLoss: true,
    },
  };
}
