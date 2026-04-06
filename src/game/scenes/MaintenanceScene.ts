import Phaser from 'phaser';
import { synth } from '../utils/SoundSynth';

export class MaintenanceScene extends Phaser.Scene {
  private day: number = 1;
  private money: number = 0;
  private accuracy: number = 100;
  private gameOver: boolean = false;

  constructor() {
    super('MaintenanceScene');
  }

  init(data: any) {
    this.day = data.day;
    this.money = data.money;
    this.accuracy = data.accuracy;
    this.gameOver = data.gameOver || false;
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.add.rectangle(0, 0, width, height, 0x1a1813).setOrigin(0);

    const textStyle = {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '24px',
      color: '#ffb000',
      align: 'center'
    };

    if (this.gameOver) {
      this.add.text(width / 2, 200, "SYSTEM FAILURE", { ...textStyle, fontSize: '48px', color: '#ff0000', fontStyle: 'bold' }).setOrigin(0.5);
      this.add.text(width / 2, 300, "HALLUCINATION CRITICAL MASS REACHED.\nSERVER MELTDOWN.", { ...textStyle, color: '#ff0000' }).setOrigin(0.5);
      
      const restartBtnShadow = this.add.rectangle(width / 2, 504, 200, 50, 0x111111).setOrigin(0.5);
      const restartBtn = this.add.rectangle(width / 2, 500, 200, 50, 0x8c867a)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          synth.playButtonPress();
          this.scene.start('BriefingScene', { day: 1, money: 0, accuracy: 100 });
        });
      restartBtn.setStrokeStyle(2, 0x555555);
      this.add.text(width / 2, 500, "REBOOT SYSTEM", { ...textStyle, color: '#111111', fontStyle: 'bold' }).setOrigin(0.5);
    } else {
      this.add.text(width / 2, 100, `END OF DAY ${this.day}`, { ...textStyle, fontSize: '32px', fontStyle: 'bold' }).setOrigin(0.5);
      
      this.add.text(width / 2, 250, `CREDITS EARNED: ${this.money}`, textStyle).setOrigin(0.5);
      this.add.text(width / 2, 300, `ACCURACY RATING: ${this.accuracy}%`, textStyle).setOrigin(0.5);

      // Deduct server costs
      const serverCost = 30;
      this.add.text(width / 2, 400, `SERVER MAINTENANCE COST: -${serverCost} CREDITS`, { ...textStyle, color: '#d4c5b0' }).setOrigin(0.5);
      
      this.money -= serverCost;

      if (this.money < 0) {
        this.add.text(width / 2, 450, "BANKRUPT. SERVER SHUTDOWN.", { ...textStyle, color: '#ff0000' }).setOrigin(0.5);
        const restartBtnShadow = this.add.rectangle(width / 2, 604, 200, 50, 0x111111).setOrigin(0.5);
        const restartBtn = this.add.rectangle(width / 2, 600, 200, 50, 0x8c867a)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => {
            synth.playButtonPress();
            this.scene.start('BriefingScene', { day: 1, money: 0, accuracy: 100 });
          });
        restartBtn.setStrokeStyle(2, 0x555555);
        this.add.text(width / 2, 600, "REBOOT SYSTEM", { ...textStyle, color: '#111111', fontStyle: 'bold' }).setOrigin(0.5);
      } else {
        const nextBtnShadow = this.add.rectangle(width / 2, 604, 250, 50, 0x111111).setOrigin(0.5);
        const nextBtn = this.add.rectangle(width / 2, 600, 250, 50, 0x8c867a)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => {
            synth.playButtonPress();
            this.scene.start('BriefingScene', { day: this.day + 1, money: this.money, accuracy: this.accuracy });
          });
        nextBtn.setStrokeStyle(2, 0x555555);
        this.add.text(width / 2, 600, "START NEXT SHIFT", { ...textStyle, color: '#111111', fontStyle: 'bold' }).setOrigin(0.5);
      }
    }

    this.addCRTEffects();
  }

  addCRTEffects() {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x000000, 0.2);
    for (let i = 0; i < this.cameras.main.height; i += 4) {
      graphics.fillRect(0, i, this.cameras.main.width, 1);
    }
    graphics.setDepth(1000);
  }
}
