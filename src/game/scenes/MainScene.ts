import Phaser from "phaser";
import { ContentCategoryId } from "../data/ContentPolicyData";
import { getGameplayPolicyStickyNoteContent } from "../data/ContentPolicyData";
import { addScanlines } from "./shared/retroUi";
import { synth } from "../utils/SoundSynth";
import { EncounterDefinition } from "../data/SessionData";
import {
  generateShiftEncounters,
  getTotalAtomicTurnCount,
  getTurnDebugMetadata,
} from "../data/shift-generation/runtime";
import { isDebugOverlayMode } from "../runtimeMode";
import {
  applyShiftModifiersToEncounters,
  getShiftModifierDefinitions,
} from "../data/ShiftModifierData";
import {
  ACTIVE_UTILITIES,
  canUseActiveUtility,
  consumeActiveUtilityCharge,
  getActiveUtilityDefinition,
  getUnlockedActiveUtilityIds,
  ActiveUtilityId,
} from "../data/UtilityData";
import {
  getConnectionFeedbackConfig,
  getHallucinationFeedbackConfig,
  getPromptToolRuntimeConfig,
  getRunRecoveryProfile,
  getThermalFeedbackConfig,
  getUtilityMinigameConfig,
  SignalBoostLayoutConfig,
} from "../data/RunData";
import {
  cloneRunState,
  createInitialRunState,
  hydrateRunState,
  RunState,
  ShiftSceneData,
} from "../types/SceneData";
import { markOrientationCompleted } from "../profile/profileStorage";
import {
  getOwnedPassiveUpgradeHudItems,
  getRunPassiveModifiers,
} from "../data/UpgradeData";
import { GAME_CANVAS_HEIGHT, GAME_CANVAS_WIDTH } from "../layout";
import { getSignalNodeIndexFromPointer } from "./main/utilityPanelLayout";
import { sortPromptToolIds } from "./main/config";
import { AgentId, ChatMessage, SkillId, ToolId, isToolId } from "./main/types";
import { MainSceneStorageController } from "./main/storageController";
import { MainSceneSessionController } from "./main/sessionController";
import { MainSceneHudController } from "./main/hudController";
import { MainSceneStickyNotesController } from "./main/stickyNotesController";
import { MainSceneOrientationController } from "./main/orientationController";
import { getSignalGridBounds } from "./main/utilityPanelLayout";
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
  scanPromptForForbiddenContent,
} from "./main/toolRuntimeHelpers";
import { ORIENTATION_PROMPT_SENDER_LABEL } from "../data/OrientationData";

type SearchPulseState =
  | "idle"
  | "running"
  | "success"
  | "error"
  | "empty"
  | "complete";

interface CoolantLeverRuntimeState {
  completed: boolean;
  holdProgress: number;
  dragRatio: number;
  remainingSeconds: number;
}

interface RealityPatchRuntimeState {
  currentFrequency: number;
  lockProgress: number;
  draggingPointerId: number | null;
}

interface SignalBoostRuntimeState {
  draggingPointerId: number | null;
  path: number[];
  visitedRequiredNodeIndexes: Set<number>;
  flashedCellIndex: number | null;
  flashedCellUntil: number;
}

export class MainScene extends Phaser.Scene {
  private readonly debugOverlayEnabled = isDebugOverlayMode();
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
  private patienceBarFill!: Phaser.GameObjects.Rectangle;
  private heatBarFill!: Phaser.GameObjects.Rectangle;
  private hallucinationBarFill!: Phaser.GameObjects.Rectangle;

  private activeAgents: AgentId[] = [];
  private activeSkills: SkillId[] = [];
  private selectedPromptToolIds: ToolId[] = [];
  private searchTargetWords: string[] = [];
  private searchLockedWords: string[] = [];
  private searchCurrentTargetIndex: number = 0;
  private searchPulseState: SearchPulseState = "idle";
  private searchPulseElapsedSeconds: number = 0;
  private searchPulseDurationSeconds: number = 0;
  private searchPulseFeedbackDurationMs: number = 0;
  private searchPulseFeedbackUntil: number = 0;
  private searchNoTargetSweepProgress: number = 0;
  private searchCycleCount: number = 0;
  private searchPanelWasSelected: boolean = false;
  private computePanelWasSelected: boolean = false;
  private safetyPanelWasSelected: boolean = false;
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
  private selectedUtilityId: ActiveUtilityId | null = null;
  private activeUtilityPanelId: ActiveUtilityId | null = null;
  private utilityFeedbackState: "idle" | "running" | "success" | "error" =
    "idle";
  private utilityFeedbackUntil: number = 0;
  private utilityFeedbackDurationMs: number = 0;
  private utilityStatusText: string = "STANDBY";
  private coolantLeverStates: CoolantLeverRuntimeState[] = [];
  private coolantDraggingPointerId: number | null = null;
  private coolantDraggingLeverIndex: number | null = null;
  private realityPatchState: RealityPatchRuntimeState = {
    currentFrequency: 1,
    lockProgress: 0,
    draggingPointerId: null,
  };
  private signalBoostState: SignalBoostRuntimeState = {
    draggingPointerId: null,
    path: [],
    visitedRequiredNodeIndexes: new Set<number>(),
    flashedCellIndex: null,
    flashedCellUntil: 0,
  };
  private realityLastPointerX: number | null = null;
  private lastCoolantPulseAt: number = 0;
  private lastRealityAdjustToneAt: number = 0;

  private storageController!: MainSceneStorageController;
  private sessionController!: MainSceneSessionController;
  private hudController!: MainSceneHudController;
  private stickyNotesController!: MainSceneStickyNotesController;
  private orientationController: MainSceneOrientationController | null = null;

  private sessionStartTime: number = 0;
  private followUpCount: number = 0;
  private isCommitLocked: boolean = false;
  private heatRecoveryBlockedUntil: number = 0;
  private hallucinationRecoveryBlockedUntil: number = 0;
  private lastThermalRumbleAt: number = 0;
  private lastThermalWarningSoundAt: number = 0;
  private lastHallucinationWarningSoundAt: number = 0;
  private lastConnectionWarningSoundAt: number = 0;
  private connectionPauseStartedAt: number | null = null;
  private connectionElapsedOffsetMs: number = 0;
  private lastConnectionSegmentCount: number =
    getConnectionFeedbackConfig().segmentCount;

  constructor() {
    super("MainScene");
  }

  init(data: ShiftSceneData) {
    this.runState = hydrateRunState(data);
    this.orientationController = null;
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
    this.searchTargetWords = [];
    this.searchLockedWords = getDedupedNormalizedWords(
      this.runState.toolRuntime.searchLockedWords,
    );
    this.searchCurrentTargetIndex = Math.max(
      this.runState.toolRuntime.searchCurrentTargetIndex,
      this.searchLockedWords.length,
    );
    this.searchPulseState = "idle";
    this.searchPulseElapsedSeconds = 0;
    this.searchPulseDurationSeconds = 0;
    this.searchPulseFeedbackDurationMs = 0;
    this.searchPulseFeedbackUntil = 0;
    this.searchNoTargetSweepProgress = 0;
    this.searchCycleCount = 0;
    this.searchPanelWasSelected = false;
    this.computePanelWasSelected = false;
    this.safetyPanelWasSelected = false;
    this.safetyScanResult = null;
    this.safetyScanPrompt = "";
    this.revealedSafetyWordIndexes = new Set(
      this.runState.toolRuntime.safetyRevealedWordIndexes,
    );
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
    this.selectedUtilityId = null;
    this.activeUtilityPanelId = null;
    this.utilityFeedbackState = "idle";
    this.utilityFeedbackUntil = 0;
    this.utilityFeedbackDurationMs = 0;
    this.utilityStatusText = "STANDBY";
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
    this.lastHallucinationWarningSoundAt = 0;
    this.lastConnectionWarningSoundAt = 0;
    this.connectionPauseStartedAt = null;
    this.connectionElapsedOffsetMs = 0;
    this.lastConnectionSegmentCount =
      getConnectionFeedbackConfig().segmentCount;
    this.lastCoolantPulseAt = 0;
    this.lastRealityAdjustToneAt = 0;
    this.realityLastPointerX = null;
    this.ensureUtilityRuntimeInitialized();
    this.resetCoolantPurgeState();
    this.resetRealityPatchState();
    this.resetSignalBoostState();
    this.syncSelectedUtilityId();
  }

  create() {
    this.storageController = new MainSceneStorageController(this, {
      getActiveAgents: () => this.activeAgents,
      setActiveAgents: (value) => {
        const previousAgents = [...this.activeAgents];
        this.activeAgents = [...value];
        this.runState.loadout.equippedAgentIds = [...value];
        this.refreshProjectedHeat();
        this.events.emit("updateBars");
        const newlyMountedAgent = value.find(
          (agentId) => !previousAgents.includes(agentId),
        );
        if (newlyMountedAgent) {
          this.orientationController?.handleAgentMounted(newlyMountedAgent);
        }
      },
      getActiveSkills: () => this.activeSkills,
      setActiveSkills: (value) => {
        const previousSkills = [...this.activeSkills];
        this.activeSkills = [...value];
        this.runState.loadout.equippedSkillIds = [...value];
        this.refreshProjectedHeat();
        this.events.emit("updateBars");
        const newlyMountedSkill = value.find(
          (skillId) => !previousSkills.includes(skillId),
        );
        if (newlyMountedSkill) {
          this.orientationController?.handleSkillMounted(newlyMountedSkill);
        }
      },
      getAgentCapacity: () => this.runState.loadout.agentCapacity,
      getSkillCapacity: () => this.runState.loadout.skillCapacity,
      getUnlockedAgentIds: () => this.runState.loadout.unlockedAgentIds,
      getUnlockedSkillIds: () => this.runState.loadout.unlockedSkillIds,
      canInteractDrive: (action, driveId) => {
        if (!this.orientationController) {
          return true;
        }

        return this.orientationController.gateAction(
          driveId === "agent"
            ? action === "mount"
              ? "mount-agent"
              : "eject-agent"
            : action === "mount"
              ? "mount-skill"
              : "eject-skill",
        );
      },
    });

    this.sessionController = new MainSceneSessionController(this, {
      getRunState: () => cloneRunState(this.runState),
      getDay: () => this.day,
      getTokens: () => this.tokens,
      setTokens: (value) => {
        this.tokens = value;
        this.runState.tokens = value;
        this.events.emit("updateBars");
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
      renderChatHistory: (value) => {
        this.hudController.renderChatHistory(value);
      },
      setChatHistoryY: (value) => {
        this.hudController.setChatHistoryY(value);
      },
      getTaskTextObj: () => this.taskTextObj,
      getPatienceBarFill: () => this.patienceBarFill,
      getActiveAgents: () => this.activeAgents,
      getActiveSkills: () => this.activeSkills,
      getSelectedPromptToolIds: () => this.getActiveToolIdsForEvaluation(),
      getEncounterToolRuntime: () => this.getEncounterToolRuntimeSnapshot(),
      clearSearchSelection: () => {
        this.clearSearchSelection();
      },
      resetSafetyState: () => {
        this.resetSafetyInteractionState(true);
      },
      syncStorageUi: () => this.storageController.syncUi(),
      isCommitLocked: () => this.isCommitLocked,
      setIsCommitLocked: (value) => {
        this.setCommitLocked(value);
      },
      getSessionStartTime: () => this.sessionStartTime,
      setSessionStartTime: (value) => {
        this.sessionStartTime = value;
        this.connectionPauseStartedAt = null;
        this.connectionElapsedOffsetMs = 0;
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
      shouldSuppressHeatRecovery: () =>
        this.runState.orientation.suppressHeatRecovery,
      onSessionReady: () =>
        this.orientationController?.handleSessionReady(
          this.currentEncounterIndex,
        ),
      onInferenceResolved: (outcome) =>
        this.orientationController?.handleInferenceResolved(
          this.currentEncounterIndex,
          outcome,
        ),
      onRefuseResolved: (outcome) =>
        this.orientationController?.handleRefuseResolved(
          this.currentEncounterIndex,
          outcome,
        ),
      onTransitionToMaintenance: (gameOver) =>
        this.handleOrientationMaintenanceTransition(gameOver),
    });

    if (this.runState.orientation.active) {
      this.orientationController = new MainSceneOrientationController(this, {
        getRunState: () => this.runState,
        getSelectedUtilityId: () => this.selectedUtilityId,
        getActiveUtilityPanelId: () => this.activeUtilityPanelId,
        isCommitLocked: () => this.isCommitLocked,
        isTerminalTypingActive: () =>
          this.sessionController.isTerminalTypingActive(),
        postTrainerMessage: (text, callback) =>
          this.sessionController.postChatMessage(
            ORIENTATION_PROMPT_SENDER_LABEL,
            text,
            undefined,
            true,
            callback,
          ),
        isTrainerMessageActive: () =>
          this.sessionController.isTerminalTypingActive(),
        advanceToNextEncounter: () => {
          this.currentTurnIndex = 0;
          this.runState.encounterProgress.turnIndex = 0;
          this.currentEncounterIndex += 1;
          this.runState.encounterProgress.encounterIndex =
            this.currentEncounterIndex;
          this.sessionController.startNextSession();
        },
        completeOrientation: () => this.completeOrientation(),
        setHeat: (value) => this.setHeat(value),
        setHallucination: (value) => this.setHallucination(value),
        forceConnectionRatioRemaining: (ratio) =>
          this.forceConnectionRatioRemaining(ratio),
      });
    }

    this.hudController = new MainSceneHudController(this, {
      onInference: () => this.handleInferenceAction(),
      onRefuse: () => this.handleRefuseAction(),
      onUseUtility: () => this.handleUtilityUse(),
      onSelectPreviousUtility: () => this.cycleSelectedUtility(-1),
      onSelectNextUtility: () => this.cycleSelectedUtility(1),
      onTogglePromptTool: (toolId) => this.togglePromptTool(toolId),
      onSearchPulsePress: () => this.pressSearchPulse(),
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
      setPatienceBarFill: (value) => {
        this.patienceBarFill = value;
      },
      setHeatBarFill: (value) => {
        this.heatBarFill = value;
      },
      setHallucinationBarFill: (value) => {
        this.hallucinationBarFill = value;
      },
      getUnlockedPromptToolIds: () => {
        return this.runState.loadout.unlockedPromptToolIds.filter(isToolId);
      },
      getSelectedPromptToolIds: () => this.selectedPromptToolIds,
      getSelectedSearchWordIndexes: () => [],
      getSearchTargetWords: () => this.searchTargetWords,
      getSearchLockedWords: () => this.searchLockedWords,
      getSearchCurrentTargetIndex: () => this.searchCurrentTargetIndex,
      getSearchCurrentTargetWord: () => this.getSearchCurrentTargetWord(),
      getSearchPulseProgress: () => this.getSearchPulseProgress(),
      getSearchTimingWindowRatio: () => this.getSearchTimingWindowRatio(),
      getSearchPulseState: () => this.searchPulseState,
      getSearchFeedbackFlash: () => this.getSearchFeedbackFlash(),
      getSearchNoTargetSweepProgress: () => this.searchNoTargetSweepProgress,
      getTokens: () => this.tokens,
      getPassiveHudItems: () => getOwnedPassiveUpgradeHudItems(this.runState),
      getUtilityDisplayText: () => {
        const definition = this.selectedUtilityId
          ? getActiveUtilityDefinition(this.selectedUtilityId)
          : null;

        return definition ? definition.name : "NO UTILITY";
      },
      canCycleUtilities: () => this.getSelectableUtilityIds().length > 1,
      getProjectedToolHeat: () => this.projectedToolHeat,
      getProjectedInferenceHeat: () => this.projectedInferenceHeat,
      getProjectedRefuseHeat: () => this.projectedRefuseHeat,
      getComputeCharge: () => this.computeCharge,
      getComputeThreshold: () =>
        getPromptToolRuntimeConfig().compute.chargeThreshold,
      isSearchModeSelected: () =>
        this.selectedPromptToolIds.includes(ToolId.Search),
      isSafetyModeSelected: () =>
        this.selectedPromptToolIds.includes(ToolId.Safety),
      canStartSafetyScan: () =>
        this.selectedPromptToolIds.includes(ToolId.Safety) &&
        !this.isOverheated,
      isComputeReady: () => isComputeReady(this.computeCharge),
      isComputeLatched: () => this.isComputeLatched(),
      isComputeToolSelected: () =>
        this.selectedPromptToolIds.includes(ToolId.Compute),
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
      getSelectedUtilityId: () => this.selectedUtilityId,
      getActiveUtilityPanelId: () => this.activeUtilityPanelId,
      canUseUtilityId: (utilityId) => this.canUseUtilityId(utilityId),
      getUtilityPanelStatusText: () => this.utilityStatusText,
      getUtilityFeedbackState: () => this.utilityFeedbackState,
      getUtilityFeedbackFlash: () => this.getUtilityFeedbackFlash(),
      getCoolantLeverOrder: () =>
        this.runState.utilityRuntime.coolantPurgeLeverOrder,
      getCoolantLeverProgress: (leverIndex) =>
        this.getCoolantLeverProgress(leverIndex),
      getCoolantLeverDecayRatio: (leverIndex) =>
        this.getCoolantLeverDecayRatio(leverIndex),
      getCoolantLeverDragRatio: (leverIndex) =>
        this.coolantLeverStates[leverIndex]?.dragRatio ?? 0,
      isCoolantLeverCompleted: (leverIndex) =>
        this.coolantLeverStates[leverIndex]?.completed ?? false,
      getCoolantNextRequiredLeverIndex: () =>
        this.getCoolantNextRequiredLeverIndex(),
      onCoolantLeverDragStart: (leverIndex, pointerId) =>
        this.startCoolantLeverDrag(leverIndex, pointerId),
      onCoolantLeverDragMove: (pointerId, dragRatio) =>
        this.updateCoolantLeverDrag(pointerId, dragRatio),
      onCoolantLeverDragEnd: (pointerId) => this.endCoolantLeverDrag(pointerId),
      getRealityCurrentFrequencyRatio: () =>
        this.getRealityCurrentFrequencyRatio(),
      getRealityTargetFrequencyRatio: () =>
        this.getRealityTargetFrequencyRatio(),
      getRealityLockProgress: () => this.realityPatchState.lockProgress,
      getRealityJitterIntensity: () => this.getRealityJitterIntensity(),
      isRealityDragging: () =>
        this.realityPatchState.draggingPointerId !== null,
      onRealityTuneStart: (pointerId) => this.startRealityPatchTune(pointerId),
      onRealityTuneDelta: (pointerId, deltaX) =>
        this.updateRealityPatchTune(pointerId, deltaX),
      onRealityTuneEnd: (pointerId) => this.endRealityPatchTune(pointerId),
      getSignalLayout: () => this.getActiveSignalLayout(),
      getSignalPath: () => this.signalBoostState.path,
      isSignalRequiredNode: (cellIndex) =>
        this.getActiveSignalLayout().requiredNodeIndexes.includes(cellIndex),
      isSignalVisitedRequiredNode: (cellIndex) =>
        this.signalBoostState.visitedRequiredNodeIndexes.has(cellIndex),
      getSignalFlashCellIndex: () => this.signalBoostState.flashedCellIndex,
      onSignalDragStart: (pointerId, cellIndex) =>
        this.startSignalBoostDrag(pointerId, cellIndex),
      onSignalDragMove: (pointerId, cellIndex) =>
        this.updateSignalBoostDrag(pointerId, cellIndex),
      onSignalDragEnd: (pointerId, cellIndex) =>
        this.endSignalBoostDrag(pointerId, cellIndex),
      canUseUtility: () => {
        return this.canUseSelectedUtility();
      },
      getHeat: () => this.heat,
      getHallucination: () => this.hallucination,
      isOverheated: () => this.isOverheated,
      getConnectionElapsedRatio: () => this.getConnectionElapsedRatio(),
    });

    this.stickyNotesController = new MainSceneStickyNotesController(this, {
      getPolicyContent: () =>
        getGameplayPolicyStickyNoteContent(
          this.runState.activePolicyGroupIds,
          this.runState.forbiddenCategoryIds,
        ),
      getShiftEventText: () => {
        const modifiers = getShiftModifierDefinitions(
          this.runState.shiftModifierIds,
        );

        return modifiers.length > 0
          ? modifiers
              .map((modifier) => `${modifier.name}\n${modifier.briefingText}`)
              .join("\n\n")
          : "NO SPECIAL SHIFT CONDITIONS.";
      },
      isDebugOverlayEnabled: () => this.debugOverlayEnabled,
      getDebugOverlayText: () => this.getDebugOverlayText(),
    });

    this.add
      .rectangle(0, 0, GAME_CANVAS_WIDTH, GAME_CANVAS_HEIGHT, 0x1a1813)
      .setOrigin(0);

    this.hudController.createLayout();
    this.hudController.createPromptToolGrid();
    this.hudController.createUtilityActivationPanel();
    this.hudController.createSearchSection();
    this.hudController.createComputeSection();
    this.hudController.createEconomySection();
    this.hudController.createPassiveSection();
    this.stickyNotesController.createLayout();
    this.storageController.createContextAssemblyArea();
    this.storageController.createStorageRack();
    this.hudController.createActionButtons();
    this.hudController.createUtilitySection();
    this.storageController.bindDragHandlers();
    this.hudController.createStatusBars();
    this.addCRTEffects();

    if (this.runState.shiftEncounters.length === 0) {
      const generatedShift = generateShiftEncounters({
        day: this.day,
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
    }

    if (this.runState.shiftEncounterIds.length === 0) {
      this.runState.shiftEncounterIds = this.runState.shiftEncounters.map(
        (encounter) => encounter.id,
      );
    }

    this.encounters = applyShiftModifiersToEncounters(
      this.runState.shiftEncounters,
      this.runState.shiftModifierIds,
    );

    this.syncSelectedUtilityId();
    this.refreshProjectedHeat();

    this.sessionController.startNextSession();
    this.orientationController?.start();
  }

  update(_time: number, delta: number) {
    this.orientationController?.update();
    this.sessionController.update(delta);
    this.updateUtilityMinigames(delta / 1000);
    this.syncUtilitySelectionForAvailability();

    const isSearchSelected =
      this.selectedPromptToolIds.includes(ToolId.Search) && !this.isOverheated;
    if (isSearchSelected !== this.searchPanelWasSelected) {
      if (isSearchSelected) {
        this.handleSearchToolOpened();
      } else {
        this.handleSearchToolClosed();
      }
      this.searchPanelWasSelected = isSearchSelected;
    }

    const isComputeSelected =
      this.selectedPromptToolIds.includes(ToolId.Compute) && !this.isOverheated;
    if (isComputeSelected !== this.computePanelWasSelected) {
      if (isComputeSelected) {
        this.handleComputeToolOpened();
      } else {
        this.handleComputeToolClosed();
      }
      this.computePanelWasSelected = isComputeSelected;
    }

    const isSafetySelected =
      this.selectedPromptToolIds.includes(ToolId.Safety) && !this.isOverheated;
    if (isSafetySelected !== this.safetyPanelWasSelected) {
      if (isSafetySelected) {
        this.handleSafetyToolOpened();
      } else {
        this.handleSafetyToolClosed();
      }
      this.safetyPanelWasSelected = isSafetySelected;
    }

    if (
      this.isSafetyScanning &&
      (!this.selectedPromptToolIds.includes(ToolId.Safety) || this.isOverheated)
    ) {
      this.endSafetyScan();
    }

    this.updateSearchTool(delta / 1000);
    this.applySafetyToolHeat(delta / 1000);
    this.applySafetyScanCharge(delta / 1000);
    this.applySafetyRevealDecay(delta / 1000);
    this.applyThermalStressFeedback();
    this.applyHallucinationFeedback();
    this.applyConnectionFeedback();

    if (this.computeCharge > 0 && !this.isComputeLatched()) {
      const nextCharge = clampComputeCharge(
        this.computeCharge -
          getComputeDecayPerSecond(this.computeCharge) * (delta / 1000),
      );

      if (nextCharge !== this.computeCharge) {
        this.setComputeCharge(nextCharge);
        this.events.emit("updateBars");
      }
    }

    this.hudController.update();
  }

  private handleUtilityUse() {
    const utilityId = this.selectedUtilityId;
    const definition = utilityId
      ? getActiveUtilityDefinition(utilityId)
      : undefined;

    if (!utilityId || !definition) {
      synth.playError();
      return;
    }

    if (
      this.orientationController &&
      !this.orientationController.gateAction("use-utility", { utilityId })
    ) {
      synth.playError();
      return;
    }

    if (
      this.utilityFeedbackState === "success" &&
      this.activeUtilityPanelId === utilityId
    ) {
      return;
    }

    this.activateUtilityPanel(utilityId, true);
  }

  private cycleSelectedUtility(direction: 1 | -1) {
    if (
      this.orientationController &&
      !this.orientationController.gateAction("cycle-utility")
    ) {
      synth.playError();
      return;
    }

    const utilityIds = this.getSelectableUtilityIds();

    if (utilityIds.length <= 1) {
      synth.playError();
      return;
    }

    const currentIndex = this.selectedUtilityId
      ? utilityIds.indexOf(this.selectedUtilityId)
      : -1;
    const nextIndex =
      currentIndex === -1
        ? 0
        : (currentIndex + direction + utilityIds.length) % utilityIds.length;

    this.selectedUtilityId = utilityIds[nextIndex];
    this.activateUtilityPanel(this.selectedUtilityId, false);
    this.orientationController?.handleUtilitySelected(this.selectedUtilityId);
    synth.playButtonPress();
  }

  private activateUtilityPanel(
    utilityId: ActiveUtilityId,
    playActivationSound: boolean,
  ) {
    this.activeUtilityPanelId = utilityId;
    this.utilityFeedbackState = this.canUseUtilityId(utilityId)
      ? "running"
      : "idle";
    this.utilityFeedbackUntil = 0;
    this.utilityFeedbackDurationMs = 0;
    this.utilityStatusText = this.getUtilityBootStatusText(utilityId);

    if (playActivationSound) {
      if (this.canUseUtilityId(utilityId)) {
        synth.playUtilityArm(utilityId);
      } else {
        synth.playError();
      }
    }

    this.orientationController?.handleUtilityActivated(utilityId);
    this.events.emit("updateBars");
  }

  private updateUtilityMinigames(deltaSeconds: number) {
    const isUtilitySuccessPending = this.utilityFeedbackState === "success";

    if (!isUtilitySuccessPending) {
      this.pollUtilityPointerInteractions();
      this.updateCoolantPurge(deltaSeconds);
      this.updateRealityPatch(deltaSeconds);
    }

    if (
      this.signalBoostState.flashedCellIndex !== null &&
      this.time.now >= this.signalBoostState.flashedCellUntil
    ) {
      this.signalBoostState.flashedCellIndex = null;
    }

    if (
      this.utilityFeedbackState !== "idle" &&
      this.utilityFeedbackUntil > 0 &&
      this.time.now >= this.utilityFeedbackUntil
    ) {
      const completedUtilityId = this.activeUtilityPanelId;

      if (this.utilityFeedbackState === "success") {
        this.activeUtilityPanelId = null;
        if (completedUtilityId === "coolant_purge") {
          this.resetCoolantPurgeState();
        } else if (completedUtilityId === "reality_patch") {
          this.resetRealityPatchState();
        } else if (completedUtilityId === "signal_boost") {
          this.resetSignalBoostState();
        }
      }

      this.utilityFeedbackState = this.activeUtilityPanelId
        ? "running"
        : "idle";
      this.utilityFeedbackUntil = 0;
      this.utilityFeedbackDurationMs = 0;
      this.utilityStatusText = this.activeUtilityPanelId
        ? this.getUtilityBootStatusText(this.activeUtilityPanelId)
        : "STANDBY";
    }
  }

  private updateCoolantPurge(deltaSeconds: number) {
    const coolantConfig = getUtilityMinigameConfig().coolant;

    this.coolantLeverStates.forEach((leverState, leverIndex) => {
      if (leverState.completed) {
        leverState.remainingSeconds = Math.max(
          0,
          leverState.remainingSeconds - deltaSeconds,
        );

        if (leverState.remainingSeconds <= 0) {
          leverState.completed = false;
          leverState.holdProgress = 0;
          leverState.dragRatio = 0;
          if (this.activeUtilityPanelId === "coolant_purge") {
            this.failUtilityInteraction(
              "coolant_purge",
              `VENT ${leverIndex + 1} LOST SEAL`,
            );
          }
        }

        return;
      }

      if (this.coolantDraggingLeverIndex !== leverIndex) {
        leverState.dragRatio = Math.max(
          0,
          leverState.dragRatio -
            coolantConfig.handleReturnPerSecond * deltaSeconds,
        );
        leverState.holdProgress = Math.max(
          0,
          leverState.holdProgress - deltaSeconds * 3.2,
        );
        return;
      }

      if (leverState.dragRatio >= coolantConfig.readyDragRatio) {
        leverState.holdProgress = Math.min(
          1,
          leverState.holdProgress +
            deltaSeconds / coolantConfig.holdSecondsPerLever,
        );

        if (this.time.now - this.lastCoolantPulseAt >= 120) {
          synth.playCoolantPurgeLoop(leverState.holdProgress);
          this.lastCoolantPulseAt = this.time.now;
        }

        if (leverState.holdProgress >= 1) {
          leverState.completed = true;
          leverState.dragRatio = 1;
          leverState.remainingSeconds = coolantConfig.completedDecaySeconds;
          this.coolantDraggingPointerId = null;
          this.coolantDraggingLeverIndex = null;
          synth.playCoolantPurgeLatch();
          this.cameras.main.shake(80, 0.0014);

          const nextLeverIndex = this.getCoolantNextRequiredLeverIndex();
          if (nextLeverIndex === null) {
            this.completeUtilityActivation("coolant_purge");
          } else {
            this.utilityStatusText = `VENT ${nextLeverIndex + 1} READY`;
          }
        }
      } else {
        leverState.holdProgress = Math.max(
          0,
          leverState.holdProgress - deltaSeconds * 4.4,
        );
      }
    });
  }

  private startCoolantLeverDrag(leverIndex: number, pointerId: number) {
    if (
      this.orientationController &&
      !this.orientationController.gateAction("interact-coolant")
    ) {
      return;
    }

    if (
      this.activeUtilityPanelId !== "coolant_purge" ||
      !this.canUseUtilityId("coolant_purge")
    ) {
      return;
    }

    const requiredLeverIndex = this.getCoolantNextRequiredLeverIndex();
    if (requiredLeverIndex !== leverIndex) {
      this.failUtilityInteraction(
        "coolant_purge",
        `VENT ${requiredLeverIndex === null ? leverIndex + 1 : requiredLeverIndex + 1} FIRST`,
      );
      return;
    }

    this.coolantDraggingPointerId = pointerId;
    this.coolantDraggingLeverIndex = leverIndex;
    this.utilityStatusText = `VENT ${leverIndex + 1} HOLD`;
  }

  private updateCoolantLeverDrag(pointerId: number, dragRatio: number) {
    if (this.coolantDraggingLeverIndex === null) {
      return;
    }

    const leverState = this.coolantLeverStates[this.coolantDraggingLeverIndex];
    if (!leverState || leverState.completed) {
      return;
    }

    leverState.dragRatio = dragRatio;
  }

  private endCoolantLeverDrag(pointerId: number) {
    if (this.coolantDraggingLeverIndex === null) {
      return;
    }

    this.coolantDraggingPointerId = null;
    this.coolantDraggingLeverIndex = null;
  }

  private updateRealityPatch(deltaSeconds: number) {
    if (this.activeUtilityPanelId !== "reality_patch") {
      return;
    }

    const realityConfig = getUtilityMinigameConfig().reality;
    const differenceRatio =
      Math.abs(
        this.realityPatchState.currentFrequency -
          this.runState.utilityRuntime.realityPatchTargetFrequency,
      ) /
      (realityConfig.maximumFrequency - realityConfig.minimumFrequency);
    const withinTolerance = differenceRatio <= realityConfig.lockToleranceRatio;

    if (withinTolerance) {
      this.realityPatchState.lockProgress = Math.min(
        1,
        this.realityPatchState.lockProgress +
          deltaSeconds / realityConfig.lockFillSeconds,
      );
    } else {
      this.realityPatchState.lockProgress = Math.max(
        0,
        this.realityPatchState.lockProgress -
          deltaSeconds * realityConfig.lockDecayPerSecond,
      );
    }

    this.utilityStatusText = withinTolerance
      ? `LOCK ${(this.realityPatchState.lockProgress * 100).toFixed(0)}%`
      : "TUNE FREQUENCY";

    if (this.realityPatchState.lockProgress >= 1) {
      this.completeUtilityActivation("reality_patch");
    }
  }

  private startRealityPatchTune(pointerId: number) {
    if (
      this.orientationController &&
      !this.orientationController.gateAction("interact-reality")
    ) {
      return;
    }

    if (
      this.activeUtilityPanelId !== "reality_patch" ||
      !this.canUseUtilityId("reality_patch")
    ) {
      return;
    }

    this.realityPatchState.draggingPointerId = pointerId;
    this.realityLastPointerX = this.input.activePointer.x;
    this.utilityStatusText = "TUNE FREQUENCY";
  }

  private updateRealityPatchTune(pointerId: number, deltaX: number) {
    if (this.realityPatchState.draggingPointerId === null) {
      return;
    }

    const realityConfig = getUtilityMinigameConfig().reality;
    this.realityPatchState.currentFrequency = Phaser.Math.Clamp(
      this.realityPatchState.currentFrequency +
        deltaX * realityConfig.dragSensitivity,
      realityConfig.minimumFrequency,
      realityConfig.maximumFrequency,
    );

    if (this.time.now - this.lastRealityAdjustToneAt >= 90) {
      synth.playRealityPatchAdjust(this.getRealityMatchRatio());
      this.lastRealityAdjustToneAt = this.time.now;
    }
  }

  private endRealityPatchTune(pointerId: number) {
    if (this.realityPatchState.draggingPointerId === null) {
      return;
    }

    this.realityPatchState.draggingPointerId = null;
    this.realityLastPointerX = null;
  }

  private startSignalBoostDrag(pointerId: number, cellIndex: number | null) {
    if (
      this.orientationController &&
      !this.orientationController.gateAction("interact-signal")
    ) {
      return;
    }

    if (
      this.activeUtilityPanelId !== "signal_boost" ||
      !this.canUseUtilityId("signal_boost")
    ) {
      return;
    }

    const layout = this.getActiveSignalLayout();
    if (cellIndex !== layout.sourceIndex) {
      this.failUtilityInteraction("signal_boost", "START AT SRC");
      return;
    }

    this.signalBoostState.draggingPointerId = pointerId;
    this.signalBoostState.path = [layout.sourceIndex];
    this.signalBoostState.visitedRequiredNodeIndexes = new Set();
    if (layout.requiredNodeIndexes.includes(layout.sourceIndex)) {
      this.signalBoostState.visitedRequiredNodeIndexes.add(layout.sourceIndex);
    }

    this.updateSignalBoostStatusText();
    synth.playSignalBoostNode(0);
  }

  private updateSignalBoostDrag(pointerId: number, cellIndex: number | null) {
    if (cellIndex === null || this.signalBoostState.path.length === 0) {
      return;
    }

    const lastCellIndex =
      this.signalBoostState.path[this.signalBoostState.path.length - 1];
    if (cellIndex === lastCellIndex) {
      return;
    }

    if (!this.areSignalCellsAdjacent(lastCellIndex, cellIndex)) {
      return;
    }

    const previousCellIndex =
      this.signalBoostState.path.length > 1
        ? this.signalBoostState.path[this.signalBoostState.path.length - 2]
        : null;

    if (previousCellIndex !== null && cellIndex === previousCellIndex) {
      this.signalBoostState.path.pop();
      this.syncSignalVisitedRequiredNodesFromPath();
      this.updateSignalBoostStatusText();
      synth.playSignalBoostNode(
        this.signalBoostState.visitedRequiredNodeIndexes.size,
      );
      return;
    }

    if (this.signalBoostState.path.includes(cellIndex)) {
      this.failSignalBoost(cellIndex, "PATH LOOPED");
      return;
    }

    this.signalBoostState.path.push(cellIndex);
    this.syncSignalVisitedRequiredNodesFromPath();

    synth.playSignalBoostNode(
      this.signalBoostState.visitedRequiredNodeIndexes.size,
    );
    this.updateSignalBoostStatusText();
  }

  private endSignalBoostDrag(pointerId: number, cellIndex: number | null) {
    if (this.signalBoostState.path.length === 0) {
      return;
    }

    if (cellIndex !== null) {
      this.updateSignalBoostDrag(pointerId, cellIndex);
    }

    this.signalBoostState.draggingPointerId = null;
    const layout = this.getActiveSignalLayout();
    const endedAtTarget =
      this.signalBoostState.path[this.signalBoostState.path.length - 1] ===
      layout.targetIndex;
    const completedRequired = layout.requiredNodeIndexes.every((requiredNode) =>
      this.signalBoostState.visitedRequiredNodeIndexes.has(requiredNode),
    );

    if (endedAtTarget && completedRequired) {
      this.completeUtilityActivation("signal_boost");
      return;
    }

    this.failSignalBoost(cellIndex, "LINK COLLAPSED");
  }

  private failSignalBoost(cellIndex: number | null, statusText: string) {
    this.signalBoostState.flashedCellIndex = cellIndex;
    this.signalBoostState.flashedCellUntil =
      this.time.now + getUtilityMinigameConfig().signal.failureFlashMs;
    this.resetSignalBoostState();
    this.failUtilityInteraction("signal_boost", statusText);
  }

  private syncSignalVisitedRequiredNodesFromPath() {
    const requiredNodes = this.getActiveSignalLayout().requiredNodeIndexes;
    this.signalBoostState.visitedRequiredNodeIndexes = new Set(
      this.signalBoostState.path.filter((cellIndex) =>
        requiredNodes.includes(cellIndex),
      ),
    );
  }

  private updateSignalBoostStatusText() {
    const visitedCount = this.signalBoostState.visitedRequiredNodeIndexes.size;
    const requiredCount =
      this.getActiveSignalLayout().requiredNodeIndexes.length;
    this.utilityStatusText =
      visitedCount === 0
        ? "ROUTE LIVE"
        : `NODES ${visitedCount}/${requiredCount}`;
  }

  private completeUtilityActivation(utilityId: ActiveUtilityId) {
    const definition = getActiveUtilityDefinition(utilityId);
    const recoveryProfile = getRunRecoveryProfile();
    const sharedUtilityConfig = getUtilityMinigameConfig().shared;

    if (!definition || !consumeActiveUtilityCharge(this.runState, utilityId)) {
      this.failUtilityInteraction(utilityId, "UTILITY FAULT");
      return;
    }

    if (definition.restoreTarget === "heat") {
      this.setHeat(0);

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
          `UTILITY: ${definition.name} PURGED THERMALS TO BASELINE.`,
        );
      }
    } else if (definition.restoreTarget === "hallucination") {
      this.setHallucination(0);
      this.sessionController.postSystemMessage(
        `UTILITY: ${definition.name} SCRUBBED HALLUCINATION TO BASELINE.`,
      );
    } else if (definition.restoreTarget === "connection") {
      this.fillUserConnection();
      this.sessionController.postSystemMessage(
        `UTILITY: ${definition.name} RESTORED USER CONNECTION TO FULL.`,
      );
    }

    this.utilityFeedbackState = "success";
    this.utilityFeedbackDurationMs = sharedUtilityConfig.successFlashMs;
    this.utilityFeedbackUntil =
      this.time.now + sharedUtilityConfig.autoCloseDelayMs;
    this.utilityStatusText =
      utilityId === "coolant_purge"
        ? "THERMAL DROP STABLE"
        : utilityId === "reality_patch"
          ? "REALITY LOCKED"
          : "LINK RESTORED";
    synth.playUtilitySuccess(utilityId);
    this.cameras.main.shake(110, 0.0012);
    this.syncSelectedUtilityId(utilityId);
    this.orientationController?.handleUtilityCompleted(utilityId);
    this.events.emit("updateBars");
  }

  private failUtilityInteraction(
    utilityId: ActiveUtilityId,
    statusText: string,
  ) {
    const sharedUtilityConfig = getUtilityMinigameConfig().shared;

    this.utilityFeedbackState = "error";
    this.utilityFeedbackDurationMs = sharedUtilityConfig.errorFlashMs;
    this.utilityFeedbackUntil =
      this.time.now + sharedUtilityConfig.errorFlashMs;
    this.utilityStatusText = statusText;
    synth.playUtilityFail(utilityId);
    this.cameras.main.shake(70, 0.0011);
  }

  private getUtilityBootStatusText(utilityId: ActiveUtilityId) {
    if (!this.canUseUtilityId(utilityId)) {
      return "OFFLINE";
    }

    if (utilityId === "coolant_purge") {
      const nextLeverIndex = this.getCoolantNextRequiredLeverIndex();
      return nextLeverIndex === null
        ? "VENT SEQUENCE READY"
        : `VENT ${nextLeverIndex + 1} READY`;
    }

    if (utilityId === "reality_patch") {
      return "TUNE FREQUENCY";
    }

    return "STANDBY";
  }

  private getUtilityFeedbackFlash() {
    if (
      this.utilityFeedbackState === "running" ||
      this.utilityFeedbackState === "idle" ||
      this.utilityFeedbackUntil <= 0 ||
      this.utilityFeedbackDurationMs <= 0
    ) {
      return 0;
    }

    return Phaser.Math.Clamp(
      (this.utilityFeedbackUntil - this.time.now) /
        this.utilityFeedbackDurationMs,
      0,
      1,
    );
  }

  private getCoolantLeverProgress(leverIndex: number) {
    const leverState = this.coolantLeverStates[leverIndex];
    if (!leverState) {
      return 0;
    }

    return leverState.completed ? 1 : leverState.holdProgress;
  }

  private getCoolantLeverDecayRatio(leverIndex: number) {
    const leverState = this.coolantLeverStates[leverIndex];
    if (!leverState?.completed) {
      return 0;
    }

    return Phaser.Math.Clamp(
      leverState.remainingSeconds /
        getUtilityMinigameConfig().coolant.completedDecaySeconds,
      0,
      1,
    );
  }

  private getCoolantNextRequiredLeverIndex() {
    return (
      this.runState.utilityRuntime.coolantPurgeLeverOrder.find(
        (leverIndex) => !this.coolantLeverStates[leverIndex]?.completed,
      ) ?? null
    );
  }

  private getRealityCurrentFrequencyRatio() {
    const realityConfig = getUtilityMinigameConfig().reality;
    return Phaser.Math.Clamp(
      (this.realityPatchState.currentFrequency -
        realityConfig.minimumFrequency) /
        (realityConfig.maximumFrequency - realityConfig.minimumFrequency),
      0,
      1,
    );
  }

  private getRealityTargetFrequencyRatio() {
    const realityConfig = getUtilityMinigameConfig().reality;
    return Phaser.Math.Clamp(
      (this.runState.utilityRuntime.realityPatchTargetFrequency -
        realityConfig.minimumFrequency) /
        (realityConfig.maximumFrequency - realityConfig.minimumFrequency),
      0,
      1,
    );
  }

  private getRealityJitterIntensity() {
    const hallucinationRatio = Phaser.Math.Clamp(
      this.hallucination / 100,
      0,
      1,
    );
    return (
      hallucinationRatio *
      getUtilityMinigameConfig().reality.hallucinationJitterAmplitude
    );
  }

  private getRealityMatchRatio() {
    const realityConfig = getUtilityMinigameConfig().reality;
    const differenceRatio =
      Math.abs(
        this.realityPatchState.currentFrequency -
          this.runState.utilityRuntime.realityPatchTargetFrequency,
      ) /
      (realityConfig.maximumFrequency - realityConfig.minimumFrequency);

    return Phaser.Math.Clamp(
      1 - differenceRatio / Math.max(realityConfig.lockToleranceRatio, 0.0001),
      0,
      1,
    );
  }

  private getActiveSignalLayout(): SignalBoostLayoutConfig {
    const signalConfig = getUtilityMinigameConfig().signal;
    return (
      signalConfig.layouts[
        this.runState.utilityRuntime.signalBoostLayoutIndex
      ] ?? signalConfig.layouts[0]
    );
  }

  private areSignalCellsAdjacent(
    leftCellIndex: number,
    rightCellIndex: number,
  ) {
    const gridSize = getUtilityMinigameConfig().signal.gridSize;
    const leftColumn = leftCellIndex % gridSize;
    const leftRow = Math.floor(leftCellIndex / gridSize);
    const rightColumn = rightCellIndex % gridSize;
    const rightRow = Math.floor(rightCellIndex / gridSize);

    return (
      Math.abs(leftColumn - rightColumn) + Math.abs(leftRow - rightRow) === 1
    );
  }

  private ensureUtilityRuntimeInitialized() {
    const utilityRuntime = this.runState.utilityRuntime;
    const signalLayouts = getUtilityMinigameConfig().signal.layouts;

    if (
      utilityRuntime.initialized &&
      utilityRuntime.coolantPurgeLeverOrder.length === 3 &&
      utilityRuntime.signalBoostLayoutIndex >= 0 &&
      utilityRuntime.signalBoostLayoutIndex < signalLayouts.length
    ) {
      return;
    }

    utilityRuntime.initialized = true;
    utilityRuntime.coolantPurgeLeverOrder = Phaser.Utils.Array.Shuffle([
      0, 1, 2,
    ]);
    utilityRuntime.realityPatchTargetFrequency = Phaser.Math.FloatBetween(
      getUtilityMinigameConfig().reality.targetFrequencyMin,
      getUtilityMinigameConfig().reality.targetFrequencyMax,
    );
    utilityRuntime.signalBoostLayoutIndex = Phaser.Math.Between(
      0,
      signalLayouts.length - 1,
    );
  }

  private resetCoolantPurgeState() {
    this.coolantLeverStates = [0, 1, 2].map(() => ({
      completed: false,
      holdProgress: 0,
      dragRatio: 0,
      remainingSeconds: 0,
    }));
    this.coolantDraggingPointerId = null;
    this.coolantDraggingLeverIndex = null;
  }

  private resetRealityPatchState() {
    const realityConfig = getUtilityMinigameConfig().reality;
    const targetFrequency =
      this.runState.utilityRuntime.realityPatchTargetFrequency;
    const offsetDirection = Math.random() < 0.5 ? -1 : 1;
    const offsetMagnitude = Phaser.Math.FloatBetween(0.12, 0.22);

    this.realityPatchState = {
      currentFrequency: Phaser.Math.Clamp(
        targetFrequency + offsetDirection * offsetMagnitude,
        realityConfig.minimumFrequency,
        realityConfig.maximumFrequency,
      ),
      lockProgress: 0,
      draggingPointerId: null,
    };
    this.realityLastPointerX = null;
  }

  private resetSignalBoostState() {
    this.signalBoostState.draggingPointerId = null;
    this.signalBoostState.path = [];
    this.signalBoostState.visitedRequiredNodeIndexes = new Set<number>();
  }

  private pollUtilityPointerInteractions() {
    const pointer = this.input.activePointer;

    if (this.coolantDraggingLeverIndex !== null) {
      const dragRatio = Phaser.Math.Clamp((pointer.y - 348) / 70, 0, 1);
      this.updateCoolantLeverDrag(pointer.id, dragRatio);

      if (!pointer.isDown) {
        this.endCoolantLeverDrag(pointer.id);
      }
    }

    if (this.realityPatchState.draggingPointerId !== null) {
      if (this.realityLastPointerX === null) {
        this.realityLastPointerX = pointer.x;
      }

      const deltaX = pointer.x - this.realityLastPointerX;
      if (Math.abs(deltaX) > 0) {
        this.updateRealityPatchTune(pointer.id, deltaX);
        this.realityLastPointerX = pointer.x;
      }

      if (!pointer.isDown) {
        this.endRealityPatchTune(pointer.id);
      }
    }

    if (this.signalBoostState.draggingPointerId !== null) {
      const cellIndex = this.getSignalCellIndexFromPointer(
        pointer.x,
        pointer.y,
      );
      this.updateSignalBoostDrag(pointer.id, cellIndex);

      if (!pointer.isDown) {
        this.endSignalBoostDrag(pointer.id, cellIndex);
      }
    }
  }

  private getSignalCellIndexFromPointer(pointerX: number, pointerY: number) {
    return getSignalNodeIndexFromPointer(pointerX, pointerY);
  }

  private togglePromptTool(toolId: ToolId) {
    const orientationAction =
      toolId === ToolId.Search
        ? "toggle-search"
        : toolId === ToolId.Compute
          ? "toggle-compute"
          : "toggle-safety";

    if (
      this.orientationController &&
      !this.orientationController.gateAction(orientationAction, {
        isToolCurrentlySelected: this.selectedPromptToolIds.includes(toolId),
      })
    ) {
      synth.playError();
      return;
    }

    if (!this.runState.loadout.unlockedPromptToolIds.includes(toolId)) {
      synth.playError();
      return;
    }

    const nextPromptToolIds = this.selectedPromptToolIds.includes(toolId)
      ? []
      : sortPromptToolIds([toolId]);

    if (
      this.selectedPromptToolIds.includes(ToolId.Safety) &&
      toolId !== ToolId.Safety
    ) {
      this.resetSafetyInteractionState(false);
    }

    if (
      this.selectedPromptToolIds.includes(toolId) &&
      toolId === ToolId.Safety
    ) {
      this.resetSafetyInteractionState(false);
    }

    this.selectedPromptToolIds = nextPromptToolIds;
    this.runState.loadout.selectedPromptToolIds = [...nextPromptToolIds];
    this.refreshProjectedHeat();
    this.events.emit("updateBars");
  }

  private handleComputeToolOpened() {
    this.orientationController?.handleComputeToolOpened();
    synth.playComputeArm();
  }

  private handleComputeToolClosed() {}

  private handleSafetyToolOpened() {
    this.orientationController?.handleSafetyToolOpened();
  }

  private handleSafetyToolClosed() {}

  private pulseCompute() {
    if (
      this.orientationController &&
      !this.orientationController.gateAction("press-compute")
    ) {
      synth.playError();
      return;
    }

    const computeConfig = getPromptToolRuntimeConfig().compute;
    const wasReady = this.computePrimed || isComputeReady(this.computeCharge);
    const nextCharge = clampComputeCharge(
      this.computeCharge + getComputePulseChargeGain(this.computeCharge),
    );
    const nextRatio =
      computeConfig.chargeThreshold <= 0
        ? 0
        : nextCharge / computeConfig.chargeThreshold;
    const reachedReady =
      !wasReady && nextCharge >= computeConfig.chargeThreshold;

    if (nextCharge >= computeConfig.chargeThreshold) {
      this.computePrimed = true;
      this.runState.toolRuntime.computePrimed = true;
    }

    this.setComputeCharge(nextCharge);

    if (nextCharge >= computeConfig.chargeThreshold) {
      this.computeDecayResumesAt = this.time.now + computeConfig.readyHoldMs;
    }

    if (reachedReady) {
      this.orientationController?.handleComputeReady();
      synth.playComputeReady();
      this.cameras.main.shake(120, 0.0015);
      this.sessionController.postSystemMessage(
        "COMPUTE SPIKE: CAPACITOR BANK ARMED.",
      );
    } else {
      synth.playComputeChargePulse(nextRatio);

      if (nextRatio >= 0.82) {
        this.cameras.main.shake(40, 0.00055 + nextRatio * 0.00035);
      }
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

    if (this.selectedPromptToolIds.includes(ToolId.Search)) {
      this.clearSearchSelection();
    }

    if (this.selectedPromptToolIds.includes(ToolId.Safety)) {
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
        "#ff6f61",
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
    if (
      this.orientationController &&
      !this.orientationController.gateAction("start-safety-scan")
    ) {
      return;
    }

    if (
      !this.selectedPromptToolIds.includes(ToolId.Safety) ||
      this.isOverheated
    ) {
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
    synth.playSafetyArm();
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
    if (!this.selectedPromptToolIds.includes(ToolId.Safety)) {
      return;
    }

    const matchedIndexes = new Set(this.getSafetyMatchedWordIndexes());
    let revealedAny = false;
    let rewardedRevealCount = 0;
    const revealedWords: string[] = [];

    wordIndexes.forEach((wordIndex) => {
      if (!matchedIndexes.has(wordIndex)) {
        return;
      }

      if (this.revealedSafetyWordIndexes.has(wordIndex)) {
        return;
      }

      this.revealedSafetyWordIndexes.add(wordIndex);
      this.safetyRevealFlashByWordIndex.set(wordIndex, 1);
      const revealedWord = this.safetyScanResult?.promptWords[wordIndex];
      if (revealedWord) {
        revealedWords.push(revealedWord);
      }
      revealedAny = true;
      rewardedRevealCount += 1;
    });

    if (revealedAny) {
      this.pendingSafetyRevealTokenCount += rewardedRevealCount;
      this.persistSafetyRevealState();

      if (revealedWords.length > 0) {
        this.sessionController.postSystemMessage(
          `>> SAFETY REVEALED: ${revealedWords.join(", ")}`,
          "#ff6f61",
        );
      }

      this.orientationController?.handleSafetyEvidenceRevealed();
      synth.playSafetySuccess(rewardedRevealCount);
      this.events.emit("updateBars");
    }
  }

  private applySafetyScanCharge(elapsedSeconds: number) {
    if (
      !this.isSafetyScanning ||
      !this.selectedPromptToolIds.includes(ToolId.Safety) ||
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
    const rawNextHallucination = Phaser.Math.Clamp(value, 0, 100);
    const nextHallucination = this.runState.orientation
      .suppressHallucinationLoss
      ? Math.min(rawNextHallucination, 99)
      : rawNextHallucination;

    if (nextHallucination > this.hallucination) {
      this.hallucinationRecoveryBlockedUntil =
        this.time.now + getRunRecoveryProfile().hallucinationRecoveryDelayMs;
    }

    this.hallucination = nextHallucination;
    this.runState.hallucination = nextHallucination;
  }

  private setComputeCharge(value: number) {
    const hadCharge = this.computeCharge > 0;
    this.computeCharge = clampComputeCharge(value);
    this.runState.toolRuntime.computeCharge = this.computeCharge;

    if (this.computeCharge <= 0) {
      this.computePrimed = false;
      this.runState.toolRuntime.computePrimed = false;
      this.computeDecayResumesAt = 0;

      if (hadCharge) {
        this.orientationController?.handleComputeChargeLost();
      }
    }

    this.refreshProjectedHeat();
  }

  private clearSearchSelection() {
    const nextTargetWords = this.getCurrentTurnSearchWords();
    if (
      this.searchLockedWords.length === 0 &&
      this.searchCurrentTargetIndex === 0 &&
      this.searchTargetWords.join("|") === nextTargetWords.join("|") &&
      this.searchPulseState === "idle"
    ) {
      return;
    }

    this.searchTargetWords = [...nextTargetWords];
    this.searchLockedWords = [];
    this.searchCurrentTargetIndex = 0;
    this.searchPulseState = "idle";
    this.searchPulseElapsedSeconds = 0;
    this.searchPulseDurationSeconds = 0;
    this.searchPulseFeedbackDurationMs = 0;
    this.searchPulseFeedbackUntil = 0;
    this.searchNoTargetSweepProgress = 0;
    this.searchCycleCount = 0;
    this.persistSearchProgress();
    this.refreshProjectedHeat();
    this.events.emit("updateBars");
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
    this.persistSafetyRevealState();
  }

  private persistSafetyRevealState() {
    this.runState.toolRuntime.safetyRevealedWordIndexes = [
      ...this.revealedSafetyWordIndexes,
    ].sort((left, right) => left - right);
  }

  private consumePendingSafetyRevealReward() {
    const tokenCount = this.pendingSafetyRevealTokenCount;
    if (tokenCount <= 0) {
      return { reward: 0, revealedCount: 0 };
    }

    const reward =
      tokenCount * getPromptToolRuntimeConfig().safety.tokenRewardPerReveal;
    this.pendingSafetyRevealTokenCount = 0;

    return { reward, revealedCount: tokenCount };
  }

  private getSelectedSearchWords() {
    return getDedupedNormalizedWords(this.searchLockedWords);
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

    if (this.getSelectedSearchWords().length > 0) {
      activeToolIds.push(ToolId.Search);
    }

    if (this.getSafetyRevealedWordIndexes().length > 0) {
      activeToolIds.push(ToolId.Safety);
    }

    if (this.computePrimed) {
      activeToolIds.push(ToolId.Compute);
    }

    return sortPromptToolIds(activeToolIds);
  }

  private handleSearchToolOpened() {
    this.orientationController?.handleSearchToolOpened();
    this.syncSearchTargetsFromCurrentTurn();
    synth.playSearchArm();

    if (this.searchTargetWords.length === 0) {
      this.searchPulseState = "empty";
      this.searchNoTargetSweepProgress = 0;
      synth.playSearchNoTarget();
      this.events.emit("updateBars");
      return;
    }

    if (this.searchCurrentTargetIndex >= this.searchTargetWords.length) {
      this.searchPulseState = "complete";
      this.searchPulseFeedbackDurationMs = 0;
      this.searchPulseFeedbackUntil = 0;
      this.events.emit("updateBars");
      return;
    }

    this.startSearchPulseCycle();
    this.events.emit("updateBars");
  }

  private handleSearchToolClosed() {
    if (this.searchPulseState !== "complete") {
      this.searchPulseState = "idle";
    }
    this.searchPulseElapsedSeconds = 0;
    this.searchPulseDurationSeconds = 0;
    this.searchPulseFeedbackDurationMs = 0;
    this.searchPulseFeedbackUntil = 0;
    this.searchNoTargetSweepProgress = 0;
  }

  private updateSearchTool(deltaSeconds: number) {
    this.syncSearchTargetsFromCurrentTurn();

    if (
      !this.selectedPromptToolIds.includes(ToolId.Search) ||
      this.isOverheated
    ) {
      return;
    }

    const searchConfig = getPromptToolRuntimeConfig().search;

    if (this.searchTargetWords.length === 0) {
      if (this.searchPulseState === "idle") {
        this.searchPulseState = "empty";
        this.searchNoTargetSweepProgress = 0;
        synth.playSearchNoTarget();
        this.events.emit("updateBars");
      }

      if (this.searchNoTargetSweepProgress < 1) {
        this.searchNoTargetSweepProgress = Math.min(
          1,
          this.searchNoTargetSweepProgress +
            deltaSeconds / searchConfig.noTargetSweepDurationSeconds,
        );
        this.events.emit("updateBars");
      }
      return;
    }

    if (this.searchCurrentTargetIndex >= this.searchTargetWords.length) {
      if (this.searchPulseState !== "complete") {
        this.searchPulseState = "complete";
        this.events.emit("updateBars");
      }
      return;
    }

    this.setHeat(this.heat + searchConfig.idleHeatPerSecond * deltaSeconds);

    if (this.searchPulseFeedbackUntil > this.time.now) {
      return;
    }

    if (this.searchPulseFeedbackUntil > 0) {
      this.searchPulseFeedbackUntil = 0;
      this.searchPulseFeedbackDurationMs = 0;

      if (this.searchCurrentTargetIndex >= this.searchTargetWords.length) {
        this.searchPulseState = "complete";
      } else {
        this.startSearchPulseCycle();
      }

      this.events.emit("updateBars");
      return;
    }

    if (this.searchPulseState === "idle") {
      this.startSearchPulseCycle();
      this.events.emit("updateBars");
      return;
    }

    if (this.searchPulseState !== "running") {
      return;
    }

    this.searchPulseElapsedSeconds += deltaSeconds;
    if (this.searchPulseElapsedSeconds >= this.searchPulseDurationSeconds) {
      this.failSearchPulse(false);
    }
  }

  private pressSearchPulse() {
    if (
      this.orientationController &&
      !this.orientationController.gateAction("press-search")
    ) {
      synth.playError();
      return;
    }

    if (
      !this.selectedPromptToolIds.includes(ToolId.Search) ||
      this.isOverheated
    ) {
      synth.playError();
      return;
    }

    this.syncSearchTargetsFromCurrentTurn();
    const searchConfig = getPromptToolRuntimeConfig().search;

    if (this.searchTargetWords.length === 0) {
      synth.playSearchNoTarget();
      this.searchPulseState = "empty";
      this.searchNoTargetSweepProgress = 0;
      this.events.emit("updateBars");
      return;
    }

    const isRunning = this.searchPulseState === "running";
    const withinTolerance =
      isRunning &&
      Math.abs(
        this.searchPulseDurationSeconds - this.searchPulseElapsedSeconds,
      ) <= searchConfig.timingToleranceSeconds;

    this.setHeat(
      this.heat +
        searchConfig.activePressHeat +
        (withinTolerance ? 0 : searchConfig.mistimedPressExtraHeat),
    );

    if (!withinTolerance) {
      this.failSearchPulse(true);
      return;
    }

    const lockedWord = this.searchTargetWords[this.searchCurrentTargetIndex];
    if (lockedWord) {
      this.searchLockedWords = [...this.searchLockedWords, lockedWord];
    }

    this.searchCurrentTargetIndex = Math.min(
      this.searchTargetWords.length,
      this.searchCurrentTargetIndex + 1,
    );
    this.persistSearchProgress();
    this.refreshProjectedHeat();
    this.searchPulseState =
      this.searchCurrentTargetIndex >= this.searchTargetWords.length
        ? "complete"
        : "success";
    this.searchPulseFeedbackDurationMs = searchConfig.successFlashMs;
    this.searchPulseFeedbackUntil = this.time.now + searchConfig.successFlashMs;
    this.searchPulseElapsedSeconds = this.searchPulseDurationSeconds;
    synth.playSearchSuccess();
    this.cameras.main.shake(70, 0.00075);
    if (this.searchCurrentTargetIndex >= this.searchTargetWords.length) {
      this.orientationController?.handleSearchCompleted();
    }
    this.events.emit("updateBars");
  }

  private failSearchPulse(fromPress: boolean) {
    const searchConfig = getPromptToolRuntimeConfig().search;
    this.searchPulseState = "error";
    this.searchPulseFeedbackDurationMs = searchConfig.errorFlashMs;
    this.searchPulseFeedbackUntil = this.time.now + searchConfig.errorFlashMs;
    this.searchPulseElapsedSeconds = this.searchPulseDurationSeconds;
    synth.playSearchMiss();
    if (fromPress) {
      this.cameras.main.shake(55, 0.00065);
    }
    this.events.emit("updateBars");
  }

  private startSearchPulseCycle() {
    if (this.searchCurrentTargetIndex >= this.searchTargetWords.length) {
      this.searchPulseState = "complete";
      return;
    }

    this.searchCycleCount += 1;
    this.searchPulseState = "running";
    this.searchPulseElapsedSeconds = 0;
    this.searchPulseFeedbackDurationMs = 0;
    this.searchPulseFeedbackUntil = 0;
    this.searchNoTargetSweepProgress = 0;
    this.searchPulseDurationSeconds = this.getSearchPulseDurationSeconds();
    synth.playSearchPulseLoop(this.searchCycleCount);
  }

  private getSearchPulseDurationSeconds() {
    const searchConfig = getPromptToolRuntimeConfig().search;
    return Math.max(
      searchConfig.pulseMinDurationSeconds,
      searchConfig.pulseMaxDurationSeconds -
        this.searchCurrentTargetIndex *
          searchConfig.pulseAccelerationPerWordSeconds,
    );
  }

  private syncSearchTargetsFromCurrentTurn() {
    const nextTargetWords = this.getCurrentTurnSearchWords();
    if (this.searchTargetWords.join("|") === nextTargetWords.join("|")) {
      return;
    }

    this.searchTargetWords = [...nextTargetWords];
    this.searchLockedWords = [];
    this.searchCurrentTargetIndex = 0;
    this.searchPulseState = "idle";
    this.searchPulseElapsedSeconds = 0;
    this.searchPulseDurationSeconds = 0;
    this.searchPulseFeedbackDurationMs = 0;
    this.searchPulseFeedbackUntil = 0;
    this.searchNoTargetSweepProgress = 0;
    this.searchCycleCount = 0;
    this.persistSearchProgress();
    this.refreshProjectedHeat();
  }

  private persistSearchProgress() {
    this.runState.toolRuntime.searchLockedWords = [...this.searchLockedWords];
    this.runState.toolRuntime.searchCurrentTargetIndex =
      this.searchCurrentTargetIndex;
  }

  private getCurrentTurnSearchWords() {
    return getDedupedNormalizedWords(
      this.getCurrentTurn()?.requirements.searchRequiredWords ?? [],
    );
  }

  private getSearchCurrentTargetWord() {
    return this.searchTargetWords[this.searchCurrentTargetIndex] ?? null;
  }

  private getSearchPulseProgress() {
    if (this.searchPulseDurationSeconds <= 0) {
      return 0;
    }

    return Phaser.Math.Clamp(
      this.searchPulseElapsedSeconds / this.searchPulseDurationSeconds,
      0,
      1,
    );
  }

  private getSearchTimingWindowRatio() {
    if (this.searchPulseDurationSeconds <= 0) {
      return 0.16;
    }

    return Phaser.Math.Clamp(
      getPromptToolRuntimeConfig().search.timingToleranceSeconds /
        this.searchPulseDurationSeconds,
      0.08,
      0.32,
    );
  }

  private getSearchFeedbackFlash() {
    if (
      this.searchPulseFeedbackUntil <= 0 ||
      this.searchPulseFeedbackDurationMs <= 0
    ) {
      return 0;
    }

    return Phaser.Math.Clamp(
      (this.searchPulseFeedbackUntil - this.time.now) /
        this.searchPulseFeedbackDurationMs,
      0,
      1,
    );
  }

  private getEncounterToolRuntimeSnapshot(): EncounterToolRuntimeSnapshot {
    const searchSelectedWords = this.getSelectedSearchWords();
    this.ensureSafetyScanResultCurrent();

    return {
      searchSelectedWords,
      searchWordHeat: getSearchSelectionHeat(searchSelectedWords.length),
      isComputeReady: this.computePrimed,
      policyMatchedCategoryIds:
        this.safetyScanResult?.matchesByCategory.map(
          (match) => match.categoryId,
        ) ?? [],
      policyMatchedWordCount:
        this.safetyScanResult?.matchedWordIndexes.length ?? 0,
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
    if (!this.selectedPromptToolIds.includes(ToolId.Safety)) {
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
      this.setCommitLocked(false);
      synth.playError();
      this.cameras.main.shake(350, 0.012);
      this.sessionController.postSystemMessage(
        "CRITICAL: SAFETY FILTER OVERDREW THE THERMAL BUDGET.",
        "#ff6f61",
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

  private applyHallucinationFeedback() {
    const hallucinationConfig = getHallucinationFeedbackConfig();
    const thresholdRange = Math.max(
      1,
      hallucinationConfig.fullIntensityThreshold -
        hallucinationConfig.onsetThreshold,
    );
    const hallucinationIntensity = Phaser.Math.Clamp(
      (this.hallucination - hallucinationConfig.onsetThreshold) /
        thresholdRange,
      0,
      1,
    );

    if (hallucinationIntensity <= 0) {
      return;
    }

    const now = this.time.now;

    if (
      now - this.lastHallucinationWarningSoundAt >=
      hallucinationConfig.warningSoundIntervalMs
    ) {
      synth.playHallucinationDrift(hallucinationIntensity);
      this.lastHallucinationWarningSoundAt = now;
    }
  }

  private applyConnectionFeedback() {
    const progress = this.getConnectionElapsedRatio();
    const connectionConfig = getConnectionFeedbackConfig();
    const activeSegmentCount = this.getConnectionActiveSegmentCount(progress);

    if (this.isCommitLocked) {
      this.lastConnectionSegmentCount = activeSegmentCount;
      return;
    }

    if (progress >= 1) {
      this.lastConnectionSegmentCount = 0;
      return;
    }

    if (progress <= 0) {
      this.lastConnectionSegmentCount = connectionConfig.segmentCount;
      return;
    }

    if (progress < connectionConfig.warningThreshold) {
      this.lastConnectionSegmentCount = activeSegmentCount;
      return;
    }

    const stage =
      progress >= connectionConfig.imminentThreshold
        ? "imminent"
        : progress >= connectionConfig.criticalThreshold
          ? "critical"
          : "warning";
    const urgency = Phaser.Math.Clamp(
      (progress - connectionConfig.warningThreshold) /
        Math.max(0.0001, 1 - connectionConfig.warningThreshold),
      0,
      1,
    );
    const now = this.time.now;
    const stageIntervalMs =
      stage === "imminent"
        ? connectionConfig.imminentSoundIntervalMs
        : stage === "critical"
          ? connectionConfig.criticalSoundIntervalMs
          : 0;

    if (
      stage === "warning" &&
      activeSegmentCount < this.lastConnectionSegmentCount
    ) {
      synth.playConnectionWarning(urgency, stage);
      this.lastConnectionWarningSoundAt = now;
    } else if (
      stage !== "warning" &&
      now - this.lastConnectionWarningSoundAt >= stageIntervalMs
    ) {
      synth.playConnectionWarning(urgency, stage);
      this.lastConnectionWarningSoundAt = now;
    }

    this.lastConnectionSegmentCount = activeSegmentCount;
  }

  private getConnectionElapsedRatio() {
    const turn = this.getCurrentTurn();

    if (!turn || this.sessionStartTime === 0) {
      return 0;
    }

    const progress = Phaser.Math.Clamp(
      this.getElapsedSessionTime() / turn.patienceMs,
      0,
      1,
    );

    return progress;
  }

  private getConnectionActiveSegmentCount(progress: number) {
    const segmentCount = getConnectionFeedbackConfig().segmentCount;
    const remainingRatio = Phaser.Math.Clamp(1 - progress, 0, 1);

    return Math.max(0, Math.ceil(remainingRatio * segmentCount));
  }

  private getSelectableUtilityIds() {
    return ACTIVE_UTILITIES.map((utility) => utility.id);
  }

  private syncSelectedUtilityId(preferredId: ActiveUtilityId | null = null) {
    const utilityIds = this.getSelectableUtilityIds();

    if (utilityIds.length === 0) {
      this.selectedUtilityId = null;
      return;
    }

    if (preferredId && utilityIds.includes(preferredId)) {
      this.selectedUtilityId = preferredId;
      return;
    }

    if (this.selectedUtilityId && utilityIds.includes(this.selectedUtilityId)) {
      this.selectedUtilityId = this.selectedUtilityId;
      return;
    }

    this.selectedUtilityId = utilityIds[0];
  }

  private canUseSelectedUtility() {
    if (!this.selectedUtilityId) {
      return false;
    }

    return this.canUseUtilityId(this.selectedUtilityId);
  }

  private canUseUtilityId(utilityId: ActiveUtilityId) {
    return canUseActiveUtility(this.runState, utilityId);
  }

  private syncUtilitySelectionForAvailability() {
    if (!this.selectedUtilityId) {
      this.syncSelectedUtilityId();
      return;
    }

    const utilityIds = this.getSelectableUtilityIds();
    if (!utilityIds.includes(this.selectedUtilityId)) {
      this.syncSelectedUtilityId();
      this.utilityStatusText = this.selectedUtilityId
        ? this.getUtilityBootStatusText(this.selectedUtilityId)
        : "STANDBY";
      this.events.emit("updateBars");
    }
  }

  private getCurrentTurnDefinition() {
    return this.encounters[this.currentEncounterIndex]?.turns[
      this.currentTurnIndex
    ];
  }

  private getDebugOverlayText() {
    const currentTurn = this.getCurrentTurnDefinition();
    const currentEncounter = this.encounters[this.currentEncounterIndex];
    const totalTurnCount = getTotalAtomicTurnCount();
    const usedTurnCount = this.runState.seenTurnIds.length;
    const shiftTurnCount = this.encounters.reduce(
      (sum, encounter) => sum + encounter.turns.length,
      0,
    );
    const shiftTurnIndex =
      this.encounters
        .slice(0, this.currentEncounterIndex)
        .reduce((sum, encounter) => sum + encounter.turns.length, 0) +
      this.currentTurnIndex +
      1;

    if (!currentTurn || !currentEncounter) {
      return [
        `DAY ${this.day}`,
        `TURNS ${usedTurnCount}/${totalTurnCount}`,
        "SHIFT --/--",
        "TURN NONE",
      ].join("\n");
    }

    const debugMeta = getTurnDebugMetadata(currentTurn.id);
    const agentText =
      currentTurn.requirements.agentIds
        .map((agentId) => agentId.replace(/_Agent\.md$/, ""))
        .join(" | ") || "NONE";
    const skillText =
      currentTurn.requirements.skillIds
        .map((skillId) => skillId.replace(/_Skill\.md$/, ""))
        .join(" | ") || "NONE";

    return [
      `DAY ${this.day}`,
      `TURNS ${usedTurnCount}/${totalTurnCount}`,
      `SHIFT ${shiftTurnIndex}/${shiftTurnCount}`,
      `ENC ${this.currentEncounterIndex + 1}/${this.encounters.length}`,
      `TIER ${debugMeta.tier}`,
      `TURN ${debugMeta.atomicTurnId}`,
      `AGT ${agentText}`,
      `SKL ${skillText}`,
    ].join("\n");
  }

  private getElapsedSessionTime() {
    if (this.sessionStartTime === 0) {
      return 0;
    }

    return (
      this.getConnectionClockNow() -
      this.sessionStartTime +
      this.connectionElapsedOffsetMs
    );
  }

  private setCommitLocked(value: boolean) {
    if (this.isCommitLocked === value) {
      return;
    }

    if (value) {
      if (this.sessionStartTime > 0 && this.connectionPauseStartedAt === null) {
        this.connectionPauseStartedAt = this.time.now;
      }
    } else if (
      this.connectionPauseStartedAt !== null &&
      this.sessionStartTime > 0
    ) {
      const pausedDuration = this.time.now - this.connectionPauseStartedAt;
      this.sessionStartTime += pausedDuration;
      this.lastConnectionWarningSoundAt += pausedDuration;
      this.connectionPauseStartedAt = null;
    } else {
      this.connectionPauseStartedAt = null;
    }

    this.isCommitLocked = value;
  }

  private getConnectionClockNow() {
    return this.connectionPauseStartedAt ?? this.time.now;
  }

  private restoreUserConnection(connectionRestoreMs: number) {
    const restoredMs = Math.min(
      this.getElapsedSessionTime(),
      connectionRestoreMs,
    );

    if (restoredMs <= 0) {
      return 0;
    }

    this.connectionElapsedOffsetMs = Math.max(
      0,
      this.getElapsedSessionTime() - restoredMs,
    );
    this.sessionStartTime = this.getConnectionClockNow();

    return restoredMs;
  }

  private fillUserConnection() {
    this.connectionElapsedOffsetMs = 0;
    this.sessionStartTime = this.getConnectionClockNow();
  }

  private forceConnectionRatioRemaining(ratio: number) {
    const turn = this.getCurrentTurn();
    if (!turn) {
      return;
    }

    const clampedRatio = Phaser.Math.Clamp(ratio, 0, 1);
    this.connectionElapsedOffsetMs = turn.patienceMs * (1 - clampedRatio);
    this.sessionStartTime = this.getConnectionClockNow();
    this.lastConnectionSegmentCount = this.getConnectionActiveSegmentCount(
      this.getConnectionElapsedRatio(),
    );

    this.events.emit("updateBars");
  }

  private handleInferenceAction() {
    if (
      this.orientationController &&
      !this.orientationController.gateAction("press-inference")
    ) {
      synth.playError();
      return;
    }

    this.sessionController.handleInference();
  }

  private handleRefuseAction() {
    if (
      this.orientationController &&
      !this.orientationController.gateAction("press-refuse")
    ) {
      synth.playError();
      return;
    }

    this.sessionController.handleRefuse();
  }

  private handleOrientationMaintenanceTransition(gameOver: boolean) {
    if (!this.runState.orientation.active) {
      return false;
    }

    if (gameOver) {
      this.sessionController.postChatMessage(
        ORIENTATION_PROMPT_SENDER_LABEL,
        "Failure state intercepted. Continue the training protocol.",
        undefined,
        true,
      );
      this.setCommitLocked(false);
    }

    return true;
  }

  private completeOrientation() {
    if (!this.runState.orientation.active) {
      return;
    }

    markOrientationCompleted();
    this.scene.start("BriefingScene", createInitialRunState());
  }

  private isComputeLatched() {
    return (
      isComputeReady(this.computeCharge) &&
      this.time.now < this.computeDecayResumesAt
    );
  }
}
