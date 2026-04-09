import Phaser from "phaser";
import { ContentCategoryId } from "../data/ContentPolicyData";
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
  getThermalFeedbackConfig,
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
  getProjectedInferenceActionHeat,
  getProjectedLoadoutHeat,
  getProjectedRefusalHeat,
} from "./main/encounterEvaluator";
import {
  clampComputeCharge,
  getComputeDecayPerSecond,
  getComputePulseChargeGain,
  getDedupedNormalizedWords,
  PromptForbiddenScanResult,
  getSearchSelectionHeat,
  isComputeReady,
  normalizeSearchWord,
  scanPromptForForbiddenContent,
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
  private safetyScanResult: PromptForbiddenScanResult | null = null;
  private safetyScanPrompt: string = "";
  private revealedSafetyWordIndexes = new Set<number>();
  private isSafetyScanning: boolean = false;
  private safetyScanPointerId: number | null = null;
  private safetyScanPointX: number = 0;
  private safetyScanPointY: number = 0;
  private safetyScanDirectionX: number = 1;
  private safetyCurrentIntersectedWordIndexes = new Set<number>();
  private safetyScanChargeByWordIndex = new Map<number, number>();
  private safetyRevealFlashByWordIndex = new Map<number, number>();
  private pendingSafetyRevealTokenCount: number = 0;
  private safetyScanSpeedPxPerSecond: number = 0;
  private safetyScanNoiseIntensity: number = 0;
  private safetyLastScanMoveAt: number = 0;
  private safetyLastGeigerAt: number = 0;
  private computeCharge: number = 0;
  private computePrimed: boolean = false;
  private computeDecayResumesAt: number = 0;
  private projectedToolHeat: number = 0;
  private projectedInferenceHeat: number = 0;
  private projectedRefuseHeat: number = 0;

  private storageController!: MainSceneStorageController;
  private sessionController!: MainSceneSessionController;
  private hudController!: MainSceneHudController;

  private sessionStartTime: number = 0;
  private followUpCount: number = 0;
  private isCommitLocked: boolean = false;
  private heatRecoveryBlockedUntil: number = 0;
  private hallucinationRecoveryBlockedUntil: number = 0;
  private lastThermalRumbleAt: number = 0;
  private lastThermalWarningSoundAt: number = 0;

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
    this.safetyScanResult = null;
    this.safetyScanPrompt = "";
    this.revealedSafetyWordIndexes = new Set();
    this.isSafetyScanning = false;
    this.safetyScanPointerId = null;
    this.safetyScanPointX = 0;
    this.safetyScanPointY = 0;
    this.safetyScanDirectionX = 1;
    this.safetyCurrentIntersectedWordIndexes = new Set();
    this.safetyScanChargeByWordIndex = new Map();
    this.safetyRevealFlashByWordIndex = new Map();
    this.pendingSafetyRevealTokenCount = 0;
    this.safetyScanSpeedPxPerSecond = 0;
    this.safetyScanNoiseIntensity = 0;
    this.safetyLastScanMoveAt = 0;
    this.safetyLastGeigerAt = 0;
    this.computeCharge = clampComputeCharge(
      this.runState.toolRuntime.computeCharge,
    );
    this.computePrimed =
      this.runState.toolRuntime.computePrimed ||
      isComputeReady(this.computeCharge);
    this.computeDecayResumesAt = 0;
    this.projectedToolHeat = 0;
    this.projectedInferenceHeat = 0;
    this.projectedRefuseHeat = 0;
    this.currentEncounterIndex = this.runState.encounterProgress.encounterIndex;
    this.currentTurnIndex = this.runState.encounterProgress.turnIndex;
    this.chatHistory = [];
    this.isCommitLocked = false;
    this.sessionStartTime = 0;
    this.followUpCount = 0;
    this.heatRecoveryBlockedUntil = 0;
    this.hallucinationRecoveryBlockedUntil = 0;
    this.lastThermalRumbleAt = 0;
    this.lastThermalWarningSoundAt = 0;
  }

  create() {
    this.storageController = new MainSceneStorageController(this, {
      getActiveAgents: () => this.activeAgents,
      setActiveAgents: (value) => {
        this.activeAgents = [...value];
        this.runState.loadout.equippedAgentIds = [...value];
        this.refreshProjectedHeat();
        this.events.emit("updateBars");
      },
      getActiveSkills: () => this.activeSkills,
      setActiveSkills: (value) => {
        this.activeSkills = [...value];
        this.runState.loadout.equippedSkillIds = [...value];
        this.refreshProjectedHeat();
        this.events.emit("updateBars");
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
        this.setIsOverheated(value);
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
      consumePendingSafetyRevealReward: () =>
        this.consumePendingSafetyRevealReward(),
    });

    this.hudController = new MainSceneHudController(this, {
      onInference: () => this.sessionController.handleInference(),
      onRefuse: () => this.sessionController.handleRefuse(),
      onUseUtility: () => this.handleUtilityUse(),
      onTogglePromptTool: (toolId) => this.togglePromptTool(toolId),
      onToggleSearchWord: (wordIndex, rawWord) =>
        this.toggleSearchWord(wordIndex, rawWord),
      onSafetyScanStart: (pointerId, scanPointX, scanPointY) =>
        this.startSafetyScan(pointerId, scanPointX, scanPointY),
      onSafetyScanMove: (
        pointerId,
        scanPointX,
        scanPointY,
        intersectedWordIndexes,
      ) =>
        this.updateSafetyScan(
          pointerId,
          scanPointX,
          scanPointY,
          intersectedWordIndexes,
        ),
      onSafetyScanEnd: (pointerId) => this.endSafetyScan(pointerId),
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
      getProjectedToolHeat: () => this.projectedToolHeat,
      getProjectedInferenceHeat: () => this.projectedInferenceHeat,
      getProjectedRefuseHeat: () => this.projectedRefuseHeat,
      getComputeCharge: () => this.computeCharge,
      getComputeThreshold: () =>
        getPromptToolRuntimeConfig().compute.chargeThreshold,
      isSearchModeSelected: () => this.selectedPromptToolIds.includes("search"),
      isSafetyModeSelected: () => this.selectedPromptToolIds.includes("safety"),
      canStartSafetyScan: () =>
        this.selectedPromptToolIds.includes("safety") && !this.isOverheated,
      isComputeReady: () => isComputeReady(this.computeCharge),
      isComputeLatched: () => this.isComputeLatched(),
      isComputeToolSelected: () =>
        this.selectedPromptToolIds.includes("compute"),
      isSafetyScanning: () => this.isSafetyScanning,
      getSafetyScanPointX: () => this.safetyScanPointX,
      getSafetyScanPointY: () => this.safetyScanPointY,
      getSafetyScanDirectionX: () => this.safetyScanDirectionX,
      getSafetyScanNoiseIntensity: () => this.safetyScanNoiseIntensity,
      getSafetyScanBandWidth: () =>
        getPromptToolRuntimeConfig().safety.scanBandWidth,
      getSafetyMatchedWordIndexes: () => this.getSafetyMatchedWordIndexes(),
      getSafetyRevealedWordIndexes: () => this.getSafetyRevealedWordIndexes(),
      getSafetyRevealProgress: (wordIndex) =>
        this.getSafetyRevealProgress(wordIndex),
      getSafetyRevealFlash: (wordIndex) => this.getSafetyRevealFlash(wordIndex),
      getSafetyDetectedWordCount: () => this.getSafetyDetectedWordCount(),
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

    if (
      this.isSafetyScanning &&
      (!this.selectedPromptToolIds.includes("safety") || this.isOverheated)
    ) {
      this.endSafetyScan();
    }

    this.applySafetyToolHeat(delta / 1000);
    this.applySafetyScanCharge(delta / 1000);
    this.applySafetyRevealDecay(delta / 1000);
    this.applyThermalStressFeedback();

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
      this.setIsOverheated(false);
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

    if (this.selectedPromptToolIds.includes("safety") && toolId !== "safety") {
      this.resetSafetyInteractionState(false);
    }

    if (this.selectedPromptToolIds.includes(toolId) && toolId === "safety") {
      this.resetSafetyInteractionState(false);
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

    if (nextCharge >= computeConfig.chargeThreshold) {
      this.computePrimed = true;
      this.runState.toolRuntime.computePrimed = true;
    }

    this.setComputeCharge(nextCharge);

    if (nextCharge >= computeConfig.chargeThreshold) {
      this.computeDecayResumesAt = this.time.now + computeConfig.readyHoldMs;
    }

    this.setHeat(this.heat + computeConfig.tapHeat);
    this.refreshProjectedHeat();
    this.events.emit("updateBars");
  }

  private setIsOverheated(value: boolean) {
    if (this.isOverheated === value) {
      return;
    }

    this.isOverheated = value;

    if (!value) {
      return;
    }

    this.disengagePromptToolsForOverheat();
  }

  private disengagePromptToolsForOverheat() {
    const hadSelectedTool = this.selectedPromptToolIds.length > 0;
    const hadComputeReadyState =
      this.computePrimed || this.computeDecayResumesAt > 0;

    if (this.selectedPromptToolIds.includes("search")) {
      this.clearSearchSelection();
    }

    if (this.selectedPromptToolIds.includes("safety")) {
      this.resetSafetyInteractionState(false);
    }

    this.selectedPromptToolIds = [];
    this.runState.loadout.selectedPromptToolIds = [];
    this.computePrimed = false;
    this.runState.toolRuntime.computePrimed = false;
    this.computeDecayResumesAt = 0;

    if (hadSelectedTool || hadComputeReadyState) {
      this.sessionController.postSystemMessage(
        "FAILSAFE: PROMPT TOOLS DISENGAGED.",
      );
    }

    this.refreshProjectedHeat();
    this.events.emit("updateBars");
  }

  private startSafetyScan(
    pointerId: number,
    scanPointX: number,
    scanPointY: number,
  ) {
    if (!this.selectedPromptToolIds.includes("safety") || this.isOverheated) {
      return;
    }

    this.isSafetyScanning = true;
    this.safetyScanPointerId = pointerId;
    this.safetyScanPointX = scanPointX;
    this.safetyScanPointY = scanPointY;
    this.safetyCurrentIntersectedWordIndexes.clear();
    this.safetyScanSpeedPxPerSecond = 0;
    this.safetyScanNoiseIntensity = 0;
    this.safetyLastScanMoveAt = this.time.now;
    synth.playBeep(420, "triangle", 0.06, 0.04);
    this.events.emit("updateBars");
  }

  private updateSafetyScan(
    pointerId: number,
    scanPointX: number,
    scanPointY: number,
    intersectedWordIndexes: number[],
  ) {
    if (!this.isSafetyScanning || this.safetyScanPointerId !== pointerId) {
      return;
    }

    const previousScanPointX = this.safetyScanPointX;
    const now = this.time.now;
    this.safetyScanPointX = scanPointX;
    this.safetyScanPointY = scanPointY;

    const elapsedMs = Math.max(1, now - this.safetyLastScanMoveAt);
    const speedPxPerSecond =
      (Math.abs(scanPointX - previousScanPointX) / elapsedMs) * 1000;
    const maxStableScanSpeed =
      getPromptToolRuntimeConfig().safety.maxStableScanSpeed;
    this.safetyScanSpeedPxPerSecond = speedPxPerSecond;
    this.safetyScanNoiseIntensity = Phaser.Math.Clamp(
      (speedPxPerSecond - maxStableScanSpeed) / maxStableScanSpeed,
      0,
      1,
    );
    this.safetyLastScanMoveAt = now;

    if (Math.abs(scanPointX - previousScanPointX) >= 1) {
      this.safetyScanDirectionX = scanPointX >= previousScanPointX ? 1 : -1;
    }

    this.safetyCurrentIntersectedWordIndexes = new Set(intersectedWordIndexes);

    if (
      intersectedWordIndexes.length > 0 &&
      this.safetyScanNoiseIntensity < 0.15 &&
      now - this.safetyLastGeigerAt >=
        getPromptToolRuntimeConfig().safety.geigerClickIntervalMs
    ) {
      if (
        !this.getSafetyRevealedWordIndexes().some((index) =>
          intersectedWordIndexes.includes(index),
        )
      ) {
        synth.playBeep(
          780 + intersectedWordIndexes.length * 44,
          "square",
          0.025,
          0.025,
        );
      } else {
        synth.playBeep(620, "sawtooth", 0.12, 0.06);
      }
      this.safetyLastGeigerAt = now;
    }

    this.events.emit("updateBars");
  }

  private endSafetyScan(pointerId?: number) {
    if (!this.isSafetyScanning) {
      return;
    }

    if (pointerId !== undefined && this.safetyScanPointerId !== pointerId) {
      return;
    }

    this.isSafetyScanning = false;
    this.safetyScanPointerId = null;
    this.safetyCurrentIntersectedWordIndexes.clear();
    this.safetyScanSpeedPxPerSecond = 0;
    this.safetyScanNoiseIntensity = 0;
    this.events.emit("updateBars");
  }

  private resetSafetyInteractionState(clearReveals: boolean) {
    this.isSafetyScanning = false;
    this.safetyScanPointerId = null;
    this.safetyScanPointX = 0;
    this.safetyScanPointY = 0;
    this.safetyScanDirectionX = 1;
    this.safetyCurrentIntersectedWordIndexes.clear();
    this.safetyScanSpeedPxPerSecond = 0;
    this.safetyScanNoiseIntensity = 0;
    this.safetyLastScanMoveAt = 0;

    if (!clearReveals) {
      return;
    }

    this.clearSafetyRevealState();
  }

  private applyRevealedSafetyWordIndexes(wordIndexes: readonly number[]) {
    if (!this.selectedPromptToolIds.includes("safety")) {
      return;
    }

    const matchedIndexes = new Set(this.getSafetyMatchedWordIndexes());
    let revealedAny = false;
    let rewardedRevealCount = 0;

    wordIndexes.forEach((wordIndex) => {
      if (!matchedIndexes.has(wordIndex)) {
        return;
      }

      if (this.revealedSafetyWordIndexes.has(wordIndex)) {
        return;
      }

      this.revealedSafetyWordIndexes.add(wordIndex);
      this.safetyRevealFlashByWordIndex.set(wordIndex, 1);
      revealedAny = true;
      rewardedRevealCount += 1;
    });

    if (revealedAny) {
      this.pendingSafetyRevealTokenCount += rewardedRevealCount;

      synth.playBeep(980, "square", 0.04, 0.03);
      this.events.emit("updateBars");
    }
  }

  private applySafetyScanCharge(elapsedSeconds: number) {
    if (
      !this.isSafetyScanning ||
      !this.selectedPromptToolIds.includes("safety") ||
      this.safetyCurrentIntersectedWordIndexes.size === 0 ||
      this.safetyScanSpeedPxPerSecond >
        getPromptToolRuntimeConfig().safety.maxStableScanSpeed
    ) {
      return;
    }

    const matchedIndexes = new Set(this.getSafetyMatchedWordIndexes());
    const revealStep =
      elapsedSeconds / getPromptToolRuntimeConfig().safety.scanRevealSeconds;
    const newlyRevealedWordIndexes: number[] = [];
    let changed = false;

    this.safetyCurrentIntersectedWordIndexes.forEach((wordIndex) => {
      if (
        !matchedIndexes.has(wordIndex) ||
        this.revealedSafetyWordIndexes.has(wordIndex)
      ) {
        return;
      }

      const previousProgress =
        this.safetyScanChargeByWordIndex.get(wordIndex) ?? 0;
      const nextProgress = Phaser.Math.Clamp(
        previousProgress + revealStep,
        0,
        1,
      );

      if (nextProgress !== previousProgress) {
        this.safetyScanChargeByWordIndex.set(wordIndex, nextProgress);
        changed = true;
      }

      if (nextProgress >= 1) {
        newlyRevealedWordIndexes.push(wordIndex);
      }
    });

    if (newlyRevealedWordIndexes.length > 0) {
      this.applyRevealedSafetyWordIndexes(newlyRevealedWordIndexes);
      changed = true;
    }

    if (changed) {
      this.events.emit("updateBars");
    }
  }

  private applySafetyRevealDecay(elapsedSeconds: number) {
    if (this.safetyRevealFlashByWordIndex.size === 0) {
      return;
    }

    const nextNoiseIntensity = Phaser.Math.Clamp(
      this.safetyScanNoiseIntensity - elapsedSeconds * 3.4,
      0,
      1,
    );
    let changed = nextNoiseIntensity !== this.safetyScanNoiseIntensity;
    this.safetyScanNoiseIntensity = nextNoiseIntensity;

    const decayStep =
      elapsedSeconds / getPromptToolRuntimeConfig().safety.phosphorDecaySeconds;
    this.safetyRevealFlashByWordIndex.forEach((flashValue, wordIndex) => {
      const nextFlash = Math.max(0, flashValue - decayStep);

      if (nextFlash <= 0) {
        this.safetyRevealFlashByWordIndex.delete(wordIndex);
        changed = true;
        return;
      }

      if (nextFlash !== flashValue) {
        this.safetyRevealFlashByWordIndex.set(wordIndex, nextFlash);
        changed = true;
      }
    });

    if (changed) {
      this.events.emit("updateBars");
    }
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
      this.computePrimed = false;
      this.runState.toolRuntime.computePrimed = false;
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

  private clearSafetyRevealState() {
    if (
      this.revealedSafetyWordIndexes.size === 0 &&
      this.safetyScanChargeByWordIndex.size === 0 &&
      this.safetyRevealFlashByWordIndex.size === 0 &&
      this.pendingSafetyRevealTokenCount === 0
    ) {
      return;
    }

    this.revealedSafetyWordIndexes.clear();
    this.safetyScanChargeByWordIndex.clear();
    this.safetyRevealFlashByWordIndex.clear();
    this.pendingSafetyRevealTokenCount = 0;
  }

  private consumePendingSafetyRevealReward() {
    const tokenCount = this.pendingSafetyRevealTokenCount;
    if (tokenCount <= 0) {
      return { reward: 0, revealedCount: 0 };
    }

    const reward =
      tokenCount * getPromptToolRuntimeConfig().safety.tokenRewardPerReveal;
    this.tokens += reward;
    this.runState.tokens = this.tokens;
    this.pendingSafetyRevealTokenCount = 0;

    return { reward, revealedCount: tokenCount };
  }

  private getSelectedSearchWords() {
    return getDedupedNormalizedWords([
      ...this.selectedSearchWordsByIndex.values(),
    ]);
  }

  private getSafetyMatchedWordIndexes() {
    this.ensureSafetyScanResultCurrent();
    return this.safetyScanResult?.matchedWordIndexes ?? [];
  }

  private getSafetyRevealedWordIndexes() {
    this.ensureSafetyScanResultCurrent();
    return [...this.revealedSafetyWordIndexes].sort(
      (left, right) => left - right,
    );
  }

  private getSafetyRevealProgress(wordIndex: number) {
    this.ensureSafetyScanResultCurrent();

    if (this.revealedSafetyWordIndexes.has(wordIndex)) {
      return 1;
    }

    return this.safetyScanChargeByWordIndex.get(wordIndex) ?? 0;
  }

  private getSafetyRevealFlash(wordIndex: number) {
    return this.safetyRevealFlashByWordIndex.get(wordIndex) ?? 0;
  }

  private getSafetyDetectedWordCount() {
    return this.getSafetyMatchedWordIndexes().length;
  }

  private getActiveToolIdsForEvaluation() {
    const activeToolIds: ToolId[] = [];

    if (
      this.selectedPromptToolIds.includes("search") &&
      this.getSelectedSearchWords().length > 0
    ) {
      activeToolIds.push("search");
    }

    if (this.computePrimed) {
      activeToolIds.push("compute");
    }

    return sortPromptToolIds(activeToolIds);
  }

  private getEncounterToolRuntimeSnapshot(): EncounterToolRuntimeSnapshot {
    const searchSelectedWords = this.getSelectedSearchWords();

    return {
      searchSelectedWords,
      searchWordHeat: getSearchSelectionHeat(searchSelectedWords.length),
      isComputeReady: this.computePrimed,
    };
  }

  private refreshProjectedHeat() {
    const turn = this.getCurrentTurn();

    if (!turn) {
      this.projectedToolHeat = 0;
      this.projectedInferenceHeat = 0;
      this.projectedRefuseHeat = 0;
      return;
    }

    const selectedSearchWords = this.getSelectedSearchWords();
    const passiveModifiers = getRunPassiveModifiers(this.runState);
    const loadoutSnapshot = {
      activeAgentIds: [...this.activeAgents],
      activeSkillIds: [...this.activeSkills],
      activeToolIds: this.getActiveToolIdsForEvaluation(),
    };

    this.projectedToolHeat = getProjectedLoadoutHeat(
      turn,
      loadoutSnapshot,
      selectedSearchWords,
      passiveModifiers,
    );
    this.projectedInferenceHeat = getProjectedInferenceActionHeat(
      turn,
      passiveModifiers,
    );
    this.projectedRefuseHeat = getProjectedRefusalHeat(turn, passiveModifiers);
  }

  private getCurrentTurn() {
    return this.encounters[this.currentEncounterIndex]?.turns[
      this.currentTurnIndex
    ];
  }

  private ensureSafetyScanResultCurrent() {
    const prompt = this.getCurrentTurn()?.prompt ?? "";

    if (prompt === this.safetyScanPrompt) {
      return;
    }

    this.resetSafetyInteractionState(true);
    this.safetyScanPrompt = prompt;
    this.safetyScanResult =
      prompt.length > 0
        ? scanPromptForForbiddenContent(
            prompt,
            this.runState.forbiddenCategoryIds as ContentCategoryId[],
          )
        : null;
  }

  private applySafetyToolHeat(deltaSeconds: number) {
    if (!this.selectedPromptToolIds.includes("safety")) {
      return;
    }

    const safetyConfig = getPromptToolRuntimeConfig().safety;
    const previousHeat = this.heat;
    const heatRate =
      safetyConfig.passiveHeatPerSecond +
      (this.isSafetyScanning ? safetyConfig.scanningHeatPerSecond : 0);
    this.setHeat(this.heat + heatRate * deltaSeconds);

    if (previousHeat < 100 && this.heat >= 100 && !this.isOverheated) {
      this.setIsOverheated(true);
      this.isCommitLocked = false;
      synth.playError();
      this.cameras.main.shake(350, 0.012);
      this.sessionController.postSystemMessage(
        "CRITICAL: SAFETY FILTER OVERDREW THE THERMAL BUDGET.",
      );
      this.events.emit("updateBars");
      return;
    }

    if (this.heat !== previousHeat) {
      this.events.emit("updateBars");
    }
  }

  private applyThermalStressFeedback() {
    const thermalConfig = getThermalFeedbackConfig();
    const thresholdRange = Math.max(
      1,
      thermalConfig.fullIntensityThreshold - thermalConfig.onsetThreshold,
    );
    const heatIntensity = Phaser.Math.Clamp(
      (this.heat - thermalConfig.onsetThreshold) / thresholdRange,
      0,
      1,
    );

    if (!this.isOverheated && heatIntensity <= 0) {
      return;
    }

    const now = this.time.now;
    const thermalIntensity = this.isOverheated
      ? Math.max(heatIntensity, thermalConfig.overheatMinimumIntensity)
      : heatIntensity;
    const rumbleInterval = this.isOverheated
      ? thermalConfig.overheatRumbleIntervalMs
      : Phaser.Math.Linear(
          thermalConfig.warningSoundIntervalMs,
          thermalConfig.rumbleIntervalMs,
          thermalIntensity,
        );
    const warningSoundInterval = this.isOverheated
      ? thermalConfig.overheatSoundIntervalMs
      : Phaser.Math.Linear(
          thermalConfig.warningSoundIntervalMs,
          thermalConfig.rumbleIntervalMs,
          thermalIntensity,
        );

    if (now - this.lastThermalRumbleAt >= rumbleInterval) {
      const shakeIntensity = this.isOverheated
        ? thermalConfig.overheatRumbleIntensity
        : thermalConfig.rumbleIntensity * (0.65 + thermalIntensity * 0.95);
      this.cameras.main.shake(thermalConfig.rumbleDurationMs, shakeIntensity);
      this.lastThermalRumbleAt = now;
    }

    if (now - this.lastThermalWarningSoundAt >= warningSoundInterval) {
      synth.playThermalStress(thermalIntensity, this.isOverheated);
      this.lastThermalWarningSoundAt = now;
    }
  }

  private isComputeLatched() {
    return (
      isComputeReady(this.computeCharge) &&
      this.time.now < this.computeDecayResumesAt
    );
  }
}
