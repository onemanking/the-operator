import Phaser from "phaser";
import { synth } from "../../utils/SoundSynth";
import {
  STORAGE_DISKS,
  STORAGE_TABS,
  TOOL_BUTTONS,
  createDriveConfigs,
} from "./config";
import {
  DiskLoadResult,
  DriveConfig,
  DriveId,
  DriveUi,
  StorageDiskDefinition,
  StorageDiskInstance,
  StorageTab,
  StorageTabButton,
  ToolId,
} from "./types";

interface StorageControllerBindings {
  getActiveAgent: () => string | null;
  setActiveAgent: (value: string | null) => void;
  getActiveSkills: () => string[];
  setActiveSkills: (value: string[]) => void;
  getActiveTool: () => ToolId;
  setActiveTool: (value: ToolId) => void;
  isProcessing: () => boolean;
}

export class MainSceneStorageController {
  private readonly diskRackX = 20;
  private readonly rackVisibleRows = 6;
  private readonly rackItemSpacing = 72;
  private readonly rackStartY = 132;
  private readonly driveConfigs: Record<DriveId, DriveConfig> =
    createDriveConfigs();

  private driveModules = {} as Record<DriveId, DriveUi>;
  private toolStatusLight!: Phaser.GameObjects.Arc;
  private toolStatusText!: Phaser.GameObjects.Text;
  private storageTab: StorageTab = "all";
  private storageScrollIndex: number = 0;
  private storageDisks: StorageDiskInstance[] = [];
  private storageTabButtons: StorageTabButton[] = [];
  private storageScrollInfo!: Phaser.GameObjects.Text;
  private storageScrollUpBtn!: Phaser.GameObjects.Rectangle;
  private storageScrollDownBtn!: Phaser.GameObjects.Rectangle;
  private storageScrollUpLabel!: Phaser.GameObjects.Text;
  private storageScrollDownLabel!: Phaser.GameObjects.Text;
  private activeDraggedDisk: Phaser.GameObjects.Container | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bindings: StorageControllerBindings,
  ) {}

  createContextAssemblyArea() {
    this.scene.add.text(250, 480, "CONTEXT ASSEMBLY [DUAL DRIVE]", {
      fontFamily: "monospace",
      color: "#d4c5b0",
      fontStyle: "bold",
    });

    const driveHousing = this.scene.add
      .rectangle(250, 506, 524, 154, 0x181512)
      .setOrigin(0);
    driveHousing.setStrokeStyle(4, 0x0a0a0a);

    this.scene.add
      .rectangle(266, 523, 96, 24, 0x77674f)
      .setOrigin(0)
      .setStrokeStyle(2, 0x2a241a);
    this.scene.add
      .text(314, 535, "BUS LINK", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#17120d",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.scene.add.rectangle(314, 564, 8, 16, 0x77674f).setOrigin(0.5, 0);

    this.createDriveModule(this.driveConfigs.agent);
    this.createDriveModule(this.driveConfigs.skill);

    this.toolStatusLight = this.scene.add
      .circle(286, 647, 6, 0x5d461d)
      .setStrokeStyle(1, 0x1f1b14);
    this.scene.add.text(302, 639, "TOOL BUS", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#8c867a",
      fontStyle: "bold",
    });
    this.toolStatusText = this.scene.add.text(382, 639, "TOOL: [NONE]", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#33ff33",
    });

    this.updateSlotsDisplay();
    this.refreshDriveIdleState();
  }

  createStorageRack() {
    this.scene.add.rectangle(0, 0, 220, 768, 0x22201c).setOrigin(0);
    this.scene.add.rectangle(216, 0, 4, 768, 0x111111).setOrigin(0);
    this.scene.add.text(20, 20, "STORAGE RACK", {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#d4c5b0",
      fontStyle: "bold",
    });
    this.scene.add.text(20, 96, "WHEEL / BUTTON SCROLL", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#8c867a",
    });
    this.scene.add
      .rectangle(18, 118, 184, 516, 0x2a2722)
      .setOrigin(0)
      .setStrokeStyle(2, 0x121212);

    this.createStorageTabs();
    this.createStorageScrollControls();
    this.createStorageDisks();
    this.renderStorageRackItems();

    this.scene.input.removeAllListeners("wheel");
    this.scene.input.on(
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

  createToolButtons() {
    this.scene.add.rectangle(804, 0, 220, 768, 0x2c2a25).setOrigin(0);
    this.scene.add.rectangle(800, 0, 4, 768, 0x111111).setOrigin(0);
    this.scene.add.text(824, 20, "TOOL CONTROL", {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#d4c5b0",
      fontStyle: "bold",
    });

    const createBtn = (y: number, label: string, toolId: ToolId) => {
      this.scene.add.rectangle(824, y + 4, 180, 60, 0x111111).setOrigin(0);

      const btn = this.scene.add
        .image(824, y, "tool_button")
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      const txt = this.scene.add.text(844, y + 20, label, {
        fontFamily: "monospace",
        color: "#111111",
        fontStyle: "bold",
      });

      btn.on("pointerdown", () => {
        synth.playButtonPress();
        this.bindings.setActiveTool(toolId);
        this.updateSlotsDisplay();
        this.pulseContextTarget("tool");
        btn.y = y + 4;
        txt.y = y + 24;
        this.scene.time.delayedCall(100, () => {
          btn.y = y;
          txt.y = y + 20;
        });
      });
    };

    TOOL_BUTTONS.forEach(({ y, label, toolId }) => {
      createBtn(y, label, toolId);
    });
  }

  bindDragHandlers() {
    this.scene.input.removeAllListeners("dragstart");
    this.scene.input.removeAllListeners("drag");
    this.scene.input.removeAllListeners("dragend");

    this.scene.input.on(
      "dragstart",
      (
        _pointer: Phaser.Input.Pointer,
        gameObject: Phaser.GameObjects.GameObject,
      ) => {
        const storageDisk = this.findStorageDisk(gameObject);
        if (!storageDisk) return;

        this.scene.children.bringToTop(storageDisk.container);
        this.scene.children.bringToTop(storageDisk.handle);
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

    this.scene.input.on(
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

    this.scene.input.on(
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

  syncUi() {
    this.updateSlotsDisplay();
    this.refreshDriveIdleState();
    this.renderStorageRackItems();
  }

  private get activeAgent() {
    return this.bindings.getActiveAgent();
  }

  private get activeSkills() {
    return this.bindings.getActiveSkills();
  }

  private get activeTool() {
    return this.bindings.getActiveTool();
  }

  private createDriveModule(config: DriveConfig) {
    const labelY = config.housingY + 10;
    const slotCenterY = config.snapPoint.y;

    this.scene.add
      .rectangle(262, config.housingY, 500, config.housingHeight, 0x221d18)
      .setOrigin(0)
      .setStrokeStyle(2, 0x111111);
    this.scene.add.text(278, labelY, config.title, {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#d4c5b0",
      fontStyle: "bold",
    });

    const glow = this.scene.add
      .rectangle(config.snapPoint.x, slotCenterY, 308, 28, 0x8d7b4e, 0.08)
      .setOrigin(0.5);
    const frame = this.scene.add
      .rectangle(config.snapPoint.x, slotCenterY, 292, 30, 0x2a2722)
      .setOrigin(0.5);
    frame.setStrokeStyle(2, 0x574d38);
    const mouth = this.scene.add
      .rectangle(config.snapPoint.x, slotCenterY, 270, 12, 0x040404)
      .setOrigin(0.5);

    this.scene.add
      .rectangle(config.snapPoint.x, slotCenterY - 13, 282, 5, 0x6d614a)
      .setOrigin(0.5);
    this.scene.add
      .rectangle(config.snapPoint.x, slotCenterY + 13, 282, 5, 0x0d0d0d)
      .setOrigin(0.5);

    const lcdBg = this.scene.add
      .rectangle(278, config.lcdY, 324, 18, 0x0f1a0f)
      .setOrigin(0)
      .setStrokeStyle(1, 0x2d452d);
    const mountedText = this.scene.add.text(286, config.lcdY + 2, "", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#33ff33",
    });

    const light = this.scene.add
      .circle(622, config.lcdY + 9, 6, 0x5e491c)
      .setStrokeStyle(1, 0x1f1b14);
    const statusText = this.scene.add
      .text(760, config.lcdY + 2, "", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#b99655",
        fontStyle: "bold",
      })
      .setOrigin(1, 0);

    const ejectButton = this.scene.add
      .rectangle(684, slotCenterY - 10, 64, 20, 0x8a1f17)
      .setOrigin(0)
      .setStrokeStyle(2, 0x380c09)
      .setInteractive({ useHandCursor: true });
    const ejectLabel = this.scene.add
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
      if (this.bindings.isProcessing() || !isLoaded) {
        synth.playError();
        return;
      }

      synth.playButtonPress();
      ejectButton.y += 2;
      ejectLabel.y += 2;
      this.scene.time.delayedCall(100, () => {
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

  private createStorageTabs() {
    STORAGE_TABS.forEach(({ tab, label, x, width }) => {
      const lip = this.scene.add
        .rectangle(x + 12, 50, width - 24, 10, 0x6f6658)
        .setOrigin(0);
      const body = this.scene.add
        .rectangle(x, 58, width, 30, 0x8c867a)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      body.setStrokeStyle(2, 0x111111);
      const text = this.scene.add
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

  private createStorageScrollControls() {
    this.storageScrollUpBtn = this.scene.add
      .rectangle(150, 646, 52, 28, 0x8c867a)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    this.storageScrollUpBtn.setStrokeStyle(2, 0x111111);
    this.storageScrollUpLabel = this.scene.add
      .text(176, 660, "UP", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#111111",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.storageScrollDownBtn = this.scene.add
      .rectangle(150, 680, 52, 28, 0x8c867a)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    this.storageScrollDownBtn.setStrokeStyle(2, 0x111111);
    this.storageScrollDownLabel = this.scene.add
      .text(176, 694, "DN", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#111111",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.storageScrollInfo = this.scene.add.text(20, 655, "0/0", {
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

  private createStorageDisks() {
    STORAGE_DISKS.forEach((definition) => {
      const disk = this.scene.add.container(this.diskRackX, this.rackStartY);
      const bg = this.scene.add.image(0, 0, "cassette").setOrigin(0);
      bg.setTint(definition.color);
      const diskWidth = bg.displayWidth;
      const diskHeight = bg.displayHeight;

      const labelText = this.scene.add.text(14, 12, definition.label, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#000000",
        fontStyle: "bold",
      });
      const typeTag = this.scene.add.text(
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

      const handle = this.scene.add
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
      this.scene.input.setDraggable(handle);

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

  private findStorageDisk(target: Phaser.GameObjects.GameObject) {
    return this.storageDisks.find(
      ({ container, handle }) => target === container || target === handle,
    );
  }

  private setDiskPosition(
    storageDisk: StorageDiskInstance,
    x: number,
    y: number,
  ) {
    storageDisk.container.setPosition(x, y);
    storageDisk.handle.setPosition(x, y);
  }

  private prepareDiskForDrag(storageDisk: StorageDiskInstance) {
    this.scene.tweens.killTweensOf(storageDisk.container);
    this.scene.tweens.killTweensOf(storageDisk.handle);
    storageDisk.container.setVisible(true);
    storageDisk.handle.setVisible(true);
    if (storageDisk.handle.input) storageDisk.handle.input.enabled = true;
    storageDisk.container.alpha = 1;
    storageDisk.container.setScale(1.04);
  }

  private getFilteredStorageDisks() {
    return this.storageDisks.filter(({ definition }) => {
      const isMounted =
        this.activeAgent === definition.label ||
        this.activeSkills.includes(definition.label);
      if (isMounted) return false;
      if (this.storageTab === "all") return true;
      return definition.type === this.storageTab;
    });
  }

  private selectStorageTab(tab: StorageTab) {
    if (this.storageTab === tab) return;

    this.storageTab = tab;
    this.storageScrollIndex = 0;
    this.updateStorageTabStyles();
    this.renderStorageRackItems();
  }

  private updateStorageTabStyles() {
    this.storageTabButtons.forEach(({ tab, body, lip, label }) => {
      const isActive = tab === this.storageTab;
      body.setFillStyle(isActive ? 0xb0a58f : 0x6f6658);
      body.setStrokeStyle(2, isActive ? 0x1b1915 : 0x111111);
      lip.setFillStyle(isActive ? 0xd4c5b0 : 0x574f43);
      label.setColor(isActive ? "#111111" : "#ebe1d1");
    });
  }

  private scrollStorage(direction: number) {
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

  private renderStorageRackItems() {
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

  private updateStorageScrollButtonState(filteredCount: number) {
    const maxStartIndex = Math.max(0, filteredCount - this.rackVisibleRows);
    const canScrollUp = this.storageScrollIndex > 0;
    const canScrollDown = this.storageScrollIndex < maxStartIndex;

    this.storageScrollUpBtn.setAlpha(canScrollUp ? 1 : 0.35);
    this.storageScrollUpLabel.setAlpha(canScrollUp ? 1 : 0.35);
    this.storageScrollDownBtn.setAlpha(canScrollDown ? 1 : 0.35);
    this.storageScrollDownLabel.setAlpha(canScrollDown ? 1 : 0.35);
  }

  private updateDriveSnapState(
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

  private getDriveSnapTarget(
    storageDisk: StorageDiskInstance,
    driveId: DriveId,
  ) {
    const drive = this.driveConfigs[driveId];
    return {
      x: drive.snapPoint.x - storageDisk.width / 2,
      y: drive.snapPoint.y - storageDisk.height / 2,
    };
  }

  private setDriveHoverState(
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

  private setDriveStatus(driveId: DriveId, message: string, color: string) {
    const ui = this.driveModules[driveId];
    if (!ui) return;
    ui.statusText.setText(message);
    ui.statusText.setColor(color);
  }

  private refreshDriveIdleState(targetDriveId?: DriveId) {
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
      const canEject = isLoaded && !this.bindings.isProcessing();

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

  private insertDisk(storageDisk: StorageDiskInstance) {
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
      this.scene.cameras.main.shake(90, 0.003);
      this.resetDiskPosition(storageDisk);
      this.scene.time.delayedCall(180, () =>
        this.refreshDriveIdleState(driveId),
      );
      return;
    }

    synth.playDriveInsert();
    this.updateSlotsDisplay();
    this.setDriveHoverState(driveId, false);
    this.setDriveStatus(driveId, result.statusMessage, "#c7ff8d");
    driveUi?.light.setFillStyle(0xb7ff8a);
    this.scene.cameras.main.shake(70, 0.0015);
    this.pulseContextTarget(result.driveId ?? driveId);

    this.scene.tweens.add({
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

    this.scene.tweens.add({
      targets: storageDisk.container,
      alpha: 0.18,
      scaleX: 0.86,
      scaleY: 0.86,
      duration: 120,
      ease: "Quad.easeIn",
    });

    this.scene.tweens.add({
      targets: driveUi ? [driveUi.glow, driveUi.light] : [],
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 90,
      yoyo: true,
      ease: "Sine.easeOut",
    });

    this.scene.time.delayedCall(220, () => this.refreshDriveIdleState(driveId));
  }

  private tryLoadDisk(driveId: DriveId, label: string): DiskLoadResult {
    if (driveId === "agent") {
      if (this.activeAgent === label) {
        return { success: false, statusMessage: "AGENT ALREADY LOADED" };
      }

      const replacedAgent = this.activeAgent;
      this.bindings.setActiveAgent(label);
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

    this.bindings.setActiveSkills([...this.activeSkills, label]);
    return {
      success: true,
      driveId,
      statusMessage:
        this.activeSkills.length === 0
          ? "SKILL ARRAY READY"
          : "SKILL ARRAY UPDATED",
    };
  }

  private pulseContextTarget(target: DriveId | "tool") {
    const light =
      target === "tool"
        ? this.toolStatusLight
        : this.driveModules[target]?.light;
    const text =
      target === "tool"
        ? this.toolStatusText
        : this.driveModules[target]?.mountedText;

    if (!light || !text) return;

    this.scene.tweens.add({
      targets: [light, text],
      scaleX: 1.07,
      scaleY: 1.07,
      duration: 90,
      yoyo: true,
      ease: "Sine.easeOut",
    });
  }

  private ejectDrive(driveId: DriveId) {
    if (driveId === "agent") {
      this.bindings.setActiveAgent(null);
      this.setDriveStatus("agent", "AGENT EJECTED", "#f2cf86");
    } else {
      this.bindings.setActiveSkills([]);
      this.setDriveStatus("skill", "SKILLS EJECTED", "#f2cf86");
    }

    this.updateSlotsDisplay();
    this.renderStorageRackItems();
    this.scene.time.delayedCall(140, () => this.refreshDriveIdleState(driveId));
  }

  private resetDiskPosition(
    storageDisk: StorageDiskInstance,
    animate: boolean = true,
  ) {
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

    this.scene.tweens.add({
      targets: storageDisk.container,
      x: startX,
      y: startY,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 140,
      ease: "Back.easeOut",
    });

    this.scene.tweens.add({
      targets: storageDisk.handle,
      x: startX,
      y: startY,
      duration: 140,
      ease: "Back.easeOut",
    });
  }

  private updateSlotsDisplay() {
    this.driveModules.agent?.mountedText.setText(
      `AGENT: [${this.activeAgent || "NONE"}]`,
    );
    this.driveModules.skill?.mountedText.setText(
      this.activeSkills.length > 0
        ? `SKILLS: [${this.activeSkills.join(", ")}]`
        : "SKILLS: []",
    );

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
}
