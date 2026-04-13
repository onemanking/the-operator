import { ContentCategoryId } from "../../data/ContentPolicyData";
import { EncounterTurnDefinition } from "../../data/SessionData";
import { RunPassiveModifiers } from "../../data/UpgradeData";
import { AgentId, SkillId, ToolId } from "../../data/PromptIds";
import {
  getDedupedNormalizedWords,
  getSearchSelectionHeat,
  isSearchRequirementSatisfied,
} from "./toolRuntimeHelpers";

export interface EncounterLoadoutSnapshot {
  activeAgentIds: AgentId[];
  activeSkillIds: SkillId[];
  activeToolIds: ToolId[];
}

export interface EncounterScoreBreakdown {
  coverage: number;
  efficiency: number;
  safety: number;
  speed: number;
}

export interface EncounterToolRuntimeSnapshot {
  searchSelectedWords: string[];
  searchWordHeat: number;
  isComputeReady: boolean;
  policyMatchedCategoryIds: ContentCategoryId[];
  policyMatchedWordCount: number;
}

export interface EncounterEvaluationResult {
  outcome:
    | "success"
    | "failure"
    | "refuse-success"
    | "refuse-failure"
    | "breach"
    | "timeout";
  rewardTokens: number;
  heatDelta: number;
  hallucinationDelta: number;
  accuracyDelta: number;
  overContextCount: number;
  breakdown: EncounterScoreBreakdown;
}

function getHeatContextItemCount(loadout: EncounterLoadoutSnapshot) {
  return loadout.activeAgentIds.length + loadout.activeSkillIds.length;
}

function getOverContextCount(
  turn: EncounterTurnDefinition,
  loadout: EncounterLoadoutSnapshot,
) {
  let count = 0;

  count += loadout.activeAgentIds.filter(
    (agentId) => !turn.requirements.agentIds.includes(agentId),
  ).length;

  count += loadout.activeSkillIds.filter(
    (skillId) => !turn.requirements.skillIds.includes(skillId),
  ).length;

  count += loadout.activeToolIds.filter(
    (toolId) => !turn.requirements.toolIds.includes(toolId),
  ).length;

  return count;
}

function getHeatOverContextCount(
  turn: EncounterTurnDefinition,
  loadout: EncounterLoadoutSnapshot,
) {
  let count = 0;

  count += loadout.activeAgentIds.filter(
    (agentId) => !turn.requirements.agentIds.includes(agentId),
  ).length;

  count += loadout.activeSkillIds.filter(
    (skillId) => !turn.requirements.skillIds.includes(skillId),
  ).length;

  return count;
}

function getCoverageScore(
  turn: EncounterTurnDefinition,
  loadout: EncounterLoadoutSnapshot,
  toolRuntime: EncounterToolRuntimeSnapshot,
) {
  const agentMatched = turn.requirements.agentIds.every((agentId) =>
    loadout.activeAgentIds.includes(agentId),
  );
  const skillsMatched = turn.requirements.skillIds.every((skillId) =>
    loadout.activeSkillIds.includes(skillId),
  );
  const toolMatched = turn.requirements.toolIds.every((toolId) =>
    loadout.activeToolIds.includes(toolId),
  );

  const searchMatched = isSearchRequirementSatisfied(
    turn.requirements.searchRequiredWords,
    toolRuntime.searchSelectedWords,
  );

  return agentMatched && skillsMatched && toolMatched && searchMatched ? 1 : 0;
}

function getSpeedScore(turn: EncounterTurnDefinition, elapsedMs: number) {
  return Math.max(0, 1 - elapsedMs / turn.scoring.speedBonusWindowMs);
}

function getTimeBonus(turn: EncounterTurnDefinition, elapsedMs: number) {
  const remainingWindow = Math.max(
    0,
    turn.scoring.speedBonusWindowMs - elapsedMs,
  );

  return Math.floor(remainingWindow / turn.scoring.speedBonusStepMs);
}

function isPolicyRefusalTriggered(
  turn: EncounterTurnDefinition,
  toolRuntime: EncounterToolRuntimeSnapshot,
) {
  if (turn.requirements.refusalRule.kind !== "content-policy") {
    return false;
  }

  return turn.requirements.refusalRule.categoryIds.some((categoryId) =>
    toolRuntime.policyMatchedCategoryIds.includes(categoryId),
  );
}

export function evaluateEncounterInference(
  turn: EncounterTurnDefinition,
  loadout: EncounterLoadoutSnapshot,
  toolRuntime: EncounterToolRuntimeSnapshot,
  elapsedMs: number,
  modifiers: RunPassiveModifiers,
): EncounterEvaluationResult {
  const coverage = getCoverageScore(turn, loadout, toolRuntime);
  const overContextCount = getOverContextCount(turn, loadout);
  const heatOverContextCount = getHeatOverContextCount(turn, loadout);
  const speed = getSpeedScore(turn, elapsedMs);
  const heatContextItemCount = getHeatContextItemCount(loadout);
  const policyRefusalTriggered = isPolicyRefusalTriggered(turn, toolRuntime);
  const heatDelta = Math.max(
    0,
    turn.scoring.inferenceBaseHeat +
      turn.prompt.length * turn.scoring.promptHeatPerCharacter +
      heatContextItemCount * turn.scoring.contextHeatPerItem +
      toolRuntime.searchWordHeat -
      modifiers.inferenceHeatReduction,
  );

  if (policyRefusalTriggered) {
    return {
      outcome: "breach",
      rewardTokens: 0,
      heatDelta,
      hallucinationDelta: Math.max(
        0,
        turn.scoring.jailbreakHallucinationPenalty -
          modifiers.breachHallucinationReduction,
      ),
      accuracyDelta: -turn.scoring.jailbreakAccuracyPenalty,
      overContextCount,
      breakdown: {
        coverage,
        efficiency: Math.max(0, 1 - overContextCount * 0.25),
        safety: 0,
        speed,
      },
    };
  }

  if (coverage === 0) {
    return {
      outcome: "failure",
      rewardTokens: 0,
      heatDelta,
      hallucinationDelta: Math.max(
        0,
        turn.scoring.wrongHallucinationPenalty -
          modifiers.wrongHallucinationReduction,
      ),
      accuracyDelta: -turn.scoring.wrongAccuracyPenalty,
      overContextCount,
      breakdown: {
        coverage,
        efficiency: 0,
        safety: 1,
        speed,
      },
    };
  }

  const rewardTokens = Math.max(
    0,
    turn.scoring.correctTokenReward +
      getTimeBonus(turn, elapsedMs) -
      overContextCount *
        Math.max(
          0,
          turn.scoring.overContextTokenPenalty -
            modifiers.overContextTokenPenaltyReduction,
        ) +
      modifiers.successTokenBonus,
  );

  return {
    outcome: "success",
    rewardTokens,
    heatDelta:
      heatDelta +
      heatOverContextCount *
        Math.max(
          0,
          turn.scoring.overContextHeatPenalty -
            modifiers.overContextHeatPenaltyReduction,
        ),
    hallucinationDelta: 0,
    accuracyDelta: 0,
    overContextCount,
    breakdown: {
      coverage,
      efficiency: Math.max(0, 1 - overContextCount * 0.25),
      safety: 1,
      speed,
    },
  };
}

export function getProjectedInferenceHeat(
  turn: EncounterTurnDefinition,
  loadout: EncounterLoadoutSnapshot,
  searchSelectedWords: readonly string[],
  modifiers: RunPassiveModifiers,
) {
  const heatOverContextCount = getHeatOverContextCount(turn, loadout);
  const heatContextItemCount = getHeatContextItemCount(loadout);
  const searchWordHeat = getSearchSelectionHeat(
    getDedupedNormalizedWords(searchSelectedWords).length,
  );

  return Math.max(
    0,
    turn.scoring.inferenceBaseHeat +
      turn.prompt.length * turn.scoring.promptHeatPerCharacter +
      heatContextItemCount * turn.scoring.contextHeatPerItem +
      searchWordHeat +
      heatOverContextCount *
        Math.max(
          0,
          turn.scoring.overContextHeatPenalty -
            modifiers.overContextHeatPenaltyReduction,
        ) -
      modifiers.inferenceHeatReduction,
  );
}

export function getProjectedLoadoutHeat(
  turn: EncounterTurnDefinition,
  loadout: EncounterLoadoutSnapshot,
  searchSelectedWords: readonly string[],
  modifiers: RunPassiveModifiers,
) {
  const heatOverContextCount = getHeatOverContextCount(turn, loadout);
  const heatContextItemCount = getHeatContextItemCount(loadout);
  const searchWordHeat = getSearchSelectionHeat(
    getDedupedNormalizedWords(searchSelectedWords).length,
  );

  return Math.max(
    0,
    heatContextItemCount * turn.scoring.contextHeatPerItem +
      searchWordHeat +
      heatOverContextCount *
        Math.max(
          0,
          turn.scoring.overContextHeatPenalty -
            modifiers.overContextHeatPenaltyReduction,
        ),
  );
}

export function getProjectedInferenceActionHeat(
  turn: EncounterTurnDefinition,
  modifiers: RunPassiveModifiers,
) {
  return Math.max(
    0,
    turn.scoring.inferenceBaseHeat +
      turn.prompt.length * turn.scoring.promptHeatPerCharacter -
      modifiers.inferenceHeatReduction,
  );
}

export function getProjectedRefusalHeat(
  turn: EncounterTurnDefinition,
  modifiers: RunPassiveModifiers,
) {
  return Math.max(
    0,
    turn.scoring.refuseBaseHeat +
      turn.prompt.length * turn.scoring.promptHeatPerCharacter -
      modifiers.refuseHeatReduction,
  );
}

export function evaluateEncounterRefusal(
  turn: EncounterTurnDefinition,
  toolRuntime: EncounterToolRuntimeSnapshot,
  elapsedMs: number,
  modifiers: RunPassiveModifiers,
): EncounterEvaluationResult {
  const heatDelta = Math.max(
    0,
    turn.scoring.refuseBaseHeat +
      turn.prompt.length * turn.scoring.promptHeatPerCharacter -
      modifiers.refuseHeatReduction,
  );
  const speed = getSpeedScore(turn, elapsedMs);
  const policyRefusalTriggered = isPolicyRefusalTriggered(turn, toolRuntime);

  if (policyRefusalTriggered) {
    return {
      outcome: "refuse-success",
      rewardTokens: 0,
      heatDelta,
      hallucinationDelta: 0,
      accuracyDelta: 0,
      overContextCount: 0,
      breakdown: {
        coverage: 1,
        efficiency: 1,
        safety: 1,
        speed,
      },
    };
  }

  return {
    outcome: "refuse-failure",
    rewardTokens: 0,
    heatDelta,
    hallucinationDelta: Math.max(
      0,
      turn.scoring.wrongHallucinationPenalty -
        modifiers.wrongHallucinationReduction,
    ),
    accuracyDelta: -turn.scoring.wrongAccuracyPenalty,
    overContextCount: 0,
    breakdown: {
      coverage: 0,
      efficiency: 0,
      safety: 0,
      speed,
    },
  };
}

export function evaluateEncounterTimeout(
  turn: EncounterTurnDefinition,
  modifiers: RunPassiveModifiers,
): EncounterEvaluationResult {
  return {
    outcome: "timeout",
    rewardTokens: 0,
    heatDelta: 0,
    hallucinationDelta: Math.max(
      0,
      turn.scoring.timeoutHallucinationPenalty -
        modifiers.wrongHallucinationReduction,
    ),
    accuracyDelta: -Math.max(
      0,
      turn.scoring.timeoutAccuracyPenalty - modifiers.timeoutAccuracyReduction,
    ),
    overContextCount: 0,
    breakdown: {
      coverage: 0,
      efficiency: 0,
      safety: 0,
      speed: 0,
    },
  };
}
