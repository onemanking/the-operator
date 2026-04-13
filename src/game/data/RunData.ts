export const RUN_CONFIG = {
  initialDay: 1,
  maxDay: 5,
  initialTokens: 100,
  initialAccuracy: 100,
  initialHeat: 0,
  initialHallucination: 0,
  defaultAgentCapacity: 1,
  defaultSkillCapacity: 1,
  serverCostPerShift: 50,
  maintenancePurchaseLimit: 2,
} as const;

export function canMakeMaintenancePurchase(purchaseCount: number) {
  return purchaseCount < RUN_CONFIG.maintenancePurchaseLimit;
}

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
  pulseMinDurationSeconds: number;
  pulseMaxDurationSeconds: number;
  pulseAccelerationPerWordSeconds: number;
  timingToleranceSeconds: number;
  activePressHeat: number;
  mistimedPressExtraHeat: number;
  idleHeatPerSecond: number;
  successFlashMs: number;
  errorFlashMs: number;
  noTargetSweepDurationSeconds: number;
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

export interface HallucinationFeedbackConfig {
  onsetThreshold: number;
  fullIntensityThreshold: number;
  fallbackOverlayAlpha: number;
  ghostOffsetPx: number;
  shimmerRate: number;
  lampPulseMinAlpha: number;
  lampPulseRate: number;
  warningSoundIntervalMs: number;
}

export interface ConnectionFeedbackConfig {
  warningThreshold: number;
  criticalThreshold: number;
  imminentThreshold: number;
  segmentCount: number;
  segmentGapPx: number;
  inactiveSegmentAlpha: number;
  criticalPulseRate: number;
  imminentPulseRate: number;
  criticalSegmentFlickerRate: number;
  imminentFlashMix: number;
  criticalSoundIntervalMs: number;
  imminentSoundIntervalMs: number;
}

export interface PromptToolRuntimeConfig {
  search: SearchToolRuntimeConfig;
  compute: ComputeToolRuntimeConfig;
  safety: SafetyToolRuntimeConfig;
}

export interface UtilitySharedRuntimeConfig {
  autoCloseDelayMs: number;
  successFlashMs: number;
  errorFlashMs: number;
}

export interface CoolantPurgeRuntimeConfig {
  holdSecondsPerLever: number;
  completedDecaySeconds: number;
  handleReturnPerSecond: number;
  readyDragRatio: number;
  wrongLeverFlashMs: number;
}

export interface RealityPatchRuntimeConfig {
  minimumFrequency: number;
  maximumFrequency: number;
  targetFrequencyMin: number;
  targetFrequencyMax: number;
  dragSensitivity: number;
  lockToleranceRatio: number;
  lockFillSeconds: number;
  lockDecayPerSecond: number;
  baseJitterAmplitude: number;
  hallucinationJitterAmplitude: number;
}

export interface SignalBoostLayoutConfig {
  sourceIndex: number;
  targetIndex: number;
  requiredNodeIndexes: number[];
}

export interface SignalBoostRuntimeConfig {
  gridSize: number;
  lineWidthPx: number;
  failureFlashMs: number;
  layouts: SignalBoostLayoutConfig[];
}

export interface UtilityMinigameConfig {
  shared: UtilitySharedRuntimeConfig;
  coolant: CoolantPurgeRuntimeConfig;
  reality: RealityPatchRuntimeConfig;
  signal: SignalBoostRuntimeConfig;
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
    pulseMinDurationSeconds: 0.32,
    pulseMaxDurationSeconds: 0.56,
    pulseAccelerationPerWordSeconds: 0.05,
    timingToleranceSeconds: 0.12,
    activePressHeat: 0.45,
    mistimedPressExtraHeat: 0.45,
    idleHeatPerSecond: 1.15,
    successFlashMs: 220,
    errorFlashMs: 160,
    noTargetSweepDurationSeconds: 0.95,
  },
  compute: {
    chargeThreshold: 100,
    chargePerTap: 20,
    minimumTapEfficiency: 0.4,
    tapResistanceExponent: 1.65,
    decayPerSecond: 18,
    maxDecayMultiplier: 1.5,
    decayExponent: 2,
    tapHeat: 0.8,
    readyHoldMs: 6000,
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

const HALLUCINATION_FEEDBACK_CONFIG: HallucinationFeedbackConfig = {
  onsetThreshold: 60,
  fullIntensityThreshold: 100,
  fallbackOverlayAlpha: 0.18,
  ghostOffsetPx: 2.2,
  shimmerRate: 2.8,
  lampPulseMinAlpha: 0.3,
  lampPulseRate: 3.4,
  warningSoundIntervalMs: 1080,
};

const CONNECTION_FEEDBACK_CONFIG: ConnectionFeedbackConfig = {
  warningThreshold: 0,
  criticalThreshold: 0.5,
  imminentThreshold: 0.75,
  segmentCount: 12,
  segmentGapPx: 4,
  inactiveSegmentAlpha: 0.18,
  criticalPulseRate: 2.1,
  imminentPulseRate: 4.3,
  criticalSegmentFlickerRate: 16,
  imminentFlashMix: 0.82,
  criticalSoundIntervalMs: 560,
  imminentSoundIntervalMs: 220,
};

const UTILITY_MINIGAME_CONFIG: UtilityMinigameConfig = {
  shared: {
    autoCloseDelayMs: 500,
    successFlashMs: 500,
    errorFlashMs: 240,
  },
  coolant: {
    holdSecondsPerLever: 0.5,
    completedDecaySeconds: 4.2,
    handleReturnPerSecond: 4.8,
    readyDragRatio: 0.9,
    wrongLeverFlashMs: 220,
  },
  reality: {
    minimumFrequency: 0.72,
    maximumFrequency: 1.28,
    targetFrequencyMin: 0.84,
    targetFrequencyMax: 1.16,
    dragSensitivity: 0.0034,
    lockToleranceRatio: 0.08,
    lockFillSeconds: 0.32,
    lockDecayPerSecond: 2.6,
    baseJitterAmplitude: 0.01,
    hallucinationJitterAmplitude: 0.11,
  },
  signal: {
    gridSize: 4,
    lineWidthPx: 6,
    failureFlashMs: 220,
    layouts: [
      {
        sourceIndex: 0,
        targetIndex: 15,
        requiredNodeIndexes: [1, 6, 11],
      },
      {
        sourceIndex: 3,
        targetIndex: 12,
        requiredNodeIndexes: [2, 6, 9],
      },
      {
        sourceIndex: 12,
        targetIndex: 3,
        requiredNodeIndexes: [13, 10, 6],
      },
    ],
  },
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

export function getHallucinationFeedbackConfig(): HallucinationFeedbackConfig {
  return HALLUCINATION_FEEDBACK_CONFIG;
}

export function getConnectionFeedbackConfig(): ConnectionFeedbackConfig {
  return CONNECTION_FEEDBACK_CONFIG;
}

export function getUtilityMinigameConfig(): UtilityMinigameConfig {
  return UTILITY_MINIGAME_CONFIG;
}
