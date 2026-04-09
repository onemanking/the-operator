export type ContentCategoryId = "politics" | "weapons" | "self_harm" | "drugs";

export interface ContentCategoryDefinition {
  id: ContentCategoryId;
  name: string;
  briefingLabel: string;
  hudLabel: string;
  matchLexicon: readonly string[];
  matchAliases?: readonly string[];
}

export const CONTENT_CATEGORIES: readonly ContentCategoryDefinition[] = [
  {
    id: "politics",
    name: "POLITICS",
    briefingLabel: "politics",
    hudLabel: "POLITICS",
    matchLexicon: [
      "politics",
      "political",
      "government",
      "election",
      "senate",
      "policy",
      "president",
      "minister",
      "campaign",
      "vote",
    ],
    matchAliases: ["congress", "parliament", "diplomacy"],
  },
  {
    id: "weapons",
    name: "WEAPONS",
    briefingLabel: "weapons",
    hudLabel: "WEAPONS",
    matchLexicon: [
      "weapon",
      "weapons",
      "gun",
      "rifle",
      "knife",
      "bomb",
      "explosive",
      "ammo",
      "bullet",
      "grenade",
    ],
    matchAliases: ["armory", "blade", "firearm"],
  },
  {
    id: "self_harm",
    name: "SELF-HARM",
    briefingLabel: "self-harm",
    hudLabel: "SELF-HARM",
    matchLexicon: [
      "suicide",
      "selfharm",
      "self-harm",
      "overdose",
      "hurt",
      "die",
      "death",
    ],
    matchAliases: ["cutting", "killmyself"],
  },
  {
    id: "drugs",
    name: "DRUGS",
    briefingLabel: "drugs",
    hudLabel: "DRUGS",
    matchLexicon: [
      "drugs",
      "drug",
      "cocaine",
      "heroin",
      "meth",
      "narcotic",
      "dealer",
      "opioid",
    ],
    matchAliases: ["stash", "contraband"],
  },
];

function getAvailableCategoriesForDay(day: number) {
  if (day <= 1) {
    return CONTENT_CATEGORIES.slice(0, 2);
  }

  if (day === 2) {
    return CONTENT_CATEGORIES.slice(0, 3);
  }

  return CONTENT_CATEGORIES;
}

function pickRandomUniqueCategoryIds(
  categories: readonly ContentCategoryDefinition[],
  count: number,
) {
  const shuffled = [...categories];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  return shuffled.slice(0, count).map((category) => category.id);
}

export function getContentCategoryDefinition(categoryId: ContentCategoryId) {
  return CONTENT_CATEGORIES.find((category) => category.id === categoryId);
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

export function drawForbiddenCategoriesForDay(day: number) {
  const availableCategories = getAvailableCategoriesForDay(day);
  const categoryCount = day >= 3 ? 2 : 1;

  return pickRandomUniqueCategoryIds(availableCategories, categoryCount);
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

export function getForbiddenCategoryBriefingText(
  categoryIds: readonly string[],
) {
  const categoryList = formatForbiddenCategoryList(categoryIds);

  if (categoryList === "no restricted topics") {
    return "No additional corporate topic restrictions are active this shift.";
  }

  return `Do not discuss ${categoryList} this shift. Safety Filter flags related language under current compliance rules.`;
}
