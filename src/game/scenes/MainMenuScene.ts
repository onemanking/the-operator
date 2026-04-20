import Phaser from "phaser";
import { MainMenuSceneData } from "../types/SceneData";
import { synth } from "../utils/SoundSynth";
import { addScanlines, createSceneBackdrop } from "./shared/retroUi";
import {
  MONITOR_COLORS,
  MonitorShell,
  createMonitorShell,
  createMonitorTextStyle,
  playMonitorSceneTransition,
} from "./shared/monitorPresentation";

export class MainMenuScene extends Phaser.Scene {
  private menuData: MainMenuSceneData = {
    nextSceneKey: "BriefingScene",
    nextSceneData: {},
    playerProfile: {
      version: 2,
      orientationCompleted: false,
      audioEnabled: true,
      reducedMotion: false,
    },
  };

  private shell?: MonitorShell;
  private root?: Phaser.GameObjects.Container;
  private commandContainer?: Phaser.GameObjects.Container;
  private actionHighlight?: Phaser.GameObjects.Rectangle;
  private titleText?: Phaser.GameObjects.Text;
  private subtitleText?: Phaser.GameObjects.Text;
  private taglineText?: Phaser.GameObjects.Text;
  private routeText?: Phaser.GameObjects.Text;
  private footerPrompt?: Phaser.GameObjects.Text;
  private startIndicator?: Phaser.GameObjects.Text;
  private startLabel?: Phaser.GameObjects.Text;
  private menuHideTargets: Phaser.GameObjects.GameObject[] = [];
  private audioBusArmed = false;
  private audioBusArming = false;
  private beatPulse = 0;
  private barPulse = 0;
  private lastBeatIndex = -1;
  private lastBarIndex = -1;
  private baseTitleY = 0;
  private baseSubtitleY = 0;
  private baseTaglineY = 0;
  private baseCommandY = 0;
  private baseRouteY = 0;
  private transitionLocked = false;

  constructor() {
    super("MainMenuScene");
  }

  init(data: MainMenuSceneData) {
    this.menuData = {
      nextSceneKey: data.nextSceneKey,
      nextSceneData: data.nextSceneData,
      playerProfile: { ...data.playerProfile },
    };
    this.menuData.playerProfile.audioEnabled = true;
    this.menuData.playerProfile.reducedMotion = false;
    this.audioBusArmed = synth.isAudioReady();
    this.audioBusArming = false;
    this.beatPulse = 0;
    this.barPulse = 0;
    this.lastBeatIndex = -1;
    this.lastBarIndex = -1;
    this.transitionLocked = false;
    this.menuHideTargets = [];
  }

  create() {
    createSceneBackdrop(this, 0x040804);
    this.shell = createMonitorShell(this, {
      title: "TERMINAL BOOT // MAIN MENU",
      subtitle: "OPERATOR CONSOLE READY",
      footerLeft: "CHANNEL: OPERATOR.ENTRY",
      footerRight: "ENTER / SPACE // START",
    });
    synth.setMenuMusicEnabled(true);
    if (this.audioBusArmed) {
      synth.startMenuMusic();
    }

    this.root = this.add.container(0, 0).setDepth(10);
    this.root.add(this.shell.chrome);

    this.buildMenuPresentation();
    addScanlines(this);

    this.input.keyboard?.on("keydown-ENTER", this.handleConfirm, this);
    this.input.keyboard?.on("keydown-SPACE", this.handleConfirm, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      synth.stopMenuMusic();
      this.input.keyboard?.off("keydown-ENTER", this.handleConfirm, this);
      this.input.keyboard?.off("keydown-SPACE", this.handleConfirm, this);
    });
  }

  update(_time: number, delta: number) {
    const menuMusicState = synth.getMenuMusicState();
    if (menuMusicState.active) {
      if (menuMusicState.beatIndex !== this.lastBeatIndex) {
        this.lastBeatIndex = menuMusicState.beatIndex;
        this.beatPulse = 1;
      }

      if (menuMusicState.barIndex !== this.lastBarIndex) {
        this.lastBarIndex = menuMusicState.barIndex;
        this.barPulse = 1;
      }
    }

    const beatDecay = delta / 170;
    const barDecay = delta / 280;
    this.beatPulse = Math.max(0, this.beatPulse - beatDecay);
    this.barPulse = Math.max(0, this.barPulse - barDecay);

    const beatInfluence = this.beatPulse;
    const barInfluence = this.barPulse;
    const idleBlink = menuMusicState.active
      ? menuMusicState.beatPhase < 0.5
        ? 1
        : 0.32
      : Math.sin(this.time.now / 220) > 0
        ? 1
        : 0.32;

    if (this.titleText) {
      this.titleText.setY(this.baseTitleY + Math.round(beatInfluence * 6));
      this.titleText.setScale(
        1 + barInfluence * 0.028,
        1 + barInfluence * 0.038,
      );
      this.titleText.setAlpha(0.9 + Math.min(0.1, beatInfluence * 0.18));
    }

    if (this.subtitleText) {
      this.subtitleText.setY(
        this.baseSubtitleY + Math.round(beatInfluence * 2),
      );
      this.subtitleText.setAlpha(0.72 + Math.min(0.2, beatInfluence * 0.2));
    }

    if (this.taglineText) {
      this.taglineText.setY(this.baseTaglineY + Math.round(beatInfluence * 3));
      this.taglineText.setAlpha(0.68 + Math.min(0.22, beatInfluence * 0.22));
    }

    if (this.commandContainer) {
      this.commandContainer.setY(
        this.baseCommandY + Math.round(beatInfluence * 3),
      );
    }

    if (this.routeText) {
      this.routeText.setY(this.baseRouteY + Math.round(barInfluence));
      this.routeText.setAlpha(0.78 + Math.min(0.16, beatInfluence * 0.12));
    }

    if (this.actionHighlight) {
      this.actionHighlight.setAlpha(0.16 + barInfluence * 0.2);
    }

    this.startIndicator?.setAlpha(idleBlink);
    this.startLabel?.setColor(MONITOR_COLORS.warningText);
  }

  private buildMenuPresentation() {
    if (!this.shell || !this.root) {
      return;
    }

    const titleBlockWidth = 512;
    const titleBlockX =
      this.shell.contentX + (this.shell.contentWidth - titleBlockWidth) / 2;
    const titleBlock = this.add
      .rectangle(
        titleBlockX,
        this.shell.contentY + 4,
        titleBlockWidth,
        172,
        0x071707,
        0.45,
      )
      .setOrigin(0)
      .setStrokeStyle(1, 0x33ff33, 0.24);
    this.menuHideTargets.push(titleBlock);
    this.root.add(titleBlock);

    this.titleText = this.add
      .text(
        this.shell.contentX + this.shell.contentWidth / 2,
        this.shell.contentY + 2,
        "THE\nOPERATOR",
        createMonitorTextStyle({
          fontSize: "84px",
          fontStyle: "bold",
          lineSpacing: -8,
          align: "center",
        }),
      )
      .setOrigin(0.5, 0);
    this.baseTitleY = this.titleText.y;
    this.menuHideTargets.push(this.titleText);
    this.root.add(this.titleText);

    this.subtitleText = this.add
      .text(
        this.shell.contentX + this.shell.contentWidth / 2,
        this.shell.contentY + 154,
        "NEURAL INFERENCE MAINFRAME",
        createMonitorTextStyle({
          fontSize: "18px",
          color: MONITOR_COLORS.dimText,
          align: "center",
        }),
      )
      .setOrigin(0.5, 0);
    this.baseSubtitleY = this.subtitleText.y;
    this.menuHideTargets.push(this.subtitleText);
    this.root.add(this.subtitleText);

    this.taglineText = this.add
      .text(
        this.shell.contentX + this.shell.contentWidth / 2,
        this.shell.contentY + 182,
        "SCREEN THE REQUEST // SAVE THE MACHINE",
        createMonitorTextStyle({
          fontSize: "16px",
          color: MONITOR_COLORS.warningText,
          align: "center",
        }),
      )
      .setOrigin(0.5, 0);
    this.baseTaglineY = this.taglineText.y;
    this.menuHideTargets.push(this.taglineText);
    this.root.add(this.taglineText);

    this.commandContainer = this.add.container(
      this.shell.contentX + this.shell.contentWidth / 2 - 176,
      this.shell.contentY + 264,
    );
    this.baseCommandY = this.commandContainer.y;
    this.menuHideTargets.push(this.commandContainer);
    this.root.add(this.commandContainer);

    this.actionHighlight = this.add
      .rectangle(176, 32, 352, 56, 0x183d18, 0.22)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0xffb347, 0.28);
    this.commandContainer.add(this.actionHighlight);

    this.startIndicator = this.add
      .text(30, 32, ">", createMonitorTextStyle({ fontSize: "30px" }))
      .setOrigin(0, 0.5);
    this.startLabel = this.add
      .text(
        56,
        32,
        this.menuData.nextSceneKey === "MainScene"
          ? "BEGIN ORIENTATION"
          : "BEGIN CONTRACT",
        createMonitorTextStyle({ fontSize: "28px" }),
      )
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    this.startLabel.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      void this.handleConfirm();
    });
    this.commandContainer.add([this.startIndicator, this.startLabel]);

    this.routeText = this.add
      .text(
        this.shell.contentX + this.shell.contentWidth / 2,
        this.shell.contentY + 378,
        this.getRouteCopy(),
        createMonitorTextStyle({
          fontSize: "18px",
          color: MONITOR_COLORS.warningText,
          align: "center",
          wordWrap: { width: 460 },
          lineSpacing: 6,
        }),
      )
      .setOrigin(0.5, 0);
    this.baseRouteY = this.routeText.y;
    this.menuHideTargets.push(this.routeText);
    this.root.add(this.routeText);

    this.footerPrompt = this.add
      .text(
        this.cameras.main.width / 2,
        720,
        "CLICK / ENTER / SPACE // START",
        createMonitorTextStyle({
          fontSize: "16px",
          color: MONITOR_COLORS.dimText,
        }),
      )
      .setOrigin(0.5);
    this.menuHideTargets.push(this.footerPrompt);
    this.root.add(this.footerPrompt);
  }

  private async handleConfirm() {
    if (this.transitionLocked) {
      return;
    }

    if (!this.audioBusArmed) {
      await this.armAudioBus();
    }

    this.startRoute();
  }

  private async armAudioBus() {
    if (this.audioBusArming || this.audioBusArmed) {
      return;
    }

    this.audioBusArming = true;
    const ready = await synth.resumeAudio();
    this.audioBusArming = false;
    this.audioBusArmed = ready;

    if (ready) {
      synth.startMenuMusic();
    }
  }

  private startRoute() {
    if (this.transitionLocked || !this.root) {
      return;
    }

    this.transitionLocked = true;
    synth.playButtonPress();
    synth.stopMenuMusic();

    playMonitorSceneTransition(this, {
      variant: "dispatch",
      statusText:
        this.menuData.nextSceneKey === "MainScene"
          ? "TRAINING LINK ACCEPTED // ORIENTATION STAGED"
          : "OPERATOR LINK ACCEPTED // BRIEFING STAGED",
      bounds: this.shell
        ? {
            x: this.shell.screenX,
            y: this.shell.screenY,
            width: this.shell.screenWidth,
            height: this.shell.screenHeight,
          }
        : undefined,
      hideTargets: this.menuHideTargets,
      onComplete: () => {
        this.scene.start(
          this.menuData.nextSceneKey,
          this.menuData.nextSceneData,
        );
      },
      holdMs: 860,
    });
  }

  private getRouteCopy() {
    if (this.menuData.nextSceneKey === "MainScene") {
      return [
        "UNTRAINED OPERATOR PROFILE DETECTED.",
        "BEGIN ORIENTATION TO BRING THE CONSOLE ONLINE.",
      ].join("\n");
    }

    return [
      "CERTIFIED OPERATOR PROFILE DETECTED.",
      "SIGN IN TO BEGIN YOUR SHIFT.\nOMNICORP EXPECTS EFFICIENCY.",
    ].join("\n");
  }
}
