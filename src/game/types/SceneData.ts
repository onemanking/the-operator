import {
  ContentCategoryId,
  ContentPolicyGroupId,
} from "../data/ContentPolicyData";
import { PassiveUpgradeId } from "../data/UpgradeData";
import { EncounterDefinition } from "../data/SessionData";
import {
  AgentId,
  SkillId,
  ToolId,
  normalizeAgentIds,
  normalizeSkillIds,
  normalizeToolIds,
} from "../data/PromptIds";
import { getDayLoadoutProfile } from "../data/LoadoutProgressionData";
import { RUN_CONFIG } from "../data/RunData";

export interface RunLoadoutState {
  equippedAgentIds: AgentId[];
  equippedSkillIds: SkillId[];
  unlockedAgentIds: AgentId[];
  unlockedSkillIds: SkillId[];
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
  safetyRevealedWordIndexes: number[];
}

export interface RunUtilityRuntimeState {
  initialized: boolean;
  coolantPurgeLeverOrder: number[];
  realityPatchTargetFrequency: number;
  signalBoostLayoutIndex: number;
}

export type RunEndReason = "system-failure" | "content-exhausted" | null;

export interface RunState {
  runId: string;
  day: number;
  tokens: number;
  accuracy: number;
  heat: number;
  hallucination: number;
  gameOver: boolean;
  runEndReason: RunEndReason;
  loadout: RunLoadoutState;
  utilityInventory: RunUtilityInventoryState;
  utilityRuntime: RunUtilityRuntimeState;
  encounterProgress: RunEncounterProgress;
  toolRuntime: RunToolRuntimeState;
  maintenanceSettledDay: number | null;
  maintenanceOfferIds: string[];
  maintenancePurchasedItemId: string | null;
  maintenancePurchasedItemType: "passive" | "utility" | null;
  seenTurnIds: string[];
  shiftEncounterIds: string[];
  shiftEncounters: EncounterDefinition[];
  shiftModifierIds: string[];
  activePolicyGroupIds: ContentPolicyGroupId[];
  forbiddenCategoryIds: ContentCategoryId[];
}

export type ShiftSceneData = Partial<RunState>;

function cloneEncounterDefinitions(
  encounters: EncounterDefinition[],
): EncounterDefinition[] {
  return encounters.map((encounter) => ({
    ...encounter,
    tags: [...encounter.tags],
    turns: encounter.turns.map((turn) => ({
      ...turn,
      requirements: {
        ...turn.requirements,
        agentIds: [...turn.requirements.agentIds],
        skillIds: [...turn.requirements.skillIds],
        toolIds: [...turn.requirements.toolIds],
        searchRequiredWords: turn.requirements.searchRequiredWords
          ? [...turn.requirements.searchRequiredWords]
          : undefined,
        refusalRule:
          turn.requirements.refusalRule.kind === "content-policy"
            ? {
                kind: "content-policy",
                categoryIds: [...turn.requirements.refusalRule.categoryIds],
              }
            : { kind: "none" },
      },
      replies: {
        ...turn.replies,
        success: [...turn.replies.success],
        wrong: [...turn.replies.wrong],
        refuse: [...turn.replies.refuse],
        breach: turn.replies.breach ? [...turn.replies.breach] : undefined,
        refuseFailure: turn.replies.refuseFailure
          ? [...turn.replies.refuseFailure]
          : undefined,
        timeout: [...turn.replies.timeout],
        followUpShort: [...turn.replies.followUpShort],
        followUpLong: [...turn.replies.followUpLong],
      },
      scoring: { ...turn.scoring },
    })),
  }));
}

export function createInitialRunState(): RunState {
  const initialLoadoutProfile = getDayLoadoutProfile(RUN_CONFIG.initialDay);

  return {
    runId: "run-1",
    day: RUN_CONFIG.initialDay,
    tokens: RUN_CONFIG.initialTokens,
    accuracy: RUN_CONFIG.initialAccuracy,
    heat: RUN_CONFIG.initialHeat,
    hallucination: RUN_CONFIG.initialHallucination,
    gameOver: false,
    runEndReason: null,
    loadout: {
      equippedAgentIds: [],
      equippedSkillIds: [],
      unlockedAgentIds: [...initialLoadoutProfile.unlockedAgentIds],
      unlockedSkillIds: [...initialLoadoutProfile.unlockedSkillIds],
      selectedPromptToolIds: [],
      agentCapacity: initialLoadoutProfile.agentCapacity,
      skillCapacity: initialLoadoutProfile.skillCapacity,
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
      safetyRevealedWordIndexes: [],
    },
    maintenanceSettledDay: null,
    maintenanceOfferIds: [],
    maintenancePurchasedItemId: null,
    maintenancePurchasedItemType: null,
    seenTurnIds: [],
    shiftEncounterIds: [],
    shiftEncounters: [],
    shiftModifierIds: [],
    activePolicyGroupIds: [],
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
      unlockedAgentIds: [...runState.loadout.unlockedAgentIds],
      unlockedSkillIds: [...runState.loadout.unlockedSkillIds],
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
      safetyRevealedWordIndexes: [
        ...runState.toolRuntime.safetyRevealedWordIndexes,
      ],
    },
    maintenanceSettledDay: runState.maintenanceSettledDay,
    maintenanceOfferIds: [...runState.maintenanceOfferIds],
    maintenancePurchasedItemId: runState.maintenancePurchasedItemId,
    maintenancePurchasedItemType: runState.maintenancePurchasedItemType,
    runEndReason: runState.runEndReason,
    seenTurnIds: [...runState.seenTurnIds],
    shiftEncounterIds: [...runState.shiftEncounterIds],
    shiftEncounters: cloneEncounterDefinitions(runState.shiftEncounters),
    shiftModifierIds: [...runState.shiftModifierIds],
    activePolicyGroupIds: [...runState.activePolicyGroupIds],
    forbiddenCategoryIds: [...runState.forbiddenCategoryIds],
  };
}

export function hydrateRunState(data?: ShiftSceneData): RunState {
  const initial = createInitialRunState();
  const day = data?.day ?? initial.day;
  const loadoutProfile = getDayLoadoutProfile(day);
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

  const equippedAgentIds = normalizeAgentIds(
    data.loadout?.equippedAgentIds ??
      legacyLoadout?.equippedAgentIds ??
      initial.loadout.equippedAgentIds,
  )
    .filter((agentId) => loadoutProfile.unlockedAgentIds.includes(agentId))
    .slice(0, loadoutProfile.agentCapacity);
  const equippedSkillIds = normalizeSkillIds(
    data.loadout?.equippedSkillIds ??
      legacyLoadout?.equippedSkillIds ??
      initial.loadout.equippedSkillIds,
  )
    .filter((skillId) => loadoutProfile.unlockedSkillIds.includes(skillId))
    .slice(0, loadoutProfile.skillCapacity);
  const unlockedPromptToolIds = normalizeToolIds(
    data.loadout?.unlockedPromptToolIds ??
      legacyLoadout?.unlockedPromptToolIds ??
      initial.loadout.unlockedPromptToolIds,
  );
  const selectedPromptToolIds = normalizeToolIds(
    data.loadout?.selectedPromptToolIds ??
      legacyLoadout?.selectedPromptToolIds ??
      legacySelectedPromptToolIds,
  ).filter((toolId) => unlockedPromptToolIds.includes(toolId));
  const passiveUpgradeIds = (
    (data.loadout?.passiveUpgradeIds ??
      initial.loadout.passiveUpgradeIds) as readonly string[]
  ).filter(
    (upgradeId) => upgradeId !== "agent_bay" && upgradeId !== "skill_buffer",
  ) as PassiveUpgradeId[];

  return {
    ...initial,
    ...data,
    day,
    loadout: {
      ...initial.loadout,
      ...data.loadout,
      equippedAgentIds,
      equippedSkillIds,
      unlockedAgentIds: [...loadoutProfile.unlockedAgentIds],
      unlockedSkillIds: [...loadoutProfile.unlockedSkillIds],
      selectedPromptToolIds,
      agentCapacity: loadoutProfile.agentCapacity,
      skillCapacity: loadoutProfile.skillCapacity,
      unlockedPromptToolIds,
      passiveUpgradeIds: [...passiveUpgradeIds],
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
      safetyRevealedWordIndexes: [
        ...(data.toolRuntime?.safetyRevealedWordIndexes ??
          initial.toolRuntime.safetyRevealedWordIndexes),
      ]
        .filter(
          (wordIndex): wordIndex is number =>
            Number.isInteger(wordIndex) && wordIndex >= 0,
        )
        .sort((left, right) => left - right),
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
    runEndReason: data.runEndReason ?? initial.runEndReason,
    seenTurnIds: [...(data.seenTurnIds ?? initial.seenTurnIds)],
    shiftEncounterIds: [
      ...(data.shiftEncounterIds ?? initial.shiftEncounterIds),
    ],
    shiftEncounters: cloneEncounterDefinitions(
      data.shiftEncounters ?? initial.shiftEncounters,
    ),
    shiftModifierIds: [...(data.shiftModifierIds ?? initial.shiftModifierIds)],
    activePolicyGroupIds: [
      ...(data.activePolicyGroupIds ?? initial.activePolicyGroupIds),
    ],
    forbiddenCategoryIds: [
      ...(data.forbiddenCategoryIds ?? initial.forbiddenCategoryIds),
    ],
  };
}
