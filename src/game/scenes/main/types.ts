import Phaser from "phaser";
import { AgentId, SkillId, ToolId } from "../../data/PromptIds";

export {
  AGENT_IDS,
  AgentId,
  PROMPT_TOOL_IDS,
  SKILL_IDS,
  SkillId,
  ToolId,
  isAgentId,
  isSkillId,
  isToolId,
  normalizeAgentIds,
  normalizeSkillIds,
  normalizeToolId,
  normalizeToolIds,
} from "../../data/PromptIds";

export interface ChatMessage {
  sender: "SYSTEM" | "USER" | "LLM";
  text: string;
}

export type DiskType = "agent" | "skill";
export type DriveId = DiskType;
export type StorageTab = "all" | DiskType;

export interface PromptToolDefinition {
  toolId: ToolId;
  label: string;
  shortLabel: string;
}

export interface CapacitySummary {
  used: number;
  total: number;
}

export interface AgentStorageDiskDefinition {
  label: AgentId;
  type: "agent";
  color: number;
}

export interface SkillStorageDiskDefinition {
  label: SkillId;
  type: "skill";
  color: number;
}

export type StorageDiskDefinition =
  | AgentStorageDiskDefinition
  | SkillStorageDiskDefinition;

export interface StorageDiskInstance {
  definition: StorageDiskDefinition;
  container: Phaser.GameObjects.Container;
  handle: Phaser.GameObjects.Rectangle;
  width: number;
  height: number;
}

export interface DriveConfig {
  id: DriveId;
  title: string;
  acceptType: DiskType;
  snapPoint: Phaser.Math.Vector2;
  hoverBounds: Phaser.Geom.Rectangle;
  capacity: number;
  housingY: number;
  housingHeight: number;
  lcdY: number;
}

export interface DriveUi {
  glow: Phaser.GameObjects.Rectangle;
  frame: Phaser.GameObjects.Rectangle;
  mouth: Phaser.GameObjects.Rectangle;
  lightHalo: Phaser.GameObjects.Arc;
  light: Phaser.GameObjects.Arc;
  mountedText: Phaser.GameObjects.Text;
  ejectButton: Phaser.GameObjects.Rectangle;
  ejectLabel: Phaser.GameObjects.Text;
}

export interface DiskLoadResult {
  success: boolean;
  driveId?: DriveId;
  statusMessage: string;
}

export interface StorageTabDefinition {
  tab: StorageTab;
  label: string;
  x: number;
  width: number;
}

export interface StorageTabButton {
  tab: StorageTab;
  body: Phaser.GameObjects.Rectangle;
  lip: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}
