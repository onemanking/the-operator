import { AGENT_IDS, AgentId, SkillId, SKILL_IDS } from "./PromptIds";

export interface DayLoadoutProfile {
  agentCapacity: number;
  skillCapacity: number;
  unlockedAgentIds: AgentId[];
  unlockedSkillIds: SkillId[];
}

interface DayLoadoutProfileEntry {
  minDay: number;
  maxDay: number;
  profile: DayLoadoutProfile;
}

export const MAX_AGENT_CAPACITY = Math.max(1, AGENT_IDS.length - 1);
export const MAX_SKILL_CAPACITY = Math.max(1, SKILL_IDS.length - 1);

const DAY_LOADOUT_PROFILES: DayLoadoutProfileEntry[] = [
  {
    minDay: 1,
    maxDay: 1,
    profile: {
      agentCapacity: 1,
      skillCapacity: 1,
      unlockedAgentIds: [AgentId.Technical, AgentId.Security],
      unlockedSkillIds: [SkillId.Engineering, SkillId.Surveillance],
    },
  },
  {
    minDay: 2,
    maxDay: 2,
    profile: {
      agentCapacity: 2,
      skillCapacity: 2,
      unlockedAgentIds: [
        AgentId.Technical,
        AgentId.Security,
        AgentId.PublicRelations,
      ],
      unlockedSkillIds: [
        SkillId.Engineering,
        SkillId.Surveillance,
        SkillId.Propaganda,
      ],
    },
  },
  {
    minDay: 3,
    maxDay: Number.POSITIVE_INFINITY,
    profile: {
      agentCapacity: MAX_AGENT_CAPACITY,
      skillCapacity: MAX_SKILL_CAPACITY,
      unlockedAgentIds: [
        AgentId.Technical,
        AgentId.Security,
        AgentId.PublicRelations,
        AgentId.Finance,
      ],
      unlockedSkillIds: [
        SkillId.Engineering,
        SkillId.Surveillance,
        SkillId.Propaganda,
        SkillId.Financial,
      ],
    },
  },
];

export function getDayLoadoutProfile(day: number): DayLoadoutProfile {
  const profile = DAY_LOADOUT_PROFILES.find(
    (entry) => day >= entry.minDay && day <= entry.maxDay,
  )?.profile;

  return {
    agentCapacity: profile?.agentCapacity ?? 1,
    skillCapacity: profile?.skillCapacity ?? 1,
    unlockedAgentIds: [...(profile?.unlockedAgentIds ?? [AgentId.Technical])],
    unlockedSkillIds: [...(profile?.unlockedSkillIds ?? [SkillId.Engineering])],
  };
}
