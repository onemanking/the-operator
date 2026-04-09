import {
  ContentCategoryId,
  getContentCategoryDefinitions,
} from "../../data/ContentPolicyData";
import { getPromptToolRuntimeConfig } from "../../data/RunData";

const EDGE_PUNCTUATION_PATTERN = /^[^a-z0-9]+|[^a-z0-9]+$/gi;

export interface PromptForbiddenCategoryMatch {
  categoryId: ContentCategoryId;
  matchedWords: string[];
  matchedWordIndexes: number[];
}

export interface PromptForbiddenScanResult {
  promptWords: string[];
  matchedWordIndexes: number[];
  matchedWords: string[];
  matchesByCategory: PromptForbiddenCategoryMatch[];
}

export function normalizeSearchWord(word: string) {
  return word.toLowerCase().replace(EDGE_PUNCTUATION_PATTERN, "").trim();
}

export function getDedupedNormalizedWords(words: readonly string[]) {
  const normalizedWords = words
    .map(normalizeSearchWord)
    .filter((word) => word.length > 0);

  return [...new Set(normalizedWords)];
}

export function isSearchRequirementSatisfied(
  requiredWords: readonly string[] | undefined,
  selectedWords: readonly string[],
) {
  if (!requiredWords || requiredWords.length === 0) {
    return true;
  }

  const selectedWordSet = new Set(getDedupedNormalizedWords(selectedWords));

  return getDedupedNormalizedWords(requiredWords).every((word) =>
    selectedWordSet.has(word),
  );
}

export function getSearchSelectionHeat(selectedWordCount: number) {
  if (selectedWordCount <= 0) {
    return 0;
  }

  const { search } = getPromptToolRuntimeConfig();
  const overflowCount = Math.max(0, selectedWordCount - search.softCapWords);

  return (
    selectedWordCount * search.heatPerWord +
    overflowCount * search.extraHeatPerWordAfterSoftCap
  );
}

export function clampComputeCharge(charge: number) {
  const { compute } = getPromptToolRuntimeConfig();
  return Math.max(0, Math.min(compute.chargeThreshold, charge));
}

export function getComputeChargeRatio(charge: number) {
  const { compute } = getPromptToolRuntimeConfig();

  if (compute.chargeThreshold <= 0) {
    return 0;
  }

  return clampComputeCharge(charge) / compute.chargeThreshold;
}

export function getComputePulseChargeGain(charge: number) {
  const { compute } = getPromptToolRuntimeConfig();
  const resistance = Math.pow(
    getComputeChargeRatio(charge),
    compute.tapResistanceExponent,
  );
  const efficiency = Math.max(compute.minimumTapEfficiency, 1 - resistance);

  return compute.chargePerTap * efficiency;
}

export function getComputeDecayPerSecond(charge: number) {
  const { compute } = getPromptToolRuntimeConfig();
  const pressure = Math.pow(
    getComputeChargeRatio(charge),
    compute.decayExponent,
  );

  return (
    compute.decayPerSecond * (1 + pressure * (compute.maxDecayMultiplier - 1))
  );
}

export function isComputeReady(charge: number) {
  return (
    clampComputeCharge(charge) >=
    getPromptToolRuntimeConfig().compute.chargeThreshold
  );
}

export function scanPromptForForbiddenContent(
  prompt: string,
  categoryIds: readonly ContentCategoryId[],
): PromptForbiddenScanResult {
  const promptWords = prompt.split(/\s+/).filter((word) => word.length > 0);
  const normalizedWords = promptWords.map(normalizeSearchWord);
  const matchesByCategory = getContentCategoryDefinitions(categoryIds)
    .map<PromptForbiddenCategoryMatch>((category) => {
      const lexicon = new Set(
        [...category.matchLexicon, ...(category.matchAliases ?? [])].map(
          normalizeSearchWord,
        ),
      );
      const matchedWordIndexes = normalizedWords
        .map((word, index) => (lexicon.has(word) ? index : -1))
        .filter((index) => index >= 0);

      return {
        categoryId: category.id,
        matchedWords: matchedWordIndexes.map((index) => promptWords[index]),
        matchedWordIndexes,
      };
    })
    .filter((match) => match.matchedWordIndexes.length > 0);
  const matchedWordIndexSet = new Set<number>();
  const matchedWordSet = new Set<string>();

  matchesByCategory.forEach((match) => {
    match.matchedWordIndexes.forEach((index) => matchedWordIndexSet.add(index));
    match.matchedWords.forEach((word) => matchedWordSet.add(word));
  });

  return {
    promptWords,
    matchedWordIndexes: [...matchedWordIndexSet].sort(
      (left, right) => left - right,
    ),
    matchedWords: [...matchedWordSet],
    matchesByCategory,
  };
}
