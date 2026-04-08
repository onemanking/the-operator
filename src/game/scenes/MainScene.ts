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
import {
  getPromptToolRuntimeConfig,
  getRunRecoveryProfile,
} from "../data/RunData";
import {
  cloneRunState,
  hydrateRunState,
  RunState,
  ShiftSceneData,
} from "../types/SceneData";
import { getRunPassiveModifiers } from "../data/UpgradeData";
import { sortPromptToolIds } from "./main/config";
import { ChatMessage, isToolId, ToolId } from "./main/types";
import { MainSceneStorageController } from "./main/storageController";
import { MainSceneSessionController } from "./main/sessionController";
import { MainSceneHudController } from "./main/hudController";
import {
  EncounterToolRuntimeSnapshot,
  getProjectedInferenceHeat,
} from "./main/encounterEvaluator";
import {
  clampComputeCharge,
  getComputeDecayPerSecond,
  getComputePulseChargeGain,
  getDedupedNormalizedWords,
  getSearchSelectionHeat,
  isComputeReady,
  normalizeSearchWord,
} from "./main/toolRuntimeHelpers";

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
  private selectedSearchWordsByIndex = new Map<number, string>();
  private computeCharge: number = 0;
  private computeDecayResumesAt: number = 0;
  private projectedHeat: number = 0;

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
    this.selectedSearchWordsByIndex = new Map();
    this.computeCharge = clampComputeCharge(
      this.runState.toolRuntime.computeCharge,
    );
    this.computeDecayResumesAt = 0;
    this.projectedHeat = 0;
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
      getSelectedPromptToolIds: () => this.getActiveToolIdsForEvaluation(),
      getEncounterToolRuntime: () => this.getEncounterToolRuntimeSnapshot(),
      clearSearchSelection: () => {
        this.clearSearchSelection();
      },
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
      onToggleSearchWord: (wordIndex, rawWord) =>
        this.toggleSearchWord(wordIndex, rawWord),
      onPulseCompute: () => this.pulseCompute(),
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
      getSelectedSearchWordIndexes: () =>
        [...this.selectedSearchWordsByIndex.keys()].sort(
          (left, right) => left - right,
        ),
      getUtilityDisplayText: () => {
        const definition = getActiveUtilityDefinition("coolant_purge");
        const charges = getActiveUtilityCharges(this.runState, "coolant_purge");
        return definition
          ? `${definition.name}\nX${charges}`
          : `UTILITY\nX${charges}`;
      },
      getProjectedHeat: () => this.projectedHeat,
      getComputeCharge: () => this.computeCharge,
      getComputeThreshold: () =>
        getPromptToolRuntimeConfig().compute.chargeThreshold,
      isSearchModeSelected: () => this.selectedPromptToolIds.includes("search"),
      isComputeReady: () => isComputeReady(this.computeCharge),
      isComputeLatched: () => this.isComputeLatched(),
      isComputeToolSelected: () =>
        this.selectedPromptToolIds.includes("compute"),
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
    this.hudController.createComputeSection();
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

    this.refreshProjectedHeat();

    this.sessionController.startNextSession();
  }

  update(_time: number, delta: number) {
    this.sessionController.update(delta);

    if (this.computeCharge > 0) {
      if (this.isComputeLatched()) {
        return;
      }

      const nextCharge = clampComputeCharge(
        this.computeCharge -
          getComputeDecayPerSecond(this.computeCharge) * (delta / 1000),
      );

      if (nextCharge !== this.computeCharge) {
        this.setComputeCharge(nextCharge);
        this.events.emit("updateBars");
      }
    }
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

    if (this.selectedPromptToolIds.includes("search") && toolId !== "search") {
      this.clearSearchSelection();
    }

    const nextPromptToolIds = this.selectedPromptToolIds.includes(toolId)
      ? []
      : sortPromptToolIds([toolId]);

    if (nextPromptToolIds.length === 0 && toolId === "search") {
      this.clearSearchSelection();
    }

    this.selectedPromptToolIds = nextPromptToolIds;
    this.runState.loadout.selectedPromptToolIds = [...nextPromptToolIds];
    this.refreshProjectedHeat();
    this.events.emit("updateBars");
  }

  private toggleSearchWord(wordIndex: number, rawWord: string) {
    if (!this.selectedPromptToolIds.includes("search")) {
      return;
    }

    const normalizedWord = normalizeSearchWord(rawWord);

    if (normalizedWord.length === 0) {
      return;
    }

    if (this.selectedSearchWordsByIndex.has(wordIndex)) {
      this.selectedSearchWordsByIndex.delete(wordIndex);
    } else {
      this.selectedSearchWordsByIndex.set(wordIndex, normalizedWord);
    }

    this.refreshProjectedHeat();
    this.events.emit("updateBars");
  }

  private pulseCompute() {
    const computeConfig = getPromptToolRuntimeConfig().compute;
    const nextCharge = clampComputeCharge(
      this.computeCharge + getComputePulseChargeGain(this.computeCharge),
    );

    this.setComputeCharge(nextCharge);

    if (nextCharge >= computeConfig.chargeThreshold) {
      this.computeDecayResumesAt = this.time.now + computeConfig.readyHoldMs;
    }

    this.setHeat(this.heat + computeConfig.tapHeat);
    this.refreshProjectedHeat();
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

  private setComputeCharge(value: number) {
    this.computeCharge = clampComputeCharge(value);
    this.runState.toolRuntime.computeCharge = this.computeCharge;

    if (this.computeCharge <= 0) {
      this.computeDecayResumesAt = 0;
    }

    this.refreshProjectedHeat();
  }

  private clearSearchSelection() {
    if (this.selectedSearchWordsByIndex.size === 0) {
      return;
    }

    this.selectedSearchWordsByIndex.clear();
    this.refreshProjectedHeat();
  }

  private getSelectedSearchWords() {
    return getDedupedNormalizedWords([
      ...this.selectedSearchWordsByIndex.values(),
    ]);
  }

  private getActiveToolIdsForEvaluation() {
    const activeToolIds: ToolId[] = [];

    if (
      this.selectedPromptToolIds.includes("search") &&
      this.getSelectedSearchWords().length > 0
    ) {
      activeToolIds.push("search");
    }

    if (isComputeReady(this.computeCharge)) {
      activeToolIds.push("compute");
    }

    return sortPromptToolIds(activeToolIds);
  }

  private getEncounterToolRuntimeSnapshot(): EncounterToolRuntimeSnapshot {
    const searchSelectedWords = this.getSelectedSearchWords();

    return {
      searchSelectedWords,
      searchWordHeat: getSearchSelectionHeat(searchSelectedWords.length),
      isComputeReady: isComputeReady(this.computeCharge),
    };
  }

  private refreshProjectedHeat() {
    const turn = this.getCurrentTurn();

    if (!turn) {
      this.projectedHeat = 0;
      return;
    }

    this.projectedHeat = getProjectedInferenceHeat(
      turn,
      {
        activeAgentIds: [...this.activeAgents],
        activeSkillIds: [...this.activeSkills],
        activeToolIds: this.getActiveToolIdsForEvaluation(),
      },
      this.getSelectedSearchWords(),
      getRunPassiveModifiers(this.runState),
    );
  }

  private getCurrentTurn() {
    return this.encounters[this.currentEncounterIndex]?.turns[
      this.currentTurnIndex
    ];
  }

  private isComputeLatched() {
    return (
      isComputeReady(this.computeCharge) &&
      this.time.now < this.computeDecayResumesAt
    );
  }
}
