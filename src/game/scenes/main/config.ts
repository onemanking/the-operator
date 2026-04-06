import Phaser from "phaser";
import {
  DriveConfig,
  DriveId,
  StorageDiskDefinition,
  StorageTabDefinition,
  ToolButtonDefinition,
} from "./types";

export const STORAGE_DISKS: StorageDiskDefinition[] = [
  { label: "Coding_Agent.md", type: "agent", color: 0x99958a },
  { label: "General_Agent.md", type: "agent", color: 0x99958a },
  { label: "Python_Skill.md", type: "skill", color: 0x7a8a99 },
  { label: "Creative_Skill.md", type: "skill", color: 0x7a8a99 },
];

export const STORAGE_TABS: StorageTabDefinition[] = [
  { tab: "all", label: "ALL", x: 18, width: 42 },
  { tab: "agent", label: "AGENTS", x: 64, width: 70 },
  { tab: "skill", label: "SKILLS", x: 138, width: 64 },
];

export const TOOL_BUTTONS: ToolButtonDefinition[] = [
  { y: 70, label: "[ SEARCH ]", toolId: "search" },
  { y: 150, label: "[ CALCULATE ]", toolId: "calculate" },
  { y: 230, label: "[ CLEAR TOOL ]", toolId: "none" },
];

export function createDriveConfigs(): Record<DriveId, DriveConfig> {
  return {
    agent: {
      id: "agent",
      title: "DRIVE A: AGENT",
      acceptType: "agent",
      snapPoint: new Phaser.Math.Vector2(536, 539),
      hoverBounds: new Phaser.Geom.Rectangle(488, 525, 96, 28),
      capacity: 1,
      housingY: 508,
      housingHeight: 60,
      lcdY: 546,
    },
    skill: {
      id: "skill",
      title: "DRIVE B: SKILLS",
      acceptType: "skill",
      snapPoint: new Phaser.Math.Vector2(536, 608),
      hoverBounds: new Phaser.Geom.Rectangle(488, 594, 96, 28),
      capacity: 2,
      housingY: 578,
      housingHeight: 72,
      lcdY: 621,
    },
  };
}
