import Phaser from "phaser";
import { getThermalFeedbackConfig } from "../../data/RunData";
import { synth } from "../../utils/SoundSynth";
import { PROMPT_TOOLS } from "./config";
import { createSafetyFilterShader } from "./safetyFilterShader";
import { createThermalFeedbackShader } from "./thermalFeedbackShader";
import {
  TERMINAL_PROMPT_LINE_HEIGHT,
  TerminalPromptController,
} from "./terminalPromptController";
import { ToolId } from "./types";

interface HudControllerBindings {
  onInference: () => void;
  onRefuse: () => void;
  onUseUtility: () => void;
  onTogglePromptTool: (toolId: ToolId) => void;
  onToggleSearchWord: (wordIndex: number, rawWord: string) => void;
  onSafetyScanStart: (
    pointerId: number,
    scanPointX: number,
    scanPointY: number,
  ) => void;
  onSafetyScanMove: (
    pointerId: number,
    scanPointX: number,
    scanPointY: number,
    intersectedWordIndexes: number[],
  ) => void;
  onSafetyScanEnd: (pointerId: number) => void;
  onPulseCompute: () => void;
  setTaskTextObj: (value: Phaser.GameObjects.Text) => void;
  setChatTextObj: (value: Phaser.GameObjects.Text) => void;
  setPatienceBarFill: (value: Phaser.GameObjects.Rectangle) => void;
  setHeatBarFill: (value: Phaser.GameObjects.Rectangle) => void;
  setHallucinationBarFill: (value: Phaser.GameObjects.Rectangle) => void;
  getShiftModifierLabel: () => string | null;
  getUnlockedPromptToolIds: () => ToolId[];
  getSelectedPromptToolIds: () => ToolId[];
  getSelectedSearchWordIndexes: () => number[];
  getUtilityDisplayText: () => string;
  getProjectedToolHeat: () => number;
  getProjectedInferenceHeat: () => number;
  getProjectedRefuseHeat: () => number;
  getComputeCharge: () => number;
  getComputeThreshold: () => number;
  isSearchModeSelected: () => boolean;
  isSafetyModeSelected: () => boolean;
  canStartSafetyScan: () => boolean;
  isComputeReady: () => boolean;
  isComputeLatched: () => boolean;
  isComputeToolSelected: () => boolean;
  isSafetyScanning: () => boolean;
  getSafetyScanPointX: () => number;
  getSafetyScanPointY: () => number;
  getSafetyScanDirectionX: () => number;
  getSafetyScanNoiseIntensity: () => number;
  getSafetyScanBandWidth: () => number;
  getSafetyMatchedWordIndexes: () => number[];
  getSafetyRevealedWordIndexes: () => number[];
  getSafetyRevealProgress: (wordIndex: number) => number;
  getSafetyRevealFlash: (wordIndex: number) => number;
  getSafetyDetectedWordCount: () => number;
  canUseUtility: () => boolean;
  getHeat: () => number;
  getHallucination: () => number;
  isOverheated: () => boolean;
}

interface PromptToolButtonUi {
  body: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  lamp: Phaser.GameObjects.Arc;
  indicatorLamps: Phaser.GameObjects.Rectangle[];
  shadow: Phaser.GameObjects.Rectangle;
}

export class MainSceneHudController {
  private hoveredAction: "inference" | "refuse" | null = null;

  private utilityBtn!: Phaser.GameObjects.Rectangle;
  private utilityTxt!: Phaser.GameObjects.Text;
  private utilityLamp!: Phaser.GameObjects.Rectangle;
  private taskTextObj!: Phaser.GameObjects.Text;
  private chatTextObj!: Phaser.GameObjects.Text;
  private terminalBg!: Phaser.GameObjects.Rectangle;
  private terminalThermalOverlay!: Phaser.GameObjects.Rectangle;
  private terminalThermalShader?: Phaser.GameObjects.Shader;
  private terminalSafetyOverlay!: Phaser.GameObjects.Rectangle;
  private terminalSafetyShader?: Phaser.GameObjects.Shader;
  private thermalWarningLamp!: Phaser.GameObjects.Arc;
  private thermalWarningLampHalo!: Phaser.GameObjects.Arc;
  private heatPreviewFill!: Phaser.GameObjects.Rectangle;
  private computePanel!: Phaser.GameObjects.Container;
  private computeGaugeSegments: Phaser.GameObjects.Rectangle[] = [];
  private computeStatusText!: Phaser.GameObjects.Text;
  private computeDetailText!: Phaser.GameObjects.Text;
  private computePulseBtn!: Phaser.GameObjects.Rectangle;
  private computePulseLabel!: Phaser.GameObjects.Text;
  private promptToolButtons = new Map<ToolId, PromptToolButtonUi>();
  private terminalPromptController!: TerminalPromptController;
  private updateBarsHandler?: () => void;
  private cleanupHandler?: () => void;
  private renderPromptHandler?: (payload: { prompt: string }) => void;
  private clearPromptHandler?: () => void;
  private thermalPulseTimer?: Phaser.Time.TimerEvent;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bindings: HudControllerBindings,
  ) {}

  createLayout() {
    const monitorOuter = this.scene.add
      .rectangle(230, 30, 564, 380, 0x2c2a25)
      .setOrigin(0);
    monitorOuter.setStrokeStyle(4, 0x111111);

    this.terminalBg = this.scene.add
      .rectangle(250, 50, 524, 340, 0x051505)
      .setOrigin(0);
    this.terminalBg.setStrokeStyle(2, 0x33ff33);
    if (this.scene.game.renderer.type === Phaser.WEBGL) {
      this.terminalThermalShader = this.scene.add
        .shader(createThermalFeedbackShader(), 250, 50, 524, 340)
        .setOrigin(0)
        .setVisible(false)
        .setDepth(0.4);
    }

    this.terminalThermalOverlay = this.scene.add
      .rectangle(250, 50, 524, 340, 0x6a1808, 0)
      .setOrigin(0)
      .setVisible(!this.terminalThermalShader)
      .setDepth(0.4);
    if (this.scene.game.renderer.type === Phaser.WEBGL) {
      this.terminalSafetyShader = this.scene.add
        .shader(createSafetyFilterShader(), 250, 50, 524, 340)
        .setOrigin(0)
        .setVisible(false)
        .setDepth(0.5);
    }

    this.terminalSafetyOverlay = this.scene.add
      .rectangle(250, 50, 524, 340, 0x47120d, 0)
      .setOrigin(0)
      .setVisible(!this.terminalSafetyShader);

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

    const lineHeightProbe = this.scene.add.text(0, 0, "A", {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: "14px",
      color: "#33ff33",
    });
    const taskLineSpacing = Math.max(
      0,
      TERMINAL_PROMPT_LINE_HEIGHT - lineHeightProbe.height,
    );
    lineHeightProbe.destroy();

    this.taskTextObj = this.scene.add.text(260, 60, "", {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: "14px",
      color: "#33ff33",
      wordWrap: { width: 500 },
    });
    this.taskTextObj.setLineSpacing(taskLineSpacing);
    this.bindings.setTaskTextObj(this.taskTextObj);

    this.chatTextObj = this.scene.add.text(260, 112, "", {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: "14px",
      color: "#33ff33",
      wordWrap: { width: 500 },
    });
    this.bindings.setChatTextObj(this.chatTextObj);

    this.terminalPromptController = new TerminalPromptController(this.scene, {
      isSearchModeSelected: () => this.bindings.isSearchModeSelected(),
      isSafetyModeSelected: () => this.bindings.isSafetyModeSelected(),
      canStartSafetyScan: () => this.bindings.canStartSafetyScan(),
      isSafetyScanning: () => this.bindings.isSafetyScanning(),
      getSafetyScanPointX: () => this.bindings.getSafetyScanPointX(),
      getSafetyScanPointY: () => this.bindings.getSafetyScanPointY(),
      getSafetyScanDirectionX: () => this.bindings.getSafetyScanDirectionX(),
      getSafetyScanNoiseIntensity: () =>
        this.bindings.getSafetyScanNoiseIntensity(),
      getSafetyScanBandWidth: () => this.bindings.getSafetyScanBandWidth(),
      getSelectedWordIndexes: () =>
        this.bindings.getSelectedSearchWordIndexes(),
      getSafetyMatchedWordIndexes: () =>
        this.bindings.getSafetyMatchedWordIndexes(),
      getSafetyRevealedWordIndexes: () =>
        this.bindings.getSafetyRevealedWordIndexes(),
      getSafetyRevealProgress: (wordIndex) =>
        this.bindings.getSafetyRevealProgress(wordIndex),
      getSafetyRevealFlash: (wordIndex) =>
        this.bindings.getSafetyRevealFlash(wordIndex),
      getPromptStartY: () => {
        if (this.taskTextObj.text.length === 0) {
          return this.taskTextObj.y;
        }

        return this.taskTextObj.y + this.taskTextObj.height + 19;
      },
      onToggleWord: (wordIndex, rawWord) =>
        this.bindings.onToggleSearchWord(wordIndex, rawWord),
      onSafetyScanStart: (pointerId, scanPointX, scanPointY) =>
        this.bindings.onSafetyScanStart(pointerId, scanPointX, scanPointY),
      onSafetyScanMove: (
        pointerId,
        scanPointX,
        scanPointY,
        intersectedWordIndexes,
      ) =>
        this.bindings.onSafetyScanMove(
          pointerId,
          scanPointX,
          scanPointY,
          intersectedWordIndexes,
        ),
      onSafetyScanEnd: (pointerId) => this.bindings.onSafetyScanEnd(pointerId),
      onPromptLayoutChanged: (bottomY) => {
        this.chatTextObj.setY(bottomY);
      },
    });
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
      const indicatorLamps: Phaser.GameObjects.Rectangle[] = [];

      if (tool.toolId === "compute") {
        for (let lampIndex = 0; lampIndex < 5; lampIndex += 1) {
          indicatorLamps.push(
            this.scene.add
              .rectangle(x + 10 + lampIndex * 14, y - 2, 9, 5, 0x2f2a21)
              .setOrigin(0, 0.5)
              .setStrokeStyle(1, 0x111111),
          );
        }
      }

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

      this.promptToolButtons.set(tool.toolId, {
        body,
        label,
        lamp,
        indicatorLamps,
        shadow,
      });
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
      onHoverChange: (isHovered) => {
        this.hoveredAction = isHovered ? "inference" : null;
        this.scene.events.emit("updateBars");
      },
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
      onHoverChange: (isHovered) => {
        this.hoveredAction = isHovered ? "refuse" : null;
        this.scene.events.emit("updateBars");
      },
    });

    runBtn.body.setDepth(3);
    refuseBtn.body.setDepth(3);
    runBtn.label.setDepth(4);
    refuseBtn.label.setDepth(4);
  }

  createComputeSection() {
    const panelBackground = this.scene.add
      .rectangle(804, 174, 200, 178, 0x232323)
      .setOrigin(0);
    const panelTopBar = this.scene.add
      .rectangle(804, 170, 200, 4, 0x111111)
      .setOrigin(0);
    const panelFrame = this.scene.add
      .rectangle(904, 263, 196, 176, 0, 0)
      .setStrokeStyle(2, 0x111111)
      .setOrigin(0.5);
    const panelTitle = this.scene.add.text(818, 182, "CAPACITOR BANK", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#d4c5b0",
      fontStyle: "bold",
    });
    const gaugeLabel = this.scene.add.text(822, 202, "LOAD", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#8f8677",
    });

    const gaugeHousing = this.scene.add
      .rectangle(904, 228, 160, 44, 0x161410)
      .setOrigin(0.5);
    gaugeHousing.setStrokeStyle(2, 0x3d3527);
    const thresholdMarker = this.scene.add
      .rectangle(978, 228, 4, 38, 0x702014)
      .setOrigin(0.5);
    this.computeGaugeSegments = [];
    for (let segmentIndex = 0; segmentIndex < 10; segmentIndex += 1) {
      const segment = this.scene.add
        .rectangle(837 + segmentIndex * 14.8, 228, 10, 28, 0x2f120f)
        .setOrigin(0, 0.5)
        .setStrokeStyle(1, 0x111111);
      this.computeGaugeSegments.push(segment);
    }

    this.computeStatusText = this.scene.add.text(822, 258, "IDLE", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#d4c5b0",
    });
    this.computeDetailText = this.scene.add.text(822, 274, "OFFLINE", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#9c8f78",
    });

    const pulseShadow = this.scene.add
      .rectangle(904, 316, 150, 38, 0x1d1309)
      .setOrigin(0.5);
    const pulseBezel = this.scene.add
      .rectangle(904, 312, 150, 38, 0x5a3321)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x111111);
    const pulseLeftBracket = this.scene.add
      .rectangle(842, 312, 10, 32, 0x29170d)
      .setOrigin(0.5);
    const pulseRightBracket = this.scene.add
      .rectangle(966, 312, 10, 32, 0x29170d)
      .setOrigin(0.5);

    this.computePulseBtn = this.scene.add
      .rectangle(904, 310, 132, 30, 0xc2874b)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x111111)
      .setInteractive({ useHandCursor: true });
    this.computePulseLabel = this.scene.add
      .text(904, 310, "PULSE", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#111111",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.computePulseBtn.on("pointerdown", () => {
      if (!this.bindings.isComputeToolSelected()) {
        synth.playError();
        return;
      }

      synth.playButtonPress();
      this.computePulseBtn.y += 3;
      this.computePulseLabel.y += 3;
      this.scene.time.delayedCall(70, () => {
        this.computePulseBtn.y -= 3;
        this.computePulseLabel.y -= 3;
      });
      this.bindings.onPulseCompute();
    });

    const thresholdText = this.scene.add
      .text(986, 210, "THR", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#8f8677",
      })
      .setOrigin(1, 0.5);

    this.computePanel = this.scene.add.container(0, 0, [
      panelBackground,
      panelTopBar,
      panelFrame,
      panelTitle,
      gaugeLabel,
      gaugeHousing,
      thresholdMarker,
      ...this.computeGaugeSegments,
      this.computeStatusText,
      this.computeDetailText,
      pulseShadow,
      pulseBezel,
      pulseLeftBracket,
      pulseRightBracket,
      this.computePulseBtn,
      this.computePulseLabel,
      thresholdText,
    ]);
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
    this.thermalWarningLampHalo = this.scene.add
      .circle(610, 690, 11, 0xff8a2b, 0)
      .setStrokeStyle(1, 0x4e1b08, 0.45);
    this.thermalWarningLamp = this.scene.add
      .circle(610, 690, 6, 0x3d1206)
      .setStrokeStyle(2, 0x111111);
    this.scene.add.rectangle(380, 680, 200, 20, 0x111111).setOrigin(0);
    const heatBarFill = this.scene.add
      .rectangle(382, 682, 0, 16, 0xff5500)
      .setOrigin(0);
    this.bindings.setHeatBarFill(heatBarFill);
    this.heatPreviewFill = this.scene.add
      .rectangle(382, 682, 0, 16, 0xc9c9c9)
      .setOrigin(0)
      .setAlpha(0.42);

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
      this.syncTerminalEffects();
      this.terminalPromptController.syncSelectionStates();
      this.syncComputeSection();
      this.syncUtilitySection();

      shiftModifierText.setText(
        `SHIFT MOD: ${this.bindings.getShiftModifierLabel() ?? "NORMAL"}`,
      );
      heatBarFill.width = 196 * Math.min(1, this.bindings.getHeat() / 100);
      hallucinationBarFill.width =
        146 * Math.min(1, this.bindings.getHallucination() / 100);

      const thermalConfig = getThermalFeedbackConfig();
      const thermalIntensity = this.getThermalIntensity();
      const pulseRate = this.bindings.isOverheated()
        ? thermalConfig.overheatLampPulseRate
        : thermalConfig.lampPulseRate;
      const pulseWave =
        thermalIntensity > 0
          ? (Math.sin(this.scene.time.now * 0.001 * pulseRate * Math.PI * 2) +
              1) /
            2
          : 0;
      const lampAlpha = Phaser.Math.Linear(
        thermalConfig.lampPulseMinAlpha,
        1,
        pulseWave,
      );

      if (this.bindings.isOverheated()) {
        heatBarFill.setFillStyle(0xff0000);
      } else if (this.bindings.getHeat() > 80) {
        heatBarFill.setFillStyle(0xff5500);
      } else {
        heatBarFill.setFillStyle(0xffaa00);
      }

      const projectedToolHeat = Math.max(
        0,
        this.bindings.getProjectedToolHeat(),
      );
      const hoveredActionHeat =
        this.hoveredAction === "inference"
          ? Math.max(0, this.bindings.getProjectedInferenceHeat())
          : this.hoveredAction === "refuse"
            ? Math.max(0, this.bindings.getProjectedRefuseHeat())
            : 0;
      const currentHeatRatio = Math.min(1, this.bindings.getHeat() / 100);
      const projectedPreviewRatio = Math.min(
        1,
        (this.bindings.getHeat() + projectedToolHeat + hoveredActionHeat) / 100,
      );
      const currentHeatWidth = 196 * currentHeatRatio;
      const projectedPreviewWidth = 196 * projectedPreviewRatio;
      const previewWidth = Math.max(
        0,
        projectedPreviewWidth - currentHeatWidth,
      );

      this.heatPreviewFill.x = 382 + currentHeatWidth;
      this.heatPreviewFill.width = previewWidth;
      this.heatPreviewFill.setFillStyle(0xc9c9c9);
      this.heatPreviewFill.setAlpha(previewWidth > 0 ? 0.42 : 0);

      if (thermalIntensity > 0) {
        const lampColor = this.mixColor(
          0xff9c3a,
          0xff2a1a,
          this.bindings.isOverheated() ? 1 : thermalIntensity,
        );
        this.thermalWarningLamp.setFillStyle(lampColor, lampAlpha);
        this.thermalWarningLampHalo.setFillStyle(
          lampColor,
          (0.12 + thermalIntensity * 0.28) * lampAlpha,
        );
        this.thermalWarningLampHalo.setScale(
          1 + pulseWave * (this.bindings.isOverheated() ? 0.18 : 0.08),
        );
      } else {
        this.thermalWarningLamp.setFillStyle(0x3d1206, 1);
        this.thermalWarningLampHalo.setFillStyle(0xff8a2b, 0);
        this.thermalWarningLampHalo.setScale(1);
      }
    };

    this.cleanupHandler = () => {
      this.cleanupSceneListeners();
    };

    this.renderPromptHandler = (payload) => {
      this.terminalPromptController.renderPrompt(payload.prompt);
    };
    this.clearPromptHandler = () => {
      this.terminalPromptController.clear();
    };

    this.scene.events.on("updateBars", this.updateBarsHandler);
    this.scene.events.on("renderPrompt", this.renderPromptHandler);
    this.scene.events.on("clearPrompt", this.clearPromptHandler);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupHandler);
    this.scene.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupHandler);

    this.thermalPulseTimer?.destroy();
    this.thermalPulseTimer = this.scene.time.addEvent({
      delay: 90,
      loop: true,
      callback: () => {
        if (
          this.bindings.getHeat() >= getThermalFeedbackConfig().onsetThreshold
        ) {
          this.scene.events.emit("updateBars");
        }
      },
    });

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
    onHoverChange?: (isHovered: boolean) => void;
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

    body.on("pointerover", () => {
      options.onHoverChange?.(true);
    });

    body.on("pointerout", () => {
      options.onHoverChange?.(false);
    });

    return { body, label };
  }

  private syncPromptToolButtons() {
    const selectedPromptToolIds = new Set(
      this.bindings.getSelectedPromptToolIds(),
    );

    this.promptToolButtons.forEach((button, toolId) => {
      const isSelected = selectedPromptToolIds.has(toolId);
      const isComputeReady =
        toolId === "compute" && this.bindings.isComputeReady();
      const computeRatio = Math.min(
        1,
        this.bindings.getComputeCharge() / this.bindings.getComputeThreshold(),
      );
      const activeIndicatorCount = Math.round(
        computeRatio * button.indicatorLamps.length,
      );
      button.body.setFillStyle(isSelected ? 0xb9af9b : 0x7f796e);
      button.label.setColor(isSelected ? "#101010" : "#111111");
      button.lamp.setFillStyle(
        isComputeReady ? 0xffc84d : isSelected ? 0x33ff33 : 0x173617,
      );
      button.shadow.setFillStyle(
        isComputeReady ? 0x5a4312 : isSelected ? 0x294829 : 0x111111,
      );

      button.indicatorLamps.forEach((indicatorLamp, lampIndex) => {
        const isActive = lampIndex < activeIndicatorCount;
        indicatorLamp.setFillStyle(
          isComputeReady ? 0x9cfb64 : isActive ? 0xffb347 : 0x2f2a21,
        );
        indicatorLamp.setAlpha(
          this.bindings.isComputeLatched() || isActive ? 1 : 0.55,
        );
      });
    });
  }

  private syncTerminalEffects() {
    const thermalConfig = getThermalFeedbackConfig();
    const searchModeSelected = this.bindings.isSearchModeSelected();
    const safetyModeSelected = this.bindings.isSafetyModeSelected();
    const safetyScanning = this.bindings.isSafetyScanning();
    const heat = this.bindings.getHeat();
    const thermalIntensity = this.getThermalIntensity();
    const overheatStrength = this.bindings.isOverheated() ? 1 : 0;
    const baseStrokeColor = safetyModeSelected ? 0x8c3429 : 0x33ff33;
    const thermalStrokeColor = this.mixColor(
      baseStrokeColor,
      0xff7c36,
      thermalIntensity * 0.72 + overheatStrength * 0.18,
    );
    const taskColor = this.toHexColor(
      this.mixColor(
        safetyModeSelected ? 0x8f4232 : 0x33ff33,
        0xffb36b,
        thermalIntensity * 0.42 + overheatStrength * 0.18,
      ),
    );
    const chatColor = this.toHexColor(
      this.mixColor(
        safetyModeSelected ? 0x874032 : 0x33ff33,
        0xff9b5c,
        thermalIntensity * 0.48 + overheatStrength * 0.2,
      ),
    );
    const taskAlpha = Phaser.Math.Clamp(
      (safetyModeSelected ? 0.78 : 1) - thermalIntensity * 0.08,
      0.7,
      1,
    );
    const chatAlpha = Phaser.Math.Clamp(
      (safetyModeSelected ? 0.72 : 1) - thermalIntensity * 0.12,
      0.62,
      1,
    );

    this.scene.input.setDefaultCursor(
      searchModeSelected ? "zoom-in" : "default",
    );
    this.terminalBg.setFillStyle(0x051505);
    this.terminalBg.setStrokeStyle(2, thermalStrokeColor);

    if (this.terminalThermalShader) {
      this.terminalThermalShader.setVisible(thermalIntensity > 0.01);
      this.terminalThermalShader.setUniform(
        "active.value",
        thermalIntensity > 0.01 ? 1 : 0,
      );
      this.terminalThermalShader.setUniform(
        "intensity.value",
        thermalIntensity,
      );
      this.terminalThermalShader.setUniform("overheat.value", overheatStrength);
      this.terminalThermalShader.setUniform(
        "bandSpeed.value",
        thermalConfig.staticBandSpeed,
      );
      this.terminalThermalShader.setUniform(
        "bandThickness.value",
        thermalConfig.staticBandThickness,
      );
      this.terminalThermalShader.setUniform(
        "flickerRate.value",
        thermalConfig.flickerRate,
      );
    }

    this.terminalThermalOverlay.setFillStyle(0x6a1808);
    this.terminalThermalOverlay.setAlpha(
      this.terminalThermalShader
        ? 0
        : thermalIntensity * thermalConfig.fallbackOverlayAlpha,
    );

    if (this.terminalSafetyShader) {
      const scanPointX = Phaser.Math.Clamp(
        (this.bindings.getSafetyScanPointX() - 250) / 524,
        0,
        1,
      );
      const scanPointY = Phaser.Math.Clamp(
        (this.bindings.getSafetyScanPointY() - 50) / 340,
        0,
        1,
      );
      const scanRadius = Phaser.Math.Clamp(
        this.bindings.getSafetyScanBandWidth() / 2800,
        0.02,
        0.06,
      );

      this.terminalSafetyShader.setVisible(safetyModeSelected);
      this.terminalSafetyShader.setUniform(
        "active.value",
        safetyModeSelected ? 1 : 0,
      );
      this.terminalSafetyShader.setUniform(
        "scanning.value",
        safetyScanning ? 1 : 0,
      );
      this.terminalSafetyShader.setUniform("scanPoint.value.x", scanPointX);
      this.terminalSafetyShader.setUniform("scanPoint.value.y", scanPointY);
      this.terminalSafetyShader.setUniform("scanRadius.value", scanRadius);
      this.terminalSafetyShader.setUniform(
        "scanDirection.value",
        this.bindings.getSafetyScanDirectionX(),
      );
      this.terminalSafetyShader.setUniform(
        "noiseIntensity.value",
        this.bindings.getSafetyScanNoiseIntensity(),
      );
    }

    this.terminalSafetyOverlay.setFillStyle(
      safetyScanning ? 0x5a170f : 0x47120d,
      safetyScanning ? 0.42 : 0.34,
    );
    this.terminalSafetyOverlay.setAlpha(
      this.terminalSafetyShader ? 0 : safetyModeSelected ? 1 : 0,
    );

    this.taskTextObj.setColor(taskColor);
    this.taskTextObj.setAlpha(taskAlpha);
    this.chatTextObj.setColor(chatColor);
    this.chatTextObj.setAlpha(chatAlpha);
  }

  private getThermalIntensity() {
    const thermalConfig = getThermalFeedbackConfig();
    const thresholdRange = Math.max(
      1,
      thermalConfig.fullIntensityThreshold - thermalConfig.onsetThreshold,
    );
    const baseIntensity = Phaser.Math.Clamp(
      (this.bindings.getHeat() - thermalConfig.onsetThreshold) / thresholdRange,
      0,
      1,
    );

    if (!this.bindings.isOverheated()) {
      return baseIntensity;
    }

    return Math.max(baseIntensity, thermalConfig.overheatMinimumIntensity);
  }

  private mixColor(leftColor: number, rightColor: number, amount: number) {
    const clampedAmount = Phaser.Math.Clamp(amount, 0, 1);
    const left = Phaser.Display.Color.IntegerToColor(leftColor);
    const right = Phaser.Display.Color.IntegerToColor(rightColor);

    return Phaser.Display.Color.GetColor(
      Math.round(Phaser.Math.Linear(left.red, right.red, clampedAmount)),
      Math.round(Phaser.Math.Linear(left.green, right.green, clampedAmount)),
      Math.round(Phaser.Math.Linear(left.blue, right.blue, clampedAmount)),
    );
  }

  private toHexColor(color: number) {
    return `#${color.toString(16).padStart(6, "0")}`;
  }

  private syncComputeSection() {
    if (
      !this.computePanel ||
      !this.computeStatusText ||
      !this.computeDetailText ||
      !this.computePulseBtn ||
      !this.computePulseLabel
    ) {
      return;
    }

    const threshold = this.bindings.getComputeThreshold();
    const charge = this.bindings.getComputeCharge();
    const ratio = threshold <= 0 ? 0 : Math.min(1, charge / threshold);
    const isSelected = this.bindings.isComputeToolSelected();
    const isReady = this.bindings.isComputeReady();
    const isLatched = this.bindings.isComputeLatched();

    this.computePanel.setVisible(isSelected);

    this.computeGaugeSegments.forEach((segment, segmentIndex) => {
      const segmentThreshold =
        (segmentIndex + 1) / this.computeGaugeSegments.length;
      const isActive = ratio >= segmentThreshold;
      segment.setFillStyle(
        isLatched
          ? 0x9cfb64
          : isReady
            ? 0xfff0a0
            : isActive
              ? 0xff9b2f
              : 0x2f120f,
      );
      segment.setAlpha(isActive || isReady ? 1 : 0.55);
    });

    this.computeStatusText.setText(
      isLatched
        ? "LATCHED"
        : isReady
          ? "ACTIVE"
          : charge > 0
            ? `CHARGE ${Math.round(charge)}%`
            : "IDLE",
    );
    this.computeDetailText.setText(
      isLatched
        ? "CAPACITOR LOCK"
        : isReady
          ? "BLEEDING OFF"
          : ratio >= 0.9
            ? "MACHINE FIGHTING BACK"
            : ratio >= 0.65
              ? "RESISTANCE RISING"
              : charge > 0
                ? "SPINNING UP"
                : "OFFLINE",
    );
    this.computePulseBtn.setFillStyle(isSelected ? 0xc2874b : 0x6c5b47);
    this.computePulseBtn.setAlpha(isSelected ? 1 : 0.72);
    this.computePulseLabel.setAlpha(isSelected ? 1 : 0.72);
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
    this.terminalPromptController?.destroy();

    if (this.updateBarsHandler) {
      this.scene.events.off("updateBars", this.updateBarsHandler);
      this.updateBarsHandler = undefined;
    }

    if (this.renderPromptHandler) {
      this.scene.events.off("renderPrompt", this.renderPromptHandler);
      this.renderPromptHandler = undefined;
    }

    if (this.clearPromptHandler) {
      this.scene.events.off("clearPrompt", this.clearPromptHandler);
      this.clearPromptHandler = undefined;
    }

    if (this.cleanupHandler) {
      this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.cleanupHandler);
      this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.cleanupHandler);
      this.cleanupHandler = undefined;
    }

    if (this.thermalPulseTimer) {
      this.thermalPulseTimer.destroy();
      this.thermalPulseTimer = undefined;
    }
  }
}
