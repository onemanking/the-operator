import Phaser from "phaser";
import { synth } from "../../utils/SoundSynth";

interface HudControllerBindings {
  onInference: () => void;
  onRefuse: () => void;
  setTaskTextObj: (value: Phaser.GameObjects.Text) => void;
  setChatTextObj: (value: Phaser.GameObjects.Text) => void;
  setPatienceBarFill: (value: Phaser.GameObjects.Rectangle) => void;
  setHeatBarFill: (value: Phaser.GameObjects.Rectangle) => void;
  setHallucinationBarFill: (value: Phaser.GameObjects.Rectangle) => void;
  getHeat: () => number;
  getHallucination: () => number;
  isOverheated: () => boolean;
}

export class MainSceneHudController {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bindings: HudControllerBindings,
  ) {}

  createLayout() {
    const monitorOuter = this.scene.add
      .rectangle(230, 30, 564, 440, 0x2c2a25)
      .setOrigin(0);
    monitorOuter.setStrokeStyle(4, 0x111111);

    const terminalBg = this.scene.add
      .rectangle(250, 50, 524, 400, 0x051505)
      .setOrigin(0);
    terminalBg.setStrokeStyle(2, 0x33ff33);

    this.scene.add.text(250, 20, "USER CONNECTION:", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#d4c5b0",
    });
    this.scene.add.rectangle(400, 20, 374, 15, 0x111111).setOrigin(0);
    const patienceBarFill = this.scene.add
      .rectangle(402, 22, 370, 11, 0xffaa00)
      .setOrigin(0);
    this.bindings.setPatienceBarFill(patienceBarFill);

    const taskTextObj = this.scene.add.text(260, 60, "", {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: "14px",
      color: "#33ff33",
      wordWrap: { width: 500 },
    });
    this.bindings.setTaskTextObj(taskTextObj);

    const chatTextObj = this.scene.add.text(260, 120, "", {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: "14px",
      color: "#33ff33",
      wordWrap: { width: 500 },
    });
    this.bindings.setChatTextObj(chatTextObj);

    return { terminalBg };
  }

  createActionButtons() {
    this.scene.add.rectangle(824, 504, 180, 80, 0x005500).setOrigin(0);
    const runBtn = this.scene.add
      .rectangle(824, 500, 180, 80, 0x00aa00)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    runBtn.setStrokeStyle(2, 0x00ff00);
    const runTxt = this.scene.add.text(844, 530, "INFERENCE", {
      fontFamily: "monospace",
      fontSize: "24px",
      color: "#ffffff",
      fontStyle: "bold",
    });

    runBtn.on("pointerdown", () => {
      synth.playButtonPress();
      runBtn.y = 504;
      runTxt.y = 534;
      this.scene.time.delayedCall(100, () => {
        runBtn.y = 500;
        runTxt.y = 530;
      });
      this.bindings.onInference();
    });

    this.scene.add.rectangle(824, 604, 180, 60, 0x550000).setOrigin(0);
    const refuseBtn = this.scene.add
      .rectangle(824, 600, 180, 60, 0xaa0000)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    refuseBtn.setStrokeStyle(2, 0xff0000);
    const refuseTxt = this.scene.add.text(864, 620, "REFUSE", {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#ffffff",
      fontStyle: "bold",
    });

    refuseBtn.on("pointerdown", () => {
      synth.playButtonPress();
      refuseBtn.y = 604;
      refuseTxt.y = 624;
      this.scene.time.delayedCall(100, () => {
        refuseBtn.y = 600;
        refuseTxt.y = 620;
      });
      this.bindings.onRefuse();
    });
  }

  createStatusBars() {
    this.scene.add.rectangle(0, 668, 1024, 100, 0x22201c).setOrigin(0);
    this.scene.add.rectangle(0, 664, 1024, 4, 0x111111).setOrigin(0);

    this.scene.add.text(250, 680, "THERMAL LOAD:", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#d4c5b0",
    });
    this.scene.add.rectangle(380, 680, 200, 20, 0x111111).setOrigin(0);
    const heatBarFill = this.scene.add
      .rectangle(382, 682, 0, 16, 0xff5500)
      .setOrigin(0);
    this.bindings.setHeatBarFill(heatBarFill);

    this.scene.add.text(650, 680, "HALLUCINATION:", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#d4c5b0",
    });
    this.scene.add.rectangle(790, 680, 150, 20, 0x111111).setOrigin(0);
    const hallucinationBarFill = this.scene.add
      .rectangle(792, 682, 0, 16, 0xff0000)
      .setOrigin(0);
    this.bindings.setHallucinationBarFill(hallucinationBarFill);

    this.scene.events.on("updateBars", () => {
      heatBarFill.width = 196 * Math.min(1, this.bindings.getHeat() / 100);
      hallucinationBarFill.width =
        146 * Math.min(1, this.bindings.getHallucination() / 100);

      if (this.bindings.isOverheated()) heatBarFill.setFillStyle(0xff0000);
      else if (this.bindings.getHeat() > 80) heatBarFill.setFillStyle(0xffaa00);
      else heatBarFill.setFillStyle(0xff5500);
    });
    this.scene.events.emit("updateBars");
  }
}
