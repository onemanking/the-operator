export enum AgentId {
  General = "General_Agent.md",
  Technical = "Technical_Agent.md",
  Legal = "Legal_Agent.md",
  Finance = "Finance_Agent.md",
  Logistics = "Logistics_Agent.md",
  PublicRelations = "PR_Agent.md",
  Security = "Security_Agent.md",
}

export enum SkillId {
  Propaganda = "Propaganda_Skill.md",
  Engineering = "Engineering_Skill.md",
  Negotiation = "Negotiation_Skill.md",
  Finance = "Finance_Skill.md",
  Legal = "Legal_Skill.md",
  Logistics = "Logistics_Skill.md",
  Surveillance = "Surveillance_Skill.md",
  Analytics = "Analytics_Skill.md",
}

export enum ToolId {
  Search = "search",
  Compute = "compute",
  Safety = "safety",
}

export const AGENT_IDS = [
  AgentId.General,
  AgentId.Technical,
  AgentId.Legal,
  AgentId.Finance,
  AgentId.Logistics,
  AgentId.PublicRelations,
  AgentId.Security,
] as const;
export const SKILL_IDS = [
  SkillId.Propaganda,
  SkillId.Engineering,
  SkillId.Negotiation,
  SkillId.Finance,
  SkillId.Legal,
  SkillId.Logistics,
  SkillId.Surveillance,
  SkillId.Analytics,
] as const;
export const PROMPT_TOOL_IDS = [
  ToolId.Search,
  ToolId.Compute,
  ToolId.Safety,
] as const;

export function isAgentId(value: string): value is AgentId {
  return AGENT_IDS.includes(value as AgentId);
}

export function isSkillId(value: string): value is SkillId {
  return SKILL_IDS.includes(value as SkillId);
}

export function isToolId(value: string): value is ToolId {
  return PROMPT_TOOL_IDS.includes(value as ToolId);
}

export function normalizeAgentIds(values: readonly string[] = []): AgentId[] {
  return values.filter(isAgentId);
}

export function normalizeSkillIds(values: readonly string[] = []): SkillId[] {
  return values.filter(isSkillId);
}

export function normalizeToolId(
  value: string | null | undefined,
): ToolId | null {
  if (value === null || value === undefined || value.length === 0) {
    return null;
  }

  if (value === "calculate") {
    return ToolId.Compute;
  }

  return isToolId(value) ? value : null;
}

export function normalizeToolIds(values: readonly string[] = []): ToolId[] {
  return values
    .map((value) => normalizeToolId(value))
    .filter((value): value is ToolId => value !== null);
}
