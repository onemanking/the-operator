import Phaser from "phaser";

export interface SearchToolPanelBindings {
  isSearchToolSelected: () => boolean;
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
  onSearchPulsePress: () => void;
}

export class MainSceneSearchToolPanelController {
  private readonly panelDepth = 2.4;
  private readonly panelX = 804;
  private readonly panelY = 220;
  private readonly panelWidth = 200;
  private readonly panelHeight = 316;
  private readonly scopeCenterX = 904;
  private readonly scopeCenterY = 356;
  private readonly scopeRadius = 46;

  private panelTitle!: Phaser.GameObjects.Text;
  private panelBody!: Phaser.GameObjects.Rectangle;
  private panelTopBar!: Phaser.GameObjects.Rectangle;
  private panelFrame!: Phaser.GameObjects.Rectangle;
  private scopeHousing!: Phaser.GameObjects.Rectangle;
  private scopeGraphics!: Phaser.GameObjects.Graphics;
  private wordText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private syncButton!: Phaser.GameObjects.Rectangle;
  private syncButtonLabel!: Phaser.GameObjects.Text;
  private syncButtonShadow!: Phaser.GameObjects.Rectangle;
  private progressLamps: Phaser.GameObjects.Rectangle[] = [];
  private displayObjects: Array<
    | Phaser.GameObjects.Rectangle
    | Phaser.GameObjects.Text
    | Phaser.GameObjects.Graphics
  > = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bindings: SearchToolPanelBindings,
  ) {}

  create() {
    this.panelBody = this.scene.add
      .rectangle(
        this.panelX,
        this.panelY,
        this.panelWidth,
        this.panelHeight,
        0x232323,
      )
      .setOrigin(0);
    this.panelTopBar = this.scene.add
      .rectangle(this.panelX, this.panelY, this.panelWidth, 4, 0x111111)
      .setOrigin(0);
    this.panelFrame = this.scene.add
      .rectangle(
        this.panelX + this.panelWidth / 2,
        this.panelY + this.panelHeight / 2,
        this.panelWidth - 10,
        this.panelHeight - 8,
        0,
        0,
      )
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x111111);

    this.panelTitle = this.scene.add.text(
      this.panelX + 14,
      this.panelY + 10,
      "SEARCH RADAR",
      {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#d4c5b0",
        fontStyle: "bold",
      },
    );

    this.progressText = this.scene.add.text(
      this.panelX + this.panelWidth - 14,
      this.panelY + 12,
      "0/0",
      {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: "11px",
        color: "#8f8677",
        fontStyle: "bold",
      },
    );
    this.progressText.setOrigin(1, 0);

    this.wordText = this.scene.add.text(
      this.scopeCenterX,
      this.panelY + 24,
      "NO TARGET",
      {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: "12px",
        color: "#9cfb64",
        fontStyle: "bold",
        align: "center",
      },
    );
    this.wordText.setOrigin(0.5, 0);

    this.statusText = this.scene.add.text(
      this.scopeCenterX,
      this.panelY + 42,
      "STANDBY",
      {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: "10px",
        color: "#8f8677",
        align: "center",
      },
    );
    this.statusText.setOrigin(0.5, 0);

    for (let index = 0; index < 4; index += 1) {
      this.progressLamps.push(
        this.scene.add
          .rectangle(
            this.panelX + 56 + index * 28,
            this.panelY + 72,
            18,
            6,
            0x2f2a21,
          )
          .setOrigin(0.5)
          .setStrokeStyle(1, 0x111111),
      );
    }

    this.scopeHousing = this.scene.add
      .rectangle(this.scopeCenterX, this.scopeCenterY, 160, 170, 0x0f140c)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x3d3527);
    this.scopeGraphics = this.scene.add.graphics();

    this.messageText = this.scene.add.text(
      this.scopeCenterX,
      this.panelY + 242,
      "",
      {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: "11px",
        color: "#c7b89a",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: 130 },
      },
    );
    this.messageText.setOrigin(0.5, 0);

    this.syncButtonShadow = this.scene.add
      .rectangle(this.scopeCenterX, this.panelY + 286, 126, 28, 0x1d1309)
      .setOrigin(0.5);
    this.syncButton = this.scene.add
      .rectangle(this.scopeCenterX, this.panelY + 282, 126, 28, 0xc2874b)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x111111)
      .setInteractive({ useHandCursor: true });
    this.syncButtonLabel = this.scene.add
      .text(this.scopeCenterX, this.panelY + 282, "SYNC PULSE", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#111111",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const pressButton = () => {
      this.syncButton.y += 3;
      this.syncButtonLabel.y += 3;
      this.scene.time.delayedCall(70, () => {
        this.syncButton.y -= 3;
        this.syncButtonLabel.y -= 3;
      });
      this.bindings.onSearchPulsePress();
    };

    this.syncButton.on("pointerdown", pressButton);
    this.scopeHousing.setInteractive({ useHandCursor: true });
    this.scopeHousing.on("pointerdown", pressButton);

    this.displayObjects = [
      this.panelBody,
      this.panelTopBar,
      this.panelFrame,
      this.panelTitle,
      this.progressText,
      this.wordText,
      this.statusText,
      ...this.progressLamps,
      this.scopeHousing,
      this.scopeGraphics,
      this.messageText,
      this.syncButtonShadow,
      this.syncButton,
      this.syncButtonLabel,
    ];
    this.displayObjects.forEach((displayObject) => {
      displayObject.setDepth(this.panelDepth);
    });
    this.setPanelVisible(false);
  }

  update() {
    if (this.displayObjects.length === 0) {
      return;
    }

    const isSelected = this.bindings.isSearchToolSelected();
    this.setPanelVisible(isSelected);
    if (!isSelected) {
      return;
    }

    const targetWords = [...this.bindings.getSearchTargetWords()];
    const lockedWords = [...this.bindings.getSearchLockedWords()];
    const currentTargetWord = this.bindings.getSearchCurrentTargetWord();
    const currentTargetIndex = this.bindings.getSearchCurrentTargetIndex();
    const pulseState = this.bindings.getSearchPulseState();
    const pulseProgress = this.bindings.getSearchPulseProgress();
    const timingWindowRatio = this.bindings.getSearchTimingWindowRatio();
    const feedbackFlash = this.bindings.getSearchFeedbackFlash();
    const sweepProgress = this.bindings.getSearchNoTargetSweepProgress();
    const totalTargets = targetWords.length;
    const lockedCount = lockedWords.length;

    this.progressText.setText(
      `${Math.min(lockedCount, totalTargets)}/${totalTargets}`,
    );
    this.wordText.setText(
      totalTargets === 0
        ? "NO TARGET"
        : currentTargetWord
          ? currentTargetWord.toUpperCase()
          : "SIGNAL LOCKED",
    );

    const statusLabel =
      pulseState === "empty"
        ? sweepProgress >= 1
          ? "NO SIGNATURES FOUND"
          : "SWEEPING BAND"
        : pulseState === "complete"
          ? "SEQUENCE LOCKED"
          : pulseState === "success"
            ? `LOCK ${Math.min(totalTargets, currentTargetIndex)}/${totalTargets}`
            : pulseState === "error"
              ? "DESYNC - RETRY"
              : totalTargets > 0
                ? `SYNC ${Math.min(totalTargets, currentTargetIndex + 1)}/${totalTargets}`
                : "STANDBY";
    this.statusText.setText(statusLabel);

    this.messageText.setText(
      pulseState === "empty"
        ? sweepProgress >= 1
          ? "NO SIGNATURES\nFOUND"
          : "SWEEP IN PROGRESS"
        : pulseState === "complete"
          ? "SIGNAL LOCK\nESTABLISHED"
          : totalTargets > 0
            ? `LOCK WORD ${Math.min(totalTargets, currentTargetIndex + 1)} OF ${totalTargets}`
            : "",
    );

    this.progressLamps.forEach((lamp, lampIndex) => {
      const mappedIndex =
        totalTargets <= 1
          ? 0
          : Math.round(
              (lampIndex / Math.max(1, this.progressLamps.length - 1)) *
                (totalTargets - 1),
            );
      const isLocked = mappedIndex < lockedCount;
      const isCurrent =
        totalTargets > 0 &&
        mappedIndex === Math.min(currentTargetIndex, totalTargets - 1) &&
        lockedCount < totalTargets;
      lamp.setFillStyle(isLocked ? 0x9cfb64 : isCurrent ? 0xffc84d : 0x2f2a21);
      lamp.setAlpha(isLocked || isCurrent ? 1 : 0.6);
    });

    this.syncButton.setFillStyle(
      pulseState === "complete"
        ? 0x8fa57e
        : pulseState === "error"
          ? 0xa3563f
          : 0xc2874b,
    );
    this.syncButtonLabel.setText(
      pulseState === "complete" ? "LOCKED" : "SYNC PULSE",
    );
    this.drawScope(
      pulseState,
      pulseProgress,
      timingWindowRatio,
      feedbackFlash,
      sweepProgress,
    );
  }

  destroy() {
    this.displayObjects.forEach((displayObject) => displayObject.destroy());
    this.displayObjects = [];
  }

  private setPanelVisible(visible: boolean) {
    this.displayObjects.forEach((displayObject) => {
      displayObject.setVisible(visible);
    });
  }

  private drawScope(
    pulseState: ReturnType<SearchToolPanelBindings["getSearchPulseState"]>,
    pulseProgress: number,
    timingWindowRatio: number,
    feedbackFlash: number,
    sweepProgress: number,
  ) {
    const graphics = this.scopeGraphics;
    const centerX = this.scopeCenterX;
    const centerY = this.scopeCenterY;
    const radius = this.scopeRadius;
    const targetRadius = Math.max(
      5,
      radius * Math.max(0.12, timingWindowRatio),
    );
    const successMix =
      pulseState === "success" || pulseState === "complete" ? feedbackFlash : 0;
    const errorMix = pulseState === "error" ? feedbackFlash : 0;

    graphics.clear();
    graphics.fillStyle(0x081108, 0.92);
    graphics.fillRect(centerX - 68, centerY - 72, 136, 144);

    graphics.lineStyle(1, 0x244524, 0.55);
    graphics.strokeCircle(centerX, centerY, radius);
    graphics.strokeCircle(centerX, centerY, radius * 0.7);
    graphics.strokeCircle(centerX, centerY, radius * 0.38);
    graphics.lineBetween(centerX - radius, centerY, centerX + radius, centerY);
    graphics.lineBetween(centerX, centerY - radius, centerX, centerY + radius);

    graphics.lineStyle(2, 0xc5a54a, 0.75);
    graphics.strokeCircle(centerX, centerY, targetRadius);
    graphics.fillStyle(0xc5a54a, 0.18);
    graphics.fillCircle(centerX, centerY, targetRadius - 1);

    if (pulseState === "empty") {
      const angle =
        -Math.PI / 2 + Phaser.Math.Clamp(sweepProgress, 0, 1) * Math.PI * 2;
      const sweepX = centerX + Math.cos(angle) * radius;
      const sweepY = centerY + Math.sin(angle) * radius;
      graphics.lineStyle(2, 0x9cfb64, 0.85);
      graphics.lineBetween(centerX, centerY, sweepX, sweepY);
      graphics.fillStyle(0x9cfb64, 0.16);
      graphics.slice(
        centerX,
        centerY,
        radius,
        angle - 0.18,
        angle + 0.18,
        false,
      );
      graphics.fillPath();
    } else if (pulseState !== "complete") {
      const pulseRadius = Phaser.Math.Linear(
        radius,
        0,
        Phaser.Math.Clamp(pulseProgress, 0, 1),
      );
      graphics.lineStyle(2, errorMix > 0 ? 0xd15f4a : 0x9cfb64, 0.92);
      graphics.strokeCircle(centerX, centerY, Math.max(2, pulseRadius));
      graphics.lineStyle(1, 0x9cfb64, 0.2);
      graphics.strokeCircle(centerX, centerY, Math.max(3, pulseRadius + 4));
    }

    if (successMix > 0) {
      const flashProgress = 1 - feedbackFlash;
      graphics.fillStyle(0xe9ffd8, successMix * 0.32);
      graphics.fillCircle(
        centerX,
        centerY,
        radius * (0.25 + flashProgress * 0.18),
      );
      graphics.lineStyle(2, 0xe9ffd8, successMix);
      graphics.strokeCircle(
        centerX,
        centerY,
        Phaser.Math.Linear(targetRadius, radius + 12, flashProgress),
      );
    }

    if (errorMix > 0) {
      graphics.fillStyle(0x8c3429, errorMix * 0.22);
      graphics.fillRect(centerX - 64, centerY - 70, 128, 140);
      graphics.lineStyle(1, 0xff7a61, errorMix * 0.7);
      for (let lineIndex = 0; lineIndex < 4; lineIndex += 1) {
        const y = centerY - 42 + lineIndex * 26;
        graphics.lineBetween(
          centerX - 56,
          y,
          centerX + 56,
          y + (lineIndex % 2 === 0 ? 4 : -4),
        );
      }
    }
  }
}
