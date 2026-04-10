import Phaser from "phaser";
import {
  MAIN_SCENE_NOTES_PANEL_WIDTH,
  MAIN_SCENE_PRIMARY_WIDTH,
} from "../../layout";

interface StickyNotesBindings {
  getPolicyText: () => string;
  getDirectiveText: () => string;
  getShiftEventText: () => string;
}

interface TerminalPanelState {
  bodyText: Phaser.GameObjects.Text;
  baseY: number;
  viewportHeight: number;
  scrollOffset: number;
  cycleDistance: number;
}

export class MainSceneStickyNotesController {
  private readonly panelStates: TerminalPanelState[] = [];
  private bodyScrollTimer?: Phaser.Time.TimerEvent;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bindings: StickyNotesBindings,
  ) {}

  createLayout() {
    const sidebarX = MAIN_SCENE_PRIMARY_WIDTH;
    const sidebarWidth = MAIN_SCENE_NOTES_PANEL_WIDTH;
    const panelX = sidebarX + 8;
    const panelWidth = sidebarWidth - 16;
    const panelHeight = 216;
    const panelGap = 16;

    this.scene.add
      .text(sidebarX + 8, 22, "SIDE TERMINAL", {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: "12px",
        color: "#d4c5b0",
        fontStyle: "bold",
      })
      .setAlpha(0.92);

    this.createTerminalPanel({
      x: panelX,
      y: 48,
      width: panelWidth,
      height: panelHeight,
      header: "POLICY",
      body: this.bindings.getPolicyText(),
    });

    this.createTerminalPanel({
      x: panelX,
      y: 48 + panelHeight + panelGap,
      width: panelWidth,
      height: panelHeight,
      header: "DIRECTIVE",
      body: this.bindings.getDirectiveText(),
    });

    this.createTerminalPanel({
      x: panelX,
      y: 48 + (panelHeight + panelGap) * 2,
      width: panelWidth,
      height: panelHeight,
      header: "SHIFT EVENT",
      body: this.bindings.getShiftEventText(),
    });

    this.ensureBodyScrollTimer();
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.bodyScrollTimer?.destroy();
      this.bodyScrollTimer = undefined;
    });
    this.scene.events.once(Phaser.Scenes.Events.DESTROY, () => {
      this.bodyScrollTimer?.destroy();
      this.bodyScrollTimer = undefined;
    });
  }

  private createTerminalPanel(options: {
    x: number;
    y: number;
    width: number;
    height: number;
    header: string;
    body: string;
  }) {
    const { x, y, width, height, header, body } = options;
    const screenHeight = height - 56;
    const screenY = y + 30 + screenHeight / 2;
    const bodyY = y + 63;
    const bodyViewportHeight = screenHeight - 38;

    this.scene.add
      .rectangle(
        x + width / 2 + 5,
        y + height / 2 + 6,
        width,
        height,
        0x090909,
        0.52,
      )
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x040404);

    this.scene.add
      .rectangle(x + width / 2, y + height / 2, width, height, 0x232323)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x111111);

    this.scene.add
      .rectangle(x + width / 2, y + 18, width - 8, 18, 0x111111)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x2f2f2f);

    this.scene.add
      .text(x + 10, y + 12, "OPS_FEED.EXE", {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: "10px",
        color: "#9fb39f",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    this.scene.add
      .rectangle(x + width / 2, screenY, width - 16, screenHeight, 0x071607)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x33ff33);

    this.scene.add
      .text(x + 10, y + 36, `> ${header}`, {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: "13px",
        color: "#5ffb6d",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    this.scene.add
      .rectangle(x + width / 2, y + 54, width - 20, 2, 0x1b5b1b, 0.8)
      .setOrigin(0.5)
      .setStrokeStyle(0);

    const bodyText = this.scene.add
      .text(x + 10, bodyY, body, {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: "13px",
        color: "#99f5a5",
        wordWrap: { width: width - 22 },
        lineSpacing: 4,
      })
      .setOrigin(0, 0);

    const maskShape = this.scene.add.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(x + 10, bodyY, width - 22, bodyViewportHeight);
    maskShape.setVisible(false);
    bodyText.setMask(maskShape.createGeometryMask());

    if (bodyText.height > bodyViewportHeight) {
      const originalHeight = bodyText.height;
      const spacerLines = "\n\n";
      bodyText.setText(`${body}${spacerLines}${body}`);
      this.panelStates.push({
        bodyText,
        baseY: bodyY,
        viewportHeight: bodyViewportHeight,
        scrollOffset: 0,
        cycleDistance: originalHeight + 28,
      });
    }
  }

  private ensureBodyScrollTimer() {
    if (this.bodyScrollTimer || this.panelStates.length === 0) {
      return;
    }

    this.bodyScrollTimer = this.scene.time.addEvent({
      delay: 140,
      loop: true,
      callback: () => {
        this.panelStates.forEach((panelState) => {
          panelState.scrollOffset =
            (panelState.scrollOffset + 1) % panelState.cycleDistance;
          panelState.bodyText.setY(panelState.baseY - panelState.scrollOffset);
        });
      },
    });
  }
}
