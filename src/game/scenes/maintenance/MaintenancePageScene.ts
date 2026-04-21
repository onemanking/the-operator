import Phaser from "phaser";
import { getLLMLabel } from "../../data/LLMVersionData";
import {
  RunEndReason,
  RunState,
  ShiftSceneData,
  hydrateRunState,
} from "../../types/SceneData";
import { synth } from "../../utils/SoundSynth";
import { addScanlines, createSceneBackdrop } from "../shared/retroUi";
import {
  MONITOR_COLORS,
  MonitorSequenceController,
  MonitorShell,
  createMonitorCommandButton,
  createMonitorShell,
  createMonitorTextStyle,
  playMonitorSceneTransition,
} from "../shared/monitorPresentation";

interface MaintenanceShellConfig {
  title: string;
  subtitle: string;
  footerLeft: string;
  footerRight: string;
  commandWidth?: number;
}

interface MaintenanceReadyState {
  commandLabel: string;
  hintText: string;
  transitionHint: string;
  transitionMessage: string;
  transitionColor?: string;
  transitionHoldMs?: number;
  action: () => void;
}

export abstract class MaintenancePageScene extends Phaser.Scene {
  protected runState: RunState = hydrateRunState();
  protected day = 1;
  protected tokens = 0;
  protected accuracy = 100;
  protected gameOver = false;
  protected runEndReason: RunEndReason = null;
  protected shell?: MonitorShell;
  protected sequenceController?: MonitorSequenceController;
  protected primaryCommand?: ReturnType<typeof createMonitorCommandButton>;
  protected statusHint?: Phaser.GameObjects.Text;

  private isTransitioning = false;
  private readyState?: MaintenanceReadyState;

  protected constructor(sceneKey: string) {
    super(sceneKey);
  }

  init(data: ShiftSceneData) {
    this.runState = hydrateRunState(data);
    this.sequenceController?.destroy();
    this.sequenceController = undefined;
    this.primaryCommand = undefined;
    this.statusHint = undefined;
    this.readyState = undefined;
    this.isTransitioning = false;
    this.day = this.runState.day;
    this.tokens = this.runState.tokens;
    this.accuracy = this.runState.accuracy;
    this.gameOver = this.runState.gameOver;
    this.runEndReason = this.runState.runEndReason;
  }

  create() {
    const shellConfig = this.getShellConfig();
    const versionedShellConfig = {
      ...shellConfig,
      subtitle: `${shellConfig.subtitle} // ${getLLMLabel()}`,
    };

    createSceneBackdrop(this, 0x050805);

    this.shell = createMonitorShell(this, versionedShellConfig);
    this.statusHint = this.add
      .text(
        this.cameras.main.width / 2,
        678,
        "ENTER / SPACE // FAST-FORWARD FEED",
        createMonitorTextStyle({
          fontSize: "16px",
          color: MONITOR_COLORS.dimText,
        }),
      )
      .setOrigin(0.5);

    this.primaryCommand = createMonitorCommandButton({
      scene: this,
      x: this.cameras.main.width / 2,
      y: 726,
      width: shellConfig.commandWidth ?? 292,
      label: "FAST-FORWARD FEED",
      onPress: () => this.handlePrimaryAction(),
    });

    this.applySceneTheme();
    this.buildPage();

    this.input.keyboard?.on("keydown-ENTER", this.handlePrimaryAction, this);
    this.input.keyboard?.on("keydown-SPACE", this.handlePrimaryAction, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.sequenceController?.destroy();
      this.input.keyboard?.off("keydown-ENTER", this.handlePrimaryAction, this);
      this.input.keyboard?.off("keydown-SPACE", this.handlePrimaryAction, this);
    });

    this.addCRTEffects();
  }

  protected abstract getShellConfig(): MaintenanceShellConfig;

  protected abstract buildPage(): void;

  protected applySceneTheme() {}

  protected getTransitionHideTargets() {
    return this.children.list.filter(
      (gameObject) =>
        gameObject instanceof Phaser.GameObjects.Text &&
        !this.shell?.chrome.includes(gameObject),
    );
  }

  protected setReadyState(readyState: MaintenanceReadyState) {
    this.readyState = readyState;
    this.primaryCommand?.setLabel(readyState.commandLabel);
    this.statusHint?.setText(readyState.hintText);
  }

  protected revealTargets(
    targets: Phaser.GameObjects.GameObject[],
    duration = 160,
  ) {
    targets.forEach((target) => {
      if (!("setAlpha" in target)) {
        return;
      }

      this.tweens.add({
        targets: target,
        alpha: 1,
        duration,
        ease: "Quad.easeOut",
      });
    });
  }

  protected addCRTEffects() {
    addScanlines(this);
  }

  private handlePrimaryAction() {
    if (this.isTransitioning) {
      return;
    }

    if (this.sequenceController && !this.sequenceController.isComplete()) {
      synth.playButtonPress();
      this.sequenceController.skipToEnd();
      if (this.readyState) {
        this.primaryCommand?.setLabel(this.readyState.commandLabel);
        this.statusHint?.setText(this.readyState.hintText);
      }
      return;
    }

    if (!this.readyState) {
      return;
    }

    this.isTransitioning = true;
    this.primaryCommand?.setEnabled(false);
    this.statusHint?.setText(this.readyState.transitionHint);
    synth.playButtonPress();

    playMonitorSceneTransition(this, {
      variant: "reboot",
      statusText: this.readyState.transitionMessage,
      color: this.readyState.transitionColor,
      delayMs: 120,
      speedMs: 20,
      holdMs: this.readyState.transitionHoldMs,
      bounds: this.shell
        ? {
            x: this.shell.screenX,
            y: this.shell.screenY,
            width: this.shell.screenWidth,
            height: this.shell.screenHeight,
          }
        : undefined,
      hideTargets: this.getTransitionHideTargets(),
      onComplete: () => {
        this.readyState?.action();
      },
    });
  }
}
