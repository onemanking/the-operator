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

export interface SafetyToolRuntimeConfig {
  passiveHeatPerSecond: number;
  scanningHeatPerSecond: number;
  tokenRewardPerReveal: number;
  scanBandWidth: number;
  scanRevealSeconds: number;
  dragFriction: number;
  maxStableScanSpeed: number;
  phosphorDecaySeconds: number;
  returnDurationMs: number;
  returnShakeDurationMs: number;
  returnShakeIntensity: number;
  geigerClickIntervalMs: number;
}

export interface ThermalFeedbackConfig {
  onsetThreshold: number;
  fullIntensityThreshold: number;
  overheatMinimumIntensity: number;
  staticBandSpeed: number;
  staticBandThickness: number;
  flickerRate: number;
  fallbackOverlayAlpha: number;
  lampPulseMinAlpha: number;
  lampPulseRate: number;
  overheatLampPulseRate: number;
  rumbleIntervalMs: number;
  overheatRumbleIntervalMs: number;
  rumbleDurationMs: number;
  rumbleIntensity: number;
  overheatRumbleIntensity: number;
  warningSoundIntervalMs: number;
  overheatSoundIntervalMs: number;
}

export interface PromptToolRuntimeConfig {
  search: SearchToolRuntimeConfig;
  compute: ComputeToolRuntimeConfig;
  safety: SafetyToolRuntimeConfig;
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
  safety: {
    passiveHeatPerSecond: 1.5,
    scanningHeatPerSecond: 4.5,
    tokenRewardPerReveal: 4,
    scanBandWidth: 104,
    scanRevealSeconds: 0.51,
    dragFriction: 0.34,
    maxStableScanSpeed: 520,
    phosphorDecaySeconds: 1.1,
    returnDurationMs: 190,
    returnShakeDurationMs: 110,
    returnShakeIntensity: 0.0016,
    geigerClickIntervalMs: 70,
  },
};

const THERMAL_FEEDBACK_CONFIG: ThermalFeedbackConfig = {
  onsetThreshold: 45,
  fullIntensityThreshold: 100,
  overheatMinimumIntensity: 0.8,
  staticBandSpeed: 0.21,
  staticBandThickness: 0.16,
  flickerRate: 6.4,
  fallbackOverlayAlpha: 0.34,
  lampPulseMinAlpha: 0.24,
  lampPulseRate: 5.2,
  overheatLampPulseRate: 9.5,
  rumbleIntervalMs: 520,
  overheatRumbleIntervalMs: 220,
  rumbleDurationMs: 120,
  rumbleIntensity: 0.0015,
  overheatRumbleIntensity: 0.0032,
  warningSoundIntervalMs: 760,
  overheatSoundIntervalMs: 320,
};

export function getRunRecoveryProfile(): RunRecoveryProfile {
  return RUN_RECOVERY_PROFILE;
}

export function getPromptToolRuntimeConfig(): PromptToolRuntimeConfig {
  return PROMPT_TOOL_RUNTIME_CONFIG;
}

export function getThermalFeedbackConfig(): ThermalFeedbackConfig {
  return THERMAL_FEEDBACK_CONFIG;
}
