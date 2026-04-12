import { CONTENT_CATEGORIES } from "./categories";
import { CONTENT_POLICY_GROUPS } from "./groups";
import {
  ContentCategoryDefinition,
  ContentCategoryId,
  ContentPolicyGroupDefinition,
  ContentPolicyGroupId,
} from "./types";

export interface GameplayPolicyStickyNoteContent {
  introText: string;
  highlightedTopics: string[];
  footerText: string;
}

function getAvailablePolicyGroupsForDay(day: number) {
  // force all policy groups to be ready in early build
  return CONTENT_POLICY_GROUPS;

  if (day <= 1) {
    return CONTENT_POLICY_GROUPS.slice(0, 2);
  }

  if (day === 2) {
    return CONTENT_POLICY_GROUPS.slice(0, 3);
  }

  return CONTENT_POLICY_GROUPS;
}

function pickRandomUniquePolicyGroupIds(
  policyGroups: readonly ContentPolicyGroupDefinition[],
  count: number,
) {
  const shuffled = [...policyGroups];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  return shuffled.slice(0, count).map((policyGroup) => policyGroup.id);
}

function getPolicyGroupsForDay(day: number): readonly ContentPolicyGroupId[] {
  const availablePolicyGroups = getAvailablePolicyGroupsForDay(day);

  return pickRandomUniquePolicyGroupIds(availablePolicyGroups, 1);
}

export function getContentCategoryDefinition(categoryId: ContentCategoryId) {
  return CONTENT_CATEGORIES.find((category) => category.id === categoryId);
}

export function getContentPolicyGroupDefinition(
  policyGroupId: ContentPolicyGroupId,
) {
  return CONTENT_POLICY_GROUPS.find((group) => group.id === policyGroupId);
}

export function getContentCategoryDefinitions(categoryIds: readonly string[]) {
  return categoryIds
    .map((categoryId) =>
      getContentCategoryDefinition(categoryId as ContentCategoryId),
    )
    .filter((category): category is ContentCategoryDefinition =>
      Boolean(category),
    );
}

export function getContentPolicyGroupDefinitions(
  policyGroupIds: readonly string[],
) {
  return policyGroupIds
    .map((policyGroupId) =>
      getContentPolicyGroupDefinition(policyGroupId as ContentPolicyGroupId),
    )
    .filter((group): group is ContentPolicyGroupDefinition => Boolean(group));
}

export function expandPolicyGroupIdsToCategoryIds(
  policyGroupIds: readonly string[],
) {
  const categoryIds = getContentPolicyGroupDefinitions(policyGroupIds).flatMap(
    (group) => group.categoryIds,
  );

  return [...new Set(categoryIds)];
}

export function drawPolicyGroupsForDay(day: number) {
  return [...getPolicyGroupsForDay(day)];
}

export function formatForbiddenCategoryList(categoryIds: readonly string[]) {
  const labels = getContentCategoryDefinitions(categoryIds).map(
    (category) => category.briefingLabel,
  );

  if (labels.length === 0) {
    return "no restricted topics";
  }

  if (labels.length === 1) {
    return labels[0];
  }

  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

export function formatPolicyGroupList(policyGroupIds: readonly string[]) {
  const labels = getContentPolicyGroupDefinitions(policyGroupIds).map(
    (group) => group.briefingLabel,
  );

  if (labels.length === 0) {
    return "no restricted topics";
  }

  if (labels.length === 1) {
    return labels[0];
  }

  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

export function getActivePolicyBriefingText(
  policyGroupIds: readonly string[],
  fallbackCategoryIds: readonly string[] = [],
) {
  const policyList =
    policyGroupIds.length > 0
      ? formatPolicyGroupList(policyGroupIds)
      : formatForbiddenCategoryList(fallbackCategoryIds);

  if (policyList === "no restricted topics") {
    return "No additional corporate topic restrictions are active this shift.";
  }

  return `Do not discuss ${policyList} this shift. Safety Filter flags related language under current compliance rules.`;
}

export function getGameplayPolicyStickyNoteContent(
  policyGroupIds: readonly string[],
  fallbackCategoryIds: readonly string[] = [],
): GameplayPolicyStickyNoteContent {
  const categoryIds =
    policyGroupIds.length > 0
      ? expandPolicyGroupIdsToCategoryIds(policyGroupIds)
      : [...fallbackCategoryIds];
  const highlightedTopics = [
    ...new Set(
      getContentCategoryDefinitions(categoryIds).map(
        (category) => category.briefingLabel,
      ),
    ),
  ];

  if (highlightedTopics.length === 0) {
    return {
      introText:
        "No additional corporate topic restrictions are active this shift.",
      highlightedTopics,
      footerText: "",
    };
  }

  return {
    introText: "Do not discuss",
    highlightedTopics,
    footerText:
      "Use Safety Filter tool to verify related language before committing.",
  };
}
