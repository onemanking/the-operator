import Phaser from "phaser";
import {
  getUtilityMinigameConfig,
  SignalBoostLayoutConfig,
} from "../../data/RunData";
import {
  ActiveUtilityId,
  getActiveUtilityDefinition,
} from "../../data/UtilityData";
import {
  getSignalGridBounds,
  getSignalPanelBounds,
  UTILITY_PANEL_LAYOUT,
} from "./utilityPanelLayout";

export interface UtilityPanelBindings {
  getSelectedUtilityId: () => ActiveUtilityId | null;
  getActiveUtilityPanelId: () => ActiveUtilityId | null;
  getUtilityPanelStatusText: () => string;
  getUtilityFeedbackState: () => "idle" | "running" | "success" | "error";
  getUtilityFeedbackFlash: () => number;
  canUseSelectedUtility: () => boolean;
  onStartUtilityActivation: () => void;
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
}

interface CoolantLeverUi {
  handle: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  orderText: Phaser.GameObjects.Text;
}

export class MainSceneUtilityPanelController {
  private readonly panelX = UTILITY_PANEL_LAYOUT.panelX;
  private readonly panelY = UTILITY_PANEL_LAYOUT.panelY;
  private readonly panelWidth = UTILITY_PANEL_LAYOUT.panelWidth;
  private readonly panelHeight = UTILITY_PANEL_LAYOUT.panelHeight;
  private readonly coolantTrackTop = 334;
  private readonly coolantTrackHeight = 118;
  private readonly coolantHandleTravel = 70;
  private readonly signalPanelLeft = getSignalPanelBounds().left;
  private readonly signalPanelTop = getSignalPanelBounds().top;
  private readonly signalPanelWidth = getSignalPanelBounds().width;
  private readonly signalPanelHeight = getSignalPanelBounds().height;
  private readonly signalCellSize = UTILITY_PANEL_LAYOUT.signalCellSize;

  private panelBody!: Phaser.GameObjects.Rectangle;
  private panelTopBar!: Phaser.GameObjects.Rectangle;
  private panelFrame!: Phaser.GameObjects.Rectangle;
  private flashOverlay!: Phaser.GameObjects.Rectangle;
  private nameText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;

  private coolantGraphics!: Phaser.GameObjects.Graphics;
  private realityGraphics!: Phaser.GameObjects.Graphics;
  private signalGraphics!: Phaser.GameObjects.Graphics;
  private realityKnobHitZone!: Phaser.GameObjects.Rectangle;
  private signalGridHitZone!: Phaser.GameObjects.Rectangle;
  private coolantLeverUi: CoolantLeverUi[] = [];
  private signalCellLabels: Phaser.GameObjects.Text[] = [];

  private pointerMoveHandler?: (pointer: Phaser.Input.Pointer) => void;
  private pointerUpHandler?: (pointer: Phaser.Input.Pointer) => void;
  private realityDraggingPointerId: number | null = null;
  private realityLastPointerX: number | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bindings: UtilityPanelBindings,
  ) {}

  create() {
    this.panelBody = this.scene.add
      .rectangle(
        this.panelX,
        this.panelY,
        this.panelWidth,
        this.panelHeight,
        0x24201a,
      )
      .setOrigin(0);
    this.panelTopBar = this.scene.add
      .rectangle(this.panelX, this.panelY, this.panelWidth, 4, 0x111111)
      .setOrigin(0);
    this.panelFrame = this.scene.add
      .rectangle(
        this.panelX + this.panelWidth / 2,
        this.panelY + this.panelHeight / 2,
        this.panelWidth - 12,
        this.panelHeight - 20,
        0x2a251e,
      )
      .setStrokeStyle(2, 0x111111);

    this.flashOverlay = this.scene.add
      .rectangle(
        this.panelX,
        this.panelY,
        this.panelWidth,
        this.panelHeight,
        0xffffff,
        0,
      )
      .setOrigin(0)
      .setDepth(0.2);

    this.nameText = this.scene.add.text(
      this.panelX + 14,
      this.panelY + 12,
      "UTILITY MODULE",
      {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#d4c5b0",
        fontStyle: "bold",
      },
    );

    this.statusText = this.scene.add.text(
      this.panelX + 14,
      this.panelY + 34,
      "STANDBY",
      {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: "10px",
        color: "#9fd87d",
        wordWrap: { width: 170 },
      },
    );

    this.hintText = this.scene.add.text(
      this.panelX + 14,
      this.panelY + 62,
      "",
      {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: "10px",
        color: "#8b8375",
        wordWrap: { width: 170 },
      },
    );

    this.coolantGraphics = this.scene.add.graphics();
    this.realityGraphics = this.scene.add.graphics();
    this.signalGraphics = this.scene.add.graphics();

    for (let leverIndex = 0; leverIndex < 3; leverIndex += 1) {
      const handle = this.scene.add
        .rectangle(0, 0, 28, 18, 0x9e998e)
        .setStrokeStyle(2, 0x111111)
        .setInteractive({ useHandCursor: true });
      const label = this.scene.add.text(0, 0, String(leverIndex + 1), {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#111111",
        fontStyle: "bold",
      });
      const orderText = this.scene.add.text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#d4c5b0",
        fontStyle: "bold",
      });

      handle.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (!this.ensurePanelActivated("coolant_purge")) {
          return;
        }

        this.bindings.onCoolantLeverDragStart(leverIndex, pointer.id);
      });

      this.coolantLeverUi.push({ handle, label, orderText });
    }

    this.realityKnobHitZone = this.scene.add
      .rectangle(this.panelX + 100, this.panelY + 252, 88, 88, 0xffffff, 0.001)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.realityKnobHitZone.on(
      "pointerdown",
      (pointer: Phaser.Input.Pointer) => {
        if (!this.ensurePanelActivated("reality_patch")) {
          return;
        }

        this.realityDraggingPointerId = pointer.id;
        this.realityLastPointerX = pointer.x;
        this.bindings.onRealityTuneStart(pointer.id);
      },
    );

    this.signalGridHitZone = this.scene.add
      .rectangle(
        this.getSignalGridLeft() + this.signalCellSize * 1.5,
        this.getSignalGridTop() + this.signalCellSize * 1.5,
        this.signalCellSize * 3,
        this.signalCellSize * 3,
        0xffffff,
        0.001,
      )
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.signalGridHitZone.on(
      "pointerdown",
      (pointer: Phaser.Input.Pointer) => {
        if (!this.ensurePanelActivated("signal_boost")) {
          return;
        }

        this.bindings.onSignalDragStart(
          pointer.id,
          this.getSignalCellIndex(pointer.x, pointer.y),
        );
      },
    );

    for (let cellIndex = 0; cellIndex < 9; cellIndex += 1) {
      this.signalCellLabels.push(
        this.scene.add.text(0, 0, "", {
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: "8px",
          color: "#111111",
          fontStyle: "bold",
          align: "center",
        }),
      );
    }

    this.pointerMoveHandler = (pointer: Phaser.Input.Pointer) => {
      this.bindings.onCoolantLeverDragMove(
        pointer.id,
        this.getCoolantDragRatio(pointer.y),
      );

      if (
        this.realityDraggingPointerId === pointer.id &&
        this.realityLastPointerX !== null
      ) {
        const deltaX = pointer.x - this.realityLastPointerX;
        this.realityLastPointerX = pointer.x;
        this.bindings.onRealityTuneDelta(pointer.id, deltaX);
      }

      this.bindings.onSignalDragMove(
        pointer.id,
        this.getSignalCellIndex(pointer.x, pointer.y),
      );
    };

    this.pointerUpHandler = (pointer: Phaser.Input.Pointer) => {
      this.bindings.onCoolantLeverDragEnd(pointer.id);
      this.bindings.onRealityTuneEnd(pointer.id);
      this.bindings.onSignalDragEnd(
        pointer.id,
        this.getSignalCellIndex(pointer.x, pointer.y),
      );

      if (this.realityDraggingPointerId === pointer.id) {
        this.realityDraggingPointerId = null;
        this.realityLastPointerX = null;
      }
    };

    this.scene.input.on("pointermove", this.pointerMoveHandler);
    this.scene.input.on("pointerup", this.pointerUpHandler);
    this.scene.input.on("pointerupoutside", this.pointerUpHandler);
  }

  update() {
    const activeUtilityId = this.bindings.getActiveUtilityPanelId();
    const selectedUtilityId = this.bindings.getSelectedUtilityId();
    const displayUtilityId = activeUtilityId ?? selectedUtilityId;
    const definition = displayUtilityId
      ? getActiveUtilityDefinition(displayUtilityId)
      : undefined;
    const feedbackState = this.bindings.getUtilityFeedbackState();
    const feedbackFlash = this.bindings.getUtilityFeedbackFlash();

    this.nameText.setText(definition?.name ?? "UTILITY MODULE");
    this.statusText.setText(this.bindings.getUtilityPanelStatusText());

    if (!displayUtilityId) {
      this.hintText.setText("NO UTILITY STOCKED");
    } else if (!activeUtilityId) {
      this.hintText.setText(
        this.bindings.canUseSelectedUtility()
          ? displayUtilityId === "coolant_purge"
            ? "DRAG A LEVER TO START PURGE"
            : displayUtilityId === "reality_patch"
              ? "DRAG THE KNOB TO START TUNING"
              : "DRAG FROM SRC TO START ROUTING"
          : "UTILITY STOCK EMPTY",
      );
    } else if (activeUtilityId === "coolant_purge") {
      this.hintText.setText(
        "DRAG LEVERS IN ORDER. HOLD AT FLOOR UNTIL PRESSURE DROPS.",
      );
    } else if (activeUtilityId === "reality_patch") {
      this.hintText.setText(
        "DRAG THE KNOB SIDEWAYS. ALIGN THE LIVE TRACE WITH TARGET.",
      );
    } else {
      this.hintText.setText(
        "DRAW ONE CONTINUOUS ROUTE. HIT EVERY NODE BEFORE TARGET.",
      );
    }

    const frameColor =
      feedbackState === "success"
        ? 0x3c7a46
        : feedbackState === "error"
          ? 0x6e2b1e
          : activeUtilityId
            ? 0x4f4331
            : 0x393128;
    this.panelFrame.setFillStyle(frameColor);
    this.flashOverlay.setFillStyle(
      feedbackState === "success"
        ? 0xb0fff2
        : feedbackState === "error"
          ? 0xff6a3a
          : 0xffd68a,
      feedbackState === "running" ? 0.04 : feedbackFlash * 0.32,
    );

    this.drawCoolantPanel(displayUtilityId === "coolant_purge");
    this.drawRealityPanel(displayUtilityId === "reality_patch");
    this.drawSignalPanel(displayUtilityId === "signal_boost");
  }

  destroy() {
    if (this.pointerMoveHandler) {
      this.scene.input.off("pointermove", this.pointerMoveHandler);
      this.pointerMoveHandler = undefined;
    }

    if (this.pointerUpHandler) {
      this.scene.input.off("pointerup", this.pointerUpHandler);
      this.scene.input.off("pointerupoutside", this.pointerUpHandler);
      this.pointerUpHandler = undefined;
    }
  }

  private drawCoolantPanel(isVisible: boolean) {
    const nextLeverIndex = this.bindings.getCoolantNextRequiredLeverIndex();
    const leverOrder = this.bindings.getCoolantLeverOrder();
    const gaugeWidth = 38;

    this.coolantGraphics.clear();
    this.coolantGraphics.setVisible(isVisible);
    this.coolantLeverUi.forEach((leverUi) => {
      leverUi.handle.setVisible(isVisible);
      leverUi.label.setVisible(isVisible);
      leverUi.orderText.setVisible(isVisible);
    });

    if (!isVisible) {
      return;
    }

    this.coolantGraphics.fillStyle(0x1a1712, 1);
    this.coolantGraphics.fillRoundedRect(
      this.panelX + 14,
      this.panelY + 86,
      172,
      196,
      6,
    );
    this.coolantGraphics.lineStyle(1, 0x3d3528, 1);
    this.coolantGraphics.strokeRoundedRect(
      this.panelX + 14,
      this.panelY + 86,
      172,
      196,
      6,
    );
    this.coolantGraphics.lineStyle(1, 0x52463b, 1);

    for (let leverIndex = 0; leverIndex < 3; leverIndex += 1) {
      const columnX = this.panelX + 22 + leverIndex * 56;
      const trackX = columnX + 12;
      const gaugeY = this.panelY + 110;
      const trackY = this.coolantTrackTop;
      const progress = this.bindings.getCoolantLeverProgress(leverIndex);
      const decayRatio = this.bindings.getCoolantLeverDecayRatio(leverIndex);
      const dragRatio = this.bindings.getCoolantLeverDragRatio(leverIndex);
      const isCompleted = this.bindings.isCoolantLeverCompleted(leverIndex);
      const isNext = nextLeverIndex === leverIndex;

      this.coolantGraphics.fillStyle(0x2a251e, 1);
      this.coolantGraphics.fillRoundedRect(columnX, gaugeY - 18, 46, 16, 4);
      this.coolantGraphics.fillStyle(
        isCompleted ? 0x64d88f : isNext ? 0xffb248 : 0x514733,
        1,
      );
      this.coolantGraphics.fillRect(
        columnX + 4,
        gaugeY - 14,
        gaugeWidth * (1 - progress),
        8,
      );
      this.coolantGraphics.fillStyle(0x1a1813, 1);
      this.coolantGraphics.fillRect(
        columnX + 4 + gaugeWidth * (1 - progress),
        gaugeY - 14,
        gaugeWidth * progress,
        8,
      );

      if (isCompleted) {
        this.coolantGraphics.fillStyle(0x2f3f33, 1);
        this.coolantGraphics.fillRect(
          columnX + 4,
          gaugeY - 5,
          gaugeWidth * decayRatio,
          3,
        );
      }

      this.coolantGraphics.fillStyle(0x3a3328, 1);
      this.coolantGraphics.fillRoundedRect(
        trackX,
        trackY,
        22,
        this.coolantTrackHeight,
        6,
      );
      this.coolantGraphics.fillStyle(isNext ? 0xffd99b : 0x50463a, 1);
      this.coolantGraphics.fillRect(
        trackX + 8,
        trackY + 6,
        6,
        this.coolantTrackHeight - 12,
      );

      const handleY = trackY + 14 + dragRatio * this.coolantHandleTravel;
      const leverUi = this.coolantLeverUi[leverIndex];
      leverUi.handle.setPosition(columnX + 23, handleY);
      leverUi.handle.setFillStyle(
        isCompleted ? 0x7ad5a5 : isNext ? 0xd6c29c : 0x8b8477,
      );
      leverUi.handle.setAngle(isCompleted ? 2 : dragRatio * 4);
      leverUi.label.setPosition(columnX + 18, handleY - 8);
      leverUi.orderText.setPosition(columnX + 9, gaugeY + 8);
      leverUi.orderText.setText(`SEQ ${leverOrder.indexOf(leverIndex) + 1}`);
      leverUi.orderText.setColor(isNext ? "#ffcf77" : "#a49b8b");
    }
  }

  private drawRealityPanel(isVisible: boolean) {
    const config = getUtilityMinigameConfig().reality;
    const currentRatio = this.bindings.getRealityCurrentFrequencyRatio();
    const targetRatio = this.bindings.getRealityTargetFrequencyRatio();
    const lockProgress = this.bindings.getRealityLockProgress();
    const jitterIntensity = this.bindings.getRealityJitterIntensity();
    const time = this.scene.time.now * 0.0042;
    const hallucinationTone = 0x8f6dff;
    const scopeX = this.panelX + 18;
    const scopeY = this.panelY + 96;
    const scopeWidth = 164;
    const scopeHeight = 120;
    const knobCenterX = this.panelX + 100;
    const knobCenterY = this.panelY + 252;

    this.realityGraphics.clear();
    this.realityGraphics.setVisible(isVisible);
    this.realityKnobHitZone.setVisible(isVisible);

    if (!isVisible) {
      return;
    }

    this.realityGraphics.fillStyle(0x151712, 1);
    this.realityGraphics.fillRoundedRect(
      scopeX,
      scopeY,
      scopeWidth,
      scopeHeight,
      6,
    );
    this.realityGraphics.lineStyle(1, 0x3d5037, 1);
    this.realityGraphics.strokeRoundedRect(
      scopeX,
      scopeY,
      scopeWidth,
      scopeHeight,
      6,
    );

    for (let gridIndex = 1; gridIndex < 4; gridIndex += 1) {
      const lineX = scopeX + (scopeWidth / 4) * gridIndex;
      const lineY = scopeY + (scopeHeight / 4) * gridIndex;
      this.realityGraphics.lineStyle(1, 0x1f3a1f, 0.45);
      this.realityGraphics.lineBetween(
        lineX,
        scopeY + 8,
        lineX,
        scopeY + scopeHeight - 8,
      );
      this.realityGraphics.lineBetween(
        scopeX + 8,
        lineY,
        scopeX + scopeWidth - 8,
        lineY,
      );
    }

    this.drawWave(
      scopeX,
      scopeY,
      scopeWidth,
      scopeHeight,
      targetRatio,
      0.012,
      time,
      hallucinationTone,
      0.45,
    );
    this.drawWave(
      scopeX,
      scopeY,
      scopeWidth,
      scopeHeight,
      currentRatio,
      config.baseJitterAmplitude + jitterIntensity,
      time,
      0xd8c9ff,
      0.95,
    );

    this.realityGraphics.fillStyle(0x24201a, 1);
    this.realityGraphics.fillCircle(knobCenterX, knobCenterY, 34);
    this.realityGraphics.lineStyle(2, 0x111111, 1);
    this.realityGraphics.strokeCircle(knobCenterX, knobCenterY, 34);
    this.realityGraphics.fillStyle(0x6f57b8, 1);
    this.realityGraphics.fillCircle(knobCenterX, knobCenterY, 22);

    const knobAngle = Phaser.Math.Linear(-2.2, 2.2, currentRatio);
    const indicatorX = knobCenterX + Math.cos(knobAngle) * 20;
    const indicatorY = knobCenterY + Math.sin(knobAngle) * 20;
    this.realityGraphics.lineStyle(
      4,
      this.bindings.isRealityDragging() ? 0xe2d7ff : 0xcab7ff,
      1,
    );
    this.realityGraphics.lineBetween(
      knobCenterX,
      knobCenterY,
      indicatorX,
      indicatorY,
    );

    this.realityGraphics.fillStyle(0x1a1712, 1);
    this.realityGraphics.fillRoundedRect(
      this.panelX + 24,
      this.panelY + 292,
      152,
      12,
      4,
    );
    this.realityGraphics.fillStyle(
      lockProgress >= 1 ? 0xc9b8ff : hallucinationTone,
      1,
    );
    this.realityGraphics.fillRoundedRect(
      this.panelX + 26,
      this.panelY + 294,
      148 * lockProgress,
      8,
      3,
    );
  }

  private drawSignalPanel(isVisible: boolean) {
    const config = getUtilityMinigameConfig().signal;
    const layout = this.bindings.getSignalLayout();
    const path = this.bindings.getSignalPath();
    const flashCellIndex = this.bindings.getSignalFlashCellIndex();

    this.signalGraphics.clear();
    this.signalGraphics.setVisible(isVisible);
    this.signalGridHitZone.setVisible(isVisible);
    this.signalCellLabels.forEach((label) => label.setVisible(isVisible));

    if (!isVisible) {
      return;
    }

    this.signalGraphics.fillStyle(0x13130f, 1);
    this.signalGraphics.fillRoundedRect(
      this.signalPanelLeft,
      this.signalPanelTop,
      this.signalPanelWidth,
      this.signalPanelHeight,
      6,
    );
    this.signalGraphics.lineStyle(1, 0x3e3c2c, 1);
    this.signalGraphics.strokeRoundedRect(
      this.signalPanelLeft,
      this.signalPanelTop,
      this.signalPanelWidth,
      this.signalPanelHeight,
      6,
    );

    for (
      let cellIndex = 0;
      cellIndex < config.gridSize * config.gridSize;
      cellIndex += 1
    ) {
      const { centerX, centerY, left, top } =
        this.getSignalCellBounds(cellIndex);
      const isSource = layout.sourceIndex === cellIndex;
      const isTarget = layout.targetIndex === cellIndex;
      const isRequired = this.bindings.isSignalRequiredNode(cellIndex);
      const wasVisited = this.bindings.isSignalVisitedRequiredNode(cellIndex);
      const isInPath = path.includes(cellIndex);
      const fillColor = isSource
        ? 0x74a8d8
        : isTarget
          ? 0xd8a86d
          : flashCellIndex === cellIndex
            ? 0xbf5533
            : isInPath
              ? 0xffd36b
              : isRequired
                ? 0x5e6b2d
                : 0x302a1f;

      this.signalGraphics.fillStyle(fillColor, 1);
      this.signalGraphics.fillRoundedRect(
        left,
        top,
        this.signalCellSize - 6,
        this.signalCellSize - 6,
        5,
      );
      this.signalGraphics.lineStyle(2, wasVisited ? 0xe5f8a5 : 0x111111, 1);
      this.signalGraphics.strokeRoundedRect(
        left,
        top,
        this.signalCellSize - 6,
        this.signalCellSize - 6,
        5,
      );

      const label = this.signalCellLabels[cellIndex];
      label.setPosition(centerX, centerY);
      label.setOrigin(0.5);
      label.setText(
        isSource ? "SRC" : isTarget ? "TERM" : isRequired ? "SIG" : "",
      );
      label.setColor(isInPath || isRequired ? "#111111" : "#8c846e");
    }

    if (path.length > 1) {
      this.signalGraphics.lineStyle(config.lineWidthPx, 0xffd36b, 1);
      this.signalGraphics.beginPath();
      path.forEach((cellIndex, pathIndex) => {
        const { centerX, centerY } = this.getSignalCellBounds(cellIndex);
        if (pathIndex === 0) {
          this.signalGraphics.moveTo(centerX, centerY);
          return;
        }

        this.signalGraphics.lineTo(centerX, centerY);
      });
      this.signalGraphics.strokePath();
    }
  }

  private drawWave(
    x: number,
    y: number,
    width: number,
    height: number,
    frequencyRatio: number,
    jitterAmplitude: number,
    time: number,
    color: number,
    alpha: number,
  ) {
    const samples = 42;
    const waveFrequency = Phaser.Math.Linear(1.4, 3.9, frequencyRatio);
    const centerY = y + height / 2;
    const amplitude = height * 0.22;

    this.realityGraphics.lineStyle(2, color, alpha);
    this.realityGraphics.beginPath();

    for (let sampleIndex = 0; sampleIndex <= samples; sampleIndex += 1) {
      const t = sampleIndex / samples;
      const waveX = x + 8 + t * (width - 16);
      const jitter = Math.sin(time * 1.7 + t * 31) * jitterAmplitude * height;
      const waveY =
        centerY +
        Math.sin(t * Math.PI * 2 * waveFrequency + time) * amplitude +
        jitter;

      if (sampleIndex === 0) {
        this.realityGraphics.moveTo(waveX, waveY);
      } else {
        this.realityGraphics.lineTo(waveX, waveY);
      }
    }

    this.realityGraphics.strokePath();
  }

  private getCoolantDragRatio(pointerY: number) {
    const clamped = Phaser.Math.Clamp(
      (pointerY - (this.coolantTrackTop + 14)) / this.coolantHandleTravel,
      0,
      1,
    );

    return clamped;
  }

  private getSignalCellIndex(pointerX: number, pointerY: number) {
    const signalGridLeft = this.getSignalGridLeft();
    const signalGridTop = this.getSignalGridTop();

    if (
      pointerX < signalGridLeft ||
      pointerY < signalGridTop ||
      pointerX >= signalGridLeft + this.signalCellSize * 3 ||
      pointerY >= signalGridTop + this.signalCellSize * 3
    ) {
      return null;
    }

    const column = Math.floor(
      (pointerX - signalGridLeft) / this.signalCellSize,
    );
    const row = Math.floor((pointerY - signalGridTop) / this.signalCellSize);

    return row * 3 + column;
  }

  private getSignalCellBounds(cellIndex: number) {
    const column = cellIndex % 3;
    const row = Math.floor(cellIndex / 3);
    const left = this.getSignalGridLeft() + column * this.signalCellSize + 3;
    const top = this.getSignalGridTop() + row * this.signalCellSize + 3;

    return {
      left,
      top,
      centerX: left + (this.signalCellSize - 6) / 2,
      centerY: top + (this.signalCellSize - 6) / 2,
    };
  }

  private getSignalGridLeft() {
    return getSignalGridBounds().left;
  }

  private getSignalGridTop() {
    return getSignalGridBounds().top;
  }

  private ensurePanelActivated(utilityId: ActiveUtilityId) {
    if (this.bindings.getActiveUtilityPanelId() === utilityId) {
      return true;
    }

    if (this.bindings.getSelectedUtilityId() !== utilityId) {
      return false;
    }

    if (!this.bindings.canUseSelectedUtility()) {
      return false;
    }

    this.bindings.onStartUtilityActivation();
    return this.bindings.getActiveUtilityPanelId() === utilityId;
  }
}
