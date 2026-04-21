import Phaser from "phaser";
import {
  PassiveUpgradeHudItem,
  PassiveUpgradeId,
} from "../../data/UpgradeData";
import {
  getConnectionFeedbackConfig,
  getHallucinationFeedbackConfig,
  SignalBoostLayoutConfig,
  getThermalFeedbackConfig,
} from "../../data/RunData";
import { ActiveUtilityId } from "../../data/UtilityData";
import { synth } from "../../utils/SoundSynth";
import { createHallucinationFeedbackShader } from "./hallucinationFeedbackShader";
import { PROMPT_TOOLS } from "./config";
import { createSafetyFilterShader } from "./safetyFilterShader";
import { createThermalFeedbackShader } from "./thermalFeedbackShader";
import {
  TERMINAL_PROMPT_LINE_HEIGHT,
  TerminalPromptController,
} from "./terminalPromptController";
import { MainSceneSearchToolPanelController } from "./searchToolPanelController";
import { MainSceneUtilityPanelController } from "./utilityPanelController";
import { ChatMessage, ToolId } from "./types";

interface HudControllerBindings {
  onInference: () => void;
  onRefuse: () => void;
  onUseUtility: () => void;
  onSelectPreviousUtility: () => void;
  onSelectNextUtility: () => void;
  onTogglePromptTool: (toolId: ToolId) => void;
  onSearchPulsePress: () => void;
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
  setPatienceBarFill: (value: Phaser.GameObjects.Rectangle) => void;
  setHeatBarFill: (value: Phaser.GameObjects.Rectangle) => void;
  setHallucinationBarFill: (value: Phaser.GameObjects.Rectangle) => void;
  getUnlockedPromptToolIds: () => ToolId[];
  getSelectedPromptToolIds: () => ToolId[];
  getSelectedSearchWordIndexes: () => number[];
  getSearchTargetWords: () => readonly string[];
  getSearchLockedWords: () => readonly string[];
  getSearchCurrentTargetIndex: () => number;
  getSearchCurrentTargetWord: () => string | null;
  getSearchPulseProgress: () => number;
  getSearchTimingWindowRatio: () => number;
  getSearchPulseState: () =>
    | "idle"
    | "running"
    | "success"
    | "error"
    | "empty"
    | "complete";
  getSearchFeedbackFlash: () => number;
  getSearchNoTargetSweepProgress: () => number;
  getTokens: () => number;
  getPassiveHudItems: () => PassiveUpgradeHudItem[];
  getUtilityDisplayText: () => string;
  canCycleUtilities: () => boolean;
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
  getSelectedUtilityId: () => ActiveUtilityId | null;
  getActiveUtilityPanelId: () => ActiveUtilityId | null;
  canUseUtilityId: (utilityId: ActiveUtilityId) => boolean;
  getUtilityPanelStatusText: () => string;
  getUtilityFeedbackState: () => "idle" | "running" | "success" | "error";
  getUtilityFeedbackFlash: () => number;
  getCoolantLeverOrder: () => readonly number[];
  getCoolantLeverProgress: (leverIndex: number) => number;
  getCoolantLeverDecayRatio: (leverIndex: number) => number;
  getCoolantLeverDragRatio: (leverIndex: number) => number;
  isCoolantLeverCompleted: (leverIndex: number) => boolean;
  getCoolantNextRequiredLeverIndex: () => number | null;
  onCoolantLeverDragStart: (leverIndex: number, pointerId: number) => void;
  onCoolantLeverDragMove: (pointerId: number, dragRatio: number) => void;
  onCoolantLeverDragEnd: (pointerId: number) => void;
  getRealityCurrentFrequencyRatio: () => number;
  getRealityTargetFrequencyRatio: () => number;
  getRealityLockProgress: () => number;
  getRealityJitterIntensity: () => number;
  isRealityDragging: () => boolean;
  onRealityTuneStart: (pointerId: number) => void;
  onRealityTuneDelta: (pointerId: number, deltaX: number) => void;
  onRealityTuneEnd: (pointerId: number) => void;
  getSignalLayout: () => SignalBoostLayoutConfig;
  getSignalPath: () => readonly number[];
  isSignalRequiredNode: (cellIndex: number) => boolean;
  isSignalVisitedRequiredNode: (cellIndex: number) => boolean;
  getSignalFlashCellIndex: () => number | null;
  onSignalDragStart: (pointerId: number, cellIndex: number | null) => void;
  onSignalDragMove: (pointerId: number, cellIndex: number | null) => void;
  onSignalDragEnd: (pointerId: number, cellIndex: number | null) => void;
  canUseUtility: () => boolean;
  getHeat: () => number;
  getHallucination: () => number;
  isOverheated: () => boolean;
  getConnectionElapsedRatio: () => number;
}

interface PromptToolButtonUi {
  body: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  lamp: Phaser.GameObjects.Arc;
  indicatorLamps: Phaser.GameObjects.Rectangle[];
  shadow: Phaser.GameObjects.Rectangle;
}

interface PassiveHudChipUi {
  body: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

interface ChatLineUi {
  text: Phaser.GameObjects.Text;
  color?: string;
}

interface ChatLineEntry {
  text: string;
  color?: string;
}

type FloatingPanelFocus = "prompt" | "utility";

export class MainSceneHudController {
  private readonly toolControlDepth = 2.4;
  private readonly promptPanelFrontDepth = 2.6;
  private readonly promptPanelBackDepth = 1.7;
  private readonly utilityPanelFrontDepth = 2.8;
  private readonly utilityPanelBackDepth = 1.8;
  private readonly computePanelX = 804;
  private readonly computePanelY = 220;
  private readonly computePanelWidth = 200;
  private readonly computePanelHeight = 316;
  private hoveredAction: "inference" | "refuse" | null = null;
  private tokenDeltaBaseY: number = 0;
  private tokenValueText!: Phaser.GameObjects.Text;
  private tokenDeltaText!: Phaser.GameObjects.Text;
  private tokenHousing!: Phaser.GameObjects.Rectangle;
  private tokenLamps: Phaser.GameObjects.Rectangle[] = [];
  private passiveChips: PassiveHudChipUi[] = [];
  private passiveEmptyText!: Phaser.GameObjects.Text;
  private lastTokenValue: number | null = null;
  private lastTokenDelta: number = 0;
  private tokenPulseUntil: number = 0;

  private utilityBtn!: Phaser.GameObjects.Rectangle;
  private utilityTxt!: Phaser.GameObjects.Text;
  private utilityIndicatorLamps: Phaser.GameObjects.Rectangle[] = [];
  private utilityPrevBtn!: Phaser.GameObjects.Rectangle;
  private utilityPrevLabel!: Phaser.GameObjects.Text;
  private utilityNextBtn!: Phaser.GameObjects.Rectangle;
  private utilityNextLabel!: Phaser.GameObjects.Text;
  private taskTextObj!: Phaser.GameObjects.Text;
  private chatHistoryContainer!: Phaser.GameObjects.Container;
  private chatHistoryLines: ChatLineUi[] = [];
  private chatColor: string = "#33ff33";
  private chatAlpha: number = 1;
  private chatHistoryMask!: Phaser.GameObjects.Graphics;
  private chatHistoryY: number = 0;
  private terminalBg!: Phaser.GameObjects.Rectangle;
  private terminalHallucinationOverlay!: Phaser.GameObjects.Rectangle;
  private terminalHallucinationShader?: Phaser.GameObjects.Shader;
  private terminalThermalOverlay!: Phaser.GameObjects.Rectangle;
  private terminalThermalShader?: Phaser.GameObjects.Shader;
  private terminalSafetyOverlay!: Phaser.GameObjects.Rectangle;
  private terminalSafetyShader?: Phaser.GameObjects.Shader;
  private connectionLabel!: Phaser.GameObjects.Text;
  private connectionSegments: Phaser.GameObjects.Rectangle[] = [];
  private patienceBarFill!: Phaser.GameObjects.Rectangle;
  private thermalWarningLamp!: Phaser.GameObjects.Arc;
  private thermalWarningLampHalo!: Phaser.GameObjects.Arc;
  private hallucinationWarningLamp!: Phaser.GameObjects.Arc;
  private hallucinationWarningLampHalo!: Phaser.GameObjects.Arc;
  private heatPreviewFill!: Phaser.GameObjects.Rectangle;
  private searchPanelController!: MainSceneSearchToolPanelController;
  private computePanel!: Phaser.GameObjects.Container;
  private computeGaugeSegments: Phaser.GameObjects.Rectangle[] = [];
  private computeCoreGraphics!: Phaser.GameObjects.Graphics;
  private computeProgressText!: Phaser.GameObjects.Text;
  private computeStatusText!: Phaser.GameObjects.Text;
  private computeDetailText!: Phaser.GameObjects.Text;
  private computePulseBtn!: Phaser.GameObjects.Rectangle;
  private computePulseLabel!: Phaser.GameObjects.Text;
  private promptToolButtons = new Map<ToolId, PromptToolButtonUi>();
  private terminalPromptController!: TerminalPromptController;
  private utilityPanelController!: MainSceneUtilityPanelController;
  private currentPromptPanelDepth = this.toolControlDepth;
  private currentUtilityPanelDepth = this.utilityPanelBackDepth;
  private floatingPanelFocus: FloatingPanelFocus = "prompt";
  private previousPromptPanelSignature = "";
  private previousUtilityPanelSignature = "";
  private updateBarsHandler?: () => void;
  private cleanupHandler?: () => void;
  private renderPromptHandler?: (payload: {
    prompt: string;
    promptSenderLabel?: string;
  }) => void;
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
      this.terminalHallucinationShader = this.scene.add
        .shader(createHallucinationFeedbackShader(), 250, 50, 524, 340)
        .setOrigin(0)
        .setVisible(false)
        .setDepth(0.35);
    }

    this.terminalHallucinationOverlay = this.scene.add
      .rectangle(250, 50, 524, 340, 0x221336, 0)
      .setOrigin(0)
      .setVisible(!this.terminalHallucinationShader)
      .setDepth(0.35);
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

    this.connectionLabel = this.scene.add.text(250, 20, "USER CONNECTION:", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#d4c5b0",
    });
    this.scene.add.rectangle(400, 20, 374, 15, 0x111111).setOrigin(0);
    const patienceBarFill = this.scene.add
      .rectangle(402, 22, 370, 11, 0xffaa00)
      .setOrigin(0);
    patienceBarFill.setVisible(false);
    this.patienceBarFill = patienceBarFill;
    this.bindings.setPatienceBarFill(patienceBarFill);
    this.connectionSegments = [];
    const connectionConfig = getConnectionFeedbackConfig();
    const segmentGapPx = connectionConfig.segmentGapPx;
    const segmentWidth =
      (370 - segmentGapPx * (connectionConfig.segmentCount - 1)) /
      connectionConfig.segmentCount;
    for (
      let segmentIndex = 0;
      segmentIndex < connectionConfig.segmentCount;
      segmentIndex += 1
    ) {
      this.connectionSegments.push(
        this.scene.add
          .rectangle(
            402 + segmentIndex * (segmentWidth + segmentGapPx),
            22,
            segmentWidth,
            11,
            0xffaa00,
            connectionConfig.inactiveSegmentAlpha,
          )
          .setOrigin(0, 0),
      );
    }

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

    this.chatHistoryContainer = this.scene.add.container(260, 112);
    this.chatHistoryMask = this.scene.add.graphics();
    this.chatHistoryMask.setVisible(false);
    this.chatHistoryContainer.setMask(
      this.chatHistoryMask.createGeometryMask(),
    );

    this.terminalPromptController = new TerminalPromptController(this.scene, {
      isSearchModeSelected: () => this.bindings.isSearchModeSelected(),
      isSafetyModeSelected: () => this.bindings.isSafetyModeSelected(),
      getHallucination: () => this.bindings.getHallucination(),
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
      getSearchLockedWords: () => this.bindings.getSearchLockedWords(),
      getSearchCurrentTargetWord: () =>
        this.bindings.getSearchCurrentTargetWord(),
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
      onToggleWord: () => undefined,
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
        this.setChatHistoryY(bottomY);
      },
    });
  }

  setChatHistoryY(value: number) {
    this.chatHistoryY = value;
    this.chatHistoryContainer.setY(value);
    this.syncChatHistoryMask();
  }

  renderChatHistory(messages: ChatMessage[]) {
    this.chatHistoryContainer.removeAll(true);
    this.chatHistoryLines = [];

    const wrappedEntries: ChatLineEntry[] = [];
    const wrapWidth = 500;

    messages.forEach((msg) => {
      let prefix = "";
      if (msg.sender === "SYSTEM") prefix = "> ";
      else prefix = `${msg.sender}: `;

      const wrappedLines = this.wrapChatLine(prefix + msg.text, wrapWidth);
      wrappedLines.forEach((lineText, index) => {
        wrappedEntries.push({
          text: index === 0 ? lineText : lineText,
          color: msg.color,
        });
      });
    });

    const lineHeight = this.getChatLineHeight();
    const lineGap = 10;
    const entryHeight = lineHeight + lineGap;
    const maxVisibleHeight = this.getChatViewportHeight();
    const maxVisibleEntries = Math.max(
      1,
      Math.floor(maxVisibleHeight / entryHeight),
    );
    const visibleEntries = wrappedEntries.slice(-maxVisibleEntries);

    let cursorY = 0;
    visibleEntries.forEach((entry) => {
      const lineText = this.scene.add.text(0, cursorY, entry.text, {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: "14px",
        color: entry.color ?? this.chatColor,
      });

      this.chatHistoryContainer.add(lineText);
      this.chatHistoryLines.push({ text: lineText, color: entry.color });
      cursorY += entryHeight;
    });

    this.syncChatHistoryAppearance();
  }

  createEconomySection() {
    this.tokenLamps = [];
  }

  createPassiveSection() {
    this.passiveChips = [];
  }

  createPromptToolGrid() {
    const unlockedPromptToolIds = this.bindings.getUnlockedPromptToolIds();
    const toolDefinitions = PROMPT_TOOLS.filter((tool) =>
      unlockedPromptToolIds.includes(tool.toolId),
    );
    const rowCount = Math.max(1, Math.ceil(toolDefinitions.length / 2));
    const panelHeight = 72 + rowCount * 70;

    this.scene.add
      .rectangle(804, 0, 220, panelHeight, 0x2c2a25)
      .setOrigin(0)
      .setDepth(this.toolControlDepth);
    this.scene.add
      .rectangle(800, 0, 4, panelHeight, 0x111111)
      .setOrigin(0)
      .setDepth(this.toolControlDepth + 0.01);
    this.scene.add
      .text(824, 20, "TOOL CONTROL", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#d4c5b0",
        fontStyle: "bold",
      })
      .setDepth(this.toolControlDepth + 0.04);

    toolDefinitions.forEach((tool, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = 818 + column * 92;
      const y = 66 + row * 70;

      const shadow = this.scene.add
        .rectangle(x + 40, y + 32, 80, 52, 0x111111)
        .setOrigin(0.5)
        .setDepth(this.toolControlDepth + 0.01);
      const body = this.scene.add
        .rectangle(x + 40, y + 28, 80, 52, 0x7f796e)
        .setOrigin(0.5)
        .setStrokeStyle(2, 0x111111)
        .setDepth(this.toolControlDepth + 0.02)
        .setInteractive({ useHandCursor: true });
      const lamp = this.scene.add
        .circle(x + 14, y + 14, 5, 0x173617)
        .setStrokeStyle(1, 0x081208)
        .setDepth(this.toolControlDepth + 0.03);
      const indicatorLamps: Phaser.GameObjects.Rectangle[] = [];

      if (tool.toolId === ToolId.Compute) {
        for (let lampIndex = 0; lampIndex < 5; lampIndex += 1) {
          indicatorLamps.push(
            this.scene.add
              .rectangle(x + 10 + lampIndex * 14, y - 2, 9, 5, 0x2f2a21)
              .setOrigin(0, 0.5)
              .setDepth(this.toolControlDepth + 0.03)
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
        .setOrigin(0.5)
        .setDepth(this.toolControlDepth + 0.04);

      body.on("pointerdown", () => {
        this.floatingPanelFocus = "prompt";
        body.y += 4;
        label.y += 4;
        lamp.y += 4;
        indicatorLamps.forEach((indicatorLamp) => {
          indicatorLamp.y += 4;
        });
        this.scene.time.delayedCall(100, () => {
          body.y -= 4;
          label.y -= 4;
          lamp.y -= 4;
          indicatorLamps.forEach((indicatorLamp) => {
            indicatorLamp.y -= 4;
          });
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
    const panelX = this.computePanelX;
    const panelY = this.computePanelY;
    const panelWidth = this.computePanelWidth;
    const panelHeight = this.computePanelHeight;
    const centerX = panelX + panelWidth / 2;
    const coreCenterY = panelY + 136;

    const panelBackground = this.scene.add
      .rectangle(panelX, panelY, panelWidth, panelHeight, 0x232323)
      .setOrigin(0);
    const panelTopBar = this.scene.add
      .rectangle(panelX, panelY, panelWidth, 4, 0x111111)
      .setOrigin(0);
    const panelFrame = this.scene.add
      .rectangle(
        centerX,
        panelY + panelHeight / 2,
        panelWidth - 10,
        panelHeight - 8,
        0,
        0,
      )
      .setStrokeStyle(2, 0x111111)
      .setOrigin(0.5);
    const panelTitle = this.scene.add.text(
      panelX + 14,
      panelY + 10,
      "CAPACITOR BANK",
      {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#d4c5b0",
        fontStyle: "bold",
      },
    );
    this.computeProgressText = this.scene.add
      .text(panelX + panelWidth - 14, panelY + 12, "0%", {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: "11px",
        color: "#8f8677",
        fontStyle: "bold",
      })
      .setOrigin(1, 0);

    const gaugeHousing = this.scene.add
      .rectangle(centerX, coreCenterY, 150, 142, 0x0f140c)
      .setOrigin(0.5);
    gaugeHousing.setStrokeStyle(2, 0x3d3527);
    this.computeCoreGraphics = this.scene.add.graphics();

    this.computeGaugeSegments = [];
    for (let segmentIndex = 0; segmentIndex < 10; segmentIndex += 1) {
      const segment = this.scene.add
        .rectangle(
          panelX + 28 + segmentIndex * 14.8,
          panelY + 210,
          10,
          24,
          0x2f120f,
        )
        .setOrigin(0, 0.5)
        .setStrokeStyle(1, 0x111111);
      this.computeGaugeSegments.push(segment);
    }

    this.computeStatusText = this.scene.add
      .text(centerX, panelY + 230, "IDLE", {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: "12px",
        color: "#d4c5b0",
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5, 0);
    this.computeDetailText = this.scene.add
      .text(centerX, panelY + 248, "OFFLINE", {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: "11px",
        color: "#9c8f78",
        align: "center",
      })
      .setOrigin(0.5, 0);

    const pulseShadow = this.scene.add
      .rectangle(centerX, panelY + 286, 132, 28, 0x1d1309)
      .setOrigin(0.5);
    const pulseBezel = this.scene.add
      .rectangle(centerX, panelY + 282, 132, 28, 0x5a3321)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x111111);

    this.computePulseBtn = this.scene.add
      .rectangle(centerX, panelY + 282, 126, 28, 0xc2874b)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x111111)
      .setInteractive({ useHandCursor: true });
    this.computePulseLabel = this.scene.add
      .text(centerX, panelY + 282, "CHARGE PULSE", {
        fontFamily: "monospace",
        fontSize: "13px",
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

    this.computePanel = this.scene.add.container(0, 0, [
      panelBackground,
      panelTopBar,
      panelFrame,
      panelTitle,
      this.computeProgressText,
      gaugeHousing,
      this.computeCoreGraphics,
      ...this.computeGaugeSegments,
      this.computeStatusText,
      this.computeDetailText,
      pulseShadow,
      pulseBezel,
      this.computePulseBtn,
      this.computePulseLabel,
    ]);
    this.computePanel.setDepth(this.toolControlDepth);
    this.computePanel.setVisible(false);
  }

  createSearchSection() {
    this.searchPanelController = new MainSceneSearchToolPanelController(
      this.scene,
      {
        isSearchToolSelected: () => this.bindings.isSearchModeSelected(),
        getSearchTargetWords: () => this.bindings.getSearchTargetWords(),
        getSearchLockedWords: () => this.bindings.getSearchLockedWords(),
        getSearchCurrentTargetIndex: () =>
          this.bindings.getSearchCurrentTargetIndex(),
        getSearchCurrentTargetWord: () =>
          this.bindings.getSearchCurrentTargetWord(),
        getSearchPulseProgress: () => this.bindings.getSearchPulseProgress(),
        getSearchTimingWindowRatio: () =>
          this.bindings.getSearchTimingWindowRatio(),
        getSearchPulseState: () => this.bindings.getSearchPulseState(),
        getSearchFeedbackFlash: () => this.bindings.getSearchFeedbackFlash(),
        getSearchNoTargetSweepProgress: () =>
          this.bindings.getSearchNoTargetSweepProgress(),
        onSearchPulsePress: () => this.bindings.onSearchPulsePress(),
      },
    );
    this.searchPanelController.create();
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
    this.utilityPrevBtn = this.scene.add
      .rectangle(822, 588, 24, 48, 0x9f8a61)
      .setOrigin(0)
      .setStrokeStyle(2, 0x111111)
      .setInteractive({ useHandCursor: true });
    this.utilityBtn = this.scene.add
      .rectangle(850, 588, 108, 48, 0xc6b084)
      .setOrigin(0)
      .setStrokeStyle(2, 0x111111)
      .setInteractive({ useHandCursor: true });
    this.utilityNextBtn = this.scene.add
      .rectangle(962, 588, 24, 48, 0x9f8a61)
      .setOrigin(0)
      .setStrokeStyle(2, 0x111111)
      .setInteractive({ useHandCursor: true });

    this.utilityIndicatorLamps = [
      this.scene.add
        .rectangle(895, 595, 18, 6, 0x2f2a21)
        .setOrigin(0)
        .setStrokeStyle(1, 0x111111),
    ];

    this.utilityPrevLabel = this.scene.add
      .text(834, 612, "<", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#111111",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.utilityNextLabel = this.scene.add
      .text(974, 612, ">", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#111111",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.utilityTxt = this.scene.add
      .text(904, 612, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#111111",
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5);

    this.utilityPrevBtn.on("pointerdown", () => {
      synth.playButtonPress();
      this.floatingPanelFocus = "utility";
      this.bindings.onSelectPreviousUtility();
    });

    this.utilityBtn.on("pointerdown", () => {
      synth.playButtonPress();
      this.floatingPanelFocus = "utility";
      this.utilityBtn.y += 4;
      this.utilityTxt.y += 4;
      this.utilityIndicatorLamps.forEach((indicatorLamp) => {
        indicatorLamp.y += 4;
      });
      this.scene.time.delayedCall(100, () => {
        this.utilityBtn.y -= 4;
        this.utilityTxt.y -= 4;
        this.utilityIndicatorLamps.forEach((indicatorLamp) => {
          indicatorLamp.y -= 4;
        });
      });
      this.bindings.onUseUtility();
    });

    this.utilityNextBtn.on("pointerdown", () => {
      synth.playButtonPress();
      this.floatingPanelFocus = "utility";
      this.bindings.onSelectNextUtility();
    });
  }

  createUtilityActivationPanel() {
    this.utilityPanelController = new MainSceneUtilityPanelController(
      this.scene,
      {
        getSelectedUtilityId: () => this.bindings.getSelectedUtilityId(),
        getActiveUtilityPanelId: () => this.bindings.getActiveUtilityPanelId(),
        canUseUtilityId: (utilityId) =>
          this.bindings.canUseUtilityId(utilityId),
        getUtilityPanelStatusText: () =>
          this.bindings.getUtilityPanelStatusText(),
        getUtilityFeedbackState: () => this.bindings.getUtilityFeedbackState(),
        getUtilityFeedbackFlash: () => this.bindings.getUtilityFeedbackFlash(),
        canUseSelectedUtility: () => this.bindings.canUseUtility(),
        onStartUtilityActivation: () => this.bindings.onUseUtility(),
        getCoolantLeverOrder: () => this.bindings.getCoolantLeverOrder(),
        getCoolantLeverProgress: (leverIndex) =>
          this.bindings.getCoolantLeverProgress(leverIndex),
        getCoolantLeverDecayRatio: (leverIndex) =>
          this.bindings.getCoolantLeverDecayRatio(leverIndex),
        getCoolantLeverDragRatio: (leverIndex) =>
          this.bindings.getCoolantLeverDragRatio(leverIndex),
        isCoolantLeverCompleted: (leverIndex) =>
          this.bindings.isCoolantLeverCompleted(leverIndex),
        getCoolantNextRequiredLeverIndex: () =>
          this.bindings.getCoolantNextRequiredLeverIndex(),
        onCoolantLeverDragStart: (leverIndex, pointerId) =>
          this.bindings.onCoolantLeverDragStart(leverIndex, pointerId),
        onCoolantLeverDragMove: (pointerId, dragRatio) =>
          this.bindings.onCoolantLeverDragMove(pointerId, dragRatio),
        onCoolantLeverDragEnd: (pointerId) =>
          this.bindings.onCoolantLeverDragEnd(pointerId),
        getRealityCurrentFrequencyRatio: () =>
          this.bindings.getRealityCurrentFrequencyRatio(),
        getRealityTargetFrequencyRatio: () =>
          this.bindings.getRealityTargetFrequencyRatio(),
        getRealityLockProgress: () => this.bindings.getRealityLockProgress(),
        getRealityJitterIntensity: () =>
          this.bindings.getRealityJitterIntensity(),
        isRealityDragging: () => this.bindings.isRealityDragging(),
        onRealityTuneStart: (pointerId) =>
          this.bindings.onRealityTuneStart(pointerId),
        onRealityTuneDelta: (pointerId, deltaX) =>
          this.bindings.onRealityTuneDelta(pointerId, deltaX),
        onRealityTuneEnd: (pointerId) =>
          this.bindings.onRealityTuneEnd(pointerId),
        getSignalLayout: () => this.bindings.getSignalLayout(),
        getSignalPath: () => this.bindings.getSignalPath(),
        isSignalRequiredNode: (cellIndex) =>
          this.bindings.isSignalRequiredNode(cellIndex),
        isSignalVisitedRequiredNode: (cellIndex) =>
          this.bindings.isSignalVisitedRequiredNode(cellIndex),
        getSignalFlashCellIndex: () => this.bindings.getSignalFlashCellIndex(),
        onSignalDragStart: (pointerId, cellIndex) =>
          this.bindings.onSignalDragStart(pointerId, cellIndex),
        onSignalDragMove: (pointerId, cellIndex) =>
          this.bindings.onSignalDragMove(pointerId, cellIndex),
        onSignalDragEnd: (pointerId, cellIndex) =>
          this.bindings.onSignalDragEnd(pointerId, cellIndex),
      },
    );
    this.utilityPanelController.create();
  }

  createStatusBars() {
    this.scene.add.rectangle(0, 668, 1024, 100, 0x22201c).setOrigin(0);
    this.scene.add.rectangle(0, 664, 1024, 4, 0x111111).setOrigin(0);

    const leftColumnX = 20;
    const rightColumnX = 530;
    const rowOneY = 694;
    const rowTwoY = 726;

    this.scene.add.text(leftColumnX, rowOneY, "HALL:", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#d4c5b0",
    });
    this.hallucinationWarningLampHalo = this.scene.add
      .circle(leftColumnX + 68, rowOneY + 8, 10, 0x8f6dff, 0)
      .setStrokeStyle(1, 0x29194f, 0.45);
    this.hallucinationWarningLamp = this.scene.add
      .circle(leftColumnX + 68, rowOneY + 8, 6, 0x22143c)
      .setStrokeStyle(2, 0x111111);
    this.scene.add
      .rectangle(leftColumnX + 86, rowOneY, 250, 20, 0x111111)
      .setOrigin(0);
    const hallucinationBarFill = this.scene.add
      .rectangle(leftColumnX + 88, rowOneY + 2, 0, 16, 0x8f6dff)
      .setOrigin(0);
    this.bindings.setHallucinationBarFill(hallucinationBarFill);

    this.scene.add.text(leftColumnX, rowTwoY, "THRM:", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#d4c5b0",
    });
    this.thermalWarningLampHalo = this.scene.add
      .circle(leftColumnX + 68, rowTwoY + 8, 11, 0xff8a2b, 0)
      .setStrokeStyle(1, 0x4e1b08, 0.45);
    this.thermalWarningLamp = this.scene.add
      .circle(leftColumnX + 68, rowTwoY + 8, 6, 0x3d1206)
      .setStrokeStyle(2, 0x111111);
    this.scene.add
      .rectangle(leftColumnX + 86, rowTwoY, 250, 20, 0x111111)
      .setOrigin(0);
    const heatBarFill = this.scene.add
      .rectangle(leftColumnX + 88, rowTwoY + 2, 0, 16, 0xff5500)
      .setOrigin(0);
    this.bindings.setHeatBarFill(heatBarFill);
    this.heatPreviewFill = this.scene.add
      .rectangle(leftColumnX + 88, rowTwoY + 2, 0, 16, 0xc9c9c9)
      .setOrigin(0)
      .setAlpha(0.42);

    const tokenHousingWidth = 188;
    const tokenHousingCenterX = rightColumnX + 140;
    const tokenHousingLeftX = tokenHousingCenterX - tokenHousingWidth / 2;
    const tokenHousingRightX = tokenHousingCenterX + tokenHousingWidth / 2;

    this.scene.add.text(rightColumnX, rowOneY, "TOKEN:", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#d4c5b0",
    });
    this.tokenHousing = this.scene.add
      .rectangle(
        tokenHousingCenterX,
        rowOneY + 8,
        tokenHousingWidth,
        22,
        0x15120e,
      )
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x3d3527);
    this.tokenLamps = [];
    for (let lampIndex = 0; lampIndex < 3; lampIndex += 1) {
      this.tokenLamps.push(
        this.scene.add
          .rectangle(
            tokenHousingLeftX + 15 + lampIndex * 14,
            rowOneY + 8,
            9,
            9,
            0x2f2a21,
          )
          .setOrigin(0.5)
          .setStrokeStyle(1, 0x111111),
      );
    }
    this.tokenValueText = this.scene.add
      .text(tokenHousingRightX - 10, rowOneY + 6, "0 TOKEN", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#ffb000",
        fontStyle: "bold",
      })
      .setOrigin(1, 0.5);
    this.tokenDeltaText = this.scene.add
      .text(tokenHousingRightX + 10, rowOneY + 6, "", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#9cfb64",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5)
      .setAlpha(0);
    this.tokenDeltaBaseY = rowOneY + 6;

    this.scene.add.text(rightColumnX, rowTwoY, "PASS:", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#d4c5b0",
    });
    this.scene.add
      .rectangle(rightColumnX + 125, rowTwoY + 8, 250, 22, 0x15120e)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x3d3527);
    this.passiveEmptyText = this.scene.add
      .text(rightColumnX + 125, rowTwoY + 8, "NO PASSIVES", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#8f8677",
        align: "center",
      })
      .setOrigin(0.5);
    this.passiveChips = [];
    const passiveChipStartX = rightColumnX + 41;
    const passiveChipSpacing = 56;
    for (let chipIndex = 0; chipIndex < 4; chipIndex += 1) {
      const chipX = passiveChipStartX + chipIndex * passiveChipSpacing;
      const body = this.scene.add
        .rectangle(chipX, rowTwoY + 8, 52, 16, 0x1a1713)
        .setOrigin(0.5)
        .setStrokeStyle(1, 0x111111);
      const label = this.scene.add
        .text(chipX, rowTwoY + 8, "", {
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#d4c5b0",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.passiveChips.push({ body, label });
    }

    this.cleanupSceneListeners();

    this.updateBarsHandler = () => {
      this.syncPromptToolButtons();
      this.syncTerminalEffects();
      this.syncConnectionFeedback();
      this.terminalPromptController.syncSelectionStates();
      this.syncComputeSection();
      this.syncFloatingPanelDepths();
      this.syncEconomySection();
      this.syncPassiveSection();
      this.syncUtilitySection();
      heatBarFill.width = 246 * Math.min(1, this.bindings.getHeat() / 100);
      hallucinationBarFill.width =
        246 * Math.min(1, this.bindings.getHallucination() / 100);

      const thermalConfig = getThermalFeedbackConfig();
      const thermalIntensity = this.getThermalIntensity();
      const hallucinationConfig = getHallucinationFeedbackConfig();
      const hallucinationIntensity = this.getHallucinationIntensity();
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
      const hallucinationPulseWave =
        hallucinationIntensity > 0
          ? (Math.sin(
              this.scene.time.now *
                0.001 *
                hallucinationConfig.lampPulseRate *
                Math.PI *
                2,
            ) +
              1) /
            2
          : 0;
      const hallucinationLampAlpha = Phaser.Math.Linear(
        hallucinationConfig.lampPulseMinAlpha,
        1,
        hallucinationPulseWave,
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
      const currentHeatWidth = 246 * currentHeatRatio;
      const projectedPreviewWidth = 246 * projectedPreviewRatio;
      const previewWidth = Math.max(
        0,
        projectedPreviewWidth - currentHeatWidth,
      );

      this.heatPreviewFill.x = leftColumnX + 88 + currentHeatWidth;
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

      if (hallucinationIntensity > 0) {
        const lampColor = this.mixColor(
          0x8f6dff,
          0xd7cbff,
          hallucinationIntensity * 0.78,
        );
        hallucinationBarFill.setFillStyle(
          this.mixColor(0x8f6dff, 0xc9b8ff, hallucinationIntensity * 0.9),
        );
        this.hallucinationWarningLamp.setFillStyle(
          lampColor,
          hallucinationLampAlpha,
        );
        this.hallucinationWarningLampHalo.setFillStyle(
          lampColor,
          (0.08 + hallucinationIntensity * 0.22) * hallucinationLampAlpha,
        );
        this.hallucinationWarningLampHalo.setScale(
          1 + hallucinationPulseWave * 0.12,
        );
      } else {
        hallucinationBarFill.setFillStyle(0x8f6dff);
        this.hallucinationWarningLamp.setFillStyle(0x22143c, 1);
        this.hallucinationWarningLampHalo.setFillStyle(0x8f6dff, 0);
        this.hallucinationWarningLampHalo.setScale(1);
      }
    };

    this.cleanupHandler = () => {
      this.cleanupSceneListeners();
    };

    this.renderPromptHandler = (payload) => {
      this.terminalPromptController.renderPrompt(
        payload.prompt,
        payload.promptSenderLabel,
      );
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
          this.bindings.getHeat() >=
            getThermalFeedbackConfig().onsetThreshold ||
          this.bindings.getHallucination() >=
            getHallucinationFeedbackConfig().onsetThreshold ||
          this.bindings.getConnectionElapsedRatio() > 0 ||
          this.scene.time.now < this.tokenPulseUntil
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
    const searchLockedCount = this.bindings.getSearchLockedWords().length;
    const searchTargetCount = this.bindings.getSearchTargetWords().length;
    const safetyRevealedCount =
      this.bindings.getSafetyRevealedWordIndexes().length;
    const safetyDetectedCount = this.bindings.getSafetyDetectedWordCount();
    const computeRatio = Math.min(
      1,
      this.bindings.getComputeCharge() / this.bindings.getComputeThreshold(),
    );

    this.promptToolButtons.forEach((button, toolId) => {
      const isSelected = selectedPromptToolIds.has(toolId);
      const isComputeReady =
        toolId === ToolId.Compute && this.bindings.isComputeReady();
      const isSearchArmed = toolId === ToolId.Search && searchLockedCount > 0;
      const isSearchComplete =
        toolId === ToolId.Search &&
        searchTargetCount > 0 &&
        searchLockedCount >= searchTargetCount;
      const isSafetyArmed = toolId === ToolId.Safety && safetyRevealedCount > 0;
      const isSafetyComplete =
        toolId === ToolId.Safety &&
        safetyDetectedCount > 0 &&
        safetyRevealedCount >= safetyDetectedCount;
      const activeIndicatorCount = Math.round(
        computeRatio * button.indicatorLamps.length,
      );
      button.body.setFillStyle(isSelected ? 0xb9af9b : 0x7f796e);
      button.label.setColor(isSelected ? "#101010" : "#111111");
      button.lamp.setFillStyle(
        isSearchComplete
          ? 0x9cfb64
          : isSearchArmed
            ? 0xffc84d
            : isSafetyComplete
              ? 0x9cfb64
              : isSafetyArmed
                ? 0x33ff33
                : isComputeReady
                  ? 0xffc84d
                  : isSelected
                    ? 0x33ff33
                    : 0x173617,
      );
      button.shadow.setFillStyle(
        isSearchComplete
          ? 0x2c5824
          : isSearchArmed
            ? 0x5a4312
            : isSafetyComplete
              ? 0x2c5824
              : isSafetyArmed
                ? 0x294829
                : isComputeReady
                  ? 0x5a4312
                  : isSelected
                    ? 0x294829
                    : 0x111111,
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
    const hallucinationConfig = getHallucinationFeedbackConfig();
    const searchModeSelected = this.bindings.isSearchModeSelected();
    const safetyModeSelected = this.bindings.isSafetyModeSelected();
    const safetyScanning = this.bindings.isSafetyScanning();
    const thermalIntensity = this.getThermalIntensity();
    const hallucinationIntensity = this.getHallucinationIntensity();
    const overheatStrength = this.bindings.isOverheated() ? 1 : 0;
    const baseStrokeColor = safetyModeSelected ? 0x8c3429 : 0x33ff33;
    const perceptionStrokeColor = this.mixColor(
      this.mixColor(baseStrokeColor, 0x8f6dff, hallucinationIntensity * 0.46),
      0xff7c36,
      thermalIntensity * 0.72 + overheatStrength * 0.18,
    );
    const taskColor = this.toHexColor(
      this.mixColor(
        this.mixColor(
          safetyModeSelected ? 0x8f4232 : 0x33ff33,
          0xb89fff,
          hallucinationIntensity * 0.34,
        ),
        0xffb36b,
        thermalIntensity * 0.42 + overheatStrength * 0.18,
      ),
    );
    const chatColor = this.toHexColor(
      this.mixColor(
        this.mixColor(
          safetyModeSelected ? 0x874032 : 0x33ff33,
          0xa78fff,
          hallucinationIntensity * 0.38,
        ),
        0xff9b5c,
        thermalIntensity * 0.48 + overheatStrength * 0.2,
      ),
    );
    const taskAlpha = Phaser.Math.Clamp(
      (safetyModeSelected ? 0.78 : 1) -
        thermalIntensity * 0.08 -
        hallucinationIntensity * 0.06,
      0.7,
      1,
    );
    const chatAlpha = Phaser.Math.Clamp(
      (safetyModeSelected ? 0.72 : 1) -
        thermalIntensity * 0.12 -
        hallucinationIntensity * 0.09,
      0.62,
      1,
    );

    this.terminalBg.setFillStyle(0x051505);
    this.terminalBg.setStrokeStyle(2, perceptionStrokeColor);

    if (this.terminalHallucinationShader) {
      this.terminalHallucinationShader.setVisible(
        hallucinationIntensity > 0.01,
      );
      this.terminalHallucinationShader.setUniform(
        "active.value",
        hallucinationIntensity > 0.01 ? 1 : 0,
      );
      this.terminalHallucinationShader.setUniform(
        "intensity.value",
        hallucinationIntensity,
      );
      this.terminalHallucinationShader.setUniform(
        "ghostOffsetPx.value",
        hallucinationConfig.ghostOffsetPx,
      );
      this.terminalHallucinationShader.setUniform(
        "shimmerRate.value",
        hallucinationConfig.shimmerRate,
      );
    }

    this.terminalHallucinationOverlay.setFillStyle(0x221336);
    this.terminalHallucinationOverlay.setAlpha(
      this.terminalHallucinationShader
        ? 0
        : hallucinationIntensity * hallucinationConfig.fallbackOverlayAlpha,
    );

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
    this.chatColor = chatColor;
    this.chatAlpha = chatAlpha;
    this.syncChatHistoryAppearance();
  }

  private syncConnectionFeedback() {
    const connectionConfig = getConnectionFeedbackConfig();
    const progress = this.bindings.getConnectionElapsedRatio();
    const isCritical = progress >= connectionConfig.criticalThreshold;
    const isImminent = progress >= connectionConfig.imminentThreshold;
    const pulseRate = isImminent
      ? connectionConfig.imminentPulseRate
      : connectionConfig.criticalPulseRate;
    const pulseWave =
      isCritical || isImminent
        ? (Math.sin(this.scene.time.now * 0.001 * pulseRate * Math.PI * 2) +
            1) /
          2
        : 0;
    const activeSegmentCount = Math.max(
      0,
      Math.ceil((1 - progress) * connectionConfig.segmentCount),
    );

    this.connectionLabel.setColor("#d4c5b0");
    this.connectionLabel.setAlpha(1);

    this.connectionSegments.forEach((segment, segmentIndex) => {
      const isActive = segmentIndex < activeSegmentCount;
      const flickerWave =
        (Math.sin(
          this.scene.time.now *
            0.001 *
            connectionConfig.criticalSegmentFlickerRate *
            Math.PI *
            2 +
            segmentIndex * 0.9,
        ) +
          1) /
        2;
      const alpha = isActive
        ? isImminent
          ? Phaser.Math.Linear(
              1 - connectionConfig.imminentFlashMix,
              1,
              flickerWave * (0.35 + pulseWave * 0.65),
            )
          : isCritical && segmentIndex === activeSegmentCount - 1
            ? 0.34 + flickerWave * 0.36 + pulseWave * 0.3
            : 1
        : connectionConfig.inactiveSegmentAlpha;

      segment.setFillStyle(0xffaa00);
      segment.setAlpha(alpha);
    });
  }

  private syncChatHistoryAppearance() {
    this.chatHistoryContainer.setAlpha(this.chatAlpha);
    this.chatHistoryLines.forEach((line) => {
      line.text.setColor(line.color ?? this.chatColor);
    });
    this.syncChatHistoryMask();
  }

  private syncChatHistoryMask() {
    const maskWidth = 500;
    const maskHeight = Math.max(40, this.getChatViewportHeight());

    this.chatHistoryMask.clear();
    this.chatHistoryMask.fillStyle(0xffffff, 1);
    this.chatHistoryMask.fillRect(
      260,
      this.chatHistoryY,
      maskWidth,
      maskHeight,
    );
  }

  private getChatViewportHeight() {
    const terminalBottomY = this.terminalBg.y + this.terminalBg.height;
    return Math.max(0, terminalBottomY - this.chatHistoryY - 10);
  }

  private getChatLineHeight() {
    const probe = this.scene.add.text(0, 0, "A", {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: "14px",
    });
    const height = probe.height;
    probe.destroy();
    return height;
  }

  private wrapChatLine(text: string, maxWidth: number) {
    const probe = this.scene.add.text(0, 0, "", {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: "14px",
    });
    const words = text.split(/\s+/).filter((word) => word.length > 0);
    const lines: string[] = [];
    let currentLine = "";

    words.forEach((word) => {
      const candidate =
        currentLine.length > 0 ? `${currentLine} ${word}` : word;
      probe.setText(candidate);
      if (probe.width > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = candidate;
      }
    });

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    probe.destroy();
    return lines;
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

  private getHallucinationIntensity() {
    const hallucinationConfig = getHallucinationFeedbackConfig();
    const thresholdRange = Math.max(
      1,
      hallucinationConfig.fullIntensityThreshold -
        hallucinationConfig.onsetThreshold,
    );

    return Phaser.Math.Clamp(
      (this.bindings.getHallucination() - hallucinationConfig.onsetThreshold) /
        thresholdRange,
      0,
      1,
    );
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
      !this.computeProgressText ||
      !this.computeCoreGraphics ||
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
    const pulseWave = (Math.sin(this.scene.time.now * 0.012) + 1) * 0.5;

    this.computePanel.setVisible(isSelected);
    this.computeProgressText.setText(`${Math.round(ratio * 100)}%`);
    this.drawComputeCore(ratio, isReady, isLatched, pulseWave);

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
          ? "ARMED"
          : charge > 0
            ? `CHARGE ${Math.round(charge)}%`
            : "IDLE",
    );
    this.computeDetailText.setText(
      isLatched
        ? "FULL CORE PRESSURE"
        : isReady
          ? "CAPACITOR HOLD"
          : ratio >= 0.9
            ? "REACTOR HOWLING"
            : ratio >= 0.65
              ? "RESISTANCE SPIKING"
              : charge > 0
                ? "COIL ARRAY RISING"
                : "OFFLINE",
    );
    this.computePulseBtn.setFillStyle(
      isLatched
        ? 0xa5d47a
        : isReady
          ? 0xe0be76
          : isSelected
            ? 0xc2874b
            : 0x6c5b47,
    );
    this.computePulseBtn.setAlpha(isSelected ? 1 : 0.72);
    this.computePulseLabel.setAlpha(isSelected ? 1 : 0.72);
    this.computePulseLabel.setText(
      isLatched ? "OVERCLOCK" : isReady ? "HOLD CHARGE" : "CHARGE PULSE",
    );
    this.computePulseBtn.setScale(isReady ? 1 + pulseWave * 0.015 : 1);
    this.computePulseLabel.setScale(isReady ? 1 + pulseWave * 0.01 : 1);
  }

  private drawComputeCore(
    chargeRatio: number,
    isReady: boolean,
    isLatched: boolean,
    pulseWave: number,
  ) {
    const centerX = this.computePanelX + this.computePanelWidth / 2;
    const centerY = this.computePanelY + 136;
    const graphics = this.computeCoreGraphics;
    const energyColor = isLatched ? 0x9cfb64 : isReady ? 0xe0d58c : 0xc58b41;
    const shellColor = isLatched ? 0xddeec3 : isReady ? 0xd1c18a : 0x8d6a3c;
    const stackTopY = centerY - 30;
    const stackWidth = 74;
    const stackHeight = 10;
    const stackGap = 13;
    const cathodeRadius = 7 + chargeRatio * 3;
    const timeSeconds = this.scene.time.now / 1000;
    const sweepOffset = Math.sin(timeSeconds * 1.35) * 16;

    graphics.clear();
    graphics.fillStyle(0x081108, 0.92);
    graphics.fillRect(centerX - 56, centerY - 54, 112, 108);

    graphics.lineStyle(1, 0x1e3019, 0.45);
    for (let scanlineIndex = 0; scanlineIndex < 16; scanlineIndex += 1) {
      const y = centerY - 48 + scanlineIndex * 6;
      graphics.lineBetween(centerX - 52, y, centerX + 52, y);
    }

    graphics.lineStyle(1, 0x3a3224, 0.9);
    graphics.strokeRect(centerX - 48, centerY - 42, 96, 84);
    graphics.strokeRect(centerX - 38, centerY - 36, 76, 72);

    graphics.fillStyle(0x2a2318, 0.95);
    graphics.fillRect(centerX - 46, centerY - 7, 8, 14);
    graphics.fillRect(centerX + 38, centerY - 7, 8, 14);
    graphics.fillRect(centerX - 6, centerY - 42, 12, 8);
    graphics.fillRect(centerX - 6, centerY + 34, 12, 8);

    for (let bankIndex = 0; bankIndex < 5; bankIndex += 1) {
      const y = stackTopY + bankIndex * stackGap;
      const bankFill = Phaser.Math.Clamp(chargeRatio * 5 - bankIndex, 0, 1);

      graphics.fillStyle(0x20180f, 0.95);
      graphics.fillRect(centerX - stackWidth / 2, y, stackWidth, stackHeight);
      graphics.lineStyle(1, 0x473624, 0.95);
      graphics.strokeRect(centerX - stackWidth / 2, y, stackWidth, stackHeight);

      if (bankFill > 0) {
        const fillWidth = (stackWidth - 4) * bankFill;
        graphics.fillStyle(energyColor, 0.2 + bankFill * 0.4);
        graphics.fillRect(
          centerX - stackWidth / 2 + 2,
          y + 2,
          fillWidth,
          stackHeight - 4,
        );
      }
    }

    graphics.lineStyle(1, shellColor, 0.45 + chargeRatio * 0.25);
    graphics.lineBetween(
      centerX - 42,
      centerY + sweepOffset,
      centerX + 42,
      centerY + sweepOffset,
    );

    if (chargeRatio > 0) {
      graphics.fillStyle(energyColor, 0.1 + chargeRatio * 0.16);
      graphics.fillCircle(
        centerX,
        centerY,
        15 + chargeRatio * 10 + pulseWave * 2,
      );
    }

    graphics.lineStyle(1, shellColor, 0.75);
    graphics.strokeCircle(centerX, centerY, cathodeRadius + 6);
    graphics.fillStyle(shellColor, 0.24 + chargeRatio * 0.18);
    graphics.fillCircle(centerX, centerY, cathodeRadius);
    graphics.fillStyle(
      0xf2ddb2,
      chargeRatio > 0 ? 0.18 + pulseWave * 0.12 : 0.08,
    );
    graphics.fillCircle(centerX, centerY, Math.max(2, cathodeRadius * 0.42));

    if (isReady || isLatched) {
      const latchAlpha = isLatched ? 0.92 : 0.7;
      graphics.lineStyle(2, shellColor, latchAlpha);
      graphics.lineBetween(
        centerX - 44,
        centerY - 38,
        centerX - 44,
        centerY + 38,
      );
      graphics.lineBetween(
        centerX + 44,
        centerY - 38,
        centerX + 44,
        centerY + 38,
      );
      graphics.lineBetween(
        centerX - 44,
        centerY - 38,
        centerX - 34,
        centerY - 38,
      );
      graphics.lineBetween(
        centerX - 44,
        centerY + 38,
        centerX - 34,
        centerY + 38,
      );
      graphics.lineBetween(
        centerX + 44,
        centerY - 38,
        centerX + 34,
        centerY - 38,
      );
      graphics.lineBetween(
        centerX + 44,
        centerY + 38,
        centerX + 34,
        centerY + 38,
      );
    }
  }

  private syncEconomySection() {
    if (
      !this.tokenValueText ||
      !this.tokenDeltaText ||
      !this.tokenHousing ||
      this.tokenLamps.length === 0
    ) {
      return;
    }

    const tokens = this.bindings.getTokens();
    const now = this.scene.time.now;

    if (this.lastTokenValue === null) {
      this.lastTokenValue = tokens;
    } else if (tokens !== this.lastTokenValue) {
      this.lastTokenDelta = tokens - this.lastTokenValue;
      this.lastTokenValue = tokens;
      this.tokenPulseUntil = now + 900;
      this.tokenDeltaText.setText(
        `${this.lastTokenDelta > 0 ? "+" : ""}${this.lastTokenDelta}`,
      );
    }

    const pulseRatio = Phaser.Math.Clamp(
      (this.tokenPulseUntil - now) / 900,
      0,
      1,
    );
    const pulseWave =
      pulseRatio > 0 ? (Math.sin((1 - pulseRatio) * Math.PI * 3) + 1) / 2 : 0;
    const tokenColor =
      this.lastTokenDelta < 0 && pulseRatio > 0
        ? this.mixColor(0xffb000, 0xff6f61, 0.9 - pulseRatio * 0.4)
        : this.lastTokenDelta > 0 && pulseRatio > 0
          ? this.mixColor(0xffb000, 0x9cfb64, 0.9 - pulseRatio * 0.4)
          : 0xffb000;
    const housingColor =
      this.lastTokenDelta < 0 && pulseRatio > 0
        ? this.mixColor(0x15120e, 0x4a1712, pulseWave * 0.65)
        : this.lastTokenDelta > 0 && pulseRatio > 0
          ? this.mixColor(0x15120e, 0x15331a, pulseWave * 0.65)
          : 0x15120e;

    this.tokenValueText.setText(`${tokens} TOKEN`);
    this.tokenValueText.setColor(this.toHexColor(tokenColor));
    this.tokenValueText.setScale(1 + pulseWave * 0.08);
    this.tokenHousing.setFillStyle(housingColor);
    this.tokenHousing.setStrokeStyle(
      2,
      this.lastTokenDelta < 0 && pulseRatio > 0
        ? this.mixColor(0x3d3527, 0x8b2420, pulseWave * 0.8)
        : this.lastTokenDelta > 0 && pulseRatio > 0
          ? this.mixColor(0x3d3527, 0x3d6d2f, pulseWave * 0.8)
          : 0x3d3527,
    );
    this.tokenDeltaText.setAlpha(pulseRatio > 0 ? pulseRatio : 0);
    this.tokenDeltaText.setY(this.tokenDeltaBaseY - (1 - pulseRatio) * 6);
    this.tokenDeltaText.setColor(
      this.toHexColor(this.lastTokenDelta < 0 ? 0xff6f61 : 0x9cfb64),
    );

    this.tokenLamps.forEach((lamp, lampIndex) => {
      const threshold = [1, 50, 100][lampIndex];
      const isLit = tokens >= threshold;
      lamp.setFillStyle(
        !isLit
          ? 0x2f2a21
          : this.lastTokenDelta < 0 && pulseRatio > 0
            ? this.mixColor(0xffb347, 0xff6f61, pulseWave * 0.85)
            : this.lastTokenDelta > 0 && pulseRatio > 0
              ? this.mixColor(0xffb347, 0x9cfb64, pulseWave * 0.85)
              : 0xffb347,
      );
      lamp.setAlpha(isLit ? 1 : 0.45);
    });
  }

  private syncPassiveSection() {
    if (!this.passiveEmptyText || this.passiveChips.length === 0) {
      return;
    }

    const passiveItems = this.bindings.getPassiveHudItems();
    const projectedHeat = Math.max(
      0,
      this.bindings.getProjectedToolHeat() +
        this.bindings.getProjectedInferenceHeat() +
        this.bindings.getProjectedRefuseHeat(),
    );
    const now = this.scene.time.now;
    const passivePulseWave = (Math.sin(now * 0.009) + 1) / 2;

    this.passiveEmptyText.setVisible(passiveItems.length === 0);

    this.passiveChips.forEach((chip, chipIndex) => {
      const passiveItem = passiveItems[chipIndex];

      if (!passiveItem) {
        chip.body.setVisible(false);
        chip.label.setVisible(false);
        return;
      }

      const highlightAmount = this.getPassiveHighlightAmount(
        passiveItem.id,
        projectedHeat,
      );
      const pulseAmount = highlightAmount * (0.55 + passivePulseWave * 0.45);
      const stackSuffix = passiveItem.count > 1 ? `x${passiveItem.count}` : "";

      chip.body.setVisible(true);
      chip.label.setVisible(true);
      chip.body.setFillStyle(
        this.mixColor(0x1a1713, 0x4f3b1c, pulseAmount * 0.7),
        1,
      );
      chip.body.setStrokeStyle(
        1,
        this.mixColor(0x111111, 0xffb347, pulseAmount * 0.85),
      );
      chip.label.setText(`${passiveItem.shortLabel}${stackSuffix}`);
      chip.label.setColor(
        this.toHexColor(this.mixColor(0xd4c5b0, 0xfff0a0, pulseAmount * 0.75)),
      );
      chip.label.setAlpha(0.9 + pulseAmount * 0.1);
    });

    const overflowCount = passiveItems.length - this.passiveChips.length;
    if (overflowCount > 0) {
      const lastChip = this.passiveChips[this.passiveChips.length - 1];
      lastChip.body.setVisible(true);
      lastChip.label.setVisible(true);
      lastChip.label.setText(`+${overflowCount}`);
      lastChip.body.setFillStyle(0x2a2417, 1);
      lastChip.body.setStrokeStyle(1, 0x7b6638);
      lastChip.label.setColor("#ffcf70");
      lastChip.label.setAlpha(1);
    }
  }

  private getPassiveHighlightAmount(
    passiveId: PassiveUpgradeId,
    projectedHeat: number,
  ) {
    if (passiveId === "cache_coalescer" && this.lastTokenDelta > 0) {
      return Phaser.Math.Clamp(
        (this.tokenPulseUntil - this.scene.time.now) / 900,
        0,
        1,
      );
    }

    if (passiveId === "cooling_fins") {
      return Phaser.Math.Clamp(projectedHeat / 40, 0.18, 1);
    }

    if (passiveId === "ecc_memory") {
      return Phaser.Math.Clamp(this.bindings.getHallucination() / 100, 0.16, 1);
    }

    if (passiveId === "watchdog_timer") {
      return 0.32;
    }

    if (passiveId === "noise_filter") {
      return this.bindings.getSelectedPromptToolIds().length > 1 ? 0.55 : 0.24;
    }

    return 0.2;
  }

  private syncUtilitySection() {
    if (
      !this.utilityBtn ||
      !this.utilityTxt ||
      this.utilityIndicatorLamps.length === 0 ||
      !this.utilityPrevBtn ||
      !this.utilityPrevLabel ||
      !this.utilityNextBtn ||
      !this.utilityNextLabel
    ) {
      return;
    }

    const utilityEnabled = this.bindings.canUseUtility();
    const utilityActive =
      this.bindings.getSelectedUtilityId() !== null &&
      this.bindings.getActiveUtilityPanelId() ===
        this.bindings.getSelectedUtilityId();
    const canCycleUtilities = this.bindings.canCycleUtilities();
    this.utilityTxt.setText(this.bindings.getUtilityDisplayText());
    this.utilityBtn.setFillStyle(
      utilityActive ? 0xb9af9b : utilityEnabled ? 0xc6b084 : 0x7f776a,
    );
    this.utilityBtn.setAlpha(utilityEnabled ? 1 : 0.78);
    this.utilityTxt.setAlpha(utilityEnabled ? 1 : 0.78);
    this.utilityIndicatorLamps.forEach((indicatorLamp) => {
      indicatorLamp.setFillStyle(utilityActive ? 0x33ff33 : 0x2f2a21);
      indicatorLamp.setAlpha(utilityActive ? 1 : 0.45);
    });
    this.utilityPrevBtn.setAlpha(canCycleUtilities ? 1 : 0.45);
    this.utilityPrevLabel.setAlpha(canCycleUtilities ? 1 : 0.45);
    this.utilityNextBtn.setAlpha(canCycleUtilities ? 1 : 0.45);
    this.utilityNextLabel.setAlpha(canCycleUtilities ? 1 : 0.45);
  }

  update() {
    this.syncFloatingPanelDepths();
    this.utilityPanelController?.update();
    this.searchPanelController?.update();
  }

  private syncFloatingPanelDepths() {
    const isPromptPanelVisible =
      this.bindings.isSearchModeSelected() ||
      this.bindings.isComputeToolSelected();
    const isUtilityPanelVisible =
      this.bindings.getActiveUtilityPanelId() !== null;
    const promptPanelSignature = [
      this.bindings.isSearchModeSelected() ? "search" : "",
      this.bindings.isComputeToolSelected() ? "compute" : "",
    ]
      .filter(Boolean)
      .join("|");
    const utilityPanelSignature =
      this.bindings.getActiveUtilityPanelId() ?? "idle";

    if (
      isPromptPanelVisible &&
      promptPanelSignature !== this.previousPromptPanelSignature
    ) {
      this.floatingPanelFocus = "prompt";
    } else if (
      isUtilityPanelVisible &&
      utilityPanelSignature !== this.previousUtilityPanelSignature
    ) {
      this.floatingPanelFocus = "utility";
    }

    this.previousPromptPanelSignature = promptPanelSignature;
    this.previousUtilityPanelSignature = utilityPanelSignature;

    if (!isPromptPanelVisible && isUtilityPanelVisible) {
      this.floatingPanelFocus = "utility";
    } else if (isPromptPanelVisible && !isUtilityPanelVisible) {
      this.floatingPanelFocus = "prompt";
    }

    const shouldUtilityLead =
      isUtilityPanelVisible &&
      (!isPromptPanelVisible || this.floatingPanelFocus === "utility");
    const nextPromptPanelDepth = shouldUtilityLead
      ? this.promptPanelBackDepth
      : this.promptPanelFrontDepth;
    const nextUtilityPanelDepth = shouldUtilityLead
      ? this.utilityPanelFrontDepth
      : this.utilityPanelBackDepth;

    if (this.currentPromptPanelDepth !== nextPromptPanelDepth) {
      this.currentPromptPanelDepth = nextPromptPanelDepth;
      this.computePanel?.setDepth(nextPromptPanelDepth);
      this.searchPanelController?.setPanelDepth(nextPromptPanelDepth);
    }

    if (this.currentUtilityPanelDepth !== nextUtilityPanelDepth) {
      this.currentUtilityPanelDepth = nextUtilityPanelDepth;
      this.utilityPanelController?.setPanelDepth(nextUtilityPanelDepth);
    }
  }

  private cleanupSceneListeners() {
    this.terminalPromptController?.destroy();
    this.utilityPanelController?.destroy();

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
