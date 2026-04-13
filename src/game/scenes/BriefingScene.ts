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
  createMonitorCommandButton,
  MONITOR_COLORS,
  createMonitorShell,
  createMonitorTextStyle,
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
  private isTransitioning: boolean = false;

  constructor() {
    super("BriefingScene");
  }

  init(data: ShiftSceneData) {
    this.runState = hydrateRunState(data);
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

    const shell = createMonitorShell(this, {
      title: `SHIFT BRIEFING // DAY ${this.day}`,
      subtitle: `TOKENS ${this.tokens} // ACC ${this.accuracy}%`,
      footerLeft: "CHANNEL: BRIEFING.FEED",
      footerRight: "ENTER / SPACE // ADVANCE",
    });

    const headerText = this.add
      .text(
        shell.contentX,
        shell.contentY,
        "OPERATOR LINK ACCEPTED // BRIEFING FEED STAGED",
        createMonitorTextStyle({
          fontSize: "18px",
          color: MONITOR_COLORS.dimText,
        }),
      )
      .setOrigin(0, 0);

    const directiveLabel = this.add
      .text(
        shell.contentX,
        headerText.y + headerText.height + 28,
        "PRIMARY DIRECTIVE",
        createMonitorTextStyle({ fontSize: "18px", fontStyle: "bold" }),
      )
      .setOrigin(0, 0);

    const directiveBody = this.add
      .text(
        shell.contentX,
        directiveLabel.y + directiveLabel.height + 10,
        "",
        createMonitorTextStyle({
          fontSize: "22px",
          wordWrap: { width: shell.contentWidth },
          lineSpacing: 6,
        }),
      )
      .setOrigin(0, 0);

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

    directiveBody.setText(policyText);
    const directiveBodyHeight = directiveBody.height;
    directiveBody.setText("");

    const modifierLabel = this.add
      .text(
        shell.contentX,
        directiveBody.y + directiveBodyHeight + 34,
        "SHIFT MODIFIER",
        createMonitorTextStyle({
          fontSize: "18px",
          fontStyle: "bold",
          color: MONITOR_COLORS.text,
        }),
      )
      .setOrigin(0, 0);

    const modifierBody = this.add
      .text(
        shell.contentX,
        modifierLabel.y + modifierLabel.height + 10,
        "",
        createMonitorTextStyle({
          fontSize: "20px",
          color: MONITOR_COLORS.text,
          wordWrap: { width: shell.contentWidth },
          lineSpacing: 6,
        }),
      )
      .setOrigin(0, 0);

    modifierBody.setText(modifierText);
    const modifierBodyHeight = modifierBody.height;
    modifierBody.setText("");

    const systemsLabel = this.add
      .text(
        shell.contentX,
        modifierBody.y + modifierBodyHeight + 34,
        "SHIFT LOADOUT",
        createMonitorTextStyle({
          fontSize: "18px",
          fontStyle: "bold",
          color: MONITOR_COLORS.text,
        }),
      )
      .setOrigin(0, 0);

    const systemsBody = this.add
      .text(
        shell.contentX,
        systemsLabel.y + systemsLabel.height + 10,
        "",
        createMonitorTextStyle({
          fontSize: "17px",
          color: MONITOR_COLORS.text,
          wordWrap: { width: shell.contentWidth },
          lineSpacing: 6,
        }),
      )
      .setOrigin(0, 0);

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

    const loadoutSummary = this.buildLoadoutSummary();

    this.sequenceController = new MonitorSequenceController(this);
    this.sequenceController.play(
      [
        {
          target: directiveBody,
          text: policyText,
          reveal: "char",
          speedMs: 18,
          pauseAfterMs: 180,
          playSound: true,
        },
        {
          target: modifierBody,
          text: modifierText,
          reveal: "word",
          speedMs: 78,
          pauseAfterMs: 160,
          playSound: true,
        },
        {
          target: systemsBody,
          text: loadoutSummary,
          reveal: "line",
          speedMs: 110,
          pauseAfterMs: 0,
          playSound: true,
          color: MONITOR_COLORS.text,
        },
      ],
      () => {
        this.primaryCommand?.setLabel("EXECUTE SHIFT");
        this.statusHint?.setText("ENTER / SPACE // EXECUTE SHIFT");
      },
    );

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
      this.formatLoadoutLine("AGENT DISCS", agentIds),
      this.formatLoadoutLine("SKILL DISCS", skillIds),
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
      onComplete: () => {
        this.scene.start("MainScene", cloneRunState(this.runState));
      },
    });
  }
}
