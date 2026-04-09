import { ContentCategoryId } from "./ContentPolicyData";
import { ToolId } from "../scenes/main/types";
import { createInitialRunState, RunState } from "../types/SceneData";

export type TestScenarioId = "guard" | "compute" | "search";

interface TestScenarioDefinition {
  encounterId: string;
  forbiddenCategoryIds: ContentCategoryId[];
  equippedAgentIds: string[];
  equippedSkillIds: string[];
  selectedPromptToolIds: ToolId[];
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
};

function isTestScenarioId(value: string): value is TestScenarioId {
  return value === "guard" || value === "compute" || value === "search";
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

  return {
    ...initialRunState,
    runId: `test-${testScenarioId}`,
    tokens: 500,
    loadout: {
      ...initialRunState.loadout,
      equippedAgentIds: [...scenario.equippedAgentIds],
      equippedSkillIds: [...scenario.equippedSkillIds],
      selectedPromptToolIds: [...scenario.selectedPromptToolIds],
    },
    shiftEncounterIds: [scenario.encounterId],
    shiftModifierIds: [],
    forbiddenCategoryIds: [...scenario.forbiddenCategoryIds],
  };
}
