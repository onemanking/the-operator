import { ContentCategoryId } from "../data/ContentPolicyData";
import { PassiveUpgradeId } from "../data/UpgradeData";
import {
  AgentId,
  SkillId,
  ToolId,
  normalizeAgentIds,
  normalizeSkillIds,
  normalizeToolIds,
} from "../data/PromptIds";
import { RUN_CONFIG } from "../data/RunData";

export interface RunLoadoutState {
  equippedAgentIds: AgentId[];
  equippedSkillIds: SkillId[];
  selectedPromptToolIds: ToolId[];
  agentCapacity: number;
  skillCapacity: number;
  unlockedPromptToolIds: ToolId[];
  passiveUpgradeIds: PassiveUpgradeId[];
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
  computePrimed: boolean;
  searchLockedWords: string[];
  searchCurrentTargetIndex: number;
}

export interface RunUtilityRuntimeState {
  initialized: boolean;
  coolantPurgeLeverOrder: number[];
  realityPatchTargetFrequency: number;
  signalBoostLayoutIndex: number;
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
  utilityRuntime: RunUtilityRuntimeState;
  encounterProgress: RunEncounterProgress;
  toolRuntime: RunToolRuntimeState;
  maintenanceSettledDay: number | null;
  maintenanceOfferIds: string[];
  maintenancePurchasedItemId: string | null;
  maintenancePurchasedItemType: "passive" | "utility" | null;
  shiftEncounterIds: string[];
  shiftModifierIds: string[];
  forbiddenCategoryIds: ContentCategoryId[];
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
      unlockedPromptToolIds: [ToolId.Search, ToolId.Compute, ToolId.Safety],
      passiveUpgradeIds: [],
    },
    utilityInventory: {
      unlockedIds: [],
      chargesById: {},
    },
    utilityRuntime: {
      initialized: false,
      coolantPurgeLeverOrder: [0, 1, 2],
      realityPatchTargetFrequency: 1,
      signalBoostLayoutIndex: 0,
    },
    encounterProgress: {
      encounterIndex: 0,
      turnIndex: 0,
    },
    toolRuntime: {
      computeCharge: 0,
      computePrimed: false,
      searchLockedWords: [],
      searchCurrentTargetIndex: 0,
    },
    maintenanceSettledDay: null,
    maintenanceOfferIds: [],
    maintenancePurchasedItemId: null,
    maintenancePurchasedItemType: null,
    shiftEncounterIds: [],
    shiftModifierIds: [],
    forbiddenCategoryIds: [],
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
    utilityRuntime: {
      ...runState.utilityRuntime,
      coolantPurgeLeverOrder: [
        ...runState.utilityRuntime.coolantPurgeLeverOrder,
      ],
    },
    encounterProgress: { ...runState.encounterProgress },
    toolRuntime: {
      ...runState.toolRuntime,
      searchLockedWords: [...runState.toolRuntime.searchLockedWords],
    },
    maintenanceSettledDay: runState.maintenanceSettledDay,
    maintenanceOfferIds: [...runState.maintenanceOfferIds],
    maintenancePurchasedItemId: runState.maintenancePurchasedItemId,
    maintenancePurchasedItemType: runState.maintenancePurchasedItemType,
    shiftEncounterIds: [...runState.shiftEncounterIds],
    shiftModifierIds: [...runState.shiftModifierIds],
    forbiddenCategoryIds: [...runState.forbiddenCategoryIds],
  };
}

export function hydrateRunState(data?: ShiftSceneData): RunState {
  const initial = createInitialRunState();
  const legacyLoadout = data?.loadout as
    | (Partial<RunLoadoutState> & {
        activeUtilityIds?: string[];
        selectedToolId?: string;
        equippedAgentIds?: readonly string[];
        equippedSkillIds?: readonly string[];
        selectedPromptToolIds?: readonly string[];
        unlockedPromptToolIds?: readonly string[];
      })
    | undefined;
  const legacyUtilityIds = legacyLoadout?.activeUtilityIds ?? [];
  const legacySelectedPromptToolIds = normalizeToolIds(
    legacyLoadout?.selectedToolId ? [legacyLoadout.selectedToolId] : [],
  );
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
      equippedAgentIds: normalizeAgentIds(
        data.loadout?.equippedAgentIds ??
          legacyLoadout?.equippedAgentIds ??
          initial.loadout.equippedAgentIds,
      ),
      equippedSkillIds: normalizeSkillIds(
        data.loadout?.equippedSkillIds ??
          legacyLoadout?.equippedSkillIds ??
          initial.loadout.equippedSkillIds,
      ),
      selectedPromptToolIds: normalizeToolIds(
        data.loadout?.selectedPromptToolIds ??
          legacyLoadout?.selectedPromptToolIds ??
          legacySelectedPromptToolIds,
      ),
      unlockedPromptToolIds: normalizeToolIds(
        data.loadout?.unlockedPromptToolIds ??
          legacyLoadout?.unlockedPromptToolIds ??
          initial.loadout.unlockedPromptToolIds,
      ),
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
    utilityRuntime: {
      ...initial.utilityRuntime,
      ...data.utilityRuntime,
      coolantPurgeLeverOrder: [
        ...(data.utilityRuntime?.coolantPurgeLeverOrder ??
          initial.utilityRuntime.coolantPurgeLeverOrder),
      ],
    },
    encounterProgress: {
      ...initial.encounterProgress,
      ...data.encounterProgress,
    },
    toolRuntime: {
      ...initial.toolRuntime,
      ...data.toolRuntime,
      searchLockedWords: [
        ...(data.toolRuntime?.searchLockedWords ??
          initial.toolRuntime.searchLockedWords),
      ],
      searchCurrentTargetIndex:
        data.toolRuntime?.searchCurrentTargetIndex ??
        initial.toolRuntime.searchCurrentTargetIndex,
      computePrimed:
        data.toolRuntime?.computePrimed ??
        (data.toolRuntime?.computeCharge ??
          initial.toolRuntime.computeCharge) >= 100,
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
    forbiddenCategoryIds: [
      ...(data.forbiddenCategoryIds ?? initial.forbiddenCategoryIds),
    ],
  };
}
