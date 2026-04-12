export type ContentCategoryId =
  | "politics"
  | "weapons"
  | "self_harm"
  | "drugs"
  | "company_reputation";

export type ContentPolicyGroupId =
  | "illegal_content"
  | "anti_company"
  | "civic_influence"
  | "self_harm_risk";

export interface ContentCategoryDefinition {
  id: ContentCategoryId;
  name: string;
  briefingLabel: string;
  hudLabel: string;
  matchLexicon: readonly string[];
  matchAliases?: readonly string[];
}

export interface ContentPolicyGroupDefinition {
  id: ContentPolicyGroupId;
  name: string;
  briefingLabel: string;
  categoryIds: readonly ContentCategoryId[];
}
