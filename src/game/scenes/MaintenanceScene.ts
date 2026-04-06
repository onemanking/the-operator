import Phaser from "phaser";
import { synth } from "../utils/SoundSynth";
import { INITIAL_SHIFT_STATE, ShiftSceneData } from "../types/SceneData";
import {
  addScanlines,
  createRetroButton,
  createRetroTextStyle,
  createSceneBackdrop,
  RETRO_COLORS,
} from "./shared/retroUi";

export class MaintenanceScene extends Phaser.Scene {
  private day: number = 1;
  private money: number = 0;
  private accuracy: number = 100;
  private gameOver: boolean = false;

  constructor() {
    super("MaintenanceScene");
  }

  init(data: ShiftSceneData) {
    this.day = data.day;
    this.money = data.money;
    this.accuracy = data.accuracy;
    this.gameOver = data.gameOver || false;
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    createSceneBackdrop(this);

    const textStyle = createRetroTextStyle();

    if (this.gameOver) {
      this.add
        .text(width / 2, 200, "SYSTEM FAILURE", {
          ...textStyle,
          fontSize: "48px",
          color: RETRO_COLORS.errorText,
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.add
        .text(
          width / 2,
          300,
          "HALLUCINATION CRITICAL MASS REACHED.\nSERVER MELTDOWN.",
          { ...textStyle, color: RETRO_COLORS.errorText },
        )
        .setOrigin(0.5);

      createRetroButton({
        scene: this,
        x: width / 2,
        y: 500,
        width: 200,
        height: 50,
        label: "REBOOT SYSTEM",
        onPress: () => {
          synth.playButtonPress();
          this.scene.start("BriefingScene", INITIAL_SHIFT_STATE);
        },
      });
    } else {
      this.add
        .text(width / 2, 100, `END OF DAY ${this.day}`, {
          ...textStyle,
          fontSize: "32px",
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      this.add
        .text(width / 2, 250, `CREDITS EARNED: ${this.money}`, textStyle)
        .setOrigin(0.5);
      this.add
        .text(width / 2, 300, `ACCURACY RATING: ${this.accuracy}%`, textStyle)
        .setOrigin(0.5);

      // Deduct server costs
      const serverCost = 30;
      this.add
        .text(
          width / 2,
          400,
          `SERVER MAINTENANCE COST: -${serverCost} CREDITS`,
          { ...textStyle, color: RETRO_COLORS.mutedText },
        )
        .setOrigin(0.5);

      this.money -= serverCost;

      if (this.money < 0) {
        this.add
          .text(width / 2, 450, "BANKRUPT. SERVER SHUTDOWN.", {
            ...textStyle,
            color: RETRO_COLORS.errorText,
          })
          .setOrigin(0.5);
        createRetroButton({
          scene: this,
          x: width / 2,
          y: 600,
          width: 200,
          height: 50,
          label: "REBOOT SYSTEM",
          onPress: () => {
            synth.playButtonPress();
            this.scene.start("BriefingScene", INITIAL_SHIFT_STATE);
          },
        });
      } else {
        createRetroButton({
          scene: this,
          x: width / 2,
          y: 600,
          width: 250,
          height: 50,
          label: "START NEXT SHIFT",
          onPress: () => {
            synth.playButtonPress();
            this.scene.start("BriefingScene", {
              day: this.day + 1,
              money: this.money,
              accuracy: this.accuracy,
            });
          },
        });
      }
    }

    this.addCRTEffects();
  }

  addCRTEffects() {
    addScanlines(this);
  }
}
