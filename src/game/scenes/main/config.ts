import Phaser from "phaser";
import { RUN_CONFIG } from "../../data/RunData";
import {
  AgentId,
  DriveConfig,
  DriveId,
  PromptToolDefinition,
  SkillId,
  StorageDiskDefinition,
  StorageTabDefinition,
  ToolId,
} from "./types";

const AGENT_DISK_COLOR = 0x99958a;
const SKILL_DISK_COLOR = 0x7a8a99;

export const STORAGE_DISKS: StorageDiskDefinition[] = [
  { label: AgentId.General, type: "agent", color: AGENT_DISK_COLOR },
  { label: AgentId.Technical, type: "agent", color: AGENT_DISK_COLOR },
  { label: AgentId.PublicRelations, type: "agent", color: AGENT_DISK_COLOR },
  { label: AgentId.Security, type: "agent", color: AGENT_DISK_COLOR },
  { label: SkillId.Propaganda, type: "skill", color: SKILL_DISK_COLOR },
  { label: SkillId.Engineering, type: "skill", color: SKILL_DISK_COLOR },
  { label: SkillId.Surveillance, type: "skill", color: SKILL_DISK_COLOR },
];

export const STORAGE_TABS: StorageTabDefinition[] = [
  { tab: "all", label: "ALL", x: 18, width: 42 },
  { tab: "agent", label: "AGENTS", x: 64, width: 70 },
  { tab: "skill", label: "SKILLS", x: 138, width: 64 },
];

export const PROMPT_TOOLS: PromptToolDefinition[] = [
  { toolId: ToolId.Search, label: "SEARCH", shortLabel: "SRCH" },
  { toolId: ToolId.Compute, label: "COMPUTE", shortLabel: "COMP" },
  { toolId: ToolId.Safety, label: "SAFETY FILTER", shortLabel: "SAFE" },
];

export function getPromptToolDefinition(toolId: ToolId) {
  return PROMPT_TOOLS.find((tool) => tool.toolId === toolId);
}

export function sortPromptToolIds(toolIds: readonly ToolId[]) {
  const order = new Map(
    PROMPT_TOOLS.map((tool, index) => [tool.toolId, index] as const),
  );

  return [...toolIds].sort((left, right) => {
    return (
      (order.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(right) ?? Number.MAX_SAFE_INTEGER)
    );
  });
}

export function createDriveConfigs(capacityOverrides?: {
  agentCapacity?: number;
  skillCapacity?: number;
}): Record<DriveId, DriveConfig> {
  return {
    agent: {
      id: "agent",
      title: "DRIVE A: [AGENTS]",
      acceptType: "agent",
      snapPoint: new Phaser.Math.Vector2(558, 534),
      hoverBounds: new Phaser.Geom.Rectangle(434, 512, 252, 44),
      capacity:
        capacityOverrides?.agentCapacity ?? RUN_CONFIG.defaultAgentCapacity,
      housingY: 510,
      housingHeight: 54,
      lcdY: 532,
    },
    skill: {
      id: "skill",
      title: "DRIVE B: [SKILLS]",
      acceptType: "skill",
      snapPoint: new Phaser.Math.Vector2(558, 602),
      hoverBounds: new Phaser.Geom.Rectangle(434, 580, 252, 44),
      capacity:
        capacityOverrides?.skillCapacity ?? RUN_CONFIG.defaultSkillCapacity,
      housingY: 578,
      housingHeight: 54,
      lcdY: 600,
    },
  };
}
