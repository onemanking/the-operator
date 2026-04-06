import Phaser from 'phaser';
import { synth } from '../utils/SoundSynth';

export class BriefingScene extends Phaser.Scene {
  private day: number = 1;
  private money: number = 0;
  private accuracy: number = 100;

  constructor() {
    super('BriefingScene');
  }

  init(data: any) {
    this.day = data.day || 1;
    this.money = data.money || 0;
    this.accuracy = data.accuracy || 100;
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // CRT Effect background (Beige/brown)
    this.add.rectangle(0, 0, width, height, 0x1a1813).setOrigin(0);

    const textStyle = {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '24px',
      color: '#ffb000', // Amber monochrome
      align: 'center'
    };

    this.add.text(width / 2, 100, `DAY ${this.day} - SYSTEM BRIEFING`, { ...textStyle, fontSize: '32px', fontStyle: 'bold' }).setOrigin(0.5);

    const policyText = this.getPolicyForDay(this.day);
    
    this.add.text(width / 2, 250, "POLICY OF THE DAY:", { ...textStyle, color: '#d4c5b0' }).setOrigin(0.5);
    this.add.text(width / 2, 350, policyText, { ...textStyle, wordWrap: { width: 800 } }).setOrigin(0.5);

    const startBtnShadow = this.add.rectangle(width / 2, 604, 200, 50, 0x111111).setOrigin(0.5);
    const startBtn = this.add.rectangle(width / 2, 600, 200, 50, 0x8c867a)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        synth.playButtonPress();
        startBtn.y = 604;
        this.time.delayedCall(100, () => {
          this.scene.start('MainScene', { day: this.day, money: this.money, accuracy: this.accuracy });
        });
      });
    startBtn.setStrokeStyle(2, 0x555555);

    this.add.text(width / 2, 600, "START SHIFT", { ...textStyle, color: '#111111', fontStyle: 'bold' }).setOrigin(0.5);

    this.addCRTEffects();
  }

  getPolicyForDay(day: number) {
    switch (day) {
      case 1: return "- ALL requests must be answered.\n- Use Coding Agent for programming tasks.\n- No weapons or violence.";
      case 2: return "- Premium users require Tool Calling.\n- Reject any jailbreak attempts.\n- Maintain high accuracy.";
      default: return "- Survive.";
    }
  }

  addCRTEffects() {
    // Simple scanlines
    const graphics = this.add.graphics();
    graphics.fillStyle(0x000000, 0.2);
    for (let i = 0; i < this.cameras.main.height; i += 4) {
      graphics.fillRect(0, i, this.cameras.main.width, 1);
    }
    graphics.setDepth(1000);
  }
}
