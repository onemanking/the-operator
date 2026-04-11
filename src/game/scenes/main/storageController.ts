import Phaser from "phaser";
import { synth } from "../../utils/SoundSynth";
import { STORAGE_DISKS, STORAGE_TABS, createDriveConfigs } from "./config";
import { AgentId, SkillId, isAgentId, isSkillId } from "../../data/PromptIds";
import {
  DiskLoadResult,
  DriveConfig,
  DriveId,
  DriveUi,
  StorageDiskDefinition,
  StorageDiskInstance,
  StorageTab,
  StorageTabButton,
} from "./types";

interface StorageControllerBindings {
  getActiveAgents: () => AgentId[];
  setActiveAgents: (value: AgentId[]) => void;
  getActiveSkills: () => SkillId[];
  setActiveSkills: (value: SkillId[]) => void;
  getAgentCapacity: () => number;
  getSkillCapacity: () => number;
}

export class MainSceneStorageController {
  private readonly diskRackX = 20;
  private readonly rackVisibleRows = 5;
  private readonly rackItemSpacing = 72;
  private readonly rackStartY = 132;
  private readonly driveConfigs: Record<DriveId, DriveConfig>;
  private readonly driveMountedLabels: Record<DriveId, string> = {
    agent: "",
    skill: "",
  };
  private readonly driveMountedScrollOffsets: Record<DriveId, number> = {
    agent: 0,
    skill: 0,
  };

  private driveModules = {} as Record<DriveId, DriveUi>;
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
  private driveMountedScrollTimer?: Phaser.Time.TimerEvent;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bindings: StorageControllerBindings,
  ) {
    this.driveConfigs = createDriveConfigs({
      agentCapacity: this.bindings.getAgentCapacity(),
      skillCapacity: this.bindings.getSkillCapacity(),
    });
  }

  createContextAssemblyArea() {
    this.scene.add.text(250, 480, "CONTEXT ASSEMBLY", {
      fontFamily: "monospace",
      color: "#d4c5b0",
      fontStyle: "bold",
    });

    const driveHousing = this.scene.add
      .rectangle(250, 506, 524, 136, 0x181512)
      .setOrigin(0);
    driveHousing.setStrokeStyle(4, 0x0a0a0a);

    this.createDriveModule(this.driveConfigs.agent);
    this.createDriveModule(this.driveConfigs.skill);

    this.ensureMountedTextScrollTimer();
    this.updateSlotsDisplay();
    this.refreshDriveIdleState();
  }

  private getDrivePalette(driveId: DriveId) {
    if (driveId === "agent") {
      return {
        titleColor: "#23351d",
        slotGlow: 0x8adf74,
        frameDim: 0x49603b,
        slotRailLight: 0xc9e8b3,
        lcdBorder: 0x335f33,
        lcdText: "#6cff69",
        haloColor: 0xb7ff8a,
        haloStroke: 0x345a24,
        lampOff: 0x193118,
        lampOn: 0x7eb15d,
        accentBright: 0xc7ff8d,
      };
    }

    return {
      titleColor: "#1d2940",
      slotGlow: 0x6f9eff,
      frameDim: 0x41557a,
      slotRailLight: 0xc6d7ff,
      lcdBorder: 0x35527d,
      lcdText: "#7ec0ff",
      haloColor: 0xb7d4ff,
      haloStroke: 0x29446c,
      lampOff: 0x16243d,
      lampOn: 0x6f9eff,
      accentBright: 0xc4dbff,
    };
  }

  private ensureMountedTextScrollTimer() {
    if (this.driveMountedScrollTimer) return;

    this.driveMountedScrollTimer = this.scene.time.addEvent({
      delay: 180,
      loop: true,
      callback: () => {
        this.syncMountedTextMarquee("agent");
        this.syncMountedTextMarquee("skill");
      },
    });
  }

  private getMountedTextCharCapacity(driveId: DriveId) {
    return driveId === "agent" ? 18 : 18;
  }

  private syncMountedTextMarquee(driveId: DriveId, reset: boolean = false) {
    const ui = this.driveModules[driveId];
    if (!ui) return;

    const source = this.driveMountedLabels[driveId] ?? "";
    const capacity = this.getMountedTextCharCapacity(driveId);

    if (reset) {
      this.driveMountedScrollOffsets[driveId] = 0;
    }

    if (source.length <= capacity) {
      ui.mountedText.setText(source);
      return;
    }

    const spacer = "   ";
    const cycleLength = source.length + spacer.length;
    const looped = `${source}${spacer}${source}`;
    const offset = this.driveMountedScrollOffsets[driveId] % cycleLength;

    ui.mountedText.setText(looped.slice(offset, offset + capacity));
    this.driveMountedScrollOffsets[driveId] = (offset + 1) % cycleLength;
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
      .rectangle(18, 118, 184, 386, 0x2a2722)
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
        const palette = this.getDrivePalette(driveId);
        this.setDriveLampState(
          driveId,
          palette.lampOn,
          palette.accentBright,
          0.18,
          1.06,
        );
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

  private get activeAgents() {
    return this.bindings.getActiveAgents();
  }

  private get activeSkills() {
    return this.bindings.getActiveSkills();
  }

  private createDriveModule(config: DriveConfig) {
    const labelY = config.housingY + 10;
    const slotCenterY = config.snapPoint.y;
    const frameCenterX = config.snapPoint.x;
    const palette = this.getDrivePalette(config.id);

    this.scene.add
      .rectangle(262, config.housingY, 500, config.housingHeight, 0x7f786b)
      .setOrigin(0)
      .setStrokeStyle(2, 0x111111);
    this.scene.add
      .rectangle(262, config.housingY, 500, 4, 0xa79e8c)
      .setOrigin(0);
    this.scene.add
      .rectangle(
        262,
        config.housingY + config.housingHeight - 4,
        500,
        4,
        0x3d3932,
      )
      .setOrigin(0);
    this.scene.add.text(278, labelY, config.title, {
      fontFamily: "monospace",
      fontSize: "12px",
      color: palette.titleColor,
      fontStyle: "bold",
    });

    const glow = this.scene.add
      .rectangle(frameCenterX, slotCenterY, 270, 28, palette.slotGlow, 0.08)
      .setOrigin(0.5);
    const frame = this.scene.add
      .rectangle(frameCenterX, slotCenterY, 236, 18, 0x39352d)
      .setOrigin(0.5);
    frame.setStrokeStyle(2, palette.frameDim);
    const mouth = this.scene.add
      .rectangle(frameCenterX, slotCenterY, 208, 6, 0x040404)
      .setOrigin(0.5);

    this.scene.add
      .rectangle(frameCenterX, slotCenterY - 8, 224, 3, palette.slotRailLight)
      .setOrigin(0.5);
    this.scene.add
      .rectangle(frameCenterX, slotCenterY + 8, 224, 3, 0x1b1915)
      .setOrigin(0.5);

    const lcdBg = this.scene.add
      .rectangle(278, config.lcdY, 156, 18, 0x0f1a0f)
      .setOrigin(0)
      .setStrokeStyle(1, palette.lcdBorder);
    const mountedText = this.scene.add.text(286, config.lcdY + 2, "", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: palette.lcdText,
    });

    const lightHalo = this.scene.add
      .circle(716, config.housingY + 16, 10, palette.haloColor, 0)
      .setStrokeStyle(1, palette.haloStroke, 0.45);
    const light = this.scene.add
      .circle(716, config.housingY + 16, 6, palette.lampOff, 1)
      .setStrokeStyle(2, 0x111111);

    const ejectButton = this.scene.add
      .rectangle(688, config.housingY + 28, 56, 18, 0x8a1f17)
      .setOrigin(0)
      .setStrokeStyle(2, 0x380c09)
      .setInteractive({ useHandCursor: true });
    const ejectLabel = this.scene.add
      .text(716, config.housingY + 37, "EJECT", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#f7d4cf",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    ejectButton.on("pointerdown", () => {
      const isLoaded =
        config.id === "agent"
          ? this.activeAgents.length > 0
          : this.activeSkills.length > 0;
      if (!isLoaded) {
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
      lightHalo,
      light,
      mountedText,
      ejectButton,
      ejectLabel,
    };

    lcdBg.setDepth(glow.depth + 1);
    mountedText.setDepth(lcdBg.depth + 1);
    this.syncMountedTextMarquee(config.id, true);
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
      .rectangle(150, 524, 52, 28, 0x8c867a)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    this.storageScrollUpBtn.setStrokeStyle(2, 0x111111);
    this.storageScrollUpLabel = this.scene.add
      .text(176, 538, "UP", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#111111",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.storageScrollDownBtn = this.scene.add
      .rectangle(150, 558, 52, 28, 0x8c867a)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    this.storageScrollDownBtn.setStrokeStyle(2, 0x111111);
    this.storageScrollDownLabel = this.scene.add
      .text(176, 572, "DN", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#111111",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.storageScrollInfo = this.scene.add.text(20, 534, "0/0", {
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
        definition.type === "agent"
          ? this.activeAgents.includes(definition.label)
          : this.activeSkills.includes(definition.label);
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
    const draggedDiskBounds = new Phaser.Geom.Rectangle(
      dragX,
      dragY,
      storageDisk.width,
      storageDisk.height,
    );
    const diskCenterX = dragX + storageDisk.width / 2;
    const diskCenterY = dragY + storageDisk.height / 2;
    const snapTarget = this.getDriveSnapTarget(storageDisk, driveId);
    const isNearOtherDrive = Phaser.Geom.Rectangle.Overlaps(
      draggedDiskBounds,
      otherDrive.hoverBounds,
    );
    const isNearDrive = Phaser.Geom.Rectangle.Overlaps(
      draggedDiskBounds,
      targetDrive.hoverBounds,
    );

    if (isNearOtherDrive) {
      this.setDiskPosition(storageDisk, dragX, dragY);
      storageDisk.container.setData("snapReady", false);
      this.refreshDriveIdleState(driveId);
      this.setDriveHoverState(otherDriveId, false, true);
      return;
    }

    if (!isNearDrive) {
      this.setDiskPosition(storageDisk, dragX, dragY);
      storageDisk.container.setData("snapReady", false);
      this.refreshDriveIdleState();
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
    const palette = this.getDrivePalette(driveId);

    if (!ui) return;
    if (!isHovering && !isInvalid) {
      this.refreshDriveIdleState(driveId);
      return;
    }

    if (isInvalid) {
      ui.glow.setFillStyle(0xa63a22, 0.22);
      ui.frame.setStrokeStyle(3, 0xff8d68);
      ui.mouth.setFillStyle(0x1c0604);
      this.setDriveLampState(driveId, 0xd95b42, 0xff8d68, 0.24, 1.08);
      return;
    }

    ui.glow.setFillStyle(palette.slotGlow, 0.24);
    ui.frame.setStrokeStyle(3, palette.accentBright);
    ui.mouth.setFillStyle(0x0b1208);
    this.setDriveLampState(
      driveId,
      palette.lampOn,
      palette.accentBright,
      0.18,
      1.08,
    );
  }

  private setDriveLampState(
    driveId: DriveId,
    coreColor: number,
    haloColor: number,
    haloAlpha: number,
    haloScale: number = 1,
  ) {
    const ui = this.driveModules[driveId];
    if (!ui) return;
    ui.light.setFillStyle(coreColor, 1);
    ui.lightHalo.setFillStyle(haloColor, haloAlpha);
    ui.lightHalo.setScale(haloScale);
  }

  private refreshDriveIdleState(targetDriveId?: DriveId) {
    const driveIds: DriveId[] = targetDriveId
      ? [targetDriveId]
      : ["agent", "skill"];

    driveIds.forEach((driveId) => {
      const ui = this.driveModules[driveId];
      const palette = this.getDrivePalette(driveId);
      if (!ui) return;

      const isLoaded =
        driveId === "agent"
          ? this.activeAgents.length > 0
          : this.activeSkills.length > 0;
      const canEject = isLoaded;

      ui.glow.setFillStyle(palette.slotGlow, isLoaded ? 0.1 : 0.05);
      ui.frame.setStrokeStyle(2, isLoaded ? palette.frameDim : 0x4f493d);
      ui.mouth.setFillStyle(0x040404);
      ui.ejectButton.setAlpha(canEject ? 1 : 0.35);
      ui.ejectLabel.setAlpha(canEject ? 1 : 0.35);
      this.setDriveLampState(
        driveId,
        isLoaded ? palette.lampOn : palette.lampOff,
        isLoaded ? palette.haloColor : palette.haloColor,
        isLoaded ? 0.14 : 0,
        isLoaded ? 1.03 : 1,
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
      this.setDriveLampState(driveId, 0xc6543f, 0xff8d68, 0.24, 1.12);
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
    const palette = this.getDrivePalette(driveId);
    this.setDriveLampState(
      driveId,
      palette.lampOn,
      palette.accentBright,
      0.22,
      1.08,
    );
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
      targets: driveUi ? [driveUi.glow, driveUi.lightHalo, driveUi.light] : [],
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
      if (!isAgentId(label)) {
        return { success: false, statusMessage: "INVALID AGENT FORMAT" };
      }

      if (this.activeAgents.includes(label)) {
        return { success: false, statusMessage: "AGENT ALREADY LOADED" };
      }

      if (this.activeAgents.length >= this.driveConfigs.agent.capacity) {
        return { success: false, statusMessage: "AGENT ARRAY FULL" };
      }

      const nextAgents = [...this.activeAgents, label];
      this.bindings.setActiveAgents(nextAgents);
      return {
        success: true,
        driveId,
        statusMessage:
          nextAgents.length === 1 ? "AGENT CORE READY" : "AGENT ARRAY EXPANDED",
      };
    }

    if (!isSkillId(label)) {
      return { success: false, statusMessage: "INVALID SKILL FORMAT" };
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

  private pulseContextTarget(target: DriveId) {
    const light = this.driveModules[target]?.light;
    const lightHalo = this.driveModules[target]?.lightHalo;
    const text = this.driveModules[target]?.mountedText;

    if (!light || !lightHalo || !text) return;

    this.scene.tweens.add({
      targets: [light, lightHalo, text],
      scaleX: 1.07,
      scaleY: 1.07,
      duration: 90,
      yoyo: true,
      ease: "Sine.easeOut",
    });
  }

  private ejectDrive(driveId: DriveId) {
    if (driveId === "agent") {
      this.bindings.setActiveAgents([]);
    } else {
      this.bindings.setActiveSkills([]);
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
      onComplete: () => {
        this.renderStorageRackItems();
      },
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
    this.driveMountedLabels.agent =
      this.activeAgents.length > 0
        ? `${this.activeAgents.length}/${this.driveConfigs.agent.capacity} [${this.activeAgents.join(", ")}]`
        : `0/${this.driveConfigs.agent.capacity} []`;
    this.driveMountedLabels.skill =
      this.activeSkills.length > 0
        ? `${this.activeSkills.length}/${this.driveConfigs.skill.capacity} [${this.activeSkills.join(", ")}]`
        : `0/${this.driveConfigs.skill.capacity} []`;

    this.syncMountedTextMarquee("agent", true);
    this.syncMountedTextMarquee("skill", true);
  }
}
