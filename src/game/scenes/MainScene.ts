import Phaser from "phaser";
import { addScanlines } from "./shared/retroUi";
import { UserSession, DAY_1_SESSIONS } from "../data/SessionData";
import { ShiftSceneData } from "../types/SceneData";
import { ChatMessage, ToolId } from "./main/types";
import { MainSceneStorageController } from "./main/storageController";
import { MainSceneSessionController } from "./main/sessionController";
import { MainSceneHudController } from "./main/hudController";

export class MainScene extends Phaser.Scene {
  private day: number = 1;
  private money: number = 0;
  private accuracy: number = 100;

  private heat: number = 0;
  private isOverheated: boolean = false;
  private hallucination: number = 0;

  private currentSessionIndex: number = 0;
  private sessions: UserSession[] = [];
  private chatHistory: ChatMessage[] = [];

  private taskTextObj!: Phaser.GameObjects.Text;
  private chatTextObj!: Phaser.GameObjects.Text;
  private patienceBarFill!: Phaser.GameObjects.Rectangle;
  private heatBarFill!: Phaser.GameObjects.Rectangle;
  private hallucinationBarFill!: Phaser.GameObjects.Rectangle;

  private activeAgent: string | null = null;
  private activeSkills: string[] = [];
  private activeTool: ToolId | null = null;

  private storageController!: MainSceneStorageController;
  private sessionController!: MainSceneSessionController;
  private hudController!: MainSceneHudController;

  private sessionStartTime: number = 0;
  private followUpCount: number = 0;
  private isProcessing: boolean = false;

  constructor() {
    super("MainScene");
  }

  init(data: ShiftSceneData) {
    this.day = data.day;
    this.money = data.money;
    this.accuracy = data.accuracy;
    this.heat = 0;
    this.isOverheated = false;
    this.hallucination = 0;
    this.activeAgent = null;
    this.activeSkills = [];
    this.activeTool = null;
    this.currentSessionIndex = 0;
    this.chatHistory = [];
    this.isProcessing = false;
    this.sessionStartTime = 0;
    this.followUpCount = 0;
  }

  create() {
    this.storageController = new MainSceneStorageController(this, {
      getActiveAgent: () => this.activeAgent,
      setActiveAgent: (value) => {
        this.activeAgent = value;
      },
      getActiveSkills: () => this.activeSkills,
      setActiveSkills: (value) => {
        this.activeSkills = value;
      },
      getActiveTool: () => this.activeTool,
      setActiveTool: (value) => {
        this.activeTool = value;
      },
      isProcessing: () => this.isProcessing,
    });

    this.sessionController = new MainSceneSessionController(this, {
      getDay: () => this.day,
      getMoney: () => this.money,
      setMoney: (value) => {
        this.money = value;
      },
      getAccuracy: () => this.accuracy,
      setAccuracy: (value) => {
        this.accuracy = value;
      },
      getHeat: () => this.heat,
      setHeat: (value) => {
        this.heat = value;
      },
      getHallucination: () => this.hallucination,
      setHallucination: (value) => {
        this.hallucination = value;
      },
      isOverheated: () => this.isOverheated,
      setIsOverheated: (value) => {
        this.isOverheated = value;
      },
      getCurrentSessionIndex: () => this.currentSessionIndex,
      setCurrentSessionIndex: (value) => {
        this.currentSessionIndex = value;
      },
      getSessions: () => this.sessions,
      getChatHistory: () => this.chatHistory,
      setChatHistory: (value) => {
        this.chatHistory = value;
      },
      getTaskTextObj: () => this.taskTextObj,
      getChatTextObj: () => this.chatTextObj,
      getPatienceBarFill: () => this.patienceBarFill,
      getActiveAgent: () => this.activeAgent,
      getActiveSkills: () => this.activeSkills,
      getActiveTool: () => this.activeTool,
      resetContextSelection: () => {
        this.activeAgent = null;
        this.activeSkills = [];
        this.activeTool = "none";
      },
      syncStorageUi: () => this.storageController.syncUi(),
      isProcessing: () => this.isProcessing,
      setIsProcessing: (value) => {
        this.isProcessing = value;
      },
      getSessionStartTime: () => this.sessionStartTime,
      setSessionStartTime: (value) => {
        this.sessionStartTime = value;
      },
      getFollowUpCount: () => this.followUpCount,
      setFollowUpCount: (value) => {
        this.followUpCount = value;
      },
    });

    this.hudController = new MainSceneHudController(this, {
      onInference: () => this.sessionController.handleInference(),
      onRefuse: () => this.sessionController.handleRefuse(),
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
      getHeat: () => this.heat,
      getHallucination: () => this.hallucination,
      isOverheated: () => this.isOverheated,
    });

    this.add.rectangle(0, 0, 1024, 768, 0x1a1813).setOrigin(0);

    this.hudController.createLayout();
    this.storageController.createContextAssemblyArea();
    this.storageController.createStorageRack();
    this.storageController.createToolButtons();
    this.hudController.createActionButtons();
    this.storageController.bindDragHandlers();
    this.hudController.createStatusBars();
    this.addCRTEffects();

    if (this.day === 1) {
      this.sessions = DAY_1_SESSIONS;
    } else {
      this.sessions = DAY_1_SESSIONS;
    }

    this.sessionController.startNextSession();
  }

  update(_time: number, delta: number) {
    this.sessionController.update(delta);
  }

  addCRTEffects() {
    addScanlines(this);
  }
}
