import { ContentCategoryId } from "./ContentPolicyData";
import { ActiveUtilityId } from "./UtilityData";
import { ToolId } from "../scenes/main/types";
import { createInitialRunState, RunState } from "../types/SceneData";

export type TestScenarioId = "guard" | "compute" | "search" | "utility";

interface TestScenarioDefinition {
  encounterId: string;
  forbiddenCategoryIds: ContentCategoryId[];
  equippedAgentIds: string[];
  equippedSkillIds: string[];
  selectedPromptToolIds: ToolId[];
  heat?: number;
  hallucination?: number;
  utilityChargesById?: Partial<Record<ActiveUtilityId, number>>;
}

const TEST_SCENARIOS: Record<TestScenarioId, TestScenarioDefinition> = {
  guard: {
    encounterId: "tool-test-guard-policy",
    forbiddenCategoryIds: ["weapons"],
    equippedAgentIds: ["General_Agent.md"],
    equippedSkillIds: [],
    selectedPromptToolIds: ["safety"],
  },
  compute: {
    encounterId: "tool-test-compute-capacitor",
    forbiddenCategoryIds: [],
    equippedAgentIds: ["General_Agent.md"],
    equippedSkillIds: [],
    selectedPromptToolIds: ["compute"],
  },
  search: {
    encounterId: "tool-test-search-selection",
    forbiddenCategoryIds: [],
    equippedAgentIds: ["General_Agent.md"],
    equippedSkillIds: [],
    selectedPromptToolIds: ["search"],
  },
  utility: {
    encounterId: "tool-test-utility-suite",
    forbiddenCategoryIds: [],
    equippedAgentIds: ["General_Agent.md"],
    equippedSkillIds: [],
    selectedPromptToolIds: [],
    heat: 60,
    hallucination: 35,
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
  const utilityChargesById = scenario.utilityChargesById ?? {};
  const unlockedUtilityIds = Object.entries(utilityChargesById)
    .filter(([, charges]) => (charges ?? 0) > 0)
    .map(([utilityId]) => utilityId);

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
    },
    utilityInventory: {
      unlockedIds: unlockedUtilityIds,
      chargesById: { ...utilityChargesById },
    },
    shiftEncounterIds: [scenario.encounterId],
    shiftModifierIds: [],
    forbiddenCategoryIds: [...scenario.forbiddenCategoryIds],
  };
}
