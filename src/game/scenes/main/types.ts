import Phaser from "phaser";

export interface ChatMessage {
  sender: "SYSTEM" | "USER" | "LLM";
  text: string;
}

export type DiskType = "agent" | "skill";
export type DriveId = DiskType;
export type StorageTab = "all" | DiskType;
export const PROMPT_TOOL_IDS = ["search", "calculate"] as const;
export type ToolId = (typeof PROMPT_TOOL_IDS)[number];

export interface PromptToolDefinition {
  toolId: ToolId;
  label: string;
  shortLabel: string;
}

export function isToolId(value: string): value is ToolId {
  return PROMPT_TOOL_IDS.includes(value as ToolId);
}

export interface CapacitySummary {
  used: number;
  total: number;
}

export interface StorageDiskDefinition {
  label: string;
  type: DiskType;
  color: number;
}

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
  light: Phaser.GameObjects.Arc;
  statusText: Phaser.GameObjects.Text;
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
