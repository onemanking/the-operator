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

export interface SearchToolRuntimeConfig {
  heatPerWord: number;
  extraHeatPerWordAfterSoftCap: number;
  softCapWords: number;
}

export interface ComputeToolRuntimeConfig {
  chargeThreshold: number;
  chargePerTap: number;
  minimumTapEfficiency: number;
  tapResistanceExponent: number;
  decayPerSecond: number;
  maxDecayMultiplier: number;
  decayExponent: number;
  tapHeat: number;
  readyHoldMs: number;
}

export interface PromptToolRuntimeConfig {
  search: SearchToolRuntimeConfig;
  compute: ComputeToolRuntimeConfig;
}

const RUN_RECOVERY_PROFILE: RunRecoveryProfile = {
  heatRecoveryPerSecond: 8,
  heatRecoveryDelayMs: 1500,
  hallucinationRecoveryPerSecond: 0, // No automatic hallucination recovery by default, can only be reduced through upgrades
  hallucinationRecoveryDelayMs: 0, // No delay since hallucination doesn't automatically recover
  overheatClearThreshold: 50,
};

const PROMPT_TOOL_RUNTIME_CONFIG: PromptToolRuntimeConfig = {
  search: {
    heatPerWord: 0.75,
    extraHeatPerWordAfterSoftCap: 0.5,
    softCapWords: 2,
  },
  compute: {
    chargeThreshold: 100,
    chargePerTap: 18,
    minimumTapEfficiency: 0.42,
    tapResistanceExponent: 1.35,
    decayPerSecond: 18,
    maxDecayMultiplier: 2.1,
    decayExponent: 1.85,
    tapHeat: 0.8,
    readyHoldMs: 1400,
  },
};

export function getRunRecoveryProfile(): RunRecoveryProfile {
  return RUN_RECOVERY_PROFILE;
}

export function getPromptToolRuntimeConfig(): PromptToolRuntimeConfig {
  return PROMPT_TOOL_RUNTIME_CONFIG;
}
