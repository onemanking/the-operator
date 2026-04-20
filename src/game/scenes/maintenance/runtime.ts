import { RUN_CONFIG } from "../../data/RunData";
import {
  ACTIVE_UTILITIES,
  ActiveUtilityDefinition,
  ActiveUtilityId,
  canPurchaseActiveUtility,
  getActiveUtilityCharges,
  getActiveUtilityDefinition,
} from "../../data/UtilityData";
import {
  PassiveUpgradeDefinition,
  PassiveUpgradeId,
  canPurchasePassiveUpgrade,
  getAvailablePassiveUpgrades,
  getPassiveUpgradeCount,
  getPassiveUpgradeDefinition,
} from "../../data/UpgradeData";
import { RunState, cloneRunState } from "../../types/SceneData";

export const MAINTENANCE_SCENE_KEYS = {
  router: "MaintenanceScene",
  shift: "MaintenanceShiftScene",
  failure: "MaintenanceFailureScene",
  runComplete: "MaintenanceRunCompleteScene",
  archive: "MaintenanceArchiveScene",
} as const;

export type MaintenanceSceneKey =
  (typeof MAINTENANCE_SCENE_KEYS)[keyof typeof MAINTENANCE_SCENE_KEYS];

export type MaintenanceOfferKind = "passive" | "utility";

export interface MaintenanceOfferCard {
  id: string;
  kind: MaintenanceOfferKind;
  name: string;
  description: string;
  cost: number;
  ownedText: string;
  isMaxed: boolean;
  canPurchase: boolean;
}

export function settleMaintenanceState(runState: RunState) {
  if (runState.maintenanceSettledDay === runState.day) {
    return;
  }

  runState.tokens -= RUN_CONFIG.serverCostPerShift;
  runState.maintenanceSettledDay = runState.day;
  runState.maintenancePurchaseCount = 0;
  runState.maintenancePurchasedItemId = null;
  runState.maintenancePurchasedItemType = null;
  runState.maintenanceOfferIds = drawShopOffers(runState).map(
    (offer) => offer.id,
  );
}

export function buildNextRunState(runState: RunState) {
  const nextRunState = cloneRunState(runState);

  nextRunState.day = runState.day + 1;
  nextRunState.accuracy = runState.accuracy;
  nextRunState.heat = 0;
  nextRunState.gameOver = false;
  nextRunState.runEndReason = null;
  nextRunState.encounterProgress = {
    encounterIndex: 0,
    turnIndex: 0,
  };
  nextRunState.maintenanceSettledDay = null;
  nextRunState.maintenanceOfferIds = [];
  nextRunState.maintenancePurchaseCount = 0;
  nextRunState.maintenancePurchasedItemId = null;
  nextRunState.maintenancePurchasedItemType = null;
  nextRunState.shiftEncounterIds = [];
  nextRunState.shiftEncounters = [];
  nextRunState.shiftModifierIds = [];
  nextRunState.activePolicyGroupIds = [];
  nextRunState.forbiddenCategoryIds = [];

  return nextRunState;
}

export function isContentExhaustedRun(runState: RunState) {
  return runState.gameOver && runState.runEndReason === "content-exhausted";
}

export function isFailureRun(runState: RunState) {
  return (
    runState.runEndReason === "system-failure" ||
    (!runState.gameOver && runState.tokens < 0)
  );
}

export function isRunComplete(runState: RunState) {
  return !runState.gameOver && runState.day >= RUN_CONFIG.maxDay;
}

export function resolveMaintenanceSceneKey(
  runState: RunState,
): MaintenanceSceneKey {
  if (isContentExhaustedRun(runState)) {
    return MAINTENANCE_SCENE_KEYS.archive;
  }

  if (isFailureRun(runState)) {
    return MAINTENANCE_SCENE_KEYS.failure;
  }

  if (isRunComplete(runState)) {
    return MAINTENANCE_SCENE_KEYS.runComplete;
  }

  return MAINTENANCE_SCENE_KEYS.shift;
}

export function formatFineTuneVersion(deathCount: number) {
  return `v1.${String(Math.max(1, deathCount)).padStart(2, "0")}`;
}

export function getFineTuneRebootText(deathCount: number) {
  return `INITIATING FINE-TUNE: OMNI-SENTINEL ${formatFineTuneVersion(deathCount)}...`;
}

export function getFailureDigestText(runState: RunState) {
  if (runState.tokens < 0) {
    return ["LEDGER COLLAPSE CONFIRMED.", "SERVER SHUTDOWN.", ""].join("\n");
  }

  return ["HALLUCINATION CRITICAL MASS REACHED.", "SERVER MELTDOWN.", ""].join(
    "\n",
  );
}

export function getMaintenanceOfferCards(runState: RunState) {
  return runState.maintenanceOfferIds
    .map((offerId) => resolveOfferCard(runState, offerId))
    .filter((offer): offer is MaintenanceOfferCard => Boolean(offer));
}

function drawShopOffers(runState: RunState) {
  const passiveOffers = getPassiveOfferCards(runState);
  const utilityOffers = getUtilityOfferCards(runState);

  shuffle(passiveOffers);
  shuffle(utilityOffers);

  const guaranteedUtilityOffer = utilityOffers.shift();
  const availableOffers = [
    ...(guaranteedUtilityOffer ? [guaranteedUtilityOffer] : []),
    ...passiveOffers,
    ...utilityOffers,
  ];

  shuffle(availableOffers);

  return availableOffers.slice(0, Math.min(3, availableOffers.length));
}

function resolveOfferCard(runState: RunState, offerId: string) {
  const passiveUpgrade = getPassiveUpgradeDefinition(
    offerId as PassiveUpgradeId,
  );

  if (passiveUpgrade) {
    return createPassiveOfferCard(runState, passiveUpgrade);
  }

  const utility = getActiveUtilityDefinition(offerId as ActiveUtilityId);

  if (utility) {
    return createUtilityOfferCard(runState, utility);
  }

  return null;
}

function getPassiveOfferCards(runState: RunState) {
  return getAvailablePassiveUpgrades(runState).map((upgrade) =>
    createPassiveOfferCard(runState, upgrade),
  );
}

function getUtilityOfferCards(runState: RunState) {
  return ACTIVE_UTILITIES.map((utility) =>
    createUtilityOfferCard(runState, utility),
  ).filter((offer): offer is MaintenanceOfferCard => Boolean(offer));
}

function createPassiveOfferCard(
  runState: RunState,
  upgrade: PassiveUpgradeDefinition,
): MaintenanceOfferCard {
  const ownedCount = getPassiveUpgradeCount(runState, upgrade.id);

  return {
    id: upgrade.id,
    kind: "passive",
    name: upgrade.name,
    description: upgrade.description,
    cost: upgrade.cost,
    ownedText: `OWNED: ${ownedCount}/${upgrade.maxStacks}`,
    isMaxed: ownedCount >= upgrade.maxStacks,
    canPurchase: canPurchasePassiveUpgrade(runState, upgrade.id),
  };
}

function createUtilityOfferCard(
  runState: RunState,
  utility: ActiveUtilityDefinition,
): MaintenanceOfferCard {
  const charges = getActiveUtilityCharges(runState, utility.id);

  return {
    id: utility.id,
    kind: "utility",
    name: utility.name,
    description: utility.description,
    cost: utility.cost,
    ownedText: `CHARGES: ${charges}`,
    isMaxed: false,
    canPurchase: canPurchaseActiveUtility(runState, utility.id),
  };
}

function shuffle<T>(items: T[]) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const current = items[index];
    items[index] = items[randomIndex];
    items[randomIndex] = current;
  }
}
