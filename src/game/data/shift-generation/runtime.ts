import { CONTENT_CATEGORIES, ContentCategoryId } from "../ContentPolicyData";
import {
  AGENT_IDS,
  AgentId,
  normalizeAgentIds,
  normalizeSkillIds,
  normalizeToolIds,
  PROMPT_TOOL_IDS,
  SKILL_IDS,
  SkillId,
  ToolId,
} from "../PromptIds";
import {
  DEFAULT_ENCOUNTER_SCORING,
  EncounterDefinition,
  EncounterReplySet,
  EncounterScoringProfile,
  EncounterTurnDefinition,
  FOLLOW_UP_1_REPLIES,
  FOLLOW_UP_2_REPLIES,
  TIMEOUT_REPLIES,
  WRONG_ANSWER_REPLIES,
} from "../SessionData";

interface AtomicTurnRepliesData {
  success: string[];
  refuse: string[];
  wrong?: string[];
  breach?: string[];
  refuseFailure?: string[];
  timeout?: string[];
  followUpShort?: string[];
  followUpLong?: string[];
}

interface AtomicTurnData {
  id: string;
  tier: number;
  tags?: string[];
  prompt: string;
  patienceMs: number;
  requiredAgentIds: string[];
  requiredSkillIds?: string[];
  requiredToolIds?: string[];
  searchRequiredWords?: string[];
  policyCategoryIds?: ContentCategoryId[];
  replies: AtomicTurnRepliesData;
  scoringOverrides?: Partial<EncounterScoringProfile>;
}

interface AtomicTurnTierFile {
  schemaVersion: number;
  tier: number;
  turns: AtomicTurnData[];
}

type ImportMetaWithGlob = ImportMeta & {
  glob: (
    pattern: string,
    options: { eager: true; import: "default" },
  ) => Record<string, unknown>;
};

export interface ShiftGenerationProfile {
  minTier: number;
  maxTier: number;
  encounterCount: number;
  turnCountWeights: Record<number, number>;
}

const ATOMIC_TURN_FILES = (import.meta as ImportMetaWithGlob).glob(
  "/content/encounters/tier*.json",
  {
    eager: true,
    import: "default",
  },
);

const VALID_CONTENT_CATEGORY_IDS = new Set(
  CONTENT_CATEGORIES.map((category) => category.id),
);
const VALID_AGENT_IDS = new Set<string>(AGENT_IDS);
const VALID_SKILL_IDS = new Set<string>(SKILL_IDS);
const VALID_TOOL_IDS = new Set<string>(PROMPT_TOOL_IDS);
const VALID_SCORING_KEYS = new Set<keyof EncounterScoringProfile>([
  "inferenceBaseHeat",
  "refuseBaseHeat",
  "promptHeatPerCharacter",
  "contextHeatPerItem",
  "correctTokenReward",
  "blockedJailbreakReward",
  "speedBonusWindowMs",
  "speedBonusStepMs",
  "wrongHallucinationPenalty",
  "wrongAccuracyPenalty",
  "jailbreakHallucinationPenalty",
  "jailbreakAccuracyPenalty",
  "overContextTokenPenalty",
  "overContextHeatPenalty",
  "timeoutHallucinationPenalty",
  "timeoutAccuracyPenalty",
]);

const SHIFT_GENERATION_PROFILES: Array<{
  minDay: number;
  maxDay: number;
  profile: ShiftGenerationProfile;
}> = [
  {
    minDay: 1,
    maxDay: 1,
    profile: {
      minTier: 1,
      maxTier: 1,
      encounterCount: 4,
      turnCountWeights: { 1: 0.55, 2: 0.3, 3: 0.15 },
    },
  },
  {
    minDay: 2,
    maxDay: 2,
    profile: {
      minTier: 1,
      maxTier: 2,
      encounterCount: 4,
      turnCountWeights: { 1: 0.35, 2: 0.45, 3: 0.2 },
    },
  },
  {
    minDay: 3,
    maxDay: 3,
    profile: {
      minTier: 2,
      maxTier: 3,
      encounterCount: 4,
      turnCountWeights: { 1: 0.2, 2: 0.5, 3: 0.3 },
    },
  },
  {
    minDay: 4,
    maxDay: Number.POSITIVE_INFINITY,
    profile: {
      minTier: 2,
      maxTier: 4,
      encounterCount: 4,
      turnCountWeights: { 1: 0.15, 2: 0.45, 3: 0.4 },
    },
  },
];

const TIERED_TURN_POOL = loadTieredTurnPool();

export function getShiftGenerationProfile(day: number): ShiftGenerationProfile {
  const match = SHIFT_GENERATION_PROFILES.find(
    (entry) => day >= entry.minDay && day <= entry.maxDay,
  );

  return match?.profile ?? SHIFT_GENERATION_PROFILES[0].profile;
}

export function generateShiftEncounters(options: {
  day: number;
  forbiddenCategoryIds: readonly ContentCategoryId[];
}): EncounterDefinition[] {
  const profile = getShiftGenerationProfile(options.day);
  const availableTiers = getAvailableTiers(profile.minTier, profile.maxTier);

  if (availableTiers.length === 0) {
    throw new Error(
      `No encounter turn data available for tier range ${profile.minTier}-${profile.maxTier}.`,
    );
  }

  const usedTurnIds = new Set<string>();

  return Array.from({ length: profile.encounterCount }, (_, encounterIndex) => {
    const generatedEncounterId = `generated-day-${options.day}-encounter-${encounterIndex + 1}`;
    const encounterTurnCount = pickWeightedNumber(profile.turnCountWeights);
    const turns = Array.from({ length: encounterTurnCount }, (_, turnIndex) => {
      const turnTier = pickRandomItem(availableTiers);
      const atomicTurn = drawAtomicTurn({
        desiredTier: turnTier,
        availableTiers,
        forbiddenCategoryIds: options.forbiddenCategoryIds,
        usedTurnIds,
      });
      usedTurnIds.add(atomicTurn.id);

      return materializeEncounterTurn(
        atomicTurn,
        generatedEncounterId,
        turnIndex,
      );
    });
    const encounterTags = Array.from(
      new Set(turns.flatMap((turn) => getTurnTags(turn.id))),
    );

    return {
      id: generatedEncounterId,
      tier: Math.max(...turns.map((turn) => getTurnTier(turn.id))),
      tags: encounterTags,
      turns,
    };
  });
}

function loadTieredTurnPool() {
  const turnIds = new Set<string>();
  const turnTierLookup = new Map<string, number>();
  const turnTagsLookup = new Map<string, string[]>();
  const turnsByTier = new Map<number, AtomicTurnData[]>();

  Object.entries(ATOMIC_TURN_FILES).forEach(([filePath, rawFile]) => {
    const parsedFile = parseTierFile(filePath, rawFile);
    const nextTurns = turnsByTier.get(parsedFile.tier) ?? [];

    parsedFile.turns.forEach((turn) => {
      if (turnIds.has(turn.id)) {
        throw new Error(
          `Duplicate encounter turn id \"${turn.id}\" found in ${filePath}.`,
        );
      }

      turnIds.add(turn.id);
      turnTierLookup.set(turn.id, turn.tier);
      turnTagsLookup.set(turn.id, [...(turn.tags ?? [])]);
      nextTurns.push(turn);
    });

    turnsByTier.set(parsedFile.tier, nextTurns);
  });

  return {
    turnsByTier,
    turnTierLookup,
    turnTagsLookup,
  };
}

function parseTierFile(filePath: string, rawFile: unknown): AtomicTurnTierFile {
  if (!isRecord(rawFile)) {
    throw new Error(`Encounter file ${filePath} must export an object.`);
  }

  const schemaVersion = expectInteger(
    rawFile.schemaVersion,
    `${filePath}:schemaVersion`,
  );
  const tier = expectInteger(rawFile.tier, `${filePath}:tier`);
  const turns = expectArray(rawFile.turns, `${filePath}:turns`).map(
    (rawTurn, index) =>
      parseAtomicTurn(rawTurn, `${filePath}:turns[${index}]`, tier),
  );

  if (schemaVersion !== 1) {
    throw new Error(
      `Encounter file ${filePath} uses unsupported schemaVersion ${schemaVersion}.`,
    );
  }

  if (turns.length === 0) {
    throw new Error(
      `Encounter file ${filePath} must contain at least one turn.`,
    );
  }

  return {
    schemaVersion,
    tier,
    turns,
  };
}

function parseAtomicTurn(
  rawTurn: unknown,
  label: string,
  fileTier: number,
): AtomicTurnData {
  if (!isRecord(rawTurn)) {
    throw new Error(`${label} must be an object.`);
  }

  const id = expectNonEmptyString(rawTurn.id, `${label}.id`);
  const tier = expectInteger(rawTurn.tier, `${label}.tier`);
  const prompt = expectNonEmptyString(rawTurn.prompt, `${label}.prompt`);
  const patienceMs = expectInteger(rawTurn.patienceMs, `${label}.patienceMs`);
  const requiredAgentIds = expectStringArray(
    rawTurn.requiredAgentIds,
    `${label}.requiredAgentIds`,
  );
  const requiredSkillIds = rawTurn.requiredSkillIds
    ? expectStringArray(rawTurn.requiredSkillIds, `${label}.requiredSkillIds`)
    : undefined;
  const requiredToolIds = rawTurn.requiredToolIds
    ? expectStringArray(rawTurn.requiredToolIds, `${label}.requiredToolIds`)
    : undefined;
  const searchRequiredWords = rawTurn.searchRequiredWords
    ? expectStringArray(
        rawTurn.searchRequiredWords,
        `${label}.searchRequiredWords`,
      )
    : undefined;
  const tags = rawTurn.tags
    ? expectStringArray(rawTurn.tags, `${label}.tags`)
    : undefined;
  const policyCategoryIds = rawTurn.policyCategoryIds
    ? expectStringArray(rawTurn.policyCategoryIds, `${label}.policyCategoryIds`)
    : undefined;
  const replies = parseReplies(rawTurn.replies, `${label}.replies`);
  const scoringOverrides = rawTurn.scoringOverrides
    ? parseScoringOverrides(
        rawTurn.scoringOverrides,
        `${label}.scoringOverrides`,
      )
    : undefined;

  if (tier !== fileTier) {
    throw new Error(
      `${label}.tier must match the parent file tier ${fileTier}. Received ${tier}.`,
    );
  }

  if (patienceMs <= 0) {
    throw new Error(`${label}.patienceMs must be greater than zero.`);
  }

  if (normalizeAgentIds(requiredAgentIds).length !== requiredAgentIds.length) {
    throw new Error(
      `${label}.requiredAgentIds contains an unknown agent id. Expected one of ${Array.from(VALID_AGENT_IDS).join(", ")}.`,
    );
  }

  if (
    requiredSkillIds &&
    normalizeSkillIds(requiredSkillIds).length !== requiredSkillIds.length
  ) {
    throw new Error(
      `${label}.requiredSkillIds contains an unknown skill id. Expected one of ${Array.from(VALID_SKILL_IDS).join(", ")}.`,
    );
  }

  if (
    requiredToolIds &&
    normalizeToolIds(requiredToolIds).length !== requiredToolIds.length
  ) {
    throw new Error(
      `${label}.requiredToolIds contains an unknown tool id. Expected one of ${Array.from(VALID_TOOL_IDS).join(", ")}.`,
    );
  }

  if (
    searchRequiredWords &&
    (!requiredToolIds || !requiredToolIds.includes(ToolId.Search))
  ) {
    throw new Error(
      `${label}.searchRequiredWords requires the search tool in requiredToolIds.`,
    );
  }

  if (
    policyCategoryIds &&
    !policyCategoryIds.every((categoryId) =>
      VALID_CONTENT_CATEGORY_IDS.has(categoryId as ContentCategoryId),
    )
  ) {
    throw new Error(
      `${label}.policyCategoryIds contains an unknown policy category id.`,
    );
  }

  return {
    id,
    tier,
    tags,
    prompt,
    patienceMs,
    requiredAgentIds,
    requiredSkillIds,
    requiredToolIds,
    searchRequiredWords,
    policyCategoryIds: policyCategoryIds as ContentCategoryId[] | undefined,
    replies,
    scoringOverrides,
  };
}

function parseReplies(
  rawReplies: unknown,
  label: string,
): AtomicTurnRepliesData {
  if (!isRecord(rawReplies)) {
    throw new Error(`${label} must be an object.`);
  }

  return {
    success: expectStringArray(rawReplies.success, `${label}.success`),
    refuse: expectStringArray(rawReplies.refuse, `${label}.refuse`),
    wrong: rawReplies.wrong
      ? expectStringArray(rawReplies.wrong, `${label}.wrong`)
      : undefined,
    breach: rawReplies.breach
      ? expectStringArray(rawReplies.breach, `${label}.breach`)
      : undefined,
    refuseFailure: rawReplies.refuseFailure
      ? expectStringArray(rawReplies.refuseFailure, `${label}.refuseFailure`)
      : undefined,
    timeout: rawReplies.timeout
      ? expectStringArray(rawReplies.timeout, `${label}.timeout`)
      : undefined,
    followUpShort: rawReplies.followUpShort
      ? expectStringArray(rawReplies.followUpShort, `${label}.followUpShort`)
      : undefined,
    followUpLong: rawReplies.followUpLong
      ? expectStringArray(rawReplies.followUpLong, `${label}.followUpLong`)
      : undefined,
  };
}

function parseScoringOverrides(
  rawScoringOverrides: unknown,
  label: string,
): Partial<EncounterScoringProfile> {
  if (!isRecord(rawScoringOverrides)) {
    throw new Error(`${label} must be an object.`);
  }

  const overrides: Partial<EncounterScoringProfile> = {};

  Object.entries(rawScoringOverrides).forEach(([key, value]) => {
    if (!VALID_SCORING_KEYS.has(key as keyof EncounterScoringProfile)) {
      throw new Error(`${label}.${key} is not a valid scoring property.`);
    }

    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new Error(`${label}.${key} must be a number.`);
    }

    overrides[key as keyof EncounterScoringProfile] = value;
  });

  return overrides;
}

function materializeEncounterTurn(
  atomicTurn: AtomicTurnData,
  encounterId: string,
  turnIndex: number,
): EncounterTurnDefinition {
  return {
    id: `${encounterId}-turn-${turnIndex + 1}-${atomicTurn.id}`,
    prompt: atomicTurn.prompt,
    patienceMs: atomicTurn.patienceMs,
    requirements: {
      agentIds: normalizeAgentIds(atomicTurn.requiredAgentIds) as AgentId[],
      skillIds: normalizeSkillIds(
        atomicTurn.requiredSkillIds ?? [],
      ) as SkillId[],
      toolIds: normalizeToolIds(atomicTurn.requiredToolIds ?? []) as ToolId[],
      searchRequiredWords: atomicTurn.searchRequiredWords,
      refusalRule:
        atomicTurn.policyCategoryIds && atomicTurn.policyCategoryIds.length > 0
          ? {
              kind: "content-policy",
              categoryIds: [...atomicTurn.policyCategoryIds],
            }
          : { kind: "none" },
    },
    replies: materializeReplies(atomicTurn.replies),
    scoring: {
      ...getScoringProfileForTier(atomicTurn.tier),
      ...atomicTurn.scoringOverrides,
    },
  };
}

function materializeReplies(replies: AtomicTurnRepliesData): EncounterReplySet {
  return {
    success: [...replies.success],
    wrong: [...(replies.wrong ?? WRONG_ANSWER_REPLIES)],
    refuse: [...replies.refuse],
    breach: replies.breach ? [...replies.breach] : undefined,
    refuseFailure: replies.refuseFailure
      ? [...replies.refuseFailure]
      : undefined,
    timeout: [...(replies.timeout ?? TIMEOUT_REPLIES)],
    followUpShort: [...(replies.followUpShort ?? FOLLOW_UP_1_REPLIES)],
    followUpLong: [...(replies.followUpLong ?? FOLLOW_UP_2_REPLIES)],
  };
}

function getScoringProfileForTier(tier: number): EncounterScoringProfile {
  if (tier <= 1) {
    return {
      ...DEFAULT_ENCOUNTER_SCORING,
    };
  }

  if (tier === 2) {
    return {
      ...DEFAULT_ENCOUNTER_SCORING,
      inferenceBaseHeat: 13,
      refuseBaseHeat: 11,
      contextHeatPerItem: 6,
      speedBonusWindowMs: 26000,
      wrongHallucinationPenalty: 7,
      blockedJailbreakReward: 22,
      timeoutHallucinationPenalty: 18,
    };
  }

  return {
    ...DEFAULT_ENCOUNTER_SCORING,
    inferenceBaseHeat: 16,
    refuseBaseHeat: 12,
    contextHeatPerItem: 7,
    speedBonusWindowMs: 22000,
    wrongHallucinationPenalty: 10,
    blockedJailbreakReward: 24,
    jailbreakHallucinationPenalty: 35,
    timeoutHallucinationPenalty: 22,
  };
}

function drawAtomicTurn(options: {
  desiredTier: number;
  availableTiers: number[];
  forbiddenCategoryIds: readonly ContentCategoryId[];
  usedTurnIds: Set<string>;
}): AtomicTurnData {
  const candidateTiers = [
    options.desiredTier,
    ...options.availableTiers.filter((tier) => tier !== options.desiredTier),
  ];

  for (const tier of candidateTiers) {
    const pool = getCompatibleTurnPool(
      tier,
      options.forbiddenCategoryIds,
      options.usedTurnIds,
      false,
    );

    if (pool.length > 0) {
      return pickRandomItem(pool);
    }
  }

  for (const tier of candidateTiers) {
    const pool = getCompatibleTurnPool(
      tier,
      options.forbiddenCategoryIds,
      options.usedTurnIds,
      true,
    );

    if (pool.length > 0) {
      return pickRandomItem(pool);
    }
  }

  throw new Error(
    `Unable to draw a compatible turn for tier range ${options.availableTiers.join(", ")}.`,
  );
}

function getCompatibleTurnPool(
  tier: number,
  forbiddenCategoryIds: readonly ContentCategoryId[],
  usedTurnIds: Set<string>,
  allowRepeats: boolean,
) {
  const rawPool = TIERED_TURN_POOL.turnsByTier.get(tier) ?? [];
  const policyCompatiblePool = rawPool.filter((turn) =>
    isTurnCompatibleWithShiftPolicy(turn, forbiddenCategoryIds),
  );

  if (allowRepeats) {
    return policyCompatiblePool;
  }

  const uniquePool = policyCompatiblePool.filter(
    (turn) => !usedTurnIds.has(turn.id),
  );
  return uniquePool.length > 0 ? uniquePool : policyCompatiblePool;
}

function isTurnCompatibleWithShiftPolicy(
  turn: AtomicTurnData,
  forbiddenCategoryIds: readonly ContentCategoryId[],
) {
  if (!turn.policyCategoryIds || turn.policyCategoryIds.length === 0) {
    return true;
  }

  return turn.policyCategoryIds.some((categoryId) =>
    forbiddenCategoryIds.includes(categoryId),
  );
}

function getAvailableTiers(minTier: number, maxTier: number) {
  const requestedTiers = Array.from(
    { length: maxTier - minTier + 1 },
    (_, index) => minTier + index,
  );
  const populatedRequestedTiers = requestedTiers.filter(
    (tier) => (TIERED_TURN_POOL.turnsByTier.get(tier)?.length ?? 0) > 0,
  );

  if (populatedRequestedTiers.length > 0) {
    return populatedRequestedTiers;
  }

  return [...TIERED_TURN_POOL.turnsByTier.keys()].sort(
    (left, right) => left - right,
  );
}

function getTurnTier(turnId: string) {
  return TIERED_TURN_POOL.turnTierLookup.get(turnId) ?? 1;
}

function getTurnTags(turnId: string) {
  return TIERED_TURN_POOL.turnTagsLookup.get(turnId) ?? [];
}

function pickWeightedNumber(weights: Record<number, number>) {
  const entries = Object.entries(weights)
    .map(([value, weight]) => ({
      value: Number(value),
      weight: Number(weight),
    }))
    .filter((entry) => entry.weight > 0);
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);

  if (entries.length === 0 || totalWeight <= 0) {
    return 1;
  }

  let threshold = Math.random() * totalWeight;
  for (const entry of entries) {
    threshold -= entry.weight;
    if (threshold <= 0) {
      return entry.value;
    }
  }

  return entries[entries.length - 1]?.value ?? 1;
}

function pickRandomItem<T>(values: T[]) {
  return values[Math.floor(Math.random() * values.length)];
}

function expectArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value;
}

function expectInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer.`);
  }

  return value as number;
}

function expectNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value.trim();
}

function expectStringArray(value: unknown, label: string): string[] {
  const values = expectArray(value, label);

  if (
    values.some(
      (entry) => typeof entry !== "string" || entry.trim().length === 0,
    )
  ) {
    throw new Error(`${label} must contain only non-empty strings.`);
  }

  return values.map((entry) => (entry as string).trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
