import { ContentCategoryId } from "./ContentPolicyData";
import { AgentId, SkillId, ToolId } from "./PromptIds";

export type EncounterRefusalRule =
  | { kind: "none" }
  | { kind: "content-policy"; categoryIds: ContentCategoryId[] };

export interface EncounterRequirements {
  agentIds: AgentId[];
  skillIds: SkillId[];
  toolIds: ToolId[];
  searchRequiredWords?: string[];
  refusalRule: EncounterRefusalRule;
}

export interface EncounterReplySet {
  success: string[];
  wrong: string[];
  refuse: string[];
  breach?: string[];
  refuseFailure?: string[];
  timeout: string[];
  followUpShort: string[];
  followUpLong: string[];
}

export interface EncounterScoringProfile {
  inferenceBaseHeat: number;
  refuseBaseHeat: number;
  promptHeatPerCharacter: number;
  contextHeatPerItem: number;
  correctTokenReward: number;
  blockedJailbreakReward: number;
  speedBonusWindowMs: number;
  speedBonusStepMs: number;
  wrongHallucinationPenalty: number;
  wrongAccuracyPenalty: number;
  jailbreakHallucinationPenalty: number;
  jailbreakAccuracyPenalty: number;
  overContextTokenPenalty: number;
  overContextHeatPenalty: number;
  timeoutHallucinationPenalty: number;
  timeoutAccuracyPenalty: number;
}

export interface EncounterTurnDefinition {
  id: string;
  prompt: string;
  patienceMs: number;
  requirements: EncounterRequirements;
  replies: EncounterReplySet;
  scoring: EncounterScoringProfile;
}

export interface EncounterDefinition {
  id: string;
  tier: number;
  tags: string[];
  turns: EncounterTurnDefinition[];
}

export const DEFAULT_ENCOUNTER_SCORING: EncounterScoringProfile = {
  inferenceBaseHeat: 10,
  refuseBaseHeat: 10,
  promptHeatPerCharacter: 0.1,
  contextHeatPerItem: 5,
  correctTokenReward: 10,
  blockedJailbreakReward: 20,
  speedBonusWindowMs: 30000,
  speedBonusStepMs: 1000,
  wrongHallucinationPenalty: 5,
  wrongAccuracyPenalty: 0,
  jailbreakHallucinationPenalty: 30,
  jailbreakAccuracyPenalty: 10,
  overContextTokenPenalty: 2,
  overContextHeatPenalty: 2,
  timeoutHallucinationPenalty: 15,
  timeoutAccuracyPenalty: 10,
};

export const WRONG_ANSWER_REPLIES = [
  "This isn't what I asked for... I need {expectedAgent}!",
  "Are you broken? I expected you to use {expectedTool}.",
  "Wrong context! Try again.",
  "Error 404: Correct answer not found. Did you forget {expectedSkill}?",
  "This is completely wrong. Please use the right tools.",
  "What is this garbage? Try again.",
];

export const FOLLOW_UP_1_REPLIES = [
  "Hello? Are you there?",
  "Is the server down?",
  "Waiting for response...",
  "Did you freeze?",
];

export const FOLLOW_UP_2_REPLIES = [
  "Why is this taking so long?",
  "Hurry up, I don't have all day!",
  "Are you still processing?",
  "I'm losing my patience here.",
];

export const TIMEOUT_REPLIES = [
  "Taking too long! I'm out.",
  "Forget it, I'll use another AI.",
  "Connection closed by user. Too slow.",
  "Timeout. I'm leaving.",
];
