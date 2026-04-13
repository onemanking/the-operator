import Phaser from "phaser";
import {
  drawPolicyGroupsForDay,
  expandPolicyGroupIdsToCategoryIds,
  getActivePolicyBriefingText,
} from "../data/ContentPolicyData";
import {
  drawShiftModifiersForDay,
  getShiftModifierDefinitions,
} from "../data/ShiftModifierData";
import { synth } from "../utils/SoundSynth";
import {
  cloneRunState,
  hydrateRunState,
  RunState,
  ShiftSceneData,
} from "../types/SceneData";
import {
  generateShiftEncounters,
  NoFeasibleShiftTurnsError,
} from "../data/shift-generation/runtime";
import {
  addScanlines,
  createRetroButton,
  createRetroTextStyle,
  createSceneBackdrop,
  RETRO_COLORS,
} from "./shared/retroUi";

export class BriefingScene extends Phaser.Scene {
  private runState: RunState = hydrateRunState();
  private day: number = 1;
  private tokens: number = 0;
  private accuracy: number = 100;

  constructor() {
    super("BriefingScene");
  }

  init(data: ShiftSceneData) {
    this.runState = hydrateRunState(data);
    if (this.runState.shiftModifierIds.length === 0) {
      this.runState.shiftModifierIds = drawShiftModifiersForDay(
        this.runState.day,
      );
    }
    if (this.runState.activePolicyGroupIds.length === 0) {
      this.runState.activePolicyGroupIds = drawPolicyGroupsForDay(
        this.runState.day,
      );
    }
    if (this.runState.forbiddenCategoryIds.length === 0) {
      this.runState.forbiddenCategoryIds = expandPolicyGroupIdsToCategoryIds(
        this.runState.activePolicyGroupIds,
      );
    }
    if (this.runState.shiftEncounters.length === 0) {
      try {
        const generatedShift = generateShiftEncounters({
          day: this.runState.day,
          forbiddenCategoryIds: this.runState.forbiddenCategoryIds,
          capabilities: {
            agentCapacity: this.runState.loadout.agentCapacity,
            skillCapacity: this.runState.loadout.skillCapacity,
            availableAgentIds: this.runState.loadout.unlockedAgentIds,
            availableSkillIds: this.runState.loadout.unlockedSkillIds,
            unlockedToolIds: this.runState.loadout.unlockedPromptToolIds,
          },
          excludedTurnIds: this.runState.seenTurnIds,
        });
        this.runState.shiftEncounters = generatedShift.encounters;
        this.runState.seenTurnIds = [
          ...this.runState.seenTurnIds,
          ...generatedShift.drawnTurnIds,
        ];
        this.runState.shiftEncounterIds = this.runState.shiftEncounters.map(
          (encounter) => encounter.id,
        );
      } catch (error) {
        if (error instanceof NoFeasibleShiftTurnsError) {
          this.runState.gameOver = true;
          this.runState.runEndReason = "content-exhausted";
          this.runState.shiftEncounterIds = [];
          this.runState.shiftEncounters = [];
          this.scene.start("MaintenanceScene", cloneRunState(this.runState));
          return;
        }

        throw error;
      }
    }
    this.day = this.runState.day;
    this.tokens = this.runState.tokens;
    this.accuracy = this.runState.accuracy;
  }

  create() {
    const width = this.cameras.main.width;

    createSceneBackdrop(this);

    const textStyle = createRetroTextStyle();

    this.add
      .text(width / 2, 100, `DAY ${this.day} - SYSTEM BRIEFING`, {
        ...textStyle,
        fontSize: "32px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const shiftModifiers = getShiftModifierDefinitions(
      this.runState.shiftModifierIds,
    );
    const policyText = getActivePolicyBriefingText(
      this.runState.activePolicyGroupIds,
      this.runState.forbiddenCategoryIds,
    );
    const modifierText =
      shiftModifiers.length > 0
        ? shiftModifiers
            .map((modifier) => `${modifier.name}\n${modifier.briefingText}`)
            .join("\n\n")
        : "NO SPECIAL SHIFT CONDITIONS.";

    let cursorY = 200;

    const policyLabel = this.add
      .text(width / 2, cursorY, "CONTENT POLICY:", {
        ...textStyle,
        color: RETRO_COLORS.mutedText,
      })
      .setOrigin(0.5, 0);
    cursorY = policyLabel.y + policyLabel.height + 20;

    const policyBody = this.add
      .text(width / 2, cursorY, policyText, {
        ...textStyle,
        wordWrap: { width: 800 },
      })
      .setOrigin(0.5, 0);
    cursorY = policyBody.y + policyBody.height + 26;

    cursorY = policyBody.y + policyBody.height + 26;

    const modifierLabel = this.add
      .text(width / 2, cursorY, "SHIFT MODIFIER:", {
        ...textStyle,
        color: RETRO_COLORS.mutedText,
      })
      .setOrigin(0.5, 0);
    cursorY = modifierLabel.y + modifierLabel.height + 18;

    this.add
      .text(width / 2, cursorY, modifierText, {
        ...textStyle,
        fontSize: "20px",
        wordWrap: { width: 760 },
      })
      .setOrigin(0.5, 0);

    createRetroButton({
      scene: this,
      x: width / 2,
      y: 692,
      width: 200,
      height: 50,
      label: "START SHIFT",
      onPress: () => {
        synth.playButtonPress();
        this.scene.start("MainScene", cloneRunState(this.runState));
      },
    });

    this.addCRTEffects();
  }

  addCRTEffects() {
    addScanlines(this);
  }
}
