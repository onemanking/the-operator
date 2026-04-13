import Phaser from "phaser";
import { RUN_CONFIG, canMakeMaintenancePurchase } from "../data/RunData";
import {
  applyPassiveUpgrade,
  canPurchasePassiveUpgrade,
  getAvailablePassiveUpgrades,
  getPassiveUpgradeCount,
  getPassiveUpgradeDefinition,
  PassiveUpgradeDefinition,
  PassiveUpgradeId,
} from "../data/UpgradeData";
import {
  ACTIVE_UTILITIES,
  ActiveUtilityDefinition,
  ActiveUtilityId,
  getActiveUtilityInventorySummary,
  applyActiveUtilityPurchase,
  canPurchaseActiveUtility,
  getActiveUtilityCharges,
  getActiveUtilityDefinition,
} from "../data/UtilityData";
import { synth } from "../utils/SoundSynth";
import {
  getPersistentDeathCount,
  recordPersistentDeath,
} from "../data/RunHistoryData";
import {
  cloneRunState,
  createInitialRunState,
  hydrateRunState,
  RunEndReason,
  RunState,
  ShiftSceneData,
} from "../types/SceneData";
import {
  addScanlines,
  createRetroTextStyle,
  createSceneBackdrop,
  RETRO_COLORS,
} from "./shared/retroUi";
import {
  createMonitorCommandButton,
  MONITOR_COLORS,
  createMonitorShell,
  createMonitorTextStyle,
  MonitorShell,
  MonitorSequenceController,
  playMonitorSceneTransition,
} from "./shared/monitorPresentation";

type MaintenanceOfferKind = "passive" | "utility";

interface MaintenanceOfferCard {
  id: string;
  kind: MaintenanceOfferKind;
  name: string;
  description: string;
  cost: number;
  ownedText: string;
  isMaxed: boolean;
  canPurchase: boolean;
}

export class MaintenanceScene extends Phaser.Scene {
  private runState: RunState = hydrateRunState();
  private day: number = 1;
  private tokens: number = 0;
  private accuracy: number = 100;
  private gameOver: boolean = false;
  private runEndReason: RunEndReason = null;
  private summaryText!: Phaser.GameObjects.Text;
  private summaryLeftText?: Phaser.GameObjects.Text;
  private summaryRightText?: Phaser.GameObjects.Text;
  private summaryUtilityText?: Phaser.GameObjects.Text;
  private purchaseStatusText!: Phaser.GameObjects.Text;
  private shell?: MonitorShell;
  private sequenceController?: MonitorSequenceController;
  private primaryCommand?: ReturnType<typeof createMonitorCommandButton>;
  private statusHint?: Phaser.GameObjects.Text;
  private isTransitioning: boolean = false;
  private readyAction?: () => void;
  private readyCommandLabel: string = "";
  private transitionStatusText: string = "";
  private deathCount: number = 0;

  constructor() {
    super("MaintenanceScene");
  }

  init(data: ShiftSceneData) {
    this.runState = hydrateRunState(data);
    this.day = this.runState.day;
    this.tokens = this.runState.tokens;
    this.accuracy = this.runState.accuracy;
    this.gameOver = this.runState.gameOver;
    this.runEndReason = this.runState.runEndReason;
  }

  create() {
    const width = this.cameras.main.width;

    if (!this.gameOver) {
      this.settleMaintenance();
    }

    const contentExhausted = this.isContentExhaustedRun();
    const failureRun = this.isFailureRun();
    const runComplete = this.isRunComplete();

    if (failureRun) {
      this.deathCount = recordPersistentDeath(this.runState.runId);
    } else {
      this.deathCount = getPersistentDeathCount();
    }

    createSceneBackdrop(this, 0x050805);

    this.shell = createMonitorShell(this, {
      title:
        contentExhausted || failureRun
          ? "SYSTEM SAFE MODE // FAILURE REPORT"
          : runComplete
            ? "SYSTEM SAFE MODE // RUN COMPLETE"
            : `SYSTEM SAFE MODE // DAY ${this.day} COMPLETE`,
      subtitle: runComplete
        ? `DAY ${this.day}/${RUN_CONFIG.maxDay} // TOKENS ${this.tokens} // ACC ${this.accuracy}%`
        : `TOKENS ${this.tokens} // ACC ${this.accuracy}%`,
      footerLeft: "CHANNEL: MAINTENANCE.BUS",
      footerRight: runComplete
        ? "ENTER / SPACE // ARCHIVE RUN"
        : "ENTER / SPACE // ADVANCE",
    });

    const textStyle = createRetroTextStyle();

    this.statusHint = this.add
      .text(
        width / 2,
        678,
        "ENTER / SPACE // FAST-FORWARD FEED",
        createMonitorTextStyle({
          fontSize: "16px",
          color: MONITOR_COLORS.dimText,
        }),
      )
      .setOrigin(0.5);

    this.primaryCommand = createMonitorCommandButton({
      scene: this,
      x: width / 2,
      y: 726,
      width: 292,
      label: "FAST-FORWARD FEED",
      onPress: () => this.handlePrimaryAction(),
    });

    if (failureRun) {
      this.applyFailureTheme();
    }

    if (contentExhausted) {
      const endBody =
        this.runEndReason === "content-exhausted"
          ? "NO FRESH PROMPTS REMAIN IN THE AUTHORED POOL.\nSHIFT ARCHIVE COMPLETE."
          : "HALLUCINATION CRITICAL MASS REACHED.\nSERVER MELTDOWN.";
      const endColor =
        this.runEndReason === "content-exhausted"
          ? RETRO_COLORS.amberText
          : RETRO_COLORS.errorText;

      this.add
        .text(width / 2, 188, "FAILURE DIGEST", {
          ...textStyle,
          fontSize: "24px",
          color: endColor,
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      this.summaryText = this.add
        .text(width / 2, 304, "", {
          ...createMonitorTextStyle({
            fontSize: "22px",
            color: endColor,
            align: "center",
          }),
          wordWrap: { width: 760 },
          lineSpacing: 10,
        })
        .setOrigin(0.5);

      this.sequenceController = new MonitorSequenceController(this);
      this.sequenceController.play(
        [
          {
            target: this.summaryText,
            text: `${endBody}\n\nSYSTEM REBOOT REQUIRED BEFORE NEXT SHIFT.`,
            reveal: "line",
            speedMs: 140,
            playSound: true,
            color: endColor,
          },
        ],
        () => {
          this.readyCommandLabel = "REBOOT SYSTEM";
          this.transitionStatusText =
            this.runEndReason === "content-exhausted"
              ? "ARCHIVE SEALED // REBOOTING CONSOLE"
              : "CORE FAILURE ACKNOWLEDGED // REBOOTING";
          this.readyAction = () => {
            this.scene.start("BriefingScene", createInitialRunState());
          };
          this.primaryCommand?.setLabel(this.readyCommandLabel);
          this.statusHint?.setText("ENTER / SPACE // REBOOT SYSTEM");
        },
      );
    } else {
      if (failureRun) {
        this.createFailurePanel();
        this.purchaseStatusText.setAlpha(0);
        this.summaryLeftText?.setAlpha(0);
        this.summaryRightText?.setAlpha(0);
        this.summaryUtilityText?.setAlpha(0);

        this.sequenceController = new MonitorSequenceController(this);
        this.sequenceController.play(
          [
            {
              target: this.summaryText,
              text: this.getFailureDigestText(),
              reveal: "line",
              speedMs: 120,
              playSound: true,
              color: RETRO_COLORS.errorText,
            },
          ],
          () => {
            this.summaryLeftText?.setAlpha(1);
            this.summaryRightText?.setAlpha(1);
            this.summaryUtilityText?.setAlpha(1);
            this.purchaseStatusText.setAlpha(1);
            this.readyCommandLabel = "REBOOT SYSTEM";
            this.transitionStatusText = this.getFineTuneRebootText();
            this.readyAction = () => {
              this.scene.start("BriefingScene", createInitialRunState());
            };
            this.primaryCommand?.setLabel(this.readyCommandLabel);
            this.statusHint?.setText("ENTER / SPACE // REBOOT SYSTEM");
          },
        );
      } else if (runComplete) {
        this.createSummaryPanel();
        const maintenancePurchaseStatusText = this.purchaseStatusText;
        this.createRunCompletePanel();
        maintenancePurchaseStatusText.destroy();
        this.purchaseStatusText.setAlpha(0);
        this.summaryLeftText?.setAlpha(0);
        this.summaryRightText?.setAlpha(0);
        this.summaryUtilityText?.setAlpha(0);

        this.sequenceController = new MonitorSequenceController(this);
        this.sequenceController.play(
          [
            {
              target: this.summaryText,
              text: [
                "FIVE-DAY OPERATOR CONTRACT COMPLETE.",
                "MAINFRAME LOAD STABILIZED.",
                "ARCHIVE THE RUN AND PREP THE NEXT CREW.",
              ].join("\n"),
              reveal: "line",
              speedMs: 120,
              playSound: true,
              color: MONITOR_COLORS.text,
            },
          ],
          () => {
            this.summaryLeftText?.setAlpha(1);
            this.summaryRightText?.setAlpha(1);
            this.summaryUtilityText?.setAlpha(1);
            this.purchaseStatusText.setAlpha(1);
            this.readyCommandLabel = "ARCHIVE RUN";
            this.transitionStatusText =
              "RUN ARCHIVE SEALED // REBOOTING CONSOLE";
            this.readyAction = () => {
              this.scene.start("BriefingScene", createInitialRunState());
            };
            this.primaryCommand?.setLabel(this.readyCommandLabel);
            this.statusHint?.setText("ENTER / SPACE // ARCHIVE RUN");
          },
        );
      } else {
        this.createSummaryPanel();
        this.summaryText.setAlpha(0);
        this.summaryLeftText?.setAlpha(1);
        this.summaryRightText?.setAlpha(1);
        this.summaryUtilityText?.setAlpha(1);
        this.purchaseStatusText.setAlpha(0);

        const revealStartIndex = this.children.list.length;
        this.createUpgradeShop();

        const revealTargets = this.children.list.slice(
          revealStartIndex,
        ) as Phaser.GameObjects.GameObject[];
        revealTargets.push(this.purchaseStatusText);
        revealTargets.forEach((gameObject) => {
          if ("setAlpha" in gameObject) {
            (
              gameObject as Phaser.GameObjects.GameObject & {
                setAlpha: (alpha: number) => Phaser.GameObjects.GameObject;
              }
            ).setAlpha(0);
          }
        });

        const blocker = this.add
          .rectangle(width / 2, 477, 900, 388, 0x000000, 0.001)
          .setInteractive();

        this.sequenceController = new MonitorSequenceController(this);
        this.sequenceController.play(
          [
            {
              target: this.summaryLeftText!,
              text: [
                `TOKENS AFTER UPKEEP..... ${this.tokens}`,
                `ACCURACY CACHE.......... ${this.accuracy}%`,
              ].join("\n"),
              reveal: "line",
              speedMs: 110,
              playSound: true,
              color: MONITOR_COLORS.text,
            },
            {
              target: this.summaryRightText!,
              text: `UPKEEP..... ${RUN_CONFIG.serverCostPerShift}`,
              reveal: "line",
              speedMs: 110,
              playSound: true,
              color: MONITOR_COLORS.text,
            },
            {
              target: this.summaryUtilityText!,
              text: `UTILITY BUS............. ${getActiveUtilityInventorySummary(this.runState)}`,
              reveal: "line",
              speedMs: 110,
              playSound: true,
              color: MONITOR_COLORS.text,
            },
          ],
          () => {
            this.refreshMaintenanceSummary();
            revealTargets.forEach((gameObject) => {
              if ("setAlpha" in gameObject) {
                this.tweens.add({
                  targets: gameObject,
                  alpha: 1,
                  duration: 160,
                  ease: "Quad.easeOut",
                });
              }
            });
            blocker.destroy();
            this.readyCommandLabel = "BOOT NEXT SHIFT";
            this.transitionStatusText = "REBOOTING CONSOLE FOR NEXT SHIFT";
            this.readyAction = () => {
              this.scene.start("BriefingScene", this.buildNextRunState());
            };
            this.primaryCommand?.setLabel(this.readyCommandLabel);
            this.statusHint?.setText("ENTER / SPACE // BOOT NEXT SHIFT");
          },
        );
      }
    }

    this.input.keyboard?.on("keydown-ENTER", this.handlePrimaryAction, this);
    this.input.keyboard?.on("keydown-SPACE", this.handlePrimaryAction, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.sequenceController?.destroy();
      this.input.keyboard?.off("keydown-ENTER", this.handlePrimaryAction, this);
      this.input.keyboard?.off("keydown-SPACE", this.handlePrimaryAction, this);
    });

    this.addCRTEffects();
  }

  addCRTEffects() {
    addScanlines(this);
  }

  private handlePrimaryAction() {
    if (this.isTransitioning) {
      return;
    }

    if (!this.sequenceController?.isComplete()) {
      synth.playButtonPress();
      this.sequenceController?.skipToEnd();
      if (this.readyCommandLabel.length > 0) {
        this.primaryCommand?.setLabel(this.readyCommandLabel);
      }
      return;
    }

    if (!this.readyAction) {
      return;
    }

    this.isTransitioning = true;
    this.primaryCommand?.setEnabled(false);
    this.statusHint?.setText(this.transitionStatusText);
    synth.playButtonPress();

    if (this.isFailureRun()) {
      this.playFailureRebootSequence();
      return;
    }

    playMonitorSceneTransition(this, {
      variant: "reboot",
      statusText: this.transitionStatusText,
      onComplete: () => {
        this.readyAction?.();
      },
    });
  }

  private buildNextRunState() {
    const nextRunState = cloneRunState(this.runState);
    nextRunState.day = this.day + 1;
    nextRunState.accuracy = this.accuracy;
    nextRunState.heat = 0;
    nextRunState.gameOver = false;
    nextRunState.runEndReason = null;
    nextRunState.encounterProgress = {
      encounterIndex: 0,
      turnIndex: 0,
    };
    nextRunState.maintenanceSettledDay = null;
    nextRunState.maintenanceOfferIds = [];
    nextRunState.maintenancePurchaseCount = 0;
    nextRunState.maintenancePurchasedItemId = null;
    nextRunState.maintenancePurchasedItemType = null;
    nextRunState.shiftEncounterIds = [];
    nextRunState.shiftEncounters = [];
    nextRunState.shiftModifierIds = [];
    nextRunState.activePolicyGroupIds = [];
    nextRunState.forbiddenCategoryIds = [];

    return nextRunState;
  }

  private isContentExhaustedRun() {
    return this.gameOver && this.runEndReason === "content-exhausted";
  }

  private isFailureRun() {
    return (
      this.runEndReason === "system-failure" ||
      (!this.gameOver && this.tokens < 0)
    );
  }

  private isRunComplete() {
    return !this.gameOver && this.day >= RUN_CONFIG.maxDay;
  }

  private formatFineTuneVersion() {
    return `v1.${String(Math.max(1, this.deathCount)).padStart(2, "0")}`;
  }

  private getFineTuneRebootText() {
    return `INITIATING FINE-TUNE: OMNI-SENTINEL ${this.formatFineTuneVersion()}...`;
  }

  private getFailureDigestText() {
    if (this.tokens < 0) {
      return [
        "LEDGER COLLAPSE CONFIRMED.",
        "SERVER SHUTDOWN.",
        "",
      ].join("\n");
    }

    return [
      "HALLUCINATION CRITICAL MASS REACHED.",
      "SERVER MELTDOWN.",
      "",
    ].join("\n");
  }

  private settleMaintenance() {
    if (this.runState.maintenanceSettledDay === this.day) {
      this.tokens = this.runState.tokens;
      return;
    }

    this.tokens -= RUN_CONFIG.serverCostPerShift;
    this.runState.tokens = this.tokens;
    this.runState.maintenanceSettledDay = this.day;
    this.runState.maintenancePurchaseCount = 0;
    this.runState.maintenancePurchasedItemId = null;
    this.runState.maintenancePurchasedItemType = null;
    this.runState.maintenanceOfferIds = this.drawShopOffers().map(
      (offer) => offer.id,
    );
  }

  private createSummaryPanel() {
    const shell = this.shell;

    if (!shell) {
      return;
    }

    const panelX = shell.contentX;
    const panelY = shell.contentY + 4;
    const panelWidth = shell.contentWidth;
    const panelHeight = 88;

    this.add
      .rectangle(panelX, panelY, panelWidth, panelHeight, 0x09140b, 0.9)
      .setOrigin(0)
      .setStrokeStyle(1, 0x33ff33, 0.45);

    this.add
      .rectangle(panelX + 16, panelY + 16, panelWidth - 32, 1, 0x33ff33, 0.18)
      .setOrigin(0, 0.5);

    this.add
      .text(
        panelX + 18,
        panelY + 12,
        "POST-SHIFT DIAGNOSTICS",
        createMonitorTextStyle({
          fontSize: "16px",
          fontStyle: "bold",
          color: MONITOR_COLORS.mutedText,
        }),
      )
      .setOrigin(0, 0);

    this.summaryText = this.add
      .text(panelX + 20, panelY + 34, "", {
        ...createMonitorTextStyle({
          fontSize: "15px",
          color: MONITOR_COLORS.mutedText,
          align: "left",
        }),
        wordWrap: { width: panelWidth - 40 },
        lineSpacing: 3,
      })
      .setOrigin(0, 0);

    this.summaryLeftText = this.add
      .text(panelX + 20, panelY + 34, "", {
        ...createMonitorTextStyle({
          fontSize: "16px",
          color: MONITOR_COLORS.text,
          align: "left",
        }),
        lineSpacing: 3,
      })
      .setOrigin(0, 0);

    this.summaryRightText = this.add
      .text(panelX + 392, panelY + 34, "", {
        ...createMonitorTextStyle({
          fontSize: "16px",
          color: MONITOR_COLORS.text,
          align: "left",
        }),
        lineSpacing: 3,
      })
      .setOrigin(0, 0);

    this.summaryUtilityText = this.add
      .text(panelX + 20, panelY + 68, "", {
        ...createMonitorTextStyle({
          fontSize: "16px",
          color: MONITOR_COLORS.text,
          align: "left",
        }),
        wordWrap: { width: panelWidth - 40 },
      })
      .setOrigin(0, 0);

    this.purchaseStatusText = this.add
      .text(
        shell.contentX + shell.contentWidth / 2,
        641,
        "SELECT UP TO TWO OFFERS OR SKIP.",
        {
          ...createMonitorTextStyle({
            fontSize: "16px",
            color: MONITOR_COLORS.text,
            align: "center",
          }),
        },
      )
      .setOrigin(0.5);

    this.refreshMaintenanceSummary();
  }

  private createRunCompletePanel() {
    const shell = this.shell;

    if (!shell) {
      return;
    }

    const panelX = shell.contentX;
    const panelY = shell.contentY + 108;
    const panelWidth = shell.contentWidth;
    const panelHeight = 336;

    this.add
      .rectangle(panelX, panelY, panelWidth, panelHeight, 0x08120a, 0.92)
      .setOrigin(0)
      .setStrokeStyle(1, 0x33ff33, 0.34);

    this.add
      .text(
        panelX + 18,
        panelY + 12,
        "FINAL RUN ARCHIVE // STORED METRICS",
        createMonitorTextStyle({
          fontSize: "16px",
          fontStyle: "bold",
          color: MONITOR_COLORS.mutedText,
        }),
      )
      .setOrigin(0, 0);

    this.add
      .rectangle(panelX + 18, panelY + 34, panelWidth - 36, 1, 0x33ff33, 0.16)
      .setOrigin(0, 0.5);

    this.summaryText = this.add
      .text(shell.contentX + shell.contentWidth / 2, panelY + 74, "", {
        ...createMonitorTextStyle({
          fontSize: "21px",
          color: MONITOR_COLORS.text,
          align: "center",
        }),
        wordWrap: { width: panelWidth - 96 },
        lineSpacing: 8,
      })
      .setOrigin(0.5, 0);

    this.summaryLeftText = this.add
      .text(panelX + 28, panelY + 152, "", {
        ...createMonitorTextStyle({
          fontSize: "16px",
          color: MONITOR_COLORS.text,
          align: "left",
        }),
        lineSpacing: 6,
      })
      .setOrigin(0, 0);

    this.summaryRightText = this.add
      .text(panelX + 430, panelY + 152, "", {
        ...createMonitorTextStyle({
          fontSize: "16px",
          color: MONITOR_COLORS.text,
          align: "left",
        }),
        lineSpacing: 6,
      })
      .setOrigin(0, 0);

    this.summaryUtilityText = this.add
      .text(panelX + 28, panelY + 276, "", {
        ...createMonitorTextStyle({
          fontSize: "16px",
          color: MONITOR_COLORS.mutedText,
          align: "left",
        }),
        wordWrap: { width: panelWidth - 56 },
        lineSpacing: 4,
      })
      .setOrigin(0, 0);

    this.purchaseStatusText = this.add
      .text(shell.contentX + shell.contentWidth / 2, 610, "", {
        ...createMonitorTextStyle({
          fontSize: "16px",
          color: MONITOR_COLORS.warningText,
          align: "center",
        }),
      })
      .setOrigin(0.5);

    this.refreshRunCompleteSummary();
  }

  private createFailurePanel() {
    const shell = this.shell;

    if (!shell) {
      return;
    }

    const panelX = shell.contentX;
    const panelY = shell.contentY + 4;
    const panelWidth = shell.contentWidth;
    const panelHeight = shell.contentHeight - 16;

    this.add
      .rectangle(panelX, panelY, panelWidth, panelHeight, 0x120404, 0.92)
      .setOrigin(0)
      .setStrokeStyle(1, 0xff0000, 0.28);

    this.add
      .text(
        panelX + 18,
        panelY + 12,
        "FAILURE ARCHIVE // LAST RECORDED METRICS",
        createMonitorTextStyle({
          fontSize: "16px",
          fontStyle: "bold",
          color: MONITOR_COLORS.dangerText,
        }),
      )
      .setOrigin(0, 0);

    this.add
      .rectangle(panelX + 18, panelY + 34, panelWidth - 36, 1, 0xff0000, 0.16)
      .setOrigin(0, 0.5);

    this.summaryText = this.add
      .text(shell.contentX + shell.contentWidth / 2, panelY + 70, "", {
        ...createMonitorTextStyle({
          fontSize: "20px",
          color: MONITOR_COLORS.dangerText,
          align: "center",
        }),
        wordWrap: { width: panelWidth - 96 },
        lineSpacing: 8,
      })
      .setOrigin(0.5, 0);

    this.summaryLeftText = this.add
      .text(panelX + 28, panelY + 188, "", {
        ...createMonitorTextStyle({
          fontSize: "16px",
          color: MONITOR_COLORS.dangerText,
          align: "left",
        }),
        lineSpacing: 6,
      })
      .setOrigin(0, 0);

    this.summaryRightText = this.add
      .text(panelX + 430, panelY + 188, "", {
        ...createMonitorTextStyle({
          fontSize: "16px",
          color: MONITOR_COLORS.dangerText,
          align: "left",
        }),
        lineSpacing: 6,
      })
      .setOrigin(0, 0);

    this.summaryUtilityText = this.add
      .text(panelX + 28, panelY + 326, "", {
        ...createMonitorTextStyle({
          fontSize: "16px",
          color: MONITOR_COLORS.dangerText,
          align: "left",
        }),
        wordWrap: { width: panelWidth - 56 },
        lineSpacing: 4,
      })
      .setOrigin(0, 0);

    this.purchaseStatusText = this.add
      .text(shell.contentX + shell.contentWidth / 2, 620, "", {
        ...createMonitorTextStyle({
          fontSize: "16px",
          color: MONITOR_COLORS.dangerText,
          align: "center",
        }),
      })
      .setOrigin(0.5);

    this.refreshFailureSummary();
  }

  private createUpgradeShop() {
    const shell = this.shell;

    if (!shell) {
      return;
    }

    const panelX = shell.contentX;
    const panelY = shell.contentY + 108;
    const panelWidth = shell.contentWidth;
    const panelHeight = 336;

    this.add
      .rectangle(panelX, panelY, panelWidth, panelHeight, 0x08120a, 0.92)
      .setOrigin(0)
      .setStrokeStyle(1, 0x33ff33, 0.34);

    this.add
      .text(
        panelX + 18,
        panelY + 12,
        "MAINTENANCE BAY // SELECT UP TO TWO SLOTS",
        createMonitorTextStyle({
          fontSize: "16px",
          fontStyle: "bold",
          color: MONITOR_COLORS.mutedText,
        }),
      )
      .setOrigin(0, 0);

    this.add
      .rectangle(panelX + 18, panelY + 34, panelWidth - 36, 1, 0x33ff33, 0.16)
      .setOrigin(0, 0.5);

    const offers = this.runState.maintenanceOfferIds
      .map((offerId) => this.resolveOfferCard(offerId))
      .filter((offer): offer is MaintenanceOfferCard => Boolean(offer));

    offers.forEach((offer, index) => {
      this.createUpgradeCard(offer, panelX + 122 + index * 262, panelY + 174);
    });
  }

  private createUpgradeCard(
    offer: MaintenanceOfferCard,
    centerX: number,
    centerY: number,
  ) {
    const canBuy = offer.canPurchase;
    const isPurchased = this.runState.maintenancePurchasedItemId === offer.id;
    const isLockedBySelection =
      !canMakeMaintenancePurchase(this.runState.maintenancePurchaseCount) &&
      !isPurchased;

    this.add
      .rectangle(centerX, centerY, 224, 248, 0x0b160d, 0.96)
      .setStrokeStyle(
        1,
        isPurchased ? 0xffb347 : canBuy ? 0x33ff33 : 0x1d7a1d,
        isPurchased ? 0.85 : 0.45,
      );

    this.add
      .rectangle(centerX - 94, centerY - 101, 188, 1, 0x33ff33, 0.14)
      .setOrigin(0, 0.5);

    this.add
      .text(centerX, centerY - 112, offer.name, {
        ...createMonitorTextStyle({
          fontSize: "18px",
          fontStyle: "bold",
          color: isPurchased
            ? MONITOR_COLORS.warningText
            : canBuy
              ? MONITOR_COLORS.text
              : MONITOR_COLORS.mutedText,
          align: "center",
        }),
        wordWrap: { width: 180 },
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, centerY - 34, offer.description, {
        ...createMonitorTextStyle({
          fontSize: "16px",
          color: MONITOR_COLORS.mutedText,
          align: "center",
        }),
        wordWrap: { width: 180 },
      })
      .setOrigin(0.5);

    this.add
      .text(
        centerX,
        centerY + 48,
        `COST: ${offer.cost} TOKENS\n${offer.ownedText}`,
        {
          ...createMonitorTextStyle({
            fontSize: "15px",
            color: isPurchased
              ? MONITOR_COLORS.warningText
              : MONITOR_COLORS.mutedText,
            align: "center",
          }),
        },
      )
      .setOrigin(0.5);

    const label = isPurchased
      ? "PURCHASED"
      : isLockedBySelection
        ? "LOCKED"
        : offer.isMaxed
          ? "MAXED"
          : this.tokens < offer.cost
            ? "INSUFFICIENT"
            : offer.kind === "utility"
              ? "LOAD CHARGE"
              : "BUY UPGRADE";

    const commandButton = createMonitorCommandButton({
      scene: this,
      x: centerX,
      y: centerY + 116,
      width: 182,
      label,
      onPress: () => {
        const purchased =
          offer.kind === "passive"
            ? applyPassiveUpgrade(this.runState, offer.id as PassiveUpgradeId)
            : applyActiveUtilityPurchase(
                this.runState,
                offer.id as ActiveUtilityId,
              );

        if (!purchased) {
          synth.playError();
          return;
        }

        synth.playButtonPress();
        this.tokens = this.runState.tokens;
        this.scene.restart(cloneRunState(this.runState));
      },
    });

    if (!canBuy) {
      commandButton.setEnabled(false);
    }
  }

  private refreshMaintenanceSummary() {
    const utilitySummary = getActiveUtilityInventorySummary(this.runState);
    const haltedRun = this.gameOver;

    this.summaryText.setText("");
    this.summaryLeftText?.setText(
      [
        haltedRun
          ? `TOKENS ON HALT......... ${this.tokens}`
          : `TOKENS AFTER UPKEEP..... ${this.tokens}`,
        `ACCURACY CACHE.......... ${this.accuracy}%`,
      ].join("\n"),
    );
    this.summaryRightText?.setText(
      [
        haltedRun
          ? "UPKEEP..... SKIPPED"
          : `UPKEEP..... ${RUN_CONFIG.serverCostPerShift}`,
      ].join("\n"),
    );
    this.summaryUtilityText?.setText(
      `UTILITY BUS............. ${utilitySummary}`,
    );

    if (this.runState.maintenancePurchasedItemId) {
      const purchasedLabel =
        this.runState.maintenancePurchasedItemType === "passive"
          ? getPassiveUpgradeDefinition(
              this.runState.maintenancePurchasedItemId as PassiveUpgradeId,
            )?.name
          : getActiveUtilityDefinition(
              this.runState.maintenancePurchasedItemId as ActiveUtilityId,
            )?.name;

      this.purchaseStatusText.setText(
        purchasedLabel
          ? this.runState.maintenancePurchasedItemType === "utility"
            ? `UTILITY STOCKED: ${purchasedLabel}`
            : `UPGRADE INSTALLED: ${purchasedLabel}`
          : "PURCHASE REGISTERED.",
      );
      this.purchaseStatusText.setColor(MONITOR_COLORS.warningText);
      return;
    }

    this.purchaseStatusText.setColor(MONITOR_COLORS.text);
  }

  private refreshRunCompleteSummary() {
    const utilitySummary = getActiveUtilityInventorySummary(this.runState);
    const installedUpgradeCount =
      this.runState.loadout.passiveUpgradeIds.length;
    const utilityChargeCount = Object.values(
      this.runState.utilityInventory.chargesById,
    ).reduce((total, charges) => total + (charges ?? 0), 0);

    this.summaryLeftText?.setText(
      [
        `DAYS CLEARED............ ${this.day}/${RUN_CONFIG.maxDay}`,
        `TOKENS BANKED........... ${this.tokens}`,
        `ACCURACY CACHE.......... ${this.accuracy}%`,
        `THERMAL LOAD............ ${Math.round(this.runState.heat)}%`,
      ].join("\n"),
    );
    this.summaryRightText?.setText(
      [
        `HALLUCINATION DRIFT..... ${Math.round(this.runState.hallucination)}%`,
        `PROMPTS ARCHIVED........ ${this.runState.seenTurnIds.length}`,
        `UPGRADES INSTALLED...... ${installedUpgradeCount}`,
        `UTILITY CHARGES......... ${utilityChargeCount}`,
      ].join("\n"),
    );
    this.summaryUtilityText?.setText(
      [
        `UTILITY BUS............. ${utilitySummary}`,
        `FINAL LOADOUT........... AGENT ${this.runState.loadout.agentCapacity} // SKILL ${this.runState.loadout.skillCapacity}`,
      ].join("\n"),
    );
    this.purchaseStatusText.setText(
      "RUN COMPLETE // REBOOT TO START A FRESH CONTRACT",
    );
    this.purchaseStatusText.setColor(MONITOR_COLORS.warningText);
  }

  private refreshFailureSummary() {
    const utilitySummary = getActiveUtilityInventorySummary(this.runState);
    const installedUpgradeCount =
      this.runState.loadout.passiveUpgradeIds.length;
    const utilityChargeCount = Object.values(
      this.runState.utilityInventory.chargesById,
    ).reduce((total, charges) => total + (charges ?? 0), 0);

    this.summaryLeftText?.setText(
      [
        `LAST DAY CLEARED........ ${this.day}`,
        `TOKENS BANKED........... ${this.tokens}`,
        `ACCURACY CACHE.......... ${this.accuracy}%`,
        `THERMAL LOAD............ ${Math.round(this.runState.heat)}%`,
      ].join("\n"),
    );
    this.summaryRightText?.setText(
      [
        `HALLUCINATION DRIFT..... ${Math.round(this.runState.hallucination)}%`,
        `PROMPTS ARCHIVED........ ${this.runState.seenTurnIds.length}`,
        `UPGRADES INSTALLED...... ${installedUpgradeCount}`,
        `DEATH COUNT............. ${this.deathCount}`,
      ].join("\n"),
    );
    this.summaryUtilityText?.setText(
      [
        `UTILITY BUS............. ${utilitySummary}`,
        `LAST LOADOUT............ AGENT ${this.runState.loadout.agentCapacity} // SKILL ${this.runState.loadout.skillCapacity}`,
      ].join("\n"),
    );
    this.purchaseStatusText.setText(
      "REBOOT SYSTEM TO QUEUE THE NEXT FINE-TUNE PASS",
    );
    this.purchaseStatusText.setColor(MONITOR_COLORS.dangerText);
  }

  private applyFailureTheme() {
    this.statusHint?.setColor(MONITOR_COLORS.dangerText);
    this.shell?.chrome.forEach((gameObject) => {
      if (gameObject instanceof Phaser.GameObjects.Text) {
        gameObject.setColor(MONITOR_COLORS.dangerText);
      }
    });
    this.primaryCommand?.setTheme({
      fillColor: 0x120404,
      hoverFillColor: 0x2b0909,
      strokeColor: 0xff0000,
      hoverStrokeColor: 0xff0000,
      textColor: MONITOR_COLORS.dangerText,
      hoverTextColor: MONITOR_COLORS.dangerText,
      disabledFillColor: 0x120404,
      disabledStrokeColor: 0x6b2b28,
      disabledTextColor: MONITOR_COLORS.dangerText,
      cursorColor: 0xff0000,
      hoverCursorColor: 0xff0000,
    });
  }

  private playFailureRebootSequence() {
    const shell = this.shell;

    if (!shell) {
      this.readyAction?.();
      return;
    }

    this.sequenceController?.destroy();
    this.statusHint?.setAlpha(0);
    this.primaryCommand?.container.setAlpha(0.35);

    const screenX = shell.contentX - 22;
    const screenY = shell.contentY - 66;
    const screenWidth = shell.contentWidth + 44;
    const screenHeight = shell.contentHeight + 114;

    const screenBlackout = this.add
      .rectangle(screenX, screenY, screenWidth, screenHeight, 0x000000, 1)
      .setOrigin(0)
      .setDepth(4500);
    const rebootText = this.add
      .text(
        screenX + 28,
        screenY + screenHeight / 2,
        "",
        createMonitorTextStyle({
          fontSize: "22px",
          color: MONITOR_COLORS.dangerText,
          align: "left",
        }),
      )
      .setOrigin(0, 0.5)
      .setDepth(4501);

    this.sequenceController = new MonitorSequenceController(this);
    this.sequenceController.play(
      [
        {
          target: rebootText,
          text: `> ${this.getFineTuneRebootText()}`,
          reveal: "char",
          delayMs: 220,
          speedMs: 22,
          playSound: true,
          color: MONITOR_COLORS.dangerText,
        },
      ],
      () => {
        this.time.delayedCall(1000, () => {
          this.readyAction?.();
          // Prevent flash from the BriefingScene loading before the blackout finishes
          this.time.delayedCall(500, () => {
            screenBlackout.destroy();
            rebootText.destroy();
          });
        });
      },
    );
  }

  private drawShopOffers() {
    const passiveOffers = this.getPassiveOfferCards();
    const utilityOffers = this.getUtilityOfferCards();

    const shuffle = <T>(items: T[]) => {
      for (let index = items.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        const current = items[index];
        items[index] = items[randomIndex];
        items[randomIndex] = current;
      }
    };

    shuffle(passiveOffers);
    shuffle(utilityOffers);

    const guaranteedUtilityOffer = utilityOffers.shift();
    const availableOffers = [
      ...(guaranteedUtilityOffer ? [guaranteedUtilityOffer] : []),
      ...passiveOffers,
      ...utilityOffers,
    ];

    shuffle(availableOffers);

    return availableOffers.slice(0, Math.min(3, availableOffers.length));
  }

  private getPassiveOfferCards(): MaintenanceOfferCard[] {
    return getAvailablePassiveUpgrades(this.runState).map((upgrade) =>
      this.createPassiveOfferCard(upgrade),
    );
  }

  private getUtilityOfferCards(): MaintenanceOfferCard[] {
    return ACTIVE_UTILITIES.map((utility) =>
      this.createUtilityOfferCard(utility),
    ).filter((offer): offer is MaintenanceOfferCard => Boolean(offer));
  }

  private resolveOfferCard(offerId: string) {
    const passiveUpgrade = getPassiveUpgradeDefinition(
      offerId as PassiveUpgradeId,
    );

    if (passiveUpgrade) {
      return this.createPassiveOfferCard(passiveUpgrade);
    }

    const utility = getActiveUtilityDefinition(offerId as ActiveUtilityId);

    if (utility) {
      return this.createUtilityOfferCard(utility);
    }

    return null;
  }

  private createPassiveOfferCard(
    upgrade: PassiveUpgradeDefinition,
  ): MaintenanceOfferCard {
    const ownedCount = getPassiveUpgradeCount(this.runState, upgrade.id);
    return {
      id: upgrade.id,
      kind: "passive",
      name: upgrade.name,
      description: upgrade.description,
      cost: upgrade.cost,
      ownedText: `OWNED: ${ownedCount}/${upgrade.maxStacks}`,
      isMaxed: ownedCount >= upgrade.maxStacks,
      canPurchase: canPurchasePassiveUpgrade(this.runState, upgrade.id),
    };
  }

  private createUtilityOfferCard(
    utility: ActiveUtilityDefinition,
  ): MaintenanceOfferCard {
    const charges = getActiveUtilityCharges(this.runState, utility.id);
    return {
      id: utility.id,
      kind: "utility",
      name: utility.name,
      description: utility.description,
      cost: utility.cost,
      ownedText: `CHARGES: ${charges}`,
      isMaxed: false,
      canPurchase: canPurchaseActiveUtility(this.runState, utility.id),
    };
  }
}
