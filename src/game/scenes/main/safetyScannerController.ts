import Phaser from "phaser";
import { getPromptToolRuntimeConfig } from "../../data/RunData";
import { synth } from "../../utils/SoundSynth";

export const SAFETY_SCANNER_LANE_X = 260;
export const SAFETY_SCANNER_LANE_Y = 115;
export const SAFETY_SCANNER_LANE_WIDTH = 500;
export const SAFETY_SCANNER_LANE_HEIGHT = 200;
export const SAFETY_FILM_TEXT_COLOR = "#8e3a2b";
export const SAFETY_FILM_TEXT_ALPHA = 0.82;
export const SAFETY_REVEALED_TEXT_COLOR = "#fff0c4";
export const SAFETY_REVEALED_TEXT_ALPHA = 0.98;
export const SAFETY_FILM_MASK_COLOR = 0x1a0605;
export const SAFETY_FILM_MASK_ALPHA = 0.38;
export const SAFETY_REVEALED_GLOW_COLOR = 0xf6dfaa;
export const SAFETY_REVEALED_GLOW_ALPHA = 0.22;

export interface PromptTokenBounds {
  index: number;
  left: number;
  right: number;
}

export interface SafetyScannerBindings {
  isSafetyModeSelected: () => boolean;
  canStartSafetyScan: () => boolean;
  isSafetyScanning: () => boolean;
  getSafetyScanDirectionX: () => number;
  getSafetyScanBandWidth: () => number;
  getSafetyMatchedWordIndexes: () => number[];
  getPromptStartY: () => number;
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
}

function getPointerId(pointer: Phaser.Input.Pointer) {
  return pointer.id ?? pointer.pointerId ?? 0;
}

function setInteractiveEnabled(
  gameObject: Phaser.GameObjects.GameObject | undefined,
  enabled: boolean,
) {
  if (!gameObject?.input) {
    return;
  }

  gameObject.input.enabled = enabled;
  gameObject.input.cursor = enabled ? "pointer" : "default";
}

export class SafetyScannerController {
  private promptBounds?: Phaser.Geom.Rectangle;
  private tokenBounds: PromptTokenBounds[] = [];
  private scannerBand?: Phaser.GameObjects.Rectangle;
  private scannerHead?: Phaser.GameObjects.Rectangle;
  private scannerHandle?: Phaser.GameObjects.Rectangle;
  private scannerHandleGrip?: Phaser.GameObjects.Rectangle;
  private scannerLabel?: Phaser.GameObjects.Text;
  private scannerVisualX: number = 0;
  private scannerRestX: number = 0;
  private activePointerId: number | null = null;
  private lastScannerMotorAt: number = 0;
  private scannerReturnTween?: Phaser.Tweens.Tween;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bindings: SafetyScannerBindings,
  ) {}

  setLayout(
    bounds: Phaser.Geom.Rectangle | undefined,
    tokenBounds: PromptTokenBounds[],
  ) {
    this.promptBounds = bounds
      ? new Phaser.Geom.Rectangle(
          bounds.x,
          bounds.y,
          bounds.width,
          bounds.height,
        )
      : undefined;
    this.tokenBounds = [...tokenBounds];
    this.ensureScannerUi();
    this.syncVisualState();
  }

  clearTokenLayout() {
    this.promptBounds = undefined;
    this.tokenBounds = [];
    this.syncVisualState();
  }

  syncVisualState() {
    const isSafetyModeSelected = this.bindings.isSafetyModeSelected();
    const isSafetyScanning = this.bindings.isSafetyScanning();
    const isDragging = this.activePointerId !== null;

    if (isSafetyModeSelected) {
      this.ensureScannerUi();
    }

    if (
      !this.scannerBand ||
      !this.scannerHead ||
      !this.scannerHandle ||
      !this.scannerHandleGrip ||
      !this.scannerLabel
    ) {
      return;
    }

    const bounds = this.getOrCreatePromptBounds();
    const scannerWidth = this.scannerBand.width;
    this.scannerRestX = bounds.right - scannerWidth * 0.5;
    const nextScannerVisualX =
      this.scannerVisualX > 0
        ? Phaser.Math.Clamp(
            this.scannerVisualX,
            bounds.left + scannerWidth * 0.5,
            bounds.right - scannerWidth * 0.5,
          )
        : this.scannerRestX;
    if (!isDragging) {
      this.scannerVisualX = nextScannerVisualX;
    }
    const scannerVisualX = isDragging
      ? this.scannerVisualX
      : nextScannerVisualX;
    const scannerCenterY = bounds.centerY;

    this.scannerBand.setVisible(isSafetyModeSelected);
    this.scannerBand.setPosition(scannerVisualX, scannerCenterY);
    this.scannerBand.setSize(this.scannerBand.width, bounds.height);
    this.scannerBand.setDisplaySize(this.scannerBand.width, bounds.height);
    this.scannerBand.setStrokeStyle(
      1,
      isSafetyScanning ? 0xc96f4d : 0xa24d34,
      isSafetyScanning ? 0.72 : 0.42,
    );
    this.scannerBand.setFillStyle(0x6b2016, isSafetyScanning ? 0.16 : 0.08);

    this.scannerHandle.setVisible(isSafetyModeSelected);
    this.scannerHandle.setPosition(
      scannerVisualX + scannerWidth * 0.5 + 14,
      scannerCenterY,
    );
    this.scannerHandle.setSize(this.scannerHandle.width, bounds.height);
    this.scannerHandle.setDisplaySize(this.scannerHandle.width, bounds.height);
    this.scannerHandle.setAlpha(isSafetyModeSelected ? 1 : 0);
    setInteractiveEnabled(this.scannerHandle, isSafetyModeSelected);

    this.scannerHandleGrip.setVisible(isSafetyModeSelected);
    this.scannerHandleGrip.setPosition(
      this.scannerHandle.x,
      this.scannerHandle.y,
    );
    this.scannerHandleGrip.setSize(
      this.scannerHandleGrip.width,
      Math.max(42, bounds.height - 26),
    );
    this.scannerHandleGrip.setDisplaySize(
      this.scannerHandleGrip.width,
      Math.max(42, bounds.height - 26),
    );

    this.scannerLabel.setVisible(isSafetyModeSelected);
    this.scannerLabel.setPosition(scannerVisualX - 10, scannerCenterY);

    const readerOffset = this.bindings.getSafetyScanDirectionX() >= 0 ? 3 : -3;
    this.scannerHead.setVisible(isSafetyModeSelected);
    this.scannerHead.setPosition(scannerVisualX + readerOffset, scannerCenterY);
    this.scannerHead.setSize(4, bounds.height);
    this.scannerHead.setDisplaySize(4, bounds.height);
    this.scannerHead.setFillStyle(
      isSafetyScanning ? 0xf7b07b : 0xcf6a44,
      isSafetyScanning ? 0.92 : 0.66,
    );

    if (!isSafetyModeSelected) {
      this.activePointerId = null;
    }
  }

  clearLayout() {
    if (this.activePointerId !== null) {
      this.bindings.onSafetyScanEnd(this.activePointerId);
    }

    this.activePointerId = null;
    this.promptBounds = undefined;
    this.tokenBounds = [];
    this.lastScannerMotorAt = 0;
    this.stopScannerReturnTween();
    this.scannerBand?.destroy();
    this.scannerBand = undefined;
    this.scannerHead?.destroy();
    this.scannerHead = undefined;
    this.scannerHandle?.destroy();
    this.scannerHandle = undefined;
    this.scannerHandleGrip?.destroy();
    this.scannerHandleGrip = undefined;
    this.scannerLabel?.destroy();
    this.scannerLabel = undefined;
    this.scannerVisualX = 0;
    this.scannerRestX = 0;
  }

  destroy() {
    this.clearLayout();
  }

  private ensureScannerUi() {
    const bounds = this.getOrCreatePromptBounds();
    const scannerWidth = Math.max(
      16,
      this.bindings.getSafetyScanBandWidth() * 0.22,
    );
    const handleHeight = bounds.height;
    const gripHeight = Math.max(42, bounds.height - 26);
    this.scannerRestX = bounds.right - scannerWidth * 0.5;
    this.scannerVisualX =
      this.scannerVisualX > 0 ? this.scannerVisualX : this.scannerRestX;
    const scannerCenterY = bounds.centerY;

    if (!this.scannerBand) {
      this.scannerBand = this.scene.add
        .rectangle(
          this.scannerVisualX,
          scannerCenterY,
          scannerWidth,
          bounds.height,
          0x6b2016,
          0.08,
        )
        .setOrigin(0.5)
        .setStrokeStyle(1, 0xa24d34, 0.42)
        .setDepth(2);
    }

    if (!this.scannerHead) {
      this.scannerHead = this.scene.add
        .rectangle(
          this.scannerVisualX,
          scannerCenterY,
          4,
          bounds.height,
          0xe67a50,
          0.72,
        )
        .setOrigin(0.5)
        .setDepth(3);
    }

    if (!this.scannerHandle) {
      this.scannerHandle = this.scene.add
        .rectangle(
          this.scannerVisualX + scannerWidth * 0.5 + 14,
          scannerCenterY,
          28,
          handleHeight,
          0xd3c19a,
          1,
        )
        .setOrigin(0.5)
        .setStrokeStyle(2, 0x564734, 1)
        .setDepth(4)
        .setInteractive({ useHandCursor: true });
      this.scene.input.setDraggable(this.scannerHandle, true);
      this.scannerHandle.on("dragstart", (pointer: Phaser.Input.Pointer) => {
        this.beginDrag(pointer);
      });
      this.scannerHandle.on(
        "drag",
        (pointer: Phaser.Input.Pointer, dragX: number, _dragY: number) => {
          this.updateDrag(pointer, dragX);
        },
      );
      this.scannerHandle.on("dragend", (pointer: Phaser.Input.Pointer) => {
        this.endDrag(pointer);
      });
    }

    if (!this.scannerHandleGrip) {
      this.scannerHandleGrip = this.scene.add
        .rectangle(
          this.scannerHandle.x,
          this.scannerHandle.y,
          14,
          gripHeight,
          0x8a7151,
          0.95,
        )
        .setOrigin(0.5)
        .setDepth(5);
    }

    if (!this.scannerLabel) {
      this.scannerLabel = this.scene.add
        .text(
          this.scannerVisualX - 10,
          scannerCenterY,
          "[ SCANNING HEAD TYPE-R ]",
          {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: "10px",
            color: "#c78c72",
          },
        )
        .setAngle(-90)
        .setOrigin(0.5)
        .setDepth(3)
        .setAlpha(0.72);
    }
  }

  private beginDrag(pointer: Phaser.Input.Pointer) {
    if (
      !this.bindings.isSafetyModeSelected() ||
      !this.bindings.canStartSafetyScan()
    ) {
      return;
    }

    const pointerId = getPointerId(pointer);
    this.stopScannerReturnTween();
    this.activePointerId = pointerId;
    const clampedX = this.getClampedScannerX(pointer.x);
    this.bindings.onSafetyScanStart(
      pointerId,
      clampedX,
      this.getPromptBoundsCenterY(),
    );
    this.setScannerVisualX(clampedX);
    this.bindings.onSafetyScanMove(
      pointerId,
      clampedX,
      this.getPromptBoundsCenterY(),
      this.getIntersectedWordIndexes(clampedX),
    );
  }

  private updateDrag(pointer: Phaser.Input.Pointer, dragX: number) {
    const pointerId = getPointerId(pointer);
    if (this.activePointerId !== pointerId) {
      return;
    }

    const nextX = this.getClampedScannerX(dragX);
    this.setScannerVisualX(nextX);
    this.playScannerMotor(nextX);
    this.bindings.onSafetyScanMove(
      pointerId,
      nextX,
      this.getPromptBoundsCenterY(),
      this.getIntersectedWordIndexes(nextX),
    );
  }

  private endDrag(pointer: Phaser.Input.Pointer) {
    const pointerId = getPointerId(pointer);
    if (this.activePointerId !== pointerId) {
      return;
    }

    this.playScannerReturn();
    this.stopScannerReturnTween();
    this.scannerReturnTween = this.scene.tweens.add({
      targets: this,
      scannerVisualX: this.scannerRestX,
      duration: getPromptToolRuntimeConfig().safety.returnDurationMs,
      ease: "Back.out",
      onUpdate: () => {
        this.syncVisualState();
        this.bindings.onSafetyScanMove(
          pointerId,
          this.scannerVisualX,
          this.getPromptBoundsCenterY(),
          [],
        );
      },
      onComplete: () => {
        this.activePointerId = null;
        this.bindings.onSafetyScanEnd(pointerId);
        this.scene.cameras.main.shake(
          getPromptToolRuntimeConfig().safety.returnShakeDurationMs,
          getPromptToolRuntimeConfig().safety.returnShakeIntensity,
          true,
        );
        synth.playBeep(110, "square", 0.06, 0.15);
        this.scannerReturnTween = undefined;
        this.syncVisualState();
      },
    });
  }

  private stopScannerReturnTween() {
    this.scannerReturnTween?.stop();
    this.scannerReturnTween = undefined;
  }

  private setScannerVisualX(nextX: number) {
    this.scannerVisualX = nextX;
    this.syncVisualState();
  }

  private getOrCreatePromptBounds() {
    if (!this.promptBounds) {
      this.promptBounds = new Phaser.Geom.Rectangle(260, 115, 500, 200);
    }

    return this.promptBounds;
  }

  private getPromptBoundsCenterY() {
    return this.getOrCreatePromptBounds().centerY;
  }

  private getClampedScannerX(nextX: number) {
    const bounds = this.getOrCreatePromptBounds();
    const halfWidth =
      (this.scannerBand?.width ??
        Math.max(16, this.bindings.getSafetyScanBandWidth() * 0.22)) * 0.5;
    return Phaser.Math.Clamp(
      nextX,
      bounds.left + halfWidth,
      bounds.right - halfWidth,
    );
  }

  private getIntersectedWordIndexes(scanPointX: number) {
    const matchedWordIndexes = new Set(
      this.bindings.getSafetyMatchedWordIndexes(),
    );
    const scanHalfWidth = Math.max(
      14,
      this.bindings.getSafetyScanBandWidth() * 0.2,
    );

    return this.tokenBounds
      .filter((token) => {
        if (!matchedWordIndexes.has(token.index)) {
          return false;
        }

        const closestX = Phaser.Math.Clamp(scanPointX, token.left, token.right);
        const deltaX = (scanPointX - closestX) / scanHalfWidth;
        return deltaX * deltaX <= 1;
      })
      .map((token) => token.index);
  }

  private playScannerMotor(targetX: number) {
    const now = this.scene.time.now;
    if (now - this.lastScannerMotorAt < 34) {
      return;
    }

    const delta = Math.abs(targetX - this.scannerVisualX);
    const speedRatio = Phaser.Math.Clamp(delta / 28, 0.15, 1);
    synth.playBeep(
      140 + speedRatio * 90,
      "sawtooth",
      0.04,
      0.03 + speedRatio * 0.02,
    );
    this.lastScannerMotorAt = now;
  }

  private playScannerReturn() {
    synth.playBeep(180, "triangle", 0.12, 0.06);
    this.scene.time.delayedCall(40, () => {
      synth.playBeep(120, "sine", 0.16, 0.05);
    });
  }
}
