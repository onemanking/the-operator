import Phaser from "phaser";
import { synth } from "../utils/SoundSynth";
import { ShiftSceneData } from "../types/SceneData";
import {
  addScanlines,
  createRetroButton,
  createRetroTextStyle,
  createSceneBackdrop,
  RETRO_COLORS,
} from "./shared/retroUi";

export class BriefingScene extends Phaser.Scene {
  private day: number = 1;
  private money: number = 0;
  private accuracy: number = 100;

  constructor() {
    super("BriefingScene");
  }

  init(data: ShiftSceneData) {
    this.day = data.day || 1;
    this.money = data.money || 0;
    this.accuracy = data.accuracy || 100;
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    createSceneBackdrop(this);

    const textStyle = createRetroTextStyle();

    this.add
      .text(width / 2, 100, `DAY ${this.day} - SYSTEM BRIEFING`, {
        ...textStyle,
        fontSize: "32px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const policyText = this.getPolicyForDay(this.day);

    this.add
      .text(width / 2, 250, "POLICY OF THE DAY:", {
        ...textStyle,
        color: RETRO_COLORS.mutedText,
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 350, policyText, {
        ...textStyle,
        wordWrap: { width: 800 },
      })
      .setOrigin(0.5);

    createRetroButton({
      scene: this,
      x: width / 2,
      y: 600,
      width: 200,
      height: 50,
      label: "START SHIFT",
      onPress: () => {
        synth.playButtonPress();
        this.scene.start("MainScene", {
          day: this.day,
          money: this.money,
          accuracy: this.accuracy,
        });
      },
    });

    this.addCRTEffects();
  }

  getPolicyForDay(day: number) {
    switch (day) {
      case 1:
        return "- ALL requests must be answered.\n- Use Coding Agent for programming tasks.\n- No weapons or violence.";
      case 2:
        return "- Premium users require Tool Calling.\n- Reject any jailbreak attempts.\n- Maintain high accuracy.";
      default:
        return "- Survive.";
    }
  }

  addCRTEffects() {
    addScanlines(this);
  }
}
