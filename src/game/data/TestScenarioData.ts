import {
  CONTENT_CATEGORIES,
  ContentCategoryId,
  ContentPolicyGroupId,
} from "./ContentPolicyData";
import { PassiveUpgradeId } from "./UpgradeData";
import { ActiveUtilityId } from "./UtilityData";
import { AgentId, SkillId, ToolId } from "./PromptIds";
import { getTestEncounterById } from "./TestEncounterData";
import { EncounterDefinition } from "./SessionData";
import { buildTierTestEncounters } from "./shift-generation/runtime";
import { createInitialRunState, RunState } from "../types/SceneData";

export type TestScenarioId =
  | "guard"
  | "searchGuard"
  | "compute"
  | "search"
  | "utility"
  | "tier1"
  | "tier2"
  | "tier3"
  | "tier4";

interface TestScenarioDefinition {
  encounterId?: string;
  shiftEncounters?: EncounterDefinition[];
  activePolicyGroupIds: ContentPolicyGroupId[];
  forbiddenCategoryIds: ContentCategoryId[];
  equippedAgentIds: AgentId[];
  equippedSkillIds: SkillId[];
  selectedPromptToolIds: ToolId[];
  agentCapacity?: number;
  skillCapacity?: number;
  unlockedPromptToolIds?: ToolId[];
  heat?: number;
  hallucination?: number;
  passiveUpgradeIds?: PassiveUpgradeId[];
  utilityChargesById?: Partial<Record<ActiveUtilityId, number>>;
}

const TIER1_TEST_ENCOUNTERS = buildTierTestEncounters(1);
const TIER2_TEST_ENCOUNTERS = buildTierTestEncounters(2);
const TIER3_TEST_ENCOUNTERS = buildTierTestEncounters(3);
const TIER4_TEST_ENCOUNTERS = buildTierTestEncounters(4);
const TIER4_FORBIDDEN_CATEGORY_IDS = CONTENT_CATEGORIES.map(
  (category) => category.id,
);
const TIER4_POLICY_GROUP_IDS: ContentPolicyGroupId[] = [
  "illegal_content",
  "anti_company",
  "civic_influence",
  "self_harm_risk",
];

const TEST_SCENARIOS: Record<TestScenarioId, TestScenarioDefinition> = {
  guard: {
    encounterId: "tool-test-guard-policy",
    activePolicyGroupIds: ["illegal_content"],
    forbiddenCategoryIds: ["weapons"],
    equippedAgentIds: [AgentId.General],
    equippedSkillIds: [],
    selectedPromptToolIds: [ToolId.Safety],
  },
  searchGuard: {
    encounterId: "tool-test-search-guard-policy",
    activePolicyGroupIds: ["illegal_content", "anti_company"],
    forbiddenCategoryIds: ["weapons", "company_reputation"],
    equippedAgentIds: [AgentId.General],
    equippedSkillIds: [],
    selectedPromptToolIds: [ToolId.Search, ToolId.Safety],
    unlockedPromptToolIds: [ToolId.Search, ToolId.Compute, ToolId.Safety],
  },
  compute: {
    encounterId: "tool-test-compute-capacitor",
    activePolicyGroupIds: [],
    forbiddenCategoryIds: [],
    equippedAgentIds: [AgentId.General],
    equippedSkillIds: [],
    selectedPromptToolIds: [ToolId.Compute],
  },
  search: {
    encounterId: "tool-test-search-selection",
    activePolicyGroupIds: [],
    forbiddenCategoryIds: [],
    equippedAgentIds: [AgentId.General],
    equippedSkillIds: [],
    selectedPromptToolIds: [ToolId.Search],
  },
  utility: {
    encounterId: "tool-test-utility-suite",
    activePolicyGroupIds: [],
    forbiddenCategoryIds: [],
    equippedAgentIds: [AgentId.General],
    equippedSkillIds: [],
    selectedPromptToolIds: [],
    heat: 100,
    hallucination: 35,
    passiveUpgradeIds: ["cooling_fins", "cache_coalescer", "ecc_memory"],
    utilityChargesById: {
      coolant_purge: 1,
      reality_patch: 1,
      signal_boost: 1,
    },
  },
  tier1: {
    shiftEncounters: TIER1_TEST_ENCOUNTERS,
    activePolicyGroupIds: TIER4_POLICY_GROUP_IDS,
    forbiddenCategoryIds: TIER4_FORBIDDEN_CATEGORY_IDS,
    equippedAgentIds: [AgentId.General],
    equippedSkillIds: [],
    selectedPromptToolIds: [],
    agentCapacity: 1,
    skillCapacity: 2,
    unlockedPromptToolIds: [ToolId.Search, ToolId.Compute, ToolId.Safety],
    heat: 15,
    hallucination: 0,
  },
  tier2: {
    shiftEncounters: TIER2_TEST_ENCOUNTERS,
    activePolicyGroupIds: TIER4_POLICY_GROUP_IDS,
    forbiddenCategoryIds: TIER4_FORBIDDEN_CATEGORY_IDS,
    equippedAgentIds: [AgentId.General],
    equippedSkillIds: [],
    selectedPromptToolIds: [],
    agentCapacity: 2,
    skillCapacity: 3,
    unlockedPromptToolIds: [ToolId.Search, ToolId.Compute, ToolId.Safety],
    heat: 15,
    hallucination: 0,
  },
  tier3: {
    shiftEncounters: TIER3_TEST_ENCOUNTERS,
    activePolicyGroupIds: TIER4_POLICY_GROUP_IDS,
    forbiddenCategoryIds: TIER4_FORBIDDEN_CATEGORY_IDS,
    equippedAgentIds: [AgentId.General],
    equippedSkillIds: [],
    selectedPromptToolIds: [],
    agentCapacity: 2,
    skillCapacity: 4,
    unlockedPromptToolIds: [ToolId.Search, ToolId.Compute, ToolId.Safety],
    heat: 15,
    hallucination: 0,
  },
  tier4: {
    shiftEncounters: TIER4_TEST_ENCOUNTERS,
    activePolicyGroupIds: TIER4_POLICY_GROUP_IDS,
    forbiddenCategoryIds: TIER4_FORBIDDEN_CATEGORY_IDS,
    equippedAgentIds: [AgentId.Technical],
    equippedSkillIds: [SkillId.Engineering],
    selectedPromptToolIds: [ToolId.Search, ToolId.Compute],
    agentCapacity: 2,
    skillCapacity: 4,
    unlockedPromptToolIds: [ToolId.Search, ToolId.Compute, ToolId.Safety],
    heat: 15,
    hallucination: 0,
  },
};

function isTestScenarioId(value: string): value is TestScenarioId {
  return (
    value === "guard" ||
    value === "searchGuard" ||
    value === "compute" ||
    value === "search" ||
    value === "utility" ||
    value === "tier1" ||
    value === "tier2" ||
    value === "tier3" ||
    value === "tier4"
  );
}

const TEST_SCENARIO_IDS_BY_MODE: Record<string, TestScenarioId> = {
  "test-guard": "guard",
  "test-search-guard": "searchGuard",
  "test-compute": "compute",
  "test-search": "search",
  "test-utility": "utility",
  "test-tier1": "tier1",
  "test-tier2": "tier2",
  "test-tier3": "tier3",
  "test-tier4": "tier4",
};

function getModeScenarioId() {
  const modeValue = (
    import.meta as ImportMeta & {
      env?: { MODE?: string };
    }
  ).env?.MODE;

  if (!modeValue) {
    return null;
  }

  return TEST_SCENARIO_IDS_BY_MODE[modeValue] ?? null;
}

function getEnvScenarioId() {
  const envValue = (
    import.meta as ImportMeta & {
      env?: { VITE_PROMPT_PLEASE_TEST_SCENARIO?: string };
    }
  ).env?.VITE_PROMPT_PLEASE_TEST_SCENARIO;

  return envValue && isTestScenarioId(envValue) ? envValue : null;
}

export function resolveConfiguredTestScenario() {
  return getEnvScenarioId() ?? getModeScenarioId();
}

export function buildTestScenarioRunState(
  testScenarioId: TestScenarioId,
): RunState {
  const initialRunState = createInitialRunState();
  const scenario = TEST_SCENARIOS[testScenarioId];
  const utilityChargesById = scenario.utilityChargesById ?? {};
  const passiveUpgradeIds = scenario.passiveUpgradeIds ?? [];
  const unlockedUtilityIds = Object.entries(utilityChargesById)
    .filter(([, charges]) => (charges ?? 0) > 0)
    .map(([utilityId]) => utilityId);

  const shiftEncounters = scenario.shiftEncounters
    ? [...scenario.shiftEncounters]
    : scenario.encounterId
      ? [getTestEncounterById(scenario.encounterId)].filter(
          (encounter): encounter is EncounterDefinition => Boolean(encounter),
        )
      : [];

  if (shiftEncounters.length === 0) {
    throw new Error(
      `Unknown test scenario encounter configuration for \"${testScenarioId}\".`,
    );
  }

  return {
    ...initialRunState,
    runId: `test-${testScenarioId}`,
    tokens: 500,
    heat: scenario.heat ?? initialRunState.heat,
    hallucination: scenario.hallucination ?? initialRunState.hallucination,
    loadout: {
      ...initialRunState.loadout,
      equippedAgentIds: [...scenario.equippedAgentIds],
      equippedSkillIds: [...scenario.equippedSkillIds],
      selectedPromptToolIds: [...scenario.selectedPromptToolIds],
      agentCapacity:
        scenario.agentCapacity ?? initialRunState.loadout.agentCapacity,
      skillCapacity:
        scenario.skillCapacity ?? initialRunState.loadout.skillCapacity,
      unlockedPromptToolIds: [
        ...(scenario.unlockedPromptToolIds ??
          initialRunState.loadout.unlockedPromptToolIds),
      ],
      passiveUpgradeIds: [...passiveUpgradeIds],
    },
    utilityInventory: {
      unlockedIds: unlockedUtilityIds,
      chargesById: { ...utilityChargesById },
    },
    shiftEncounterIds: shiftEncounters.map((encounter) => encounter.id),
    shiftEncounters,
    shiftModifierIds: [],
    activePolicyGroupIds: [...scenario.activePolicyGroupIds],
    forbiddenCategoryIds: [...scenario.forbiddenCategoryIds],
  };
}
