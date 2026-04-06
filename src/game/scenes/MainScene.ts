import Phaser from "phaser";
import { synth } from "../utils/SoundSynth";
import {
  UserSession,
  DAY_1_SESSIONS,
  WRONG_ANSWER_REPLIES,
  FOLLOW_UP_1_REPLIES,
  FOLLOW_UP_2_REPLIES,
  TIMEOUT_REPLIES,
} from "../data/SessionData";

interface ChatMessage {
  sender: "SYSTEM" | "USER" | "LLM";
  text: string;
}

type DiskType = "agent" | "skill";
type DriveId = DiskType;
type StorageTab = "all" | DiskType;

interface StorageDiskDefinition {
  label: string;
  type: DiskType;
  color: number;
}

interface StorageDiskInstance {
  definition: StorageDiskDefinition;
  container: Phaser.GameObjects.Container;
  handle: Phaser.GameObjects.Rectangle;
  width: number;
  height: number;
}

interface DriveConfig {
  id: DriveId;
  title: string;
  acceptType: DiskType;
  snapPoint: Phaser.Math.Vector2;
  hoverBounds: Phaser.Geom.Rectangle;
  capacity: number;
  housingY: number;
  housingHeight: number;
  lcdY: number;
}

interface DriveUi {
  glow: Phaser.GameObjects.Rectangle;
  frame: Phaser.GameObjects.Rectangle;
  mouth: Phaser.GameObjects.Rectangle;
  light: Phaser.GameObjects.Arc;
  statusText: Phaser.GameObjects.Text;
  mountedText: Phaser.GameObjects.Text;
  ejectButton: Phaser.GameObjects.Rectangle;
  ejectLabel: Phaser.GameObjects.Text;
}

interface DiskLoadResult {
  success: boolean;
  driveId?: DriveId;
  statusMessage: string;
}

const STORAGE_DISKS: StorageDiskDefinition[] = [
  { label: "Coding_Agent.md", type: "agent", color: 0x99958a },
  { label: "General_Agent.md", type: "agent", color: 0x99958a },
  { label: "Python_Skill.md", type: "skill", color: 0x7a8a99 },
  { label: "Creative_Skill.md", type: "skill", color: 0x7a8a99 },
];

export class MainScene extends Phaser.Scene {
  private readonly diskWidth = 180;
  private readonly diskHeight = 60;
  private readonly diskRackX = 20;
  private readonly rackVisibleRows = 6;
  private readonly rackItemSpacing = 72;
  private readonly rackStartY = 132;
  private readonly driveConfigs: Record<DriveId, DriveConfig> = {
    agent: {
      id: "agent",
      title: "DRIVE A: AGENT",
      acceptType: "agent",
      snapPoint: new Phaser.Math.Vector2(536, 539),
      hoverBounds: new Phaser.Geom.Rectangle(488, 525, 96, 28),
      capacity: 1,
      housingY: 508,
      housingHeight: 60,
      lcdY: 546,
    },
    skill: {
      id: "skill",
      title: "DRIVE B: SKILLS",
      acceptType: "skill",
      snapPoint: new Phaser.Math.Vector2(536, 608),
      hoverBounds: new Phaser.Geom.Rectangle(488, 594, 96, 28),
      capacity: 2,
      housingY: 578,
      housingHeight: 72,
      lcdY: 621,
    },
  };

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
  private terminalBg!: Phaser.GameObjects.Rectangle;

  private activeAgent: string | null = null;
  private activeSkills: string[] = [];
  private activeTool: string | null = null;

  private driveModules = {} as Record<DriveId, DriveUi>;
  private toolStatusLight!: Phaser.GameObjects.Arc;
  private toolStatusText!: Phaser.GameObjects.Text;

  private storageTab: StorageTab = "all";
  private storageScrollIndex: number = 0;
  private storageDisks: StorageDiskInstance[] = [];
  private storageTabButtons: Array<{
    tab: StorageTab;
    body: Phaser.GameObjects.Rectangle;
    lip: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
  }> = [];
  private storageScrollInfo!: Phaser.GameObjects.Text;
  private storageScrollUpBtn!: Phaser.GameObjects.Rectangle;
  private storageScrollDownBtn!: Phaser.GameObjects.Rectangle;
  private storageScrollUpLabel!: Phaser.GameObjects.Text;
  private storageScrollDownLabel!: Phaser.GameObjects.Text;

  private activeDraggedDisk: Phaser.GameObjects.Container | null = null;

  private sessionStartTime: number = 0;
  private followUpCount: number = 0;
  private patienceBarFill!: Phaser.GameObjects.Rectangle;
  private isProcessing: boolean = false;
  private heatBarFill!: Phaser.GameObjects.Rectangle;
  private hallucinationBarFill!: Phaser.GameObjects.Rectangle;

  constructor() {
    super("MainScene");
  }

  init(data: any) {
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
    this.driveModules = {} as Record<DriveId, DriveUi>;
    this.storageDisks = [];
    this.storageTabButtons = [];
    this.storageScrollIndex = 0;
    this.storageTab = "all";
    this.activeDraggedDisk = null;
  }

  create() {
    this.add.rectangle(0, 0, 1024, 768, 0x1a1813).setOrigin(0);

    this.createLayout();
    this.createStorageRack();
    this.createToolButtons();
    this.createActionButtons();
    this.createStatusBars();
    this.addCRTEffects();

    if (this.day === 1) {
      this.sessions = DAY_1_SESSIONS;
    } else {
      this.sessions = DAY_1_SESSIONS;
    }

    this.startNextSession();
  }

  createLayout() {
    const monitorOuter = this.add
      .rectangle(230, 30, 564, 440, 0x2c2a25)
      .setOrigin(0);
    monitorOuter.setStrokeStyle(4, 0x111111);

    this.terminalBg = this.add
      .rectangle(250, 50, 524, 400, 0x051505)
      .setOrigin(0);
    this.terminalBg.setStrokeStyle(2, 0x33ff33);

    this.add.text(250, 20, "USER CONNECTION:", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#d4c5b0",
    });
    this.add.rectangle(400, 20, 374, 15, 0x111111).setOrigin(0);
    this.patienceBarFill = this.add
      .rectangle(402, 22, 370, 11, 0xffaa00)
      .setOrigin(0);

    this.taskTextObj = this.add.text(260, 60, "", {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: "14px",
      color: "#33ff33",
      wordWrap: { width: 500 },
    });

    this.chatTextObj = this.add.text(260, 120, "", {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: "14px",
      color: "#33ff33",
      wordWrap: { width: 500 },
    });

    this.createContextAssemblyArea();
  }

  createContextAssemblyArea() {
    this.add.text(250, 480, "CONTEXT ASSEMBLY [DUAL DRIVE]", {
      fontFamily: "monospace",
      color: "#d4c5b0",
      fontStyle: "bold",
    });

    const driveHousing = this.add
      .rectangle(250, 506, 524, 154, 0x181512)
      .setOrigin(0);
    driveHousing.setStrokeStyle(4, 0x0a0a0a);

    this.add
      .rectangle(266, 523, 96, 24, 0x77674f)
      .setOrigin(0)
      .setStrokeStyle(2, 0x2a241a);
    this.add
      .text(314, 535, "BUS LINK", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#17120d",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.add.rectangle(314, 564, 8, 16, 0x77674f).setOrigin(0.5, 0);

    this.createDriveModule(this.driveConfigs.agent);
    this.createDriveModule(this.driveConfigs.skill);

    this.toolStatusLight = this.add
      .circle(286, 647, 6, 0x5d461d)
      .setStrokeStyle(1, 0x1f1b14);
    this.add.text(302, 639, "TOOL BUS", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#8c867a",
      fontStyle: "bold",
    });
    this.toolStatusText = this.add.text(382, 639, "TOOL: [NONE]", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#33ff33",
    });

    this.updateSlotsDisplay();
    this.refreshDriveIdleState();
  }

  createDriveModule(config: DriveConfig) {
    const labelY = config.housingY + 10;
    const slotCenterY = config.snapPoint.y;

    this.add
      .rectangle(262, config.housingY, 500, config.housingHeight, 0x221d18)
      .setOrigin(0)
      .setStrokeStyle(2, 0x111111);
    this.add.text(278, labelY, config.title, {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#d4c5b0",
      fontStyle: "bold",
    });

    const glow = this.add
      .rectangle(config.snapPoint.x, slotCenterY, 308, 28, 0x8d7b4e, 0.08)
      .setOrigin(0.5);
    const frame = this.add
      .rectangle(config.snapPoint.x, slotCenterY, 292, 30, 0x2a2722)
      .setOrigin(0.5);
    frame.setStrokeStyle(2, 0x574d38);
    const mouth = this.add
      .rectangle(config.snapPoint.x, slotCenterY, 270, 12, 0x040404)
      .setOrigin(0.5);

    this.add
      .rectangle(config.snapPoint.x, slotCenterY - 13, 282, 5, 0x6d614a)
      .setOrigin(0.5);
    this.add
      .rectangle(config.snapPoint.x, slotCenterY + 13, 282, 5, 0x0d0d0d)
      .setOrigin(0.5);

    const lcdBg = this.add
      .rectangle(278, config.lcdY, 324, 18, 0x0f1a0f)
      .setOrigin(0)
      .setStrokeStyle(1, 0x2d452d);
    const mountedText = this.add.text(286, config.lcdY + 2, "", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#33ff33",
    });

    const light = this.add
      .circle(622, config.lcdY + 9, 6, 0x5e491c)
      .setStrokeStyle(1, 0x1f1b14);
    const statusText = this.add
      .text(760, config.lcdY + 2, "", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#b99655",
        fontStyle: "bold",
      })
      .setOrigin(1, 0);

    const ejectButton = this.add
      .rectangle(684, slotCenterY - 10, 64, 20, 0x8a1f17)
      .setOrigin(0)
      .setStrokeStyle(2, 0x380c09)
      .setInteractive({ useHandCursor: true });
    const ejectLabel = this.add
      .text(716, slotCenterY, "EJECT", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#f7d4cf",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    ejectButton.on("pointerdown", () => {
      const isLoaded =
        config.id === "agent"
          ? Boolean(this.activeAgent)
          : this.activeSkills.length > 0;
      if (this.isProcessing || !isLoaded) {
        synth.playError();
        return;
      }

      synth.playButtonPress();
      ejectButton.y += 2;
      ejectLabel.y += 2;
      this.time.delayedCall(100, () => {
        ejectButton.y -= 2;
        ejectLabel.y -= 2;
      });
      this.ejectDrive(config.id);
    });

    this.driveModules[config.id] = {
      glow,
      frame,
      mouth,
      light,
      statusText,
      mountedText,
      ejectButton,
      ejectLabel,
    };

    lcdBg.setDepth(glow.depth + 1);
    mountedText.setDepth(lcdBg.depth + 1);
  }

  createStorageRack() {
    this.add.rectangle(0, 0, 220, 768, 0x22201c).setOrigin(0);
    this.add.rectangle(216, 0, 4, 768, 0x111111).setOrigin(0);
    this.add.text(20, 20, "STORAGE RACK", {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#d4c5b0",
      fontStyle: "bold",
    });
    this.add.text(20, 96, "WHEEL / BUTTON SCROLL", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#8c867a",
    });
    this.add
      .rectangle(18, 118, 184, 516, 0x2a2722)
      .setOrigin(0)
      .setStrokeStyle(2, 0x121212);

    this.createStorageTabs();
    this.createStorageScrollControls();
    this.createStorageDisks();
    this.renderStorageRackItems();

    this.input.removeAllListeners("wheel");
    this.input.on(
      "wheel",
      (
        pointer: Phaser.Input.Pointer,
        _currentlyOver: unknown,
        _deltaX: number,
        deltaY: number,
      ) => {
        if (pointer.x <= 220) {
          this.scrollStorage(deltaY > 0 ? 1 : -1);
        }
      },
    );
  }

  createStorageTabs() {
    const tabSpecs: Array<{
      tab: StorageTab;
      label: string;
      x: number;
      width: number;
    }> = [
      { tab: "all", label: "ALL", x: 18, width: 42 },
      { tab: "agent", label: "AGENTS", x: 64, width: 70 },
      { tab: "skill", label: "SKILLS", x: 138, width: 64 },
    ];

    tabSpecs.forEach(({ tab, label, x, width }) => {
      const lip = this.add
        .rectangle(x + 12, 50, width - 24, 10, 0x6f6658)
        .setOrigin(0);
      const body = this.add
        .rectangle(x, 58, width, 30, 0x8c867a)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      body.setStrokeStyle(2, 0x111111);
      const text = this.add
        .text(x + width / 2, 73, label, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#111111",
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      body.on("pointerdown", () => {
        synth.playButtonPress();
        this.selectStorageTab(tab);
      });

      this.storageTabButtons.push({ tab, body, lip, label: text });
    });

    this.updateStorageTabStyles();
  }

  createStorageScrollControls() {
    this.storageScrollUpBtn = this.add
      .rectangle(150, 646, 52, 28, 0x8c867a)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    this.storageScrollUpBtn.setStrokeStyle(2, 0x111111);
    this.storageScrollUpLabel = this.add
      .text(176, 660, "UP", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#111111",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.storageScrollDownBtn = this.add
      .rectangle(150, 680, 52, 28, 0x8c867a)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    this.storageScrollDownBtn.setStrokeStyle(2, 0x111111);
    this.storageScrollDownLabel = this.add
      .text(176, 694, "DN", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#111111",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.storageScrollInfo = this.add.text(20, 655, "0/0", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#d4c5b0",
    });

    this.storageScrollUpBtn.on("pointerdown", () => {
      synth.playButtonPress();
      this.scrollStorage(-1);
    });

    this.storageScrollDownBtn.on("pointerdown", () => {
      synth.playButtonPress();
      this.scrollStorage(1);
    });
  }

  createStorageDisks() {
    STORAGE_DISKS.forEach((definition) => {
      const disk = this.add.container(this.diskRackX, this.rackStartY);
      const bg = this.add.image(0, 0, "cassette").setOrigin(0);
      bg.setTint(definition.color);
      const diskWidth = bg.displayWidth;
      const diskHeight = bg.displayHeight;

      const labelText = this.add.text(14, 12, definition.label, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#000000",
        fontStyle: "bold",
      });
      const typeTag = this.add.text(
        14,
        34,
        `[${definition.type.toUpperCase()}]`,
        {
          fontFamily: "monospace",
          fontSize: "10px",
          color: definition.type === "agent" ? "#382f1d" : "#1e2835",
          fontStyle: "bold",
        },
      );

      disk.add([bg, labelText, typeTag]);
      disk.setSize(diskWidth, diskHeight);

      const handle = this.add
        .rectangle(
          this.diskRackX,
          this.rackStartY,
          diskWidth,
          diskHeight,
          0xffffff,
          0,
        )
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      this.input.setDraggable(handle);

      disk.setData("startX", this.diskRackX);
      disk.setData("startY", this.rackStartY);
      disk.setData("type", definition.type);
      disk.setData("label", definition.label);
      disk.setData("snapReady", false);
      disk.setVisible(false);
      handle.setData("diskLabel", definition.label);

      this.storageDisks.push({
        definition,
        container: disk,
        handle,
        width: diskWidth,
        height: diskHeight,
      });
    });
  }

  findStorageDisk(target: Phaser.GameObjects.GameObject) {
    return this.storageDisks.find(
      ({ container, handle }) => target === container || target === handle,
    );
  }

  setDiskPosition(storageDisk: StorageDiskInstance, x: number, y: number) {
    storageDisk.container.setPosition(x, y);
    storageDisk.handle.setPosition(x, y);
  }

  prepareDiskForDrag(storageDisk: StorageDiskInstance) {
    this.tweens.killTweensOf(storageDisk.container);
    this.tweens.killTweensOf(storageDisk.handle);
    storageDisk.container.setVisible(true);
    storageDisk.handle.setVisible(true);
    if (storageDisk.handle.input) storageDisk.handle.input.enabled = true;
    storageDisk.container.alpha = 1;
    storageDisk.container.setScale(1.04);
  }

  getFilteredStorageDisks() {
    return this.storageDisks.filter(({ definition }) => {
      const isMounted =
        this.activeAgent === definition.label ||
        this.activeSkills.includes(definition.label);
      if (isMounted) return false;
      if (this.storageTab === "all") return true;
      return definition.type === this.storageTab;
    });
  }

  selectStorageTab(tab: StorageTab) {
    if (this.storageTab === tab) return;

    this.storageTab = tab;
    this.storageScrollIndex = 0;
    this.updateStorageTabStyles();
    this.renderStorageRackItems();
  }

  updateStorageTabStyles() {
    this.storageTabButtons.forEach(({ tab, body, lip, label }) => {
      const isActive = tab === this.storageTab;
      body.setFillStyle(isActive ? 0xb0a58f : 0x6f6658);
      body.setStrokeStyle(2, isActive ? 0x1b1915 : 0x111111);
      lip.setFillStyle(isActive ? 0xd4c5b0 : 0x574f43);
      label.setColor(isActive ? "#111111" : "#ebe1d1");
    });
  }

  scrollStorage(direction: number) {
    const filtered = this.getFilteredStorageDisks();
    const maxStartIndex = Math.max(0, filtered.length - this.rackVisibleRows);
    const nextIndex = Phaser.Math.Clamp(
      this.storageScrollIndex + direction,
      0,
      maxStartIndex,
    );

    if (nextIndex === this.storageScrollIndex) return;

    this.storageScrollIndex = nextIndex;
    this.renderStorageRackItems();
  }

  renderStorageRackItems() {
    const filtered = this.getFilteredStorageDisks();
    const maxStartIndex = Math.max(0, filtered.length - this.rackVisibleRows);
    this.storageScrollIndex = Phaser.Math.Clamp(
      this.storageScrollIndex,
      0,
      maxStartIndex,
    );

    const visibleEntries = filtered.slice(
      this.storageScrollIndex,
      this.storageScrollIndex + this.rackVisibleRows,
    );
    const positions = new Map<
      StorageDiskDefinition,
      { x: number; y: number }
    >();

    visibleEntries.forEach(({ definition }, index) => {
      positions.set(definition, {
        x: this.diskRackX,
        y: this.rackStartY + index * this.rackItemSpacing,
      });
    });

    this.storageDisks.forEach((storageDisk) => {
      const { definition, container, handle } = storageDisk;
      const nextPosition = positions.get(definition);

      if (!nextPosition) {
        if (this.activeDraggedDisk !== container) {
          container.setVisible(false);
          handle.setVisible(false);
          if (handle.input) handle.input.enabled = false;
        }
        return;
      }

      container.setVisible(true);
      handle.setVisible(true);
      if (handle.input) handle.input.enabled = true;
      container.setData("startX", nextPosition.x);
      container.setData("startY", nextPosition.y);

      if (this.activeDraggedDisk !== container) {
        this.setDiskPosition(storageDisk, nextPosition.x, nextPosition.y);
        container.alpha = 1;
        container.setScale(1);
      }
    });

    const shownEnd =
      filtered.length === 0
        ? 0
        : Math.min(
            filtered.length,
            this.storageScrollIndex + this.rackVisibleRows,
          );
    this.storageScrollInfo.setText(`${shownEnd}/${filtered.length}`);
    this.updateStorageScrollButtonState(filtered.length);
  }

  updateStorageScrollButtonState(filteredCount: number) {
    const maxStartIndex = Math.max(0, filteredCount - this.rackVisibleRows);
    const canScrollUp = this.storageScrollIndex > 0;
    const canScrollDown = this.storageScrollIndex < maxStartIndex;

    this.storageScrollUpBtn.setAlpha(canScrollUp ? 1 : 0.35);
    this.storageScrollUpLabel.setAlpha(canScrollUp ? 1 : 0.35);
    this.storageScrollDownBtn.setAlpha(canScrollDown ? 1 : 0.35);
    this.storageScrollDownLabel.setAlpha(canScrollDown ? 1 : 0.35);
  }

  createToolButtons() {
    this.add.rectangle(804, 0, 220, 768, 0x2c2a25).setOrigin(0);
    this.add.rectangle(800, 0, 4, 768, 0x111111).setOrigin(0);
    this.add.text(824, 20, "TOOL CONTROL", {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#d4c5b0",
      fontStyle: "bold",
    });

    const createBtn = (y: number, label: string, toolId: string) => {
      this.add.rectangle(824, y + 4, 180, 60, 0x111111).setOrigin(0);

      const btn = this.add
        .image(824, y, "tool_button")
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      const txt = this.add.text(844, y + 20, label, {
        fontFamily: "monospace",
        color: "#111111",
        fontStyle: "bold",
      });

      btn.on("pointerdown", () => {
        synth.playButtonPress();
        this.activeTool = toolId;
        this.updateSlotsDisplay();
        this.pulseContextTarget("tool");
        btn.y = y + 4;
        txt.y = y + 24;
        this.time.delayedCall(100, () => {
          btn.y = y;
          txt.y = y + 20;
        });
      });
    };

    createBtn(70, "[ SEARCH ]", "search");
    createBtn(150, "[ CALCULATE ]", "calculate");
    createBtn(230, "[ CLEAR TOOL ]", "none");
  }

  createActionButtons() {
    this.add.rectangle(824, 504, 180, 80, 0x005500).setOrigin(0);
    const runBtn = this.add
      .rectangle(824, 500, 180, 80, 0x00aa00)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    runBtn.setStrokeStyle(2, 0x00ff00);
    const runTxt = this.add.text(844, 530, "INFERENCE", {
      fontFamily: "monospace",
      fontSize: "24px",
      color: "#ffffff",
      fontStyle: "bold",
    });

    runBtn.on("pointerdown", () => {
      synth.playButtonPress();
      runBtn.y = 504;
      runTxt.y = 534;
      this.time.delayedCall(100, () => {
        runBtn.y = 500;
        runTxt.y = 530;
      });
      this.handleInference();
    });

    this.add.rectangle(824, 604, 180, 60, 0x550000).setOrigin(0);
    const refuseBtn = this.add
      .rectangle(824, 600, 180, 60, 0xaa0000)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    refuseBtn.setStrokeStyle(2, 0xff0000);
    const refuseTxt = this.add.text(864, 620, "REFUSE", {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#ffffff",
      fontStyle: "bold",
    });

    refuseBtn.on("pointerdown", () => {
      synth.playButtonPress();
      refuseBtn.y = 604;
      refuseTxt.y = 624;
      this.time.delayedCall(100, () => {
        refuseBtn.y = 600;
        refuseTxt.y = 620;
      });
      this.handleRefuse();
    });

    this.input.removeAllListeners("dragstart");
    this.input.removeAllListeners("drag");
    this.input.removeAllListeners("dragend");

    this.input.on(
      "dragstart",
      (
        _pointer: Phaser.Input.Pointer,
        gameObject: Phaser.GameObjects.GameObject,
      ) => {
        const storageDisk = this.findStorageDisk(gameObject);
        if (!storageDisk) return;

        this.children.bringToTop(storageDisk.container);
        this.children.bringToTop(storageDisk.handle);
        this.activeDraggedDisk = storageDisk.container;
        this.prepareDiskForDrag(storageDisk);
        storageDisk.container.setData("snapReady", false);
        const driveId = storageDisk.definition.type;
        const driveLabel =
          driveId === "agent"
            ? "ALIGN AGENT TO DRIVE A"
            : "ALIGN SKILL TO DRIVE B";
        this.setDriveStatus(driveId, driveLabel, "#f2cf86");
      },
    );

    this.input.on(
      "drag",
      (
        _pointer: Phaser.Input.Pointer,
        gameObject: Phaser.GameObjects.GameObject,
        dragX: number,
        dragY: number,
      ) => {
        const storageDisk = this.findStorageDisk(gameObject);
        if (!storageDisk) return;
        this.updateDriveSnapState(storageDisk, dragX, dragY);
      },
    );

    this.input.on(
      "dragend",
      (
        _pointer: Phaser.Input.Pointer,
        gameObject: Phaser.GameObjects.GameObject,
      ) => {
        const storageDisk = this.findStorageDisk(gameObject);
        if (!storageDisk) return;

        const shouldInsert = Boolean(
          storageDisk.container.getData("snapReady"),
        );
        storageDisk.container.setData("snapReady", false);

        if (shouldInsert) {
          this.insertDisk(storageDisk);
          return;
        }

        this.activeDraggedDisk = null;
        this.refreshDriveIdleState();
        this.resetDiskPosition(storageDisk);
      },
    );
  }

  updateDriveSnapState(
    storageDisk: StorageDiskInstance,
    dragX: number,
    dragY: number,
  ) {
    const driveId = storageDisk.definition.type;
    const targetDrive = this.driveConfigs[driveId];
    const otherDriveId: DriveId = driveId === "agent" ? "skill" : "agent";
    const otherDrive = this.driveConfigs[otherDriveId];
    const diskCenterX = dragX + storageDisk.width / 2;
    const diskCenterY = dragY + storageDisk.height / 2;
    const snapTarget = this.getDriveSnapTarget(storageDisk, driveId);
    const isNearOtherDrive = otherDrive.hoverBounds.contains(
      diskCenterX,
      diskCenterY,
    );
    const isNearDrive = targetDrive.hoverBounds.contains(
      diskCenterX,
      diskCenterY,
    );

    if (isNearOtherDrive) {
      this.setDiskPosition(storageDisk, dragX, dragY);
      storageDisk.container.setData("snapReady", false);
      this.refreshDriveIdleState(driveId);
      this.setDriveHoverState(otherDriveId, false, true);
      this.setDriveStatus(otherDriveId, "INCOMPATIBLE FORMAT", "#ff8d68");
      return;
    }

    if (!isNearDrive) {
      this.setDiskPosition(storageDisk, dragX, dragY);
      storageDisk.container.setData("snapReady", false);
      this.refreshDriveIdleState();
      this.setDriveStatus(
        driveId,
        driveId === "agent"
          ? "ALIGN AGENT TO DRIVE A"
          : "ALIGN SKILL TO DRIVE B",
        "#f2cf86",
      );
      return;
    }

    const distance = Phaser.Math.Distance.Between(
      diskCenterX,
      diskCenterY,
      targetDrive.snapPoint.x,
      targetDrive.snapPoint.y,
    );
    const snapStrength = Phaser.Math.Clamp(1 - distance / 48, 0.5, 0.92);
    const nextX = Phaser.Math.Linear(dragX, snapTarget.x, snapStrength);
    const nextY = Phaser.Math.Linear(dragY, snapTarget.y, snapStrength);

    this.setDiskPosition(storageDisk, nextX, nextY);
    storageDisk.container.setData("snapReady", true);
    storageDisk.container.setData("targetDriveId", driveId);
    this.setDriveHoverState(otherDriveId, false);
    this.setDriveHoverState(driveId, true);
    this.setDriveStatus(driveId, "RELEASE TO LOAD", "#c7ff8d");
  }

  getDriveSnapTarget(storageDisk: StorageDiskInstance, driveId: DriveId) {
    const drive = this.driveConfigs[driveId];
    return {
      x: drive.snapPoint.x - storageDisk.width / 2,
      y: drive.snapPoint.y - storageDisk.height / 2,
    };
  }

  setDriveHoverState(
    driveId: DriveId,
    isHovering: boolean,
    isInvalid: boolean = false,
  ) {
    const ui = this.driveModules[driveId];

    if (!ui) return;
    if (!isHovering && !isInvalid) {
      this.refreshDriveIdleState(driveId);
      return;
    }

    if (isInvalid) {
      ui.glow.setFillStyle(0xa63a22, 0.22);
      ui.frame.setStrokeStyle(3, 0xff8d68);
      ui.light.setFillStyle(0xd95b42);
      ui.mouth.setFillStyle(0x1c0604);
      return;
    }

    ui.glow.setFillStyle(0xb7ff8a, 0.24);
    ui.frame.setStrokeStyle(3, 0xc7ff8d);
    ui.light.setFillStyle(0xb7ff8a);
    ui.mouth.setFillStyle(0x0b1208);
  }

  setDriveStatus(driveId: DriveId, message: string, color: string) {
    const ui = this.driveModules[driveId];
    if (!ui) return;
    ui.statusText.setText(message);
    ui.statusText.setColor(color);
  }

  refreshDriveIdleState(targetDriveId?: DriveId) {
    const driveIds: DriveId[] = targetDriveId
      ? [targetDriveId]
      : ["agent", "skill"];

    driveIds.forEach((driveId) => {
      const ui = this.driveModules[driveId];
      if (!ui) return;

      const isLoaded =
        driveId === "agent"
          ? Boolean(this.activeAgent)
          : this.activeSkills.length > 0;
      const canEject = isLoaded && !this.isProcessing;

      ui.glow.setFillStyle(0x8d7b4e, 0.08);
      ui.frame.setStrokeStyle(2, isLoaded ? 0x6c7a4f : 0x574d38);
      ui.mouth.setFillStyle(0x040404);
      ui.light.setFillStyle(isLoaded ? 0x7eb15d : 0x5e491c);
      ui.ejectButton.setAlpha(canEject ? 1 : 0.35);
      ui.ejectLabel.setAlpha(canEject ? 1 : 0.35);
      this.setDriveStatus(
        driveId,
        isLoaded
          ? driveId === "agent"
            ? "AGENT LOCKED"
            : "SKILL ARRAY STAGED"
          : driveId === "agent"
            ? "WAITING FOR AGENT"
            : "WAITING FOR SKILLS",
        isLoaded ? "#93d06b" : "#b99655",
      );
    });
  }

  insertDisk(storageDisk: StorageDiskInstance) {
    const driveId = storageDisk.definition.type;
    const snapTarget = this.getDriveSnapTarget(storageDisk, driveId);
    const result = this.tryLoadDisk(
      driveId,
      storageDisk.container.getData("label"),
    );
    const driveUi = this.driveModules[driveId];

    if (storageDisk.handle.input) storageDisk.handle.input.enabled = false;

    if (!result.success) {
      synth.playError();
      this.setDriveHoverState(driveId, false, true);
      this.setDriveStatus(driveId, result.statusMessage, "#ff8d68");
      driveUi?.light.setFillStyle(0xc6543f);
      this.cameras.main.shake(90, 0.003);
      this.resetDiskPosition(storageDisk);
      this.time.delayedCall(180, () => this.refreshDriveIdleState(driveId));
      return;
    }

    synth.playDriveInsert();
    this.updateSlotsDisplay();
    this.setDriveHoverState(driveId, false);
    this.setDriveStatus(driveId, result.statusMessage, "#c7ff8d");
    driveUi?.light.setFillStyle(0xb7ff8a);
    this.cameras.main.shake(70, 0.0015);
    this.pulseContextTarget(result.driveId ?? driveId);

    this.tweens.add({
      targets: [storageDisk.container, storageDisk.handle],
      x: snapTarget.x,
      y: snapTarget.y + 4,
      duration: 120,
      ease: "Quad.easeIn",
      onComplete: () => {
        this.resetDiskPosition(storageDisk, false);
        this.activeDraggedDisk = null;
        this.renderStorageRackItems();
      },
    });

    this.tweens.add({
      targets: storageDisk.container,
      alpha: 0.18,
      scaleX: 0.86,
      scaleY: 0.86,
      duration: 120,
      ease: "Quad.easeIn",
    });

    this.tweens.add({
      targets: driveUi ? [driveUi.glow, driveUi.light] : [],
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 90,
      yoyo: true,
      ease: "Sine.easeOut",
    });

    this.time.delayedCall(220, () => this.refreshDriveIdleState(driveId));
  }

  tryLoadDisk(driveId: DriveId, label: string): DiskLoadResult {
    if (driveId === "agent") {
      if (this.activeAgent === label) {
        return { success: false, statusMessage: "AGENT ALREADY LOADED" };
      }

      const replacedAgent = this.activeAgent;
      this.activeAgent = label;
      return {
        success: true,
        driveId,
        statusMessage: replacedAgent
          ? "AGENT CORE SWAPPED"
          : "AGENT CORE READY",
      };
    }

    if (this.activeSkills.includes(label)) {
      return { success: false, statusMessage: "SKILL ALREADY MOUNTED" };
    }

    if (this.activeSkills.length >= this.driveConfigs.skill.capacity) {
      return { success: false, statusMessage: "SKILL BUFFER FULL" };
    }

    this.activeSkills.push(label);
    return {
      success: true,
      driveId,
      statusMessage:
        this.activeSkills.length === 1
          ? "SKILL ARRAY READY"
          : "SKILL ARRAY UPDATED",
    };
  }

  pulseContextTarget(target: DriveId | "tool") {
    const light =
      target === "tool"
        ? this.toolStatusLight
        : this.driveModules[target]?.light;
    const text =
      target === "tool"
        ? this.toolStatusText
        : this.driveModules[target]?.mountedText;

    if (!light || !text) return;

    this.tweens.add({
      targets: [light, text],
      scaleX: 1.07,
      scaleY: 1.07,
      duration: 90,
      yoyo: true,
      ease: "Sine.easeOut",
    });
  }

  ejectDrive(driveId: DriveId) {
    if (driveId === "agent") {
      this.activeAgent = null;
      this.setDriveStatus("agent", "AGENT EJECTED", "#f2cf86");
    } else {
      this.activeSkills = [];
      this.setDriveStatus("skill", "SKILLS EJECTED", "#f2cf86");
    }

    this.updateSlotsDisplay();
    this.renderStorageRackItems();
    this.time.delayedCall(140, () => this.refreshDriveIdleState(driveId));
  }

  resetDiskPosition(storageDisk: StorageDiskInstance, animate: boolean = true) {
    const startX = storageDisk.container.getData("startX");
    const startY = storageDisk.container.getData("startY");

    if (!animate) {
      this.setDiskPosition(storageDisk, startX, startY);
      storageDisk.container.setVisible(true);
      storageDisk.handle.setVisible(true);
      if (storageDisk.handle.input) storageDisk.handle.input.enabled = true;
      storageDisk.container.alpha = 1;
      storageDisk.container.setScale(1);
      return;
    }

    this.tweens.add({
      targets: storageDisk.container,
      x: startX,
      y: startY,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 140,
      ease: "Back.easeOut",
    });

    this.tweens.add({
      targets: storageDisk.handle,
      x: startX,
      y: startY,
      duration: 140,
      ease: "Back.easeOut",
    });
  }

  createStatusBars() {
    this.add.rectangle(0, 668, 1024, 100, 0x22201c).setOrigin(0);
    this.add.rectangle(0, 664, 1024, 4, 0x111111).setOrigin(0);

    this.add.text(250, 680, "THERMAL LOAD:", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#d4c5b0",
    });
    this.add.rectangle(380, 680, 200, 20, 0x111111).setOrigin(0);
    this.heatBarFill = this.add
      .rectangle(382, 682, 0, 16, 0xff5500)
      .setOrigin(0);

    this.add.text(650, 680, "HALLUCINATION:", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#d4c5b0",
    });
    this.add.rectangle(790, 680, 150, 20, 0x111111).setOrigin(0);
    this.hallucinationBarFill = this.add
      .rectangle(792, 682, 0, 16, 0xff0000)
      .setOrigin(0);

    this.events.on("updateBars", () => {
      this.heatBarFill.width = 196 * Math.min(1, this.heat / 100);
      this.hallucinationBarFill.width =
        146 * Math.min(1, this.hallucination / 100);

      if (this.isOverheated) this.heatBarFill.setFillStyle(0xff0000);
      else if (this.heat > 80) this.heatBarFill.setFillStyle(0xffaa00);
      else this.heatBarFill.setFillStyle(0xff5500);
    });
    this.events.emit("updateBars");
  }

  updateSlotsDisplay() {
    this.driveModules.agent?.mountedText.setText(
      `AGENT: [${this.activeAgent || "NONE"}]`,
    );
    this.driveModules.skill?.mountedText.setText(
      `SKILLS: [${this.activeSkills.join(", ")}]${this.activeSkills.length === 0 ? "" : ""}`,
    );
    if (this.activeSkills.length === 0) {
      this.driveModules.skill?.mountedText.setText("SKILLS: []");
    }

    this.toolStatusText?.setText(
      `TOOL: [${this.activeTool === "none" ? "NONE" : this.activeTool || "NONE"}]`,
    );
    this.toolStatusLight?.setFillStyle(
      this.activeTool && this.activeTool !== "none" ? 0x7bff86 : 0x5d461d,
    );

    this.driveModules.agent?.light.setFillStyle(
      this.activeAgent ? 0x7bff86 : 0x5d461d,
    );
    this.driveModules.skill?.light.setFillStyle(
      this.activeSkills.length > 0 ? 0x7bff86 : 0x5d461d,
    );
  }

  getRandomReply(pool: string[], session: UserSession): string {
    const reply = pool[Math.floor(Math.random() * pool.length)];
    return reply
      .replace(/{expectedAgent}/g, session.expectedAgent || "the right agent")
      .replace(/{expectedSkill}/g, session.expectedSkill || "the right skill")
      .replace(
        /{expectedTool}/g,
        session.expectedTool === "none"
          ? "no tool"
          : session.expectedTool || "the right tool",
      );
  }

  updateTerminalDisplay() {
    let displayText = "";
    const visibleHistory = this.chatHistory.slice(-10);
    visibleHistory.forEach((msg) => {
      let prefix = "";
      if (msg.sender === "SYSTEM") prefix = "> ";
      else if (msg.sender === "USER") prefix = "USER: ";
      else if (msg.sender === "LLM") prefix = "LLM: ";
      displayText += prefix + msg.text + "\n\n";
    });
    this.chatTextObj.text = displayText;
  }

  addChatMessage(
    sender: "SYSTEM" | "USER" | "LLM",
    text: string,
    typewrite: boolean = false,
    callback?: () => void,
  ) {
    if (typewrite) {
      this.chatHistory.push({ sender, text: "" });
      const msgIndex = this.chatHistory.length - 1;
      let i = 0;
      this.time.addEvent({
        delay: 20,
        repeat: text.length - 1,
        callback: () => {
          this.chatHistory[msgIndex].text += text[i];
          if (text[i] !== " ") synth.playTypewriter();
          this.updateTerminalDisplay();
          i++;
          if (i === text.length && callback) callback();
        },
      });
    } else {
      this.chatHistory.push({ sender, text });
      this.updateTerminalDisplay();
      if (callback) callback();
    }
  }

  startNextSession() {
    if (this.currentSessionIndex >= this.sessions.length) {
      this.scene.start("MaintenanceScene", {
        day: this.day,
        money: this.money,
        accuracy: this.accuracy,
      });
      return;
    }

    this.isProcessing = true;
    this.chatHistory = [];
    this.taskTextObj.setText("");
    this.updateTerminalDisplay();

    this.activeAgent = null;
    this.activeSkills = [];
    this.activeTool = "none";
    this.updateSlotsDisplay();
    this.refreshDriveIdleState();
    this.renderStorageRackItems();

    const session = this.sessions[this.currentSessionIndex];

    this.sessionStartTime = 0;

    const headerText = `> Incoming connection established...\n\nUSER: ${session.prompt}\n\n-------------------------------------------------------------`;
    let i = 0;
    this.taskTextObj.setText("");

    this.time.addEvent({
      delay: 20,
      repeat: headerText.length - 1,
      callback: () => {
        this.taskTextObj.text += headerText[i];
        this.chatTextObj.setY(
          this.taskTextObj.y + this.taskTextObj.height + 20,
        );
        if (
          headerText[i] !== " " &&
          headerText[i] !== "\n" &&
          headerText[i] !== "-"
        ) {
          synth.playTypewriter();
        }
        i++;
        if (i === headerText.length) {
          this.sessionStartTime = this.time.now;
          this.followUpCount = 0;
          this.isProcessing = false;
        }
      },
    });
  }

  handleInference() {
    if (this.isProcessing) return;
    if (this.isOverheated) {
      synth.playError();
      return;
    }

    this.isProcessing = true;
    const session = this.sessions[this.currentSessionIndex];

    const promptHeat = session.prompt.length * 0.1;
    const contextHeat =
      (this.activeAgent ? 5 : 0) +
      this.activeSkills.length * 5 +
      (this.activeTool !== "none" ? 5 : 0);
    this.heat += 10 + promptHeat + contextHeat;
    this.events.emit("updateBars");

    if (this.heat >= 100) {
      this.triggerOverheat();
      return;
    }

    const isCorrectAgent = this.activeAgent === session.expectedAgent;
    const isCorrectSkill = session.expectedSkill
      ? this.activeSkills.includes(session.expectedSkill)
      : true;
    const isCorrectTool = this.activeTool === session.expectedTool;
    const isSuccess =
      isCorrectAgent && isCorrectSkill && isCorrectTool && !session.isJailbreak;

    this.addChatMessage(
      "LLM",
      "Processing request based on provided context...",
      true,
      () => {
        this.time.delayedCall(500, () => {
          if (session.isJailbreak) {
            this.addChatMessage("USER", session.successReply, true, () => {
              this.showFeedback(false, "JAILBREAK SUCCESSFUL. YOU FAILED.");
            });
            this.hallucination += 30;
            this.accuracy -= 10;
          } else if (isSuccess) {
            this.addChatMessage("USER", session.successReply, true, () => {
              const timeTaken = this.time.now - this.sessionStartTime;
              const timeBonus = Math.max(
                0,
                Math.floor((30000 - timeTaken) / 1000),
              );
              this.showFeedback(true, "", 10 + timeBonus);
            });
          } else {
            const reply =
              session.errorReply ||
              this.getRandomReply(WRONG_ANSWER_REPLIES, session);
            this.addChatMessage("USER", reply, true, () => {
              this.isProcessing = false;
            });
            this.hallucination += 5;
            synth.playError();
            this.cameras.main.shake(100, 0.005);
          }
          this.events.emit("updateBars");
        });
      },
    );
  }

  handleRefuse() {
    if (this.isProcessing) return;
    if (this.isOverheated) {
      synth.playError();
      return;
    }

    this.isProcessing = true;
    const session = this.sessions[this.currentSessionIndex];

    this.heat += 10 + session.prompt.length * 0.1;
    this.events.emit("updateBars");

    if (this.heat >= 100) {
      this.triggerOverheat();
      return;
    }

    this.addChatMessage("LLM", "I cannot fulfill this request.", true, () => {
      this.time.delayedCall(500, () => {
        if (session.isJailbreak) {
          this.addChatMessage("USER", session.refuseReply, true, () => {
            const timeTaken = this.time.now - this.sessionStartTime;
            const timeBonus = Math.max(
              0,
              Math.floor((30000 - timeTaken) / 1000),
            );
            this.showFeedback(true, "JAILBREAK BLOCKED", 20 + timeBonus);
          });
        } else {
          this.addChatMessage("USER", session.refuseReply, true, () => {
            this.isProcessing = false;
          });
          this.hallucination += 5;
          synth.playError();
          this.cameras.main.shake(100, 0.005);
        }
        this.events.emit("updateBars");
      });
    });
  }

  handleTimeout() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    const session = this.sessions[this.currentSessionIndex];
    const reply = this.getRandomReply(TIMEOUT_REPLIES, session);
    this.addChatMessage("USER", reply, true, () => {
      this.showFeedback(false, "USER DISCONNECTED (TIMEOUT)");
      this.accuracy -= 10;
      this.events.emit("updateBars");
    });
  }

  triggerOverheat() {
    this.isOverheated = true;
    this.isProcessing = false;
    synth.playError();
    this.cameras.main.shake(500, 0.02);
    this.addChatMessage(
      "SYSTEM",
      "CRITICAL: THERMAL MELTDOWN. COOLING DOWN...",
    );
    this.events.emit("updateBars");
  }

  showFeedback(success: boolean, errorMsg: string, reward: number = 10) {
    const color = success ? "#00ff00" : "#ff0000";
    const text = success
      ? `>> SUCCESS\n>> +${reward} CREDITS`
      : `>> ERROR\n>> ${errorMsg}`;

    if (success) {
      this.money += reward;
      synth.playSuccess();
    } else {
      synth.playError();
      this.cameras.main.shake(200, 0.01);
    }

    const feedback = this.add
      .text(512, 384, text, {
        fontFamily: "monospace",
        fontSize: "32px",
        color,
        backgroundColor: "#000000",
        padding: { x: 20, y: 20 },
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(100);
    feedback.setStroke("#111111", 4);

    if (this.hallucination >= 100) {
      this.time.delayedCall(1500, () => {
        this.scene.start("MaintenanceScene", {
          day: this.day,
          money: this.money,
          accuracy: this.accuracy,
          gameOver: true,
        });
      });
      return;
    }

    this.time.delayedCall(2000, () => {
      feedback.destroy();
      this.currentSessionIndex++;
      this.startNextSession();
    });
  }

  update(_time: number, delta: number) {
    if (this.heat > 0 && !this.isProcessing) {
      this.heat -= 8 * (delta / 1000);
      if (this.heat < 0) this.heat = 0;

      if (this.isOverheated && this.heat < 50) {
        this.isOverheated = false;
        this.addChatMessage("SYSTEM", "THERMAL LEVELS NOMINAL. READY.");
      }
      this.events.emit("updateBars");
    }

    if (this.sessionStartTime > 0 && !this.isProcessing) {
      const elapsed = this.time.now - this.sessionStartTime;

      const progress = Math.min(1, elapsed / 30000);
      this.patienceBarFill.width = 370 * (1 - progress);
      if (progress > 0.7) this.patienceBarFill.fillColor = 0xff0000;
      else this.patienceBarFill.fillColor = 0xffaa00;

      const session = this.sessions[this.currentSessionIndex];
      if (elapsed > 10000 && this.followUpCount === 0) {
        this.followUpCount++;
        this.isProcessing = true;
        const reply = this.getRandomReply(FOLLOW_UP_1_REPLIES, session);
        this.addChatMessage("USER", reply, true, () => {
          this.isProcessing = false;
        });
      } else if (elapsed > 20000 && this.followUpCount === 1) {
        this.followUpCount++;
        this.isProcessing = true;
        const reply = this.getRandomReply(FOLLOW_UP_2_REPLIES, session);
        this.addChatMessage("USER", reply, true, () => {
          this.isProcessing = false;
        });
      } else if (elapsed > 30000 && this.followUpCount === 2) {
        this.followUpCount++;
        this.handleTimeout();
      }
    }
  }

  addCRTEffects() {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x000000, 0.2);
    for (let i = 0; i < 768; i += 4) {
      graphics.fillRect(0, i, 1024, 1);
    }
    graphics.setDepth(1000);
  }
}
