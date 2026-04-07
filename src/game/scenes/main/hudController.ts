import Phaser from "phaser";
import { synth } from "../../utils/SoundSynth";
import { PROMPT_TOOLS } from "./config";
import { ToolId } from "./types";

interface HudControllerBindings {
  onInference: () => void;
  onRefuse: () => void;
  onUseUtility: () => void;
  onTogglePromptTool: (toolId: ToolId) => void;
  setTaskTextObj: (value: Phaser.GameObjects.Text) => void;
  setChatTextObj: (value: Phaser.GameObjects.Text) => void;
  setPatienceBarFill: (value: Phaser.GameObjects.Rectangle) => void;
  setHeatBarFill: (value: Phaser.GameObjects.Rectangle) => void;
  setHallucinationBarFill: (value: Phaser.GameObjects.Rectangle) => void;
  getShiftModifierLabel: () => string | null;
  getUnlockedPromptToolIds: () => ToolId[];
  getSelectedPromptToolIds: () => ToolId[];
  getUtilityDisplayText: () => string;
  canUseUtility: () => boolean;
  getHeat: () => number;
  getHallucination: () => number;
  isOverheated: () => boolean;
}

interface PromptToolButtonUi {
  body: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  lamp: Phaser.GameObjects.Arc;
  shadow: Phaser.GameObjects.Rectangle;
}

export class MainSceneHudController {
  private utilityBtn!: Phaser.GameObjects.Rectangle;
  private utilityTxt!: Phaser.GameObjects.Text;
  private utilityLamp!: Phaser.GameObjects.Rectangle;
  private promptToolButtons = new Map<ToolId, PromptToolButtonUi>();
  private updateBarsHandler?: () => void;
  private cleanupHandler?: () => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bindings: HudControllerBindings,
  ) {}

  createLayout() {
    const monitorOuter = this.scene.add
      .rectangle(230, 30, 564, 380, 0x2c2a25)
      .setOrigin(0);
    monitorOuter.setStrokeStyle(4, 0x111111);

    const terminalBg = this.scene.add
      .rectangle(250, 50, 524, 340, 0x051505)
      .setOrigin(0);
    terminalBg.setStrokeStyle(2, 0x33ff33);

    this.scene.add.text(250, 20, "USER CONNECTION:", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#d4c5b0",
    });
    this.scene.add.rectangle(400, 20, 374, 15, 0x111111).setOrigin(0);
    const patienceBarFill = this.scene.add
      .rectangle(402, 22, 370, 11, 0xffaa00)
      .setOrigin(0);
    this.bindings.setPatienceBarFill(patienceBarFill);

    const taskTextObj = this.scene.add.text(260, 60, "", {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: "14px",
      color: "#33ff33",
      wordWrap: { width: 500 },
    });
    this.bindings.setTaskTextObj(taskTextObj);

    const chatTextObj = this.scene.add.text(260, 112, "", {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: "14px",
      color: "#33ff33",
      wordWrap: { width: 500 },
    });
    this.bindings.setChatTextObj(chatTextObj);
  }

  createPromptToolGrid() {
    const unlockedPromptToolIds = this.bindings.getUnlockedPromptToolIds();
    const toolDefinitions = PROMPT_TOOLS.filter((tool) =>
      unlockedPromptToolIds.includes(tool.toolId),
    );
    const rowCount = Math.max(1, Math.ceil(toolDefinitions.length / 2));
    const panelHeight = 72 + rowCount * 70;

    this.scene.add.rectangle(804, 0, 220, panelHeight, 0x2c2a25).setOrigin(0);
    this.scene.add.rectangle(800, 0, 4, panelHeight, 0x111111).setOrigin(0);
    this.scene.add.text(824, 20, "TOOL CONTROL", {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#d4c5b0",
      fontStyle: "bold",
    });

    toolDefinitions.forEach((tool, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = 818 + column * 92;
      const y = 66 + row * 70;

      const shadow = this.scene.add
        .rectangle(x + 40, y + 32, 80, 52, 0x111111)
        .setOrigin(0.5);
      const body = this.scene.add
        .rectangle(x + 40, y + 28, 80, 52, 0x7f796e)
        .setOrigin(0.5)
        .setStrokeStyle(2, 0x111111)
        .setInteractive({ useHandCursor: true });
      const lamp = this.scene.add
        .circle(x + 14, y + 14, 5, 0x173617)
        .setStrokeStyle(1, 0x081208);
      const label = this.scene.add
        .text(x + 44, y + 28, tool.shortLabel, {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#111111",
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      body.on("pointerdown", () => {
        body.y += 4;
        label.y += 4;
        lamp.y += 4;
        this.scene.time.delayedCall(100, () => {
          body.y -= 4;
          label.y -= 4;
          lamp.y -= 4;
        });
        this.bindings.onTogglePromptTool(tool.toolId);
      });

      this.promptToolButtons.set(tool.toolId, { body, label, lamp, shadow });
    });
  }

  createActionButtons() {
    const actionButtonWidth = 258;

    const runBtn = this.createWideButton({
      x: 250,
      y: 418,
      width: actionButtonWidth,
      height: 52,
      fillColor: 0x1a8f1a,
      shadowColor: 0x0d4a0d,
      strokeColor: 0x33ff33,
      label: "INFERENCE",
      labelOffsetX: 0,
      labelStyle: { fontSize: "26px", color: "#f5fff1" },
      onPress: this.bindings.onInference,
    });

    const refuseBtn = this.createWideButton({
      x: 516,
      y: 418,
      width: actionButtonWidth,
      height: 52,
      fillColor: 0x8b2420,
      shadowColor: 0x421110,
      strokeColor: 0xff6f61,
      label: "REFUSE",
      labelOffsetX: 0,
      labelStyle: { fontSize: "26px", color: "#fff1ec" },
      onPress: this.bindings.onRefuse,
    });

    runBtn.body.setDepth(3);
    refuseBtn.body.setDepth(3);
    runBtn.label.setDepth(4);
    refuseBtn.label.setDepth(4);
  }

  createUtilitySection() {
    this.scene.add.rectangle(804, 544, 200, 106, 0x232323).setOrigin(0);
    this.scene.add.rectangle(804, 540, 200, 4, 0x111111).setOrigin(0);
    this.scene.add.text(818, 552, "ACTIVE UTILITY", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#d4c5b0",
      fontStyle: "bold",
    });

    this.scene.add.rectangle(822, 592, 164, 48, 0x4f4331).setOrigin(0);
    this.utilityBtn = this.scene.add
      .rectangle(822, 588, 164, 48, 0xc6b084)
      .setOrigin(0)
      .setStrokeStyle(2, 0x111111)
      .setInteractive({ useHandCursor: true });

    this.utilityLamp = this.scene.add
      .rectangle(834, 598, 18, 6, 0x4d3a10)
      .setOrigin(0)
      .setStrokeStyle(1, 0x211706);
    this.scene.add.rectangle(856, 598, 18, 6, 0x4d3a10).setOrigin(0);
    this.scene.add.rectangle(878, 598, 18, 6, 0x4d3a10).setOrigin(0);

    this.utilityTxt = this.scene.add
      .text(904, 612, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#111111",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: 110 },
      })
      .setOrigin(0.5);

    this.utilityBtn.on("pointerdown", () => {
      synth.playButtonPress();
      this.utilityBtn.y += 4;
      this.utilityTxt.y += 4;
      this.scene.time.delayedCall(100, () => {
        this.utilityBtn.y -= 4;
        this.utilityTxt.y -= 4;
      });
      this.bindings.onUseUtility();
    });
  }

  createStatusBars() {
    this.scene.add.rectangle(0, 668, 1024, 100, 0x22201c).setOrigin(0);
    this.scene.add.rectangle(0, 664, 1024, 4, 0x111111).setOrigin(0);

    const shiftModifierText = this.scene.add.text(
      20,
      692,
      `SHIFT MOD: ${this.bindings.getShiftModifierLabel() ?? "NORMAL"}`,
      {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffb000",
        wordWrap: { width: 210 },
      },
    );

    this.scene.add.text(250, 680, "THERMAL LOAD:", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#d4c5b0",
    });
    this.scene.add.rectangle(380, 680, 200, 20, 0x111111).setOrigin(0);
    const heatBarFill = this.scene.add
      .rectangle(382, 682, 0, 16, 0xff5500)
      .setOrigin(0);
    this.bindings.setHeatBarFill(heatBarFill);

    this.scene.add.text(650, 680, "HALLUCINATION:", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#d4c5b0",
    });
    this.scene.add.rectangle(790, 680, 150, 20, 0x111111).setOrigin(0);
    const hallucinationBarFill = this.scene.add
      .rectangle(792, 682, 0, 16, 0xff0000)
      .setOrigin(0);
    this.bindings.setHallucinationBarFill(hallucinationBarFill);

    this.cleanupSceneListeners();

    this.updateBarsHandler = () => {
      this.syncPromptToolButtons();
      this.syncUtilitySection();

      shiftModifierText.setText(
        `SHIFT MOD: ${this.bindings.getShiftModifierLabel() ?? "NORMAL"}`,
      );
      heatBarFill.width = 196 * Math.min(1, this.bindings.getHeat() / 100);
      hallucinationBarFill.width =
        146 * Math.min(1, this.bindings.getHallucination() / 100);

      if (this.bindings.isOverheated()) {
        heatBarFill.setFillStyle(0xff0000);
      } else if (this.bindings.getHeat() > 80) {
        heatBarFill.setFillStyle(0xffaa00);
      } else {
        heatBarFill.setFillStyle(0xff5500);
      }
    };

    this.cleanupHandler = () => {
      this.cleanupSceneListeners();
    };

    this.scene.events.on("updateBars", this.updateBarsHandler);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupHandler);
    this.scene.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupHandler);
    this.scene.events.emit("updateBars");
  }

  private createWideButton(options: {
    x: number;
    y: number;
    width: number;
    height: number;
    fillColor: number;
    shadowColor: number;
    strokeColor: number;
    label: string;
    labelOffsetX: number;
    labelStyle: Phaser.Types.GameObjects.Text.TextStyle;
    onPress: () => void;
  }) {
    this.scene.add
      .rectangle(
        options.x + options.width / 2,
        options.y + options.height / 2 + 4,
        options.width,
        options.height,
        options.shadowColor,
      )
      .setOrigin(0.5);

    const body = this.scene.add
      .rectangle(
        options.x + options.width / 2,
        options.y + options.height / 2,
        options.width,
        options.height,
        options.fillColor,
      )
      .setOrigin(0.5)
      .setStrokeStyle(2, options.strokeColor)
      .setInteractive({ useHandCursor: true });

    const label = this.scene.add
      .text(
        options.x + options.width / 2 + options.labelOffsetX,
        options.y + options.height / 2,
        options.label,
        {
          fontFamily: "monospace",
          fontStyle: "bold",
          ...options.labelStyle,
        },
      )
      .setOrigin(0.5);

    body.on("pointerdown", () => {
      synth.playButtonPress();
      body.y += 4;
      label.y += 4;
      this.scene.time.delayedCall(100, () => {
        body.y -= 4;
        label.y -= 4;
      });
      options.onPress();
    });

    return { body, label };
  }

  private syncPromptToolButtons() {
    const selectedPromptToolIds = new Set(
      this.bindings.getSelectedPromptToolIds(),
    );

    this.promptToolButtons.forEach((button, toolId) => {
      const isSelected = selectedPromptToolIds.has(toolId);
      button.body.setFillStyle(isSelected ? 0xb9af9b : 0x7f796e);
      button.label.setColor(isSelected ? "#101010" : "#111111");
      button.lamp.setFillStyle(isSelected ? 0x33ff33 : 0x173617);
      button.shadow.setFillStyle(isSelected ? 0x294829 : 0x111111);
    });
  }

  private syncUtilitySection() {
    if (!this.utilityBtn || !this.utilityTxt || !this.utilityLamp) {
      return;
    }

    const utilityEnabled = this.bindings.canUseUtility();
    this.utilityTxt.setText(this.bindings.getUtilityDisplayText());
    this.utilityBtn.setFillStyle(utilityEnabled ? 0xc6b084 : 0x7f776a);
    this.utilityBtn.setAlpha(utilityEnabled ? 1 : 0.78);
    this.utilityTxt.setAlpha(utilityEnabled ? 1 : 0.78);
    this.utilityLamp.setFillStyle(utilityEnabled ? 0xffb000 : 0x4d3a10);
  }

  private cleanupSceneListeners() {
    if (this.updateBarsHandler) {
      this.scene.events.off("updateBars", this.updateBarsHandler);
      this.updateBarsHandler = undefined;
    }

    if (this.cleanupHandler) {
      this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.cleanupHandler);
      this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.cleanupHandler);
      this.cleanupHandler = undefined;
    }
  }
}
