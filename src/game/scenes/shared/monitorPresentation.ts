import Phaser from "phaser";
import { synth } from "../../utils/SoundSynth";
import { createRetroTextStyle } from "./retroUi";

export const MONITOR_COLORS = {
  bezelShadow: 0x050504,
  bezelFrame: 0x14120e,
  bezelEdge: 0x343128,
  screen: 0x020602,
  screenGlow: 0x020602,
  grid: 0x0a220a,
  text: "#33ff33",
  mutedText: "#33ff33",
  dimText: "#1d7a1d",
  warningText: "#ffb347",
  dangerText: "#ff756b",
  commandFill: 0x030703,
  commandDisabledFill: 0x050705,
  commandStroke: 0x33ff33,
  commandDisabledStroke: 0x1d7a1d,
  invertFill: 0x33ff33,
  invertText: "#020602",
} as const;

export type RevealMode = "char" | "word" | "line" | "instant";

export interface TypedTextStep {
  target: Phaser.GameObjects.Text;
  text: string;
  reveal?: RevealMode;
  delayMs?: number;
  speedMs?: number;
  pauseAfterMs?: number;
  playSound?: boolean;
  color?: string;
  append?: boolean;
}

export interface MonitorShell {
  contentX: number;
  contentY: number;
  contentWidth: number;
  contentHeight: number;
  chrome: Phaser.GameObjects.GameObject[];
}

interface MonitorShellOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  title?: string;
  subtitle?: string;
  footerLeft?: string;
  footerRight?: string;
}

interface MonitorCommandButtonConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  label: string;
  onPress: () => void;
}

interface MonitorSceneTransitionConfig {
  variant: "dispatch" | "reboot";
  statusText: string;
  onComplete: () => void;
}

function tokenizeText(text: string, reveal: RevealMode) {
  if (reveal === "instant") {
    return [text];
  }

  if (reveal === "word") {
    return text.split(/(\s+)/).filter((token) => token.length > 0);
  }

  if (reveal === "line") {
    const lines = text.split("\n");
    return lines.flatMap((line, index) =>
      index === lines.length - 1 ? [line] : [`${line}\n`],
    );
  }

  return Array.from(text);
}

function isAudibleToken(token: string) {
  return token.trim().length > 0;
}

export function createMonitorTextStyle(
  overrides: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return createRetroTextStyle({
    fontSize: "20px",
    color: MONITOR_COLORS.text,
    align: "left",
    ...overrides,
  });
}

export function createMonitorShell(
  scene: Phaser.Scene,
  options: MonitorShellOptions = {},
): MonitorShell {
  const camera = scene.cameras.main;
  const width = options.width ?? 888;
  const height = options.height ?? 636;
  const x = options.x ?? (camera.width - width) / 2;
  const y = options.y ?? 52;
  const chrome: Phaser.GameObjects.GameObject[] = [];

  chrome.push(
    scene.add
      .rectangle(x + 8, y + 10, width, height, MONITOR_COLORS.bezelShadow, 0.95)
      .setOrigin(0),
  );

  chrome.push(
    scene.add
      .rectangle(x, y, width, height, MONITOR_COLORS.bezelFrame)
      .setOrigin(0)
      .setStrokeStyle(2, MONITOR_COLORS.bezelEdge),
  );

  const screenInset = 20;
  const screenWidth = width - screenInset * 2;
  const screenHeight = height - screenInset * 2;
  const screenX = x + screenInset;
  const screenY = y + screenInset;

  chrome.push(
    scene.add
      .rectangle(screenX, screenY, screenWidth, screenHeight, 0x000000, 0.12)
      .setOrigin(0),
  );

  chrome.push(
    scene.add
      .rectangle(
        screenX,
        screenY,
        screenWidth,
        screenHeight,
        MONITOR_COLORS.screen,
      )
      .setOrigin(0)
      .setStrokeStyle(2, 0x33ff33, 0.55),
  );

  const grid = scene.add.graphics();
  grid.lineStyle(1, MONITOR_COLORS.grid, 0.08);
  for (let lineY = screenY + 26; lineY < screenY + screenHeight; lineY += 26) {
    grid.lineBetween(screenX + 14, lineY, screenX + screenWidth - 14, lineY);
  }
  chrome.push(grid);

  const titleY = screenY + 18;
  chrome.push(
    scene.add
      .text(
        screenX + 22,
        titleY,
        options.title ?? "SYSTEM MONITOR",
        createMonitorTextStyle({ fontSize: "18px", fontStyle: "bold" }),
      )
      .setOrigin(0, 0),
  );

  chrome.push(
    scene.add
      .text(
        screenX + screenWidth - 22,
        titleY,
        options.subtitle ?? "LINK STABLE",
        createMonitorTextStyle({
          fontSize: "16px",
          color: MONITOR_COLORS.dimText,
        }),
      )
      .setOrigin(1, 0),
  );

  chrome.push(
    scene.add
      .rectangle(
        screenX + 18,
        screenY + 48,
        screenWidth - 36,
        1,
        0x33ff33,
        0.35,
      )
      .setOrigin(0, 0.5),
  );

  chrome.push(
    scene.add
      .rectangle(
        screenX + 18,
        screenY + screenHeight - 36,
        screenWidth - 36,
        1,
        0x33ff33,
        0.2,
      )
      .setOrigin(0, 0.5),
  );

  chrome.push(
    scene.add
      .text(
        screenX + 22,
        screenY + screenHeight - 30,
        options.footerLeft ?? "CHANNEL: OPERATOR//CRT",
        createMonitorTextStyle({
          fontSize: "15px",
          color: MONITOR_COLORS.dimText,
        }),
      )
      .setOrigin(0, 0.5),
  );

  chrome.push(
    scene.add
      .text(
        screenX + screenWidth - 22,
        screenY + screenHeight - 30,
        options.footerRight ?? "INPUT: ENTER / SPACE",
        createMonitorTextStyle({
          fontSize: "15px",
          color: MONITOR_COLORS.dimText,
        }),
      )
      .setOrigin(1, 0.5),
  );

  return {
    contentX: screenX + 22,
    contentY: screenY + 66,
    contentWidth: screenWidth - 44,
    contentHeight: screenHeight - 114,
    chrome,
  };
}

export function createMonitorCommandButton({
  scene,
  x,
  y,
  width,
  label,
  onPress,
}: MonitorCommandButtonConfig) {
  const shadow = scene.add
    .rectangle(x + 4, y + 4, width, 42, MONITOR_COLORS.bezelShadow, 0.92)
    .setOrigin(0.5);
  const button = scene.add
    .rectangle(x, y, width, 42, MONITOR_COLORS.commandFill)
    .setOrigin(0.5)
    .setStrokeStyle(2, MONITOR_COLORS.commandStroke)
    .setInteractive({ useHandCursor: true });
  const prompt = scene.add
    .text(
      x - width / 2 + 18,
      y,
      ">",
      createMonitorTextStyle({ fontSize: "20px", fontStyle: "bold" }),
    )
    .setOrigin(0, 0.5);
  const buttonLabel = scene.add
    .text(
      x - width / 2 + 44,
      y,
      label,
      createMonitorTextStyle({ fontSize: "18px", fontStyle: "bold" }),
    )
    .setOrigin(0, 0.5);
  const cursor = scene.add
    .rectangle(x + width / 2 - 20, y, 10, 18, 0x62ff8f, 0.65)
    .setOrigin(0.5);

  const container = scene.add.container(0, 0, [
    shadow,
    button,
    prompt,
    buttonLabel,
    cursor,
  ]);

  let enabled = true;

  const applyVisualState = (hovered: boolean = false) => {
    const fillColor = enabled
      ? hovered
        ? MONITOR_COLORS.invertFill
        : MONITOR_COLORS.commandFill
      : MONITOR_COLORS.commandDisabledFill;
    const strokeColor = enabled
      ? hovered
        ? MONITOR_COLORS.invertFill
        : MONITOR_COLORS.commandStroke
      : MONITOR_COLORS.commandDisabledStroke;
    const textColor = enabled
      ? hovered
        ? MONITOR_COLORS.invertText
        : MONITOR_COLORS.text
      : MONITOR_COLORS.dimText;

    button.setFillStyle(fillColor, 1);
    button.setStrokeStyle(2, strokeColor);
    buttonLabel.setColor(textColor);
    prompt.setColor(textColor);
    cursor.setFillStyle(
      hovered && enabled ? 0x020602 : 0x33ff33,
      enabled ? 0.7 : 0.2,
    );
    container.setAlpha(enabled ? 1 : 0.55);
  };

  button.on("pointerover", () => applyVisualState(true));
  button.on("pointerout", () => applyVisualState(false));
  button.on("pointerdown", () => {
    if (!enabled) {
      return;
    }

    applyVisualState(true);
    scene.time.delayedCall(70, () => {
      if (!button.scene) {
        return;
      }

      applyVisualState(false);
      onPress();
    });
  });

  scene.tweens.add({
    targets: cursor,
    alpha: { from: 0.18, to: 0.82 },
    duration: 480,
    yoyo: true,
    repeat: -1,
  });

  applyVisualState(false);

  return {
    container,
    button,
    buttonLabel,
    setEnabled(nextEnabled: boolean) {
      enabled = nextEnabled;
      if (nextEnabled) {
        button.setInteractive({ useHandCursor: true });
      } else {
        button.disableInteractive();
      }
      applyVisualState(false);
    },
    setLabel(nextLabel: string) {
      buttonLabel.setText(nextLabel);
    },
  };
}

export class MonitorSequenceController {
  private currentEvent?: Phaser.Time.TimerEvent;
  private pendingCall?: Phaser.Time.TimerEvent;
  private steps: TypedTextStep[] = [];
  private onComplete?: () => void;
  private running = false;
  private complete = false;

  constructor(private readonly scene: Phaser.Scene) {}

  play(steps: TypedTextStep[], onComplete?: () => void) {
    this.destroyTimers();
    this.steps = steps;
    this.onComplete = onComplete;
    this.running = true;
    this.complete = false;
    this.runStep(0);
  }

  isRunning() {
    return this.running;
  }

  isComplete() {
    return this.complete;
  }

  skipToEnd() {
    if (this.complete) {
      return;
    }

    this.destroyTimers();
    this.steps.forEach((step) => {
      if (step.color) {
        step.target.setColor(step.color);
      }

      if (step.append) {
        step.target.setText(`${step.target.text}${step.text}`);
      } else {
        step.target.setText(step.text);
      }
    });
    this.finish();
  }

  destroy() {
    this.destroyTimers();
    this.running = false;
    this.complete = false;
  }

  private runStep(index: number) {
    if (index >= this.steps.length) {
      this.finish();
      return;
    }

    const step = this.steps[index];
    const reveal = step.reveal ?? "char";
    const delayMs = step.delayMs ?? 0;

    if (!step.append) {
      step.target.setText("");
    }

    if (step.color) {
      step.target.setColor(step.color);
    }

    const beginReveal = () => {
      const tokens = tokenizeText(step.text, reveal);
      const speedMs = step.speedMs ?? (reveal === "char" ? 18 : 90);

      if (reveal === "instant" || tokens.length <= 1) {
        step.target.setText(
          step.append ? `${step.target.text}${step.text}` : step.text,
        );
        if (step.playSound && isAudibleToken(step.text)) {
          synth.playTypewriter();
        }
        this.scheduleNext(index, step.pauseAfterMs ?? 0);
        return;
      }

      let builtText = step.append ? step.target.text : "";
      let tokenIndex = 0;
      this.currentEvent = this.scene.time.addEvent({
        delay: speedMs,
        repeat: tokens.length - 1,
        callback: () => {
          const token = tokens[tokenIndex] ?? "";
          builtText += token;
          step.target.setText(builtText);
          if (step.playSound && isAudibleToken(token)) {
            synth.playTypewriter();
          }
          tokenIndex += 1;
          if (tokenIndex === tokens.length) {
            this.currentEvent = undefined;
            this.scheduleNext(index, step.pauseAfterMs ?? 0);
          }
        },
      });
    };

    if (delayMs > 0) {
      this.pendingCall = this.scene.time.delayedCall(delayMs, beginReveal);
      return;
    }

    beginReveal();
  }

  private scheduleNext(index: number, pauseAfterMs: number) {
    if (pauseAfterMs > 0) {
      this.pendingCall = this.scene.time.delayedCall(pauseAfterMs, () => {
        this.pendingCall = undefined;
        this.runStep(index + 1);
      });
      return;
    }

    this.runStep(index + 1);
  }

  private finish() {
    if (this.complete) {
      return;
    }

    this.destroyTimers();
    this.running = false;
    this.complete = true;
    this.onComplete?.();
  }

  private destroyTimers() {
    this.currentEvent?.remove(false);
    this.currentEvent = undefined;
    this.pendingCall?.remove(false);
    this.pendingCall = undefined;
  }
}

export function playMonitorSceneTransition(
  scene: Phaser.Scene,
  config: MonitorSceneTransitionConfig,
) {
  const { width, height } = scene.cameras.main;
  const overlay = scene.add.container(0, 0).setDepth(5000);
  const blackout = scene.add
    .rectangle(0, 0, width, height, 0x010401, 0)
    .setOrigin(0);
  const tintColor =
    config.variant === "dispatch"
      ? 0x33ff33
      : config.statusText.includes("FAIL")
        ? 0xff756b
        : 0xffb347;
  const sweep = scene.add
    .rectangle(
      0,
      config.variant === "dispatch" ? 0 : height / 2,
      width,
      config.variant === "dispatch" ? 0 : 4,
      tintColor,
      config.variant === "dispatch" ? 0.22 : 0.88,
    )
    .setOrigin(0, config.variant === "dispatch" ? 0 : 0.5);
  const status = scene.add
    .text(
      54,
      height - 66,
      `> ${config.statusText}`,
      createMonitorTextStyle({
        fontSize: "20px",
        color:
          config.variant === "dispatch"
            ? MONITOR_COLORS.text
            : config.statusText.includes("FAIL")
              ? MONITOR_COLORS.dangerText
              : MONITOR_COLORS.warningText,
      }),
    )
    .setOrigin(0, 0.5)
    .setAlpha(0);
  const chatter = scene.add
    .text(
      54,
      height - 118,
      config.variant === "dispatch"
        ? "CHANNEL_LOCK......OK\nSHIFT_EXECUTE....PENDING"
        : "SAFE_MODE........ACTIVE\nDISPLAY_RESET.....PENDING",
      createMonitorTextStyle({
        fontSize: "16px",
        color: MONITOR_COLORS.mutedText,
      }),
    )
    .setOrigin(0, 1)
    .setAlpha(0);

  overlay.add([blackout, sweep, chatter, status]);

  scene.tweens.add({ targets: blackout, alpha: 0.94, duration: 110 });
  scene.tweens.add({ targets: status, alpha: 1, duration: 90, delay: 40 });
  scene.tweens.add({ targets: chatter, alpha: 1, duration: 90, delay: 60 });

  if (config.variant === "dispatch") {
    scene.tweens.add({
      targets: sweep,
      height,
      alpha: { from: 0.14, to: 0.58 },
      duration: 260,
      ease: "Quad.easeIn",
    });
    scene.cameras.main.shake(110, 0.0014, true);
  } else {
    scene.tweens.add({
      targets: sweep,
      scaleX: { from: 0.12, to: 1 },
      duration: 110,
      ease: "Sine.easeOut",
    });
    scene.tweens.add({
      targets: sweep,
      scaleY: { from: 1, to: 0.04 },
      alpha: { from: 0.92, to: 0.18 },
      duration: 180,
      delay: 110,
      ease: "Quad.easeIn",
    });
  }

  scene.time.delayedCall(340, () => {
    config.onComplete();
  });
}
