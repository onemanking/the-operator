import Phaser from "phaser";
import {
  MAIN_SCENE_NOTES_PANEL_WIDTH,
  MAIN_SCENE_PRIMARY_WIDTH,
} from "../../layout";
import { GameplayPolicyStickyNoteContent } from "../../data/ContentPolicyData";

interface StickyNotesBindings {
  getPolicyContent: () => GameplayPolicyStickyNoteContent;
  getShiftEventText: () => string;
  isDebugOverlayEnabled: () => boolean;
  getDebugOverlayText: () => string;
}

type ScrollableTerminalBody =
  | Phaser.GameObjects.Text
  | Phaser.GameObjects.Container;

interface TerminalPanelState {
  bodyText: ScrollableTerminalBody;
  baseY: number;
  viewportHeight: number;
  scrollOffset: number;
  cycleDistance: number;
}

export class MainSceneStickyNotesController {
  private readonly panelStates: TerminalPanelState[] = [];
  private bodyScrollTimer?: Phaser.Time.TimerEvent;
  private debugRefreshTimer?: Phaser.Time.TimerEvent;
  private debugText?: Phaser.GameObjects.Text;

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
      header: "CONTENT POLICY",
      body: this.bindings.getPolicyContent(),
    });

    this.createTerminalPanel({
      x: panelX,
      y: 48 + panelHeight + panelGap,
      width: panelWidth,
      height: panelHeight,
      header: "SHIFT EVENT",
      body: this.bindings.getShiftEventText(),
    });

    if (this.bindings.isDebugOverlayEnabled()) {
      this.createDebugPanel({
        x: panelX,
        y: 48 + (panelHeight + panelGap) * 2,
        width: panelWidth,
        height: 240,
      });
    }

    this.ensureBodyScrollTimer();
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.bodyScrollTimer?.destroy();
      this.bodyScrollTimer = undefined;
      this.debugRefreshTimer?.destroy();
      this.debugRefreshTimer = undefined;
    });
    this.scene.events.once(Phaser.Scenes.Events.DESTROY, () => {
      this.bodyScrollTimer?.destroy();
      this.bodyScrollTimer = undefined;
      this.debugRefreshTimer?.destroy();
      this.debugRefreshTimer = undefined;
    });
  }

  private createDebugPanel(options: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) {
    const { x, y, width, height } = options;
    const screenHeight = height - 56;
    const screenY = y + 30 + screenHeight / 2;

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
      .text(x + 10, y + 12, "OPS_DEBUG.EXE", {
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
      .text(x + 10, y + 36, "> RUN DEBUG", {
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

    this.debugText = this.scene.add
      .text(x + 10, y + 63, this.bindings.getDebugOverlayText(), {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: "12px",
        color: "#99f5a5",
        wordWrap: { width: width - 22 },
        lineSpacing: 4,
      })
      .setOrigin(0, 0);

    this.debugRefreshTimer = this.scene.time.addEvent({
      delay: 120,
      loop: true,
      callback: () => {
        this.debugText?.setText(this.bindings.getDebugOverlayText());
      },
    });
  }

  private createTerminalPanel(options: {
    x: number;
    y: number;
    width: number;
    height: number;
    header: string;
    body: string | GameplayPolicyStickyNoteContent;
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

    const plainBodyText =
      typeof body === "string"
        ? this.scene.add
            .text(x + 10, bodyY, body, {
              fontFamily: '"Courier New", Courier, monospace',
              fontSize: "13px",
              color: "#99f5a5",
              wordWrap: { width: width - 22 },
              lineSpacing: 4,
            })
            .setOrigin(0, 0)
        : undefined;
    const policyBodyText =
      typeof body === "string"
        ? undefined
        : this.createPolicyBodyText({
            x: x + 10,
            y: bodyY,
            width: width - 22,
            viewportHeight: bodyViewportHeight,
            content: body,
          });
    const bodyText = plainBodyText ?? policyBodyText?.bodyObject;

    if (!bodyText) {
      return;
    }

    const maskShape = this.scene.add.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(x + 10, bodyY, width - 22, bodyViewportHeight);
    maskShape.setVisible(false);
    bodyText.setMask(maskShape.createGeometryMask());

    if (plainBodyText && plainBodyText.height > bodyViewportHeight) {
      const originalHeight = plainBodyText.height;
      const spacerLines = "\n\n";
      plainBodyText.setText(`${body}${spacerLines}${body}`);
      this.panelStates.push({
        bodyText: plainBodyText,
        baseY: bodyY,
        viewportHeight: bodyViewportHeight,
        scrollOffset: 0,
        cycleDistance: originalHeight + 28,
      });
    }

    if (policyBodyText?.cycleDistance) {
      this.panelStates.push({
        bodyText: policyBodyText.bodyObject,
        baseY: bodyY,
        viewportHeight: bodyViewportHeight,
        scrollOffset: 0,
        cycleDistance: policyBodyText.cycleDistance,
      });
    }
  }

  private createPolicyBodyText(options: {
    x: number;
    y: number;
    width: number;
    viewportHeight: number;
    content: GameplayPolicyStickyNoteContent;
  }) {
    const container = this.scene.add.container(options.x, options.y);
    const firstPassHeight = this.appendPolicyBodyBlock(
      container,
      0,
      options.width,
      options.content,
    );

    let cycleDistance: number | undefined;
    if (firstPassHeight > options.viewportHeight) {
      cycleDistance = firstPassHeight + 28;
      this.appendPolicyBodyBlock(
        container,
        cycleDistance,
        options.width,
        options.content,
      );
    }

    container.setSize(options.width, container.getBounds().height);

    return { bodyObject: container, cycleDistance };
  }

  private appendPolicyBodyBlock(
    container: Phaser.GameObjects.Container,
    startY: number,
    width: number,
    content: GameplayPolicyStickyNoteContent,
  ) {
    let cursorY = startY;

    const introText = this.scene.add
      .text(0, cursorY, content.introText, {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: "13px",
        color: "#99f5a5",
        wordWrap: { width },
        lineSpacing: 4,
      })
      .setOrigin(0, 0);
    container.add(introText);
    cursorY += introText.height;

    if (content.highlightedTopics.length > 0) {
      cursorY += 10;

      content.highlightedTopics.forEach((topic) => {
        const topicText = this.scene.add
          .text(0, cursorY, `- ${topic}`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: "13px",
            color: "#ff6f61",
            wordWrap: { width },
            lineSpacing: 2,
          })
          .setOrigin(0, 0);
        container.add(topicText);
        cursorY += topicText.height + 4;
      });
    }

    if (content.footerText) {
      cursorY += 10;

      const footerText = this.scene.add
        .text(0, cursorY, content.footerText, {
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: "13px",
          color: "#99f5a5",
          wordWrap: { width },
          lineSpacing: 4,
        })
        .setOrigin(0, 0);
      container.add(footerText);
      cursorY += footerText.height;
    }

    return cursorY;
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
