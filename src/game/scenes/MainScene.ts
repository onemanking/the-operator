import Phaser from "phaser";
import { addScanlines } from "./shared/retroUi";
import { synth } from "../utils/SoundSynth";
import {
  EncounterDefinition,
  drawEncounterIdsForDay,
  getEncounterSequenceForDay,
} from "../data/SessionData";
import {
  applyShiftModifiersToEncounters,
  getShiftModifierDefinitions,
} from "../data/ShiftModifierData";
import {
  canUseActiveUtility,
  consumeActiveUtilityCharge,
  getActiveUtilityCharges,
  getActiveUtilityDefinition,
} from "../data/UtilityData";
import { getRunRecoveryProfile } from "../data/RunData";
import {
  cloneRunState,
  hydrateRunState,
  RunState,
  ShiftSceneData,
} from "../types/SceneData";
import { sortPromptToolIds } from "./main/config";
import { ChatMessage, isToolId, ToolId } from "./main/types";
import { MainSceneStorageController } from "./main/storageController";
import { MainSceneSessionController } from "./main/sessionController";
import { MainSceneHudController } from "./main/hudController";

export class MainScene extends Phaser.Scene {
  private runState: RunState = hydrateRunState();
  private day: number = 1;
  private tokens: number = 0;
  private accuracy: number = 100;

  private heat: number = 0;
  private isOverheated: boolean = false;
  private hallucination: number = 0;

  private currentEncounterIndex: number = 0;
  private currentTurnIndex: number = 0;
  private encounters: EncounterDefinition[] = [];
  private chatHistory: ChatMessage[] = [];

  private taskTextObj!: Phaser.GameObjects.Text;
  private chatTextObj!: Phaser.GameObjects.Text;
  private patienceBarFill!: Phaser.GameObjects.Rectangle;
  private heatBarFill!: Phaser.GameObjects.Rectangle;
  private hallucinationBarFill!: Phaser.GameObjects.Rectangle;

  private activeAgents: string[] = [];
  private activeSkills: string[] = [];
  private selectedPromptToolIds: ToolId[] = [];

  private storageController!: MainSceneStorageController;
  private sessionController!: MainSceneSessionController;
  private hudController!: MainSceneHudController;

  private sessionStartTime: number = 0;
  private followUpCount: number = 0;
  private isCommitLocked: boolean = false;
  private heatRecoveryBlockedUntil: number = 0;
  private hallucinationRecoveryBlockedUntil: number = 0;

  constructor() {
    super("MainScene");
  }

  init(data: ShiftSceneData) {
    this.runState = hydrateRunState(data);
    this.day = this.runState.day;
    this.tokens = this.runState.tokens;
    this.accuracy = this.runState.accuracy;
    this.heat = this.runState.heat;
    this.isOverheated = false;
    this.hallucination = this.runState.hallucination;
    this.activeAgents = [...this.runState.loadout.equippedAgentIds];
    this.activeSkills = [...this.runState.loadout.equippedSkillIds];
    this.selectedPromptToolIds = sortPromptToolIds(
      (this.runState.loadout.selectedPromptToolIds ?? []).filter(isToolId),
    );
    this.currentEncounterIndex = this.runState.encounterProgress.encounterIndex;
    this.currentTurnIndex = this.runState.encounterProgress.turnIndex;
    this.chatHistory = [];
    this.isCommitLocked = false;
    this.sessionStartTime = 0;
    this.followUpCount = 0;
    this.heatRecoveryBlockedUntil = 0;
    this.hallucinationRecoveryBlockedUntil = 0;
  }

  create() {
    this.storageController = new MainSceneStorageController(this, {
      getActiveAgents: () => this.activeAgents,
      setActiveAgents: (value) => {
        this.activeAgents = [...value];
        this.runState.loadout.equippedAgentIds = [...value];
      },
      getActiveSkills: () => this.activeSkills,
      setActiveSkills: (value) => {
        this.activeSkills = [...value];
        this.runState.loadout.equippedSkillIds = [...value];
      },
      getAgentCapacity: () => this.runState.loadout.agentCapacity,
      getSkillCapacity: () => this.runState.loadout.skillCapacity,
    });

    this.sessionController = new MainSceneSessionController(this, {
      getRunState: () => cloneRunState(this.runState),
      getDay: () => this.day,
      getTokens: () => this.tokens,
      setTokens: (value) => {
        this.tokens = value;
        this.runState.tokens = value;
      },
      getAccuracy: () => this.accuracy,
      setAccuracy: (value) => {
        this.accuracy = value;
        this.runState.accuracy = value;
      },
      getHeat: () => this.heat,
      setHeat: (value) => {
        this.setHeat(value);
      },
      getHallucination: () => this.hallucination,
      setHallucination: (value) => {
        this.setHallucination(value);
      },
      isOverheated: () => this.isOverheated,
      setIsOverheated: (value) => {
        this.isOverheated = value;
      },
      getCurrentEncounterIndex: () => this.currentEncounterIndex,
      setCurrentEncounterIndex: (value) => {
        this.currentEncounterIndex = value;
        this.runState.encounterProgress.encounterIndex = value;
      },
      getCurrentTurnIndex: () => this.currentTurnIndex,
      setCurrentTurnIndex: (value) => {
        this.currentTurnIndex = value;
        this.runState.encounterProgress.turnIndex = value;
      },
      getEncounters: () => this.encounters,
      getChatHistory: () => this.chatHistory,
      setChatHistory: (value) => {
        this.chatHistory = value;
      },
      getTaskTextObj: () => this.taskTextObj,
      getChatTextObj: () => this.chatTextObj,
      getPatienceBarFill: () => this.patienceBarFill,
      getActiveAgents: () => this.activeAgents,
      getActiveSkills: () => this.activeSkills,
      getSelectedPromptToolIds: () => this.selectedPromptToolIds,
      syncStorageUi: () => this.storageController.syncUi(),
      isCommitLocked: () => this.isCommitLocked,
      setIsCommitLocked: (value) => {
        this.isCommitLocked = value;
      },
      getSessionStartTime: () => this.sessionStartTime,
      setSessionStartTime: (value) => {
        this.sessionStartTime = value;
      },
      getFollowUpCount: () => this.followUpCount,
      setFollowUpCount: (value) => {
        this.followUpCount = value;
      },
      getHeatRecoveryBlockedUntil: () => this.heatRecoveryBlockedUntil,
      getHallucinationRecoveryBlockedUntil: () =>
        this.hallucinationRecoveryBlockedUntil,
    });

    this.hudController = new MainSceneHudController(this, {
      onInference: () => this.sessionController.handleInference(),
      onRefuse: () => this.sessionController.handleRefuse(),
      onUseUtility: () => this.handleUtilityUse(),
      onTogglePromptTool: (toolId) => this.togglePromptTool(toolId),
      setTaskTextObj: (value) => {
        this.taskTextObj = value;
      },
      setChatTextObj: (value) => {
        this.chatTextObj = value;
      },
      setPatienceBarFill: (value) => {
        this.patienceBarFill = value;
      },
      setHeatBarFill: (value) => {
        this.heatBarFill = value;
      },
      setHallucinationBarFill: (value) => {
        this.hallucinationBarFill = value;
      },
      getShiftModifierLabel: () => {
        const modifiers = getShiftModifierDefinitions(
          this.runState.shiftModifierIds,
        );
        return modifiers[0]?.hudLabel ?? null;
      },
      getUnlockedPromptToolIds: () => {
        return this.runState.loadout.unlockedPromptToolIds.filter(isToolId);
      },
      getSelectedPromptToolIds: () => this.selectedPromptToolIds,
      getUtilityDisplayText: () => {
        const definition = getActiveUtilityDefinition("coolant_purge");
        const charges = getActiveUtilityCharges(this.runState, "coolant_purge");
        return definition
          ? `${definition.name}\nX${charges}`
          : `UTILITY\nX${charges}`;
      },
      canUseUtility: () => {
        return (
          this.heat > 0 && canUseActiveUtility(this.runState, "coolant_purge")
        );
      },
      getHeat: () => this.heat,
      getHallucination: () => this.hallucination,
      isOverheated: () => this.isOverheated,
    });

    this.add.rectangle(0, 0, 1024, 768, 0x1a1813).setOrigin(0);

    this.hudController.createLayout();
    this.hudController.createPromptToolGrid();
    this.storageController.createContextAssemblyArea();
    this.storageController.createStorageRack();
    this.hudController.createActionButtons();
    this.hudController.createUtilitySection();
    this.storageController.bindDragHandlers();
    this.hudController.createStatusBars();
    this.addCRTEffects();

    if (this.runState.shiftEncounterIds.length === 0) {
      this.runState.shiftEncounterIds = drawEncounterIdsForDay(this.day);
    }

    this.encounters = applyShiftModifiersToEncounters(
      getEncounterSequenceForDay(this.day, this.runState.shiftEncounterIds),
      this.runState.shiftModifierIds,
    );

    this.sessionController.startNextSession();
  }

  update(_time: number, delta: number) {
    this.sessionController.update(delta);
  }

  private handleUtilityUse() {
    const definition = getActiveUtilityDefinition("coolant_purge");
    const recoveryProfile = getRunRecoveryProfile();

    if (!definition || this.heat <= 0) {
      synth.playError();
      return;
    }

    if (!consumeActiveUtilityCharge(this.runState, definition.id)) {
      synth.playError();
      return;
    }

    this.setHeat(this.heat - definition.heatReduction);

    if (
      this.isOverheated &&
      this.heat < recoveryProfile.overheatClearThreshold
    ) {
      this.isOverheated = false;
      this.sessionController.postSystemMessage(
        `UTILITY: ${definition.name} STABILIZED THERMALS.`,
      );
    } else {
      this.sessionController.postSystemMessage(
        `UTILITY: ${definition.name} VENTED ${definition.heatReduction} HEAT.`,
      );
    }

    this.events.emit("updateBars");
  }

  private togglePromptTool(toolId: ToolId) {
    if (!this.runState.loadout.unlockedPromptToolIds.includes(toolId)) {
      synth.playError();
      return;
    }

    const nextPromptToolIds = this.selectedPromptToolIds.includes(toolId)
      ? []
      : sortPromptToolIds([toolId]);

    this.selectedPromptToolIds = nextPromptToolIds;
    this.runState.loadout.selectedPromptToolIds = [...nextPromptToolIds];
    this.events.emit("updateBars");
  }

  addCRTEffects() {
    addScanlines(this);
  }

  private setHeat(value: number) {
    const nextHeat = Phaser.Math.Clamp(value, 0, 100);

    if (nextHeat > this.heat) {
      this.heatRecoveryBlockedUntil =
        this.time.now + getRunRecoveryProfile().heatRecoveryDelayMs;
    }

    this.heat = nextHeat;
    this.runState.heat = nextHeat;
  }

  private setHallucination(value: number) {
    const nextHallucination = Phaser.Math.Clamp(value, 0, 100);

    if (nextHallucination > this.hallucination) {
      this.hallucinationRecoveryBlockedUntil =
        this.time.now + getRunRecoveryProfile().hallucinationRecoveryDelayMs;
    }

    this.hallucination = nextHallucination;
    this.runState.hallucination = nextHallucination;
  }
}
