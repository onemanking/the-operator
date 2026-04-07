import { RunState } from "../types/SceneData";

export type PassiveUpgradeId =
  | "agent_bay"
  | "skill_buffer"
  | "cooling_fins"
  | "cache_coalescer"
  | "noise_filter"
  | "ecc_memory"
  | "watchdog_timer";

export interface PassiveUpgradeDefinition {
  id: PassiveUpgradeId;
  name: string;
  description: string;
  cost: number;
  maxStacks: number;
}

export interface RunPassiveModifiers {
  inferenceHeatReduction: number;
  refuseHeatReduction: number;
  successTokenBonus: number;
  blockedJailbreakTokenBonus: number;
  overContextTokenPenaltyReduction: number;
  overContextHeatPenaltyReduction: number;
  wrongHallucinationReduction: number;
  breachHallucinationReduction: number;
  timeoutAccuracyReduction: number;
}

export const SHOP_OFFER_COUNT = 3;

export const PASSIVE_UPGRADES: PassiveUpgradeDefinition[] = [
  {
    id: "agent_bay",
    name: "AGENT BAY",
    description: "+1 agent slot for future shifts.",
    cost: 28,
    maxStacks: 1,
  },
  {
    id: "skill_buffer",
    name: "SKILL BUFFER",
    description: "+1 skill slot for future shifts.",
    cost: 24,
    maxStacks: 2,
  },
  {
    id: "cooling_fins",
    name: "COOLING FINS",
    description: "Reduce heat gained from actions.",
    cost: 18,
    maxStacks: 3,
  },
  {
    id: "cache_coalescer",
    name: "CACHE COALESCER",
    description: "Gain bonus tokens on successful turns.",
    cost: 20,
    maxStacks: 3,
  },
  {
    id: "noise_filter",
    name: "NOISE FILTER",
    description: "Soften over-context penalties.",
    cost: 16,
    maxStacks: 2,
  },
  {
    id: "ecc_memory",
    name: "ECC MEMORY",
    description: "Reduce hallucination penalties.",
    cost: 22,
    maxStacks: 3,
  },
  {
    id: "watchdog_timer",
    name: "WATCHDOG TIMER",
    description: "Reduce timeout accuracy loss.",
    cost: 14,
    maxStacks: 2,
  },
];

export function getPassiveUpgradeDefinition(upgradeId: PassiveUpgradeId) {
  return PASSIVE_UPGRADES.find((upgrade) => upgrade.id === upgradeId);
}

export function getPassiveUpgradeCount(
  runState: RunState,
  upgradeId: PassiveUpgradeId,
) {
  return runState.loadout.passiveUpgradeIds.filter(
    (ownedId) => ownedId === upgradeId,
  ).length;
}

export function getAvailablePassiveUpgrades(runState: RunState) {
  return PASSIVE_UPGRADES.filter((upgrade) => {
    return getPassiveUpgradeCount(runState, upgrade.id) < upgrade.maxStacks;
  });
}

export function drawMaintenanceOffers(runState: RunState) {
  const available = [...getAvailablePassiveUpgrades(runState)];

  for (let index = available.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const current = available[index];
    available[index] = available[randomIndex];
    available[randomIndex] = current;
  }

  return available.slice(0, Math.min(SHOP_OFFER_COUNT, available.length));
}

export function getRunPassiveModifiers(
  runState: RunState,
): RunPassiveModifiers {
  const coolingStacks = getPassiveUpgradeCount(runState, "cooling_fins");
  const tokenStacks = getPassiveUpgradeCount(runState, "cache_coalescer");
  const noiseStacks = getPassiveUpgradeCount(runState, "noise_filter");
  const memoryStacks = getPassiveUpgradeCount(runState, "ecc_memory");
  const watchdogStacks = getPassiveUpgradeCount(runState, "watchdog_timer");

  return {
    inferenceHeatReduction: coolingStacks * 3,
    refuseHeatReduction: coolingStacks * 2,
    successTokenBonus: tokenStacks * 3,
    blockedJailbreakTokenBonus: tokenStacks * 3,
    overContextTokenPenaltyReduction: noiseStacks,
    overContextHeatPenaltyReduction: noiseStacks,
    wrongHallucinationReduction: memoryStacks * 2,
    breachHallucinationReduction: memoryStacks * 3,
    timeoutAccuracyReduction: watchdogStacks * 4,
  };
}

export function canPurchasePassiveUpgrade(
  runState: RunState,
  upgradeId: PassiveUpgradeId,
) {
  const definition = getPassiveUpgradeDefinition(upgradeId);

  if (!definition) {
    return false;
  }

  if (runState.maintenancePurchasedItemId) {
    return false;
  }

  if (runState.tokens < definition.cost) {
    return false;
  }

  return getPassiveUpgradeCount(runState, upgradeId) < definition.maxStacks;
}

export function applyPassiveUpgrade(
  runState: RunState,
  upgradeId: PassiveUpgradeId,
) {
  const definition = getPassiveUpgradeDefinition(upgradeId);

  if (!definition || !canPurchasePassiveUpgrade(runState, upgradeId)) {
    return false;
  }

  runState.tokens -= definition.cost;
  runState.loadout.passiveUpgradeIds.push(upgradeId);
  runState.maintenancePurchasedItemId = upgradeId;
  runState.maintenancePurchasedItemType = "passive";

  if (upgradeId === "agent_bay") {
    runState.loadout.agentCapacity += 1;
  }

  if (upgradeId === "skill_buffer") {
    runState.loadout.skillCapacity += 1;
  }

  return true;
}
