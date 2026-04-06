import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { BriefingScene } from './scenes/BriefingScene';
import { MainScene } from './scenes/MainScene';
import { MaintenanceScene } from './scenes/MaintenanceScene';

export const initGame = (parent: HTMLElement) => {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: parent,
    width: 1024,
    height: 768,
    backgroundColor: '#050505',
    pixelArt: true,
    scene: [BootScene, BriefingScene, MainScene, MaintenanceScene],
    physics: {
      default: 'arcade',
      arcade: {
        debug: false
      }
    }
  };

  return new Phaser.Game(config);
};
