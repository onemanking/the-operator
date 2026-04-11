import { RunState } from "../types/SceneData";

export type ActiveUtilityId =
  | "coolant_purge"
  | "reality_patch"
  | "signal_boost";

export interface ActiveUtilityDefinition {
  id: ActiveUtilityId;
  name: string;
  shortLabel: string;
  description: string;
  effectText: string;
  cost: number;
  maxCharges: number;
  purchaseChargeCount: number;
  heatReduction?: number;
  hallucinationReduction?: number;
  connectionRestoreMs?: number;
}

export const ACTIVE_UTILITIES: ActiveUtilityDefinition[] = [
  {
    id: "coolant_purge",
    name: "COOLANT PURGE",
    shortLabel: "COOLANT",
    description: "Single-use vent. Reduce current thermal load by 35.",
    effectText: "VENT -35 HEAT",
    cost: 18,
    maxCharges: 2,
    purchaseChargeCount: 1,
    heatReduction: 35,
  },
  {
    id: "reality_patch",
    name: "REALITY PATCH",
    shortLabel: "PATCH",
    description: "Single-use stabilizer. Reduce current hallucination by 20.",
    effectText: "SCRUB -20 HALL",
    cost: 20,
    maxCharges: 2,
    purchaseChargeCount: 1,
    hallucinationReduction: 20,
  },
  {
    id: "signal_boost",
    name: "SIGNAL BOOST",
    shortLabel: "SIGNAL",
    description: "Single-use uplink spike. Fully restore user connection.",
    effectText: "FULL LINK",
    cost: 16,
    maxCharges: 2,
    purchaseChargeCount: 1,
    connectionRestoreMs: 6000,
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

export function getUnlockedActiveUtilityIds(runState: RunState) {
  return ACTIVE_UTILITIES.filter((utility) => {
    return (
      runState.utilityInventory.unlockedIds.includes(utility.id) ||
      getActiveUtilityCharges(runState, utility.id) > 0
    );
  }).map((utility) => utility.id);
}

export function getActiveUtilityInventorySummary(runState: RunState) {
  const stockedUtilities = ACTIVE_UTILITIES.filter(
    (utility) => getActiveUtilityCharges(runState, utility.id) > 0,
  );

  if (stockedUtilities.length === 0) {
    return "NONE";
  }

  return stockedUtilities
    .map(
      (utility) =>
        `${utility.shortLabel} X${getActiveUtilityCharges(runState, utility.id)}`,
    )
    .join(" | ");
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
