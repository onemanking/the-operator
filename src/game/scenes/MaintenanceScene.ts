import Phaser from "phaser";
import {
  ShiftSceneData,
  cloneRunState,
  hydrateRunState,
} from "../types/SceneData";
import {
  resolveMaintenanceSceneKey,
  settleMaintenanceState,
} from "./maintenance/runtime";

export class MaintenanceScene extends Phaser.Scene {
  private runState = hydrateRunState();

  constructor() {
    super("MaintenanceScene");
  }

  init(data: ShiftSceneData) {
    this.runState = hydrateRunState(data);
  }

  create() {
    if (!this.runState.gameOver) {
      settleMaintenanceState(this.runState);
    }

    this.scene.start(
      resolveMaintenanceSceneKey(this.runState),
      cloneRunState(this.runState),
    );
  }
}
