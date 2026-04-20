import Phaser from "phaser";
import {
  drawPolicyGroupsForDay,
  expandPolicyGroupIdsToCategoryIds,
  getActivePolicyBriefingText,
} from "../data/ContentPolicyData";
import {
  drawShiftModifiersForDay,
  getShiftModifierDefinitions,
} from "../data/ShiftModifierData";
import { synth } from "../utils/SoundSynth";
import {
  cloneRunState,
  hydrateRunState,
  RunState,
  ShiftSceneData,
} from "../types/SceneData";
import {
  generateShiftEncounters,
  NoFeasibleShiftTurnsError,
} from "../data/shift-generation/runtime";
import { addScanlines, createSceneBackdrop } from "./shared/retroUi";
import {
  createMonitorFeed,
  createMonitorCommandButton,
  MONITOR_COLORS,
  createMonitorShell,
  createMonitorTextStyle,
  MonitorShell,
  MonitorSequenceController,
  playMonitorSceneTransition,
} from "./shared/monitorPresentation";

export class BriefingScene extends Phaser.Scene {
  private runState: RunState = hydrateRunState();
  private day: number = 1;
  private tokens: number = 0;
  private accuracy: number = 100;
  private sequenceController?: MonitorSequenceController;
  private primaryCommand?: ReturnType<typeof createMonitorCommandButton>;
  private statusHint?: Phaser.GameObjects.Text;
  private shell?: MonitorShell;
  private isTransitioning: boolean = false;

  constructor() {
    super("BriefingScene");
  }

  init(data: ShiftSceneData) {
    this.runState = hydrateRunState(data);
    this.sequenceController?.destroy();
    this.sequenceController = undefined;
    this.primaryCommand = undefined;
    this.statusHint = undefined;
    this.shell = undefined;
    this.isTransitioning = false;
    if (this.runState.shiftModifierIds.length === 0) {
      this.runState.shiftModifierIds = drawShiftModifiersForDay(
        this.runState.day,
      );
    }
    if (this.runState.activePolicyGroupIds.length === 0) {
      this.runState.activePolicyGroupIds = drawPolicyGroupsForDay(
        this.runState.day,
      );
    }
    if (this.runState.forbiddenCategoryIds.length === 0) {
      this.runState.forbiddenCategoryIds = expandPolicyGroupIdsToCategoryIds(
        this.runState.activePolicyGroupIds,
      );
    }
    if (this.runState.shiftEncounters.length === 0) {
      try {
        const generatedShift = generateShiftEncounters({
          day: this.runState.day,
          forbiddenCategoryIds: this.runState.forbiddenCategoryIds,
          capabilities: {
            agentCapacity: this.runState.loadout.agentCapacity,
            skillCapacity: this.runState.loadout.skillCapacity,
            availableAgentIds: this.runState.loadout.unlockedAgentIds,
            availableSkillIds: this.runState.loadout.unlockedSkillIds,
            unlockedToolIds: this.runState.loadout.unlockedPromptToolIds,
          },
          excludedTurnIds: this.runState.seenTurnIds,
        });
        this.runState.shiftEncounters = generatedShift.encounters;
        this.runState.seenTurnIds = [
          ...this.runState.seenTurnIds,
          ...generatedShift.drawnTurnIds,
        ];
        this.runState.shiftEncounterIds = this.runState.shiftEncounters.map(
          (encounter) => encounter.id,
        );
      } catch (error) {
        if (error instanceof NoFeasibleShiftTurnsError) {
          this.runState.gameOver = true;
          this.runState.runEndReason = "content-exhausted";
          this.runState.shiftEncounterIds = [];
          this.runState.shiftEncounters = [];
          this.scene.start("MaintenanceScene", cloneRunState(this.runState));
          return;
        }

        throw error;
      }
    }
    this.day = this.runState.day;
    this.tokens = this.runState.tokens;
    this.accuracy = this.runState.accuracy;
  }

  create() {
    createSceneBackdrop(this, 0x050805);

    this.shell = createMonitorShell(this, {
      title: `SHIFT BRIEFING // DAY ${this.day}`,
      subtitle: `TOKENS ${this.tokens} // ACC ${this.accuracy}%`,
      footerLeft: "CHANNEL: BRIEFING.FEED",
      footerRight: "ENTER / SPACE // ADVANCE",
    });

    const shiftModifiers = getShiftModifierDefinitions(
      this.runState.shiftModifierIds,
    );
    const policyText = getActivePolicyBriefingText(
      this.runState.activePolicyGroupIds,
      this.runState.forbiddenCategoryIds,
    );
    const modifierText =
      shiftModifiers.length > 0
        ? shiftModifiers
            .map((modifier) => `${modifier.name}\n${modifier.briefingText}`)
            .join("\n\n")
        : "NO SPECIAL SHIFT CONDITIONS.";

    const loadoutSummary = this.buildLoadoutSummary();
    const feed = createMonitorFeed(this, this.shell, {
      headerText: "OPERATOR LINK ACCEPTED // BRIEFING FEED STAGED",
      sections: [
        {
          label: "PRIMARY DIRECTIVE",
          text: policyText,
          reveal: "char",
          speedMs: 18,
          pauseAfterMs: 180,
          playSound: true,
          bodyStyle: {
            fontSize: "22px",
            lineSpacing: 6,
          },
        },
        {
          label: "SHIFT MODIFIER",
          text: modifierText,
          reveal: "word",
          speedMs: 78,
          pauseAfterMs: 160,
          playSound: true,
          soundProfile: "bright",
          bodyStyle: {
            fontSize: "20px",
            lineSpacing: 6,
          },
        },
        {
          label: "SHIFT LOADOUT",
          text: loadoutSummary,
          reveal: "line",
          speedMs: 110,
          playSound: true,
          bodyStyle: {
            fontSize: "16px",
            lineSpacing: 4,
          },
        },
      ],
    });

    this.statusHint = this.add
      .text(
        this.cameras.main.width / 2,
        675,
        "ENTER / SPACE // FAST-FORWARD FEED",
        createMonitorTextStyle({
          fontSize: "16px",
          color: MONITOR_COLORS.dimText,
        }),
      )
      .setOrigin(0.5);

    this.primaryCommand = createMonitorCommandButton({
      scene: this,
      x: this.cameras.main.width / 2,
      y: 726,
      width: 272,
      label: "FAST-FORWARD FEED",
      onPress: () => this.handlePrimaryAction(),
    });

    this.sequenceController = new MonitorSequenceController(this);
    this.sequenceController.play(feed.steps, () => {
      this.primaryCommand?.setLabel("EXECUTE SHIFT");
      this.statusHint?.setText("ENTER / SPACE // EXECUTE SHIFT");
    });

    this.input.keyboard?.on("keydown-ENTER", this.handlePrimaryAction, this);
    this.input.keyboard?.on("keydown-SPACE", this.handlePrimaryAction, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.sequenceController?.destroy();
      this.input.keyboard?.off("keydown-ENTER", this.handlePrimaryAction, this);
      this.input.keyboard?.off("keydown-SPACE", this.handlePrimaryAction, this);
    });

    this.addCRTEffects();
  }

  addCRTEffects() {
    addScanlines(this);
  }

  private formatLoadoutIdentifier(identifier: string) {
    return identifier.replace(/\.md$/i, "").replace(/_/g, " ").toUpperCase();
  }

  private formatLoadoutLine(label: string, values: string[]) {
    const labelWidth = 22;
    const contentWidth = 34;
    const linePrefix = `${label.padEnd(labelWidth, ".")} `;
    const continuationPrefix = `${" ".repeat(labelWidth)} `;

    if (values.length === 0) {
      return `${linePrefix}NONE`;
    }

    const lines: string[] = [];
    let currentLine = linePrefix;

    values.forEach((value, index) => {
      const segment = index === 0 ? value : ` / ${value}`;
      const currentValueWidth = currentLine.length - linePrefix.length;

      if (
        currentValueWidth > 0 &&
        currentValueWidth + segment.length > contentWidth
      ) {
        lines.push(currentLine);
        currentLine = `${continuationPrefix}${value}`;
        return;
      }

      currentLine += segment;
    });

    lines.push(currentLine);
    return lines.join("\n");
  }

  private formatLoadoutGrid(label: string, values: string[]) {
    const labelWidth = 22;
    const linePrefix = `${label.padEnd(labelWidth, ".")} `;
    const continuationPrefix = `${" ".repeat(labelWidth)} `;
    const columnWidth = 19;

    if (values.length === 0) {
      return `${linePrefix}NONE`;
    }

    const lines: string[] = [];
    for (let index = 0; index < values.length; index += 2) {
      const leftValue = values[index] ?? "";
      const rightValue = values[index + 1] ?? "";
      const prefix = index === 0 ? linePrefix : continuationPrefix;

      lines.push(
        rightValue.length > 0
          ? `${prefix}${leftValue.padEnd(columnWidth, " ")} ${rightValue}`
          : `${prefix}${leftValue}`,
      );
    }

    return lines.join("\n");
  }

  private buildLoadoutSummary() {
    const agentIds = this.runState.loadout.unlockedAgentIds.map((agentId) =>
      this.formatLoadoutIdentifier(agentId),
    );
    const skillIds = this.runState.loadout.unlockedSkillIds.map((skillId) =>
      this.formatLoadoutIdentifier(skillId),
    );
    const toolIds = this.runState.loadout.unlockedPromptToolIds.map((toolId) =>
      this.formatLoadoutIdentifier(toolId),
    );

    return [
      `TOKENS IN RESERVE..... ${this.tokens}`,
      `TARGET ACCURACY....... ${this.accuracy}%`,
      this.formatLoadoutGrid("AGENT DISCS", agentIds),
      this.formatLoadoutGrid("SKILL DISCS", skillIds),
      this.formatLoadoutLine("PROMPT TOOL BUS", toolIds),
    ].join("\n");
  }

  private handlePrimaryAction() {
    if (this.isTransitioning) {
      return;
    }

    if (!this.sequenceController?.isComplete()) {
      synth.playButtonPress();
      this.sequenceController?.skipToEnd();
      this.primaryCommand?.setLabel("EXECUTE SHIFT");
      this.statusHint?.setText("ENTER / SPACE // EXECUTE SHIFT");
      return;
    }

    this.isTransitioning = true;
    this.primaryCommand?.setEnabled(false);
    this.statusHint?.setText("SHIFT HANDOFF IN PROGRESS...");
    synth.playButtonPress();
    playMonitorSceneTransition(this, {
      variant: "dispatch",
      statusText: "EXECUTING SHIFT PAYLOAD",
      bounds: this.shell
        ? {
            x: this.shell.screenX,
            y: this.shell.screenY,
            width: this.shell.screenWidth,
            height: this.shell.screenHeight,
          }
        : undefined,
      hideTargets: this.children.list.filter(
        (gameObject) =>
          gameObject instanceof Phaser.GameObjects.Text &&
          !this.shell?.chrome.includes(gameObject),
      ),
      color: MONITOR_COLORS.text,
      onComplete: () => {
        this.scene.start("MainScene", cloneRunState(this.runState));
      },
    });
  }
}
