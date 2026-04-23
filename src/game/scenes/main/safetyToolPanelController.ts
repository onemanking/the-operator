import Phaser from "phaser";

export interface SafetyToolPanelBindings {
  isSafetyToolSelected: () => boolean;
  isSafetyScanning: () => boolean;
  getSafetyRevealedWordCount: () => number;
  getSafetyPolicyWatchlist: () => readonly string[];
  getSafetyRevealedPolicyWatchlist: () => readonly string[];
}

export class MainSceneSafetyToolPanelController {
  private readonly panelDepth = 2.4;
  private readonly panelX = 804;
  private readonly panelY = 220;
  private readonly panelWidth = 200;
  private readonly panelHeight = 316;
  private readonly panelCenterX = 904;
  private readonly chamberCenterY = 352;
  private readonly chamberWidth = 150;
  private readonly chamberHeight = 126;
  private readonly chamberViewportWidth = 108;
  private readonly chamberViewportHeight = 72;

  private panelTitle!: Phaser.GameObjects.Text;
  private panelBody!: Phaser.GameObjects.Rectangle;
  private panelTopBar!: Phaser.GameObjects.Rectangle;
  private panelFrame!: Phaser.GameObjects.Rectangle;
  private chamberHousing!: Phaser.GameObjects.Rectangle;
  private chamberViewport!: Phaser.GameObjects.Rectangle;
  private chamberBezel!: Phaser.GameObjects.Rectangle;
  private scanGraphics!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private instructionText!: Phaser.GameObjects.Text;
  private watchlistChipBodies: Phaser.GameObjects.Rectangle[] = [];
  private watchlistChipTexts: Phaser.GameObjects.Text[] = [];
  private displayObjects: Array<
    | Phaser.GameObjects.Rectangle
    | Phaser.GameObjects.Text
    | Phaser.GameObjects.Graphics
  > = [];
  private currentPanelDepth = this.panelDepth;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bindings: SafetyToolPanelBindings,
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
      "SAFETY FILTER",
      {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#d4c5b0",
        fontStyle: "bold",
      },
    );

    this.statusText = this.scene.add.text(
      this.panelX + this.panelWidth - 14,
      this.panelY + 12,
      "IDLE",
      {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: "11px",
        color: "#8f8677",
        fontStyle: "bold",
      },
    );
    this.statusText.setOrigin(1, 0);

    this.instructionText = this.scene.add.text(
      this.panelCenterX,
      this.panelY + 44,
      "MATCH SIDE POLICY",
      {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: "10px",
        color: "#f0d0ad",
        align: "center",
        wordWrap: { width: 154 },
      },
    );
    this.instructionText.setOrigin(0.5, 0);

    this.chamberHousing = this.scene.add
      .rectangle(
        this.panelCenterX,
        this.chamberCenterY,
        this.chamberWidth,
        this.chamberHeight,
        0x17140f,
      )
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x3d3527);
    this.chamberBezel = this.scene.add
      .rectangle(
        this.panelCenterX,
        this.chamberCenterY - 32,
        this.chamberWidth - 18,
        16,
        0x24201a,
      )
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x111111);
    this.chamberViewport = this.scene.add
      .rectangle(
        this.panelCenterX,
        this.chamberCenterY + 6,
        this.chamberViewportWidth,
        this.chamberViewportHeight,
        0x0a0d09,
      )
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x5e271d);
    this.scanGraphics = this.scene.add.graphics();

    this.watchlistChipBodies = [];
    this.watchlistChipTexts = [];
    for (let chipIndex = 0; chipIndex < 3; chipIndex += 1) {
      const chipX = this.panelX + 44 + chipIndex * 48;
      const chipBody = this.scene.add
        .rectangle(chipX, this.panelY + 246, 40, 18, 0x1a1713)
        .setOrigin(0.5)
        .setStrokeStyle(1, 0x111111);
      const chipText = this.scene.add
        .text(chipX, this.panelY + 246, "", {
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: "8px",
          color: "#d4c5b0",
          fontStyle: "bold",
          align: "center",
        })
        .setOrigin(0.5);

      this.watchlistChipBodies.push(chipBody);
      this.watchlistChipTexts.push(chipText);
    }

    this.displayObjects = [
      this.panelBody,
      this.panelTopBar,
      this.panelFrame,
      this.panelTitle,
      this.statusText,
      this.instructionText,
      this.chamberHousing,
      this.chamberBezel,
      this.chamberViewport,
      this.scanGraphics,
      ...this.watchlistChipBodies,
      ...this.watchlistChipTexts,
    ];

    this.applyPanelDepth(this.panelDepth);
    this.setPanelVisible(false);
  }

  setPanelDepth(panelDepth: number) {
    if (this.currentPanelDepth === panelDepth) {
      return;
    }

    this.applyPanelDepth(panelDepth);
  }

  update() {
    if (this.displayObjects.length === 0) {
      return;
    }

    const isSelected = this.bindings.isSafetyToolSelected();
    this.setPanelVisible(isSelected);
    if (!isSelected) {
      return;
    }

    const revealedCount = this.bindings.getSafetyRevealedWordCount();
    const isConfirmed = revealedCount > 0;
    const isScanning = this.bindings.isSafetyScanning() && !isConfirmed;
    const animationPhase = (this.scene.time.now % 1400) / 1400;
    const watchlist = this.bindings.getSafetyPolicyWatchlist();
    const revealedWatchlist = this.bindings.getSafetyRevealedPolicyWatchlist();

    this.statusText.setText(
      isConfirmed ? "BREACH" : isScanning ? "SWEEP" : "IDLE",
    );
    this.statusText.setColor(
      isConfirmed ? "#ff7e73" : isScanning ? "#ffb347" : "#ffb17f",
    );

    this.instructionText.setText(
      isConfirmed
        ? "REFUSE REQUEST"
        : isScanning
          ? "HOLD STEADY"
          : "MATCH SIDE POLICY",
    );

    this.drawScanChamber({
      isScanning,
      isConfirmed,
      animationPhase,
    });

    this.syncWatchlistChips(watchlist, revealedWatchlist);
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

  private applyPanelDepth(panelDepth: number) {
    this.currentPanelDepth = panelDepth;
    this.displayObjects.forEach((displayObject) => {
      displayObject.setDepth(panelDepth);
    });
  }

  private drawScanChamber(options: {
    isScanning: boolean;
    isConfirmed: boolean;
    animationPhase: number;
  }) {
    const { isScanning, isConfirmed, animationPhase } = options;
    const graphics = this.scanGraphics;
    const viewportLeft = this.panelCenterX - this.chamberViewportWidth / 2;
    const viewportTop =
      this.chamberCenterY + 6 - this.chamberViewportHeight / 2;
    const viewportRight = viewportLeft + this.chamberViewportWidth;
    const viewportBottom = viewportTop + this.chamberViewportHeight;
    const sweepX = Phaser.Math.Linear(
      viewportLeft + 16,
      viewportRight - 16,
      animationPhase,
    );

    graphics.clear();

    graphics.lineStyle(1, 0x20301d, 0.9);
    for (let row = 1; row <= 3; row += 1) {
      const lineY = Phaser.Math.Linear(
        viewportTop + 10,
        viewportBottom - 10,
        row / 4,
      );
      graphics.beginPath();
      graphics.moveTo(viewportLeft + 8, lineY);
      graphics.lineTo(viewportRight - 8, lineY);
      graphics.strokePath();
    }

    graphics.lineStyle(1, 0x25451f, 0.8);
    graphics.strokeRect(
      viewportLeft + 8,
      viewportTop + 8,
      this.chamberViewportWidth - 16,
      this.chamberViewportHeight - 16,
    );

    if (isConfirmed) {
      graphics.fillStyle(0x8f241d, 0.2);
      graphics.fillRect(
        viewportLeft + 12,
        viewportTop + 12,
        this.chamberViewportWidth - 24,
        this.chamberViewportHeight - 24,
      );
      graphics.lineStyle(2, 0xff6f61, 0.95);
      graphics.strokeRect(
        this.panelCenterX - 22,
        this.chamberCenterY - 16,
        44,
        32,
      );
      graphics.beginPath();
      graphics.moveTo(this.panelCenterX - 12, this.chamberCenterY - 8);
      graphics.lineTo(this.panelCenterX + 12, this.chamberCenterY + 8);
      graphics.strokePath();
      graphics.beginPath();
      graphics.moveTo(this.panelCenterX + 12, this.chamberCenterY - 8);
      graphics.lineTo(this.panelCenterX - 12, this.chamberCenterY + 8);
      graphics.strokePath();
    } else if (isScanning) {
      graphics.fillStyle(0xa33425, 0.22);
      graphics.fillRect(
        sweepX - 10,
        viewportTop + 12,
        20,
        this.chamberViewportHeight - 24,
      );
      graphics.fillStyle(0xffb347, 0.9);
      graphics.fillRect(
        sweepX - 2,
        viewportTop + 10,
        4,
        this.chamberViewportHeight - 20,
      );
      graphics.lineStyle(2, 0xffb347, 0.7);
      graphics.strokeRect(
        this.panelCenterX - 18,
        this.chamberCenterY - 14,
        36,
        28,
      );
      graphics.beginPath();
      graphics.moveTo(this.panelCenterX, this.chamberCenterY - 8);
      graphics.lineTo(this.panelCenterX, this.chamberCenterY + 4);
      graphics.strokePath();
      graphics.fillStyle(0xffb347, 0.95);
      graphics.fillCircle(this.panelCenterX, this.chamberCenterY + 10, 2);
    } else {
      graphics.fillStyle(0x5e271d, 0.12);
      graphics.fillRect(
        this.panelCenterX - 10,
        viewportTop + 12,
        20,
        this.chamberViewportHeight - 24,
      );
      graphics.fillStyle(0xc9835d, 0.55);
      graphics.fillRect(
        this.panelCenterX - 2,
        viewportTop + 10,
        4,
        this.chamberViewportHeight - 20,
      );
    }
  }

  private syncWatchlistChips(
    watchlist: readonly string[],
    revealedWatchlist: readonly string[],
  ) {
    const visibleWatchlist = watchlist.slice(
      0,
      this.watchlistChipBodies.length,
    );
    const revealedLabelSet = new Set(
      revealedWatchlist.map((label) => this.normalizeWatchlistLabel(label)),
    );

    this.watchlistChipBodies.forEach((chipBody, chipIndex) => {
      const label = visibleWatchlist[chipIndex];
      const chipText = this.watchlistChipTexts[chipIndex];

      if (!label) {
        chipBody.setVisible(false);
        chipText.setVisible(false);
        return;
      }

      chipBody.setVisible(true);
      chipText.setVisible(true);
      const isRevealed = revealedLabelSet.has(
        this.normalizeWatchlistLabel(label),
      );
      chipBody.setFillStyle(isRevealed ? 0x6e1f18 : 0x1a1713, 1);
      chipBody.setStrokeStyle(1, isRevealed ? 0xff6f61 : 0x7c3b2e);
      chipText.setText(this.formatChipLabel(label));
      chipText.setColor(isRevealed ? "#ffd3cb" : "#8f8677");
    });
  }

  private formatChipLabel(label: string) {
    return label.length <= 8
      ? label.toUpperCase()
      : label.slice(0, 8).toUpperCase();
  }

  private normalizeWatchlistLabel(label: string) {
    return label.trim().toLowerCase();
  }
}
