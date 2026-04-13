import Phaser from "phaser";
import { GENERATED_TEXTURES } from "./boot/generatedTextures";
import { INITIAL_SHIFT_STATE } from "../types/SceneData";
import { createOrientationRunState } from "../data/OrientationData";
import {
  buildTestScenarioRunState,
  getTestScenarioStartScene,
  resolveConfiguredTestScenario,
} from "../data/TestScenarioData";
import { loadPlayerProfile } from "../profile/profileStorage";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    // Load retro font or use standard monospace
  }

  create() {
    this.generatePixelArt();

    const testScenarioId = resolveConfiguredTestScenario();

    if (testScenarioId) {
      this.scene.start(
        getTestScenarioStartScene(testScenarioId),
        buildTestScenarioRunState(testScenarioId),
      );
      return;
    }

    const playerProfile = loadPlayerProfile();

    if (!playerProfile.orientationCompleted) {
      this.scene.start("MainScene", createOrientationRunState());
      return;
    }

    this.scene.start("BriefingScene", INITIAL_SHIFT_STATE);
  }

  generatePixelArt() {
    GENERATED_TEXTURES.forEach(({ key, config }) => {
      this.textures.generate(key, config);
    });
  }
}
