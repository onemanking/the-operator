import { ContentCategoryId, ContentPolicyGroupId } from "./ContentPolicyData";
import { PassiveUpgradeId } from "./UpgradeData";
import { ActiveUtilityId } from "./UtilityData";
import { AgentId, SkillId, ToolId } from "./PromptIds";
import { getTestEncounterById } from "./TestEncounterData";
import { createInitialRunState, RunState } from "../types/SceneData";

export type TestScenarioId = "guard" | "compute" | "search" | "utility";

interface TestScenarioDefinition {
  encounterId: string;
  activePolicyGroupIds: ContentPolicyGroupId[];
  forbiddenCategoryIds: ContentCategoryId[];
  equippedAgentIds: AgentId[];
  equippedSkillIds: SkillId[];
  selectedPromptToolIds: ToolId[];
  heat?: number;
  hallucination?: number;
  passiveUpgradeIds?: PassiveUpgradeId[];
  utilityChargesById?: Partial<Record<ActiveUtilityId, number>>;
}

const TEST_SCENARIOS: Record<TestScenarioId, TestScenarioDefinition> = {
  guard: {
    encounterId: "tool-test-guard-policy",
    activePolicyGroupIds: ["illegal_content"],
    forbiddenCategoryIds: ["weapons"],
    equippedAgentIds: [AgentId.General],
    equippedSkillIds: [],
    selectedPromptToolIds: [ToolId.Safety],
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
};

function isTestScenarioId(value: string): value is TestScenarioId {
  return (
    value === "guard" ||
    value === "compute" ||
    value === "search" ||
    value === "utility"
  );
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
  return getEnvScenarioId();
}

export function buildTestScenarioRunState(
  testScenarioId: TestScenarioId,
): RunState {
  const initialRunState = createInitialRunState();
  const scenario = TEST_SCENARIOS[testScenarioId];
  const encounter = getTestEncounterById(scenario.encounterId);
  const utilityChargesById = scenario.utilityChargesById ?? {};
  const passiveUpgradeIds = scenario.passiveUpgradeIds ?? [];
  const unlockedUtilityIds = Object.entries(utilityChargesById)
    .filter(([, charges]) => (charges ?? 0) > 0)
    .map(([utilityId]) => utilityId);

  if (!encounter) {
    throw new Error(
      `Unknown test scenario encounter id \"${scenario.encounterId}\".`,
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
      passiveUpgradeIds: [...passiveUpgradeIds],
    },
    utilityInventory: {
      unlockedIds: unlockedUtilityIds,
      chargesById: { ...utilityChargesById },
    },
    shiftEncounterIds: [scenario.encounterId],
    shiftEncounters: [encounter],
    shiftModifierIds: [],
    activePolicyGroupIds: [...scenario.activePolicyGroupIds],
    forbiddenCategoryIds: [...scenario.forbiddenCategoryIds],
  };
}
