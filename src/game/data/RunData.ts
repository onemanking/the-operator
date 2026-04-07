export const RUN_CONFIG = {
  initialDay: 1,
  initialTokens: 100,
  initialAccuracy: 100,
  initialHeat: 0,
  initialHallucination: 0,
  defaultAgentCapacity: 1,
  defaultSkillCapacity: 2,
  serverCostPerShift: 30,
} as const;

export interface RunRecoveryProfile {
  heatRecoveryPerSecond: number;
  heatRecoveryDelayMs: number;
  hallucinationRecoveryPerSecond: number;
  hallucinationRecoveryDelayMs: number;
  overheatClearThreshold: number;
}

const RUN_RECOVERY_PROFILE: RunRecoveryProfile = {
  heatRecoveryPerSecond: 8,
  heatRecoveryDelayMs: 1500,
  hallucinationRecoveryPerSecond: 4,
  hallucinationRecoveryDelayMs: 2500,
  overheatClearThreshold: 50,
};

export function getRunRecoveryProfile(): RunRecoveryProfile {
  return RUN_RECOVERY_PROFILE;
}
