import { RUN_CONFIG } from "../data/RunData";

export interface RunLoadoutState {
  equippedAgentIds: string[];
  equippedSkillIds: string[];
  selectedPromptToolIds: string[];
  agentCapacity: number;
  skillCapacity: number;
  unlockedPromptToolIds: string[];
  passiveUpgradeIds: string[];
}

export interface RunUtilityInventoryState {
  unlockedIds: string[];
  chargesById: Record<string, number>;
}

export interface RunEncounterProgress {
  encounterIndex: number;
  turnIndex: number;
}

export interface RunToolRuntimeState {
  computeCharge: number;
}

export interface RunState {
  runId: string;
  day: number;
  tokens: number;
  accuracy: number;
  heat: number;
  hallucination: number;
  gameOver: boolean;
  loadout: RunLoadoutState;
  utilityInventory: RunUtilityInventoryState;
  encounterProgress: RunEncounterProgress;
  toolRuntime: RunToolRuntimeState;
  maintenanceSettledDay: number | null;
  maintenanceOfferIds: string[];
  maintenancePurchasedItemId: string | null;
  maintenancePurchasedItemType: "passive" | "utility" | null;
  shiftEncounterIds: string[];
  shiftModifierIds: string[];
}

export type ShiftSceneData = Partial<RunState>;

export function createInitialRunState(): RunState {
  return {
    runId: "run-1",
    day: RUN_CONFIG.initialDay,
    tokens: RUN_CONFIG.initialTokens,
    accuracy: RUN_CONFIG.initialAccuracy,
    heat: RUN_CONFIG.initialHeat,
    hallucination: RUN_CONFIG.initialHallucination,
    gameOver: false,
    loadout: {
      equippedAgentIds: [],
      equippedSkillIds: [],
      selectedPromptToolIds: [],
      agentCapacity: RUN_CONFIG.defaultAgentCapacity,
      skillCapacity: RUN_CONFIG.defaultSkillCapacity,
      unlockedPromptToolIds: ["search", "compute"],
      passiveUpgradeIds: [],
    },
    utilityInventory: {
      unlockedIds: [],
      chargesById: {},
    },
    encounterProgress: {
      encounterIndex: 0,
      turnIndex: 0,
    },
    toolRuntime: {
      computeCharge: 0,
    },
    maintenanceSettledDay: null,
    maintenanceOfferIds: [],
    maintenancePurchasedItemId: null,
    maintenancePurchasedItemType: null,
    shiftEncounterIds: [],
    shiftModifierIds: [],
  };
}

export const INITIAL_SHIFT_STATE: RunState = createInitialRunState();

export function cloneRunState(runState: RunState): RunState {
  return {
    ...runState,
    loadout: {
      ...runState.loadout,
      equippedAgentIds: [...runState.loadout.equippedAgentIds],
      equippedSkillIds: [...runState.loadout.equippedSkillIds],
      selectedPromptToolIds: [...runState.loadout.selectedPromptToolIds],
      unlockedPromptToolIds: [...runState.loadout.unlockedPromptToolIds],
      passiveUpgradeIds: [...runState.loadout.passiveUpgradeIds],
    },
    utilityInventory: {
      unlockedIds: [...runState.utilityInventory.unlockedIds],
      chargesById: { ...runState.utilityInventory.chargesById },
    },
    encounterProgress: { ...runState.encounterProgress },
    toolRuntime: { ...runState.toolRuntime },
    maintenanceSettledDay: runState.maintenanceSettledDay,
    maintenanceOfferIds: [...runState.maintenanceOfferIds],
    maintenancePurchasedItemId: runState.maintenancePurchasedItemId,
    maintenancePurchasedItemType: runState.maintenancePurchasedItemType,
    shiftEncounterIds: [...runState.shiftEncounterIds],
    shiftModifierIds: [...runState.shiftModifierIds],
  };
}

export function hydrateRunState(data?: ShiftSceneData): RunState {
  const initial = createInitialRunState();
  const legacyLoadout = data?.loadout as
    | (Partial<RunLoadoutState> & {
        activeUtilityIds?: string[];
        selectedToolId?: string;
      })
    | undefined;
  const legacyUtilityIds = legacyLoadout?.activeUtilityIds ?? [];
  const legacySelectedPromptToolIds =
    legacyLoadout?.selectedToolId && legacyLoadout.selectedToolId !== "none"
      ? [legacyLoadout.selectedToolId]
      : [];
  const mergedUtilityUnlockedIds = [
    ...new Set([
      ...legacyUtilityIds,
      ...(data?.utilityInventory?.unlockedIds ??
        initial.utilityInventory.unlockedIds),
    ]),
  ];
  const legacyChargesById = legacyUtilityIds.reduce<Record<string, number>>(
    (chargesById, utilityId) => {
      chargesById[utilityId] = (chargesById[utilityId] ?? 0) + 1;
      return chargesById;
    },
    {},
  );

  if (!data) {
    return initial;
  }

  return {
    ...initial,
    ...data,
    loadout: {
      ...initial.loadout,
      ...data.loadout,
      equippedAgentIds: [
        ...(data.loadout?.equippedAgentIds ?? initial.loadout.equippedAgentIds),
      ],
      equippedSkillIds: [
        ...(data.loadout?.equippedSkillIds ?? initial.loadout.equippedSkillIds),
      ],
      selectedPromptToolIds: [
        ...(
          data.loadout?.selectedPromptToolIds ?? legacySelectedPromptToolIds
        ).map((toolId) => (toolId === "calculate" ? "compute" : toolId)),
      ],
      unlockedPromptToolIds: [
        ...(
          data.loadout?.unlockedPromptToolIds ??
          initial.loadout.unlockedPromptToolIds
        ).map((toolId) => (toolId === "calculate" ? "compute" : toolId)),
      ],
      passiveUpgradeIds: [
        ...(data.loadout?.passiveUpgradeIds ??
          initial.loadout.passiveUpgradeIds),
      ],
    },
    utilityInventory: {
      unlockedIds: mergedUtilityUnlockedIds,
      chargesById: {
        ...legacyChargesById,
        ...(data.utilityInventory?.chargesById ??
          initial.utilityInventory.chargesById),
      },
    },
    encounterProgress: {
      ...initial.encounterProgress,
      ...data.encounterProgress,
    },
    toolRuntime: {
      ...initial.toolRuntime,
      ...data.toolRuntime,
    },
    maintenanceSettledDay:
      data.maintenanceSettledDay ?? initial.maintenanceSettledDay,
    maintenanceOfferIds: [
      ...(data.maintenanceOfferIds ?? initial.maintenanceOfferIds),
    ],
    maintenancePurchasedItemId:
      data.maintenancePurchasedItemId ?? initial.maintenancePurchasedItemId,
    maintenancePurchasedItemType:
      data.maintenancePurchasedItemType ?? initial.maintenancePurchasedItemType,
    shiftEncounterIds: [
      ...(data.shiftEncounterIds ?? initial.shiftEncounterIds),
    ],
    shiftModifierIds: [...(data.shiftModifierIds ?? initial.shiftModifierIds)],
  };
}
