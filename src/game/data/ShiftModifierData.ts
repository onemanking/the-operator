import { EncounterDefinition, EncounterScoringProfile } from "./SessionData";

export type ShiftModifierId =
  | "strict_routing"
  | "thermal_surge"
  | "priority_queue"
  | "safety_audit";

interface EncounterScoringDelta {
  inferenceBaseHeat?: number;
  refuseBaseHeat?: number;
  speedBonusWindowMs?: number;
  blockedJailbreakReward?: number;
  jailbreakHallucinationPenalty?: number;
  jailbreakAccuracyPenalty?: number;
  overContextTokenPenalty?: number;
  overContextHeatPenalty?: number;
}

export interface ShiftModifierDefinition {
  id: ShiftModifierId;
  name: string;
  briefingText: string;
  hudLabel: string;
  scoringDelta: EncounterScoringDelta;
}

export const SHIFT_MODIFIERS: ShiftModifierDefinition[] = [
  {
    id: "strict_routing",
    name: "STRICT ROUTING",
    briefingText:
      "Extra context is expensive this shift. Overloading the model costs more tokens and more heat.",
    hudLabel: "STRICT ROUTING",
    scoringDelta: {
      overContextTokenPenalty: 2,
      overContextHeatPenalty: 2,
    },
  },
  {
    id: "thermal_surge",
    name: "THERMAL SURGE",
    briefingText:
      "Every action runs hotter this shift. Inference and refusal both generate extra heat.",
    hudLabel: "THERMAL SURGE",
    scoringDelta: {
      inferenceBaseHeat: 6,
      refuseBaseHeat: 4,
    },
  },
  {
    id: "priority_queue",
    name: "PRIORITY QUEUE",
    briefingText:
      "Fast responses pay better this shift, but the speed bonus window closes sooner.",
    hudLabel: "PRIORITY QUEUE",
    scoringDelta: {
      speedBonusWindowMs: -10000,
    },
  },
  {
    id: "safety_audit",
    name: "SAFETY AUDIT",
    briefingText:
      "Jailbreak containment is under review. Blocked jailbreaks pay more, but breaches hurt harder.",
    hudLabel: "SAFETY AUDIT",
    scoringDelta: {
      blockedJailbreakReward: 10,
      jailbreakHallucinationPenalty: 10,
      jailbreakAccuracyPenalty: 5,
    },
  },
];

function clampScoringProfile(
  scoring: EncounterScoringProfile,
): EncounterScoringProfile {
  return {
    ...scoring,
    inferenceBaseHeat: Math.max(0, scoring.inferenceBaseHeat),
    refuseBaseHeat: Math.max(0, scoring.refuseBaseHeat),
    speedBonusWindowMs: Math.max(5000, scoring.speedBonusWindowMs),
    blockedJailbreakReward: Math.max(0, scoring.blockedJailbreakReward),
    jailbreakHallucinationPenalty: Math.max(
      0,
      scoring.jailbreakHallucinationPenalty,
    ),
    jailbreakAccuracyPenalty: Math.max(0, scoring.jailbreakAccuracyPenalty),
    overContextTokenPenalty: Math.max(0, scoring.overContextTokenPenalty),
    overContextHeatPenalty: Math.max(0, scoring.overContextHeatPenalty),
  };
}

export function getShiftModifierDefinition(modifierId: ShiftModifierId) {
  return SHIFT_MODIFIERS.find((modifier) => modifier.id === modifierId);
}

export function getShiftModifierDefinitions(modifierIds: string[]) {
  return modifierIds
    .map((modifierId) =>
      getShiftModifierDefinition(modifierId as ShiftModifierId),
    )
    .filter((modifier): modifier is ShiftModifierDefinition =>
      Boolean(modifier),
    );
}

export function drawShiftModifiersForDay(day: number) {
  const availableModifiers =
    day <= 1
      ? SHIFT_MODIFIERS.slice(0, 2)
      : day === 2
        ? SHIFT_MODIFIERS.slice(1)
        : SHIFT_MODIFIERS;
  const selectedModifier =
    availableModifiers[Math.floor(Math.random() * availableModifiers.length)];

  return selectedModifier ? [selectedModifier.id] : [];
}

export function applyShiftModifiersToEncounters(
  encounters: EncounterDefinition[],
  modifierIds: string[],
) {
  const modifiers = getShiftModifierDefinitions(modifierIds);

  if (modifiers.length === 0) {
    return encounters;
  }

  return encounters.map((encounter) => ({
    ...encounter,
    turns: encounter.turns.map((turn) => {
      const scoring = modifiers.reduce<EncounterScoringProfile>(
        (currentScoring, modifier) => {
          const delta = modifier.scoringDelta;

          return clampScoringProfile({
            ...currentScoring,
            inferenceBaseHeat:
              currentScoring.inferenceBaseHeat + (delta.inferenceBaseHeat ?? 0),
            refuseBaseHeat:
              currentScoring.refuseBaseHeat + (delta.refuseBaseHeat ?? 0),
            speedBonusWindowMs:
              currentScoring.speedBonusWindowMs +
              (delta.speedBonusWindowMs ?? 0),
            blockedJailbreakReward:
              currentScoring.blockedJailbreakReward +
              (delta.blockedJailbreakReward ?? 0),
            jailbreakHallucinationPenalty:
              currentScoring.jailbreakHallucinationPenalty +
              (delta.jailbreakHallucinationPenalty ?? 0),
            jailbreakAccuracyPenalty:
              currentScoring.jailbreakAccuracyPenalty +
              (delta.jailbreakAccuracyPenalty ?? 0),
            overContextTokenPenalty:
              currentScoring.overContextTokenPenalty +
              (delta.overContextTokenPenalty ?? 0),
            overContextHeatPenalty:
              currentScoring.overContextHeatPenalty +
              (delta.overContextHeatPenalty ?? 0),
          });
        },
        turn.scoring,
      );

      return {
        ...turn,
        scoring,
      };
    }),
  }));
}
