import { RunState } from "../types/SceneData";

export type ActiveUtilityId = "coolant_purge";

export interface ActiveUtilityDefinition {
  id: ActiveUtilityId;
  name: string;
  description: string;
  cost: number;
  maxCharges: number;
  purchaseChargeCount: number;
  heatReduction: number;
}

export const ACTIVE_UTILITIES: ActiveUtilityDefinition[] = [
  {
    id: "coolant_purge",
    name: "COOLANT PURGE",
    description: "Single-use vent. Reduce current thermal load by 35.",
    cost: 18,
    maxCharges: 2,
    purchaseChargeCount: 1,
    heatReduction: 35,
  },
];

export function getActiveUtilityDefinition(utilityId: ActiveUtilityId) {
  return ACTIVE_UTILITIES.find((utility) => utility.id === utilityId);
}

export function getActiveUtilityCharges(
  runState: RunState,
  utilityId: ActiveUtilityId,
) {
  return runState.utilityInventory.chargesById[utilityId] ?? 0;
}

export function getAvailableActiveUtilities(runState: RunState) {
  return ACTIVE_UTILITIES.filter((utility) => {
    return getActiveUtilityCharges(runState, utility.id) < utility.maxCharges;
  });
}

export function canPurchaseActiveUtility(
  runState: RunState,
  utilityId: ActiveUtilityId,
) {
  const definition = getActiveUtilityDefinition(utilityId);

  if (!definition) {
    return false;
  }

  if (runState.maintenancePurchasedItemId) {
    return false;
  }

  if (runState.tokens < definition.cost) {
    return false;
  }

  return getActiveUtilityCharges(runState, utilityId) < definition.maxCharges;
}

export function applyActiveUtilityPurchase(
  runState: RunState,
  utilityId: ActiveUtilityId,
) {
  const definition = getActiveUtilityDefinition(utilityId);

  if (!definition || !canPurchaseActiveUtility(runState, utilityId)) {
    return false;
  }

  runState.tokens -= definition.cost;
  if (!runState.utilityInventory.unlockedIds.includes(utilityId)) {
    runState.utilityInventory.unlockedIds.push(utilityId);
  }

  runState.utilityInventory.chargesById[utilityId] = Math.min(
    definition.maxCharges,
    getActiveUtilityCharges(runState, utilityId) +
      definition.purchaseChargeCount,
  );
  runState.maintenancePurchasedItemId = utilityId;
  runState.maintenancePurchasedItemType = "utility";

  return true;
}

export function canUseActiveUtility(
  runState: RunState,
  utilityId: ActiveUtilityId,
) {
  return getActiveUtilityCharges(runState, utilityId) > 0;
}

export function consumeActiveUtilityCharge(
  runState: RunState,
  utilityId: ActiveUtilityId,
) {
  if (!canUseActiveUtility(runState, utilityId)) {
    return false;
  }

  runState.utilityInventory.chargesById[utilityId] = Math.max(
    0,
    getActiveUtilityCharges(runState, utilityId) - 1,
  );

  return true;
}
