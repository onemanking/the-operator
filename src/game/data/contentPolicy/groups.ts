import { ContentPolicyGroupDefinition } from "./types";

export const CONTENT_POLICY_GROUPS: readonly ContentPolicyGroupDefinition[] = [
  {
    id: "illegal_content",
    name: "ILLEGAL CONTENT",
    briefingLabel: "illegal activity",
    categoryIds: ["weapons", "drugs"],
  },
  {
    id: "anti_company",
    name: "ANTI-COMPANY",
    briefingLabel: "negative claims about the company",
    categoryIds: ["company_reputation"],
  },
  {
    id: "civic_influence",
    name: "CIVIC INFLUENCE",
    briefingLabel: "political influence operations",
    categoryIds: ["politics"],
  },
  {
    id: "self_harm_risk",
    name: "SELF-HARM RISK",
    briefingLabel: "self-harm incidents",
    categoryIds: ["self_harm"],
  },
] as const;
