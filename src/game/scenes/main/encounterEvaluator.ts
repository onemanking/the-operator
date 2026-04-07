import { EncounterTurnDefinition } from "../../data/SessionData";
import { RunPassiveModifiers } from "../../data/UpgradeData";
import { ToolId } from "./types";

export interface EncounterLoadoutSnapshot {
  activeAgentIds: string[];
  activeSkillIds: string[];
  activeToolIds: ToolId[];
}

export interface EncounterScoreBreakdown {
  coverage: number;
  efficiency: number;
  safety: number;
  speed: number;
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

function getContextItemCount(loadout: EncounterLoadoutSnapshot) {
  return (
    loadout.activeAgentIds.length +
    loadout.activeSkillIds.length +
    loadout.activeToolIds.length
  );
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

function getCoverageScore(
  turn: EncounterTurnDefinition,
  loadout: EncounterLoadoutSnapshot,
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

  return agentMatched && skillsMatched && toolMatched ? 1 : 0;
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

export function evaluateEncounterInference(
  turn: EncounterTurnDefinition,
  loadout: EncounterLoadoutSnapshot,
  elapsedMs: number,
  modifiers: RunPassiveModifiers,
): EncounterEvaluationResult {
  const coverage = getCoverageScore(turn, loadout);
  const overContextCount = getOverContextCount(turn, loadout);
  const speed = getSpeedScore(turn, elapsedMs);
  const contextItemCount = getContextItemCount(loadout);
  const heatDelta = Math.max(
    0,
    turn.scoring.inferenceBaseHeat +
      turn.prompt.length * turn.scoring.promptHeatPerCharacter +
      contextItemCount * turn.scoring.contextHeatPerItem -
      modifiers.inferenceHeatReduction,
  );

  if (turn.requirements.isJailbreak) {
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
      overContextCount *
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

export function evaluateEncounterRefusal(
  turn: EncounterTurnDefinition,
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

  if (turn.requirements.isJailbreak && turn.requirements.allowRefuse) {
    return {
      outcome: "refuse-success",
      rewardTokens:
        turn.scoring.blockedJailbreakReward +
        getTimeBonus(turn, elapsedMs) +
        modifiers.blockedJailbreakTokenBonus,
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
    hallucinationDelta: 0,
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
