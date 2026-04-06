import Phaser from "phaser";
import { GENERATED_TEXTURES } from "./boot/generatedTextures";
import { INITIAL_SHIFT_STATE } from "../types/SceneData";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    // Load retro font or use standard monospace
  }

  create() {
    this.generatePixelArt();
    this.scene.start("BriefingScene", INITIAL_SHIFT_STATE);
  }

  generatePixelArt() {
    GENERATED_TEXTURES.forEach(({ key, config }) => {
      this.textures.generate(key, config);
    });
  }
}
