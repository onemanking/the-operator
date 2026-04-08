import Phaser from "phaser";
import { RUN_CONFIG } from "../data/RunData";
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
  applyActiveUtilityPurchase,
  canPurchaseActiveUtility,
  getActiveUtilityCharges,
  getActiveUtilityDefinition,
} from "../data/UtilityData";
import { synth } from "../utils/SoundSynth";
import {
  cloneRunState,
  createInitialRunState,
  hydrateRunState,
  RunState,
  ShiftSceneData,
} from "../types/SceneData";
import {
  addScanlines,
  createRetroButton,
  createRetroTextStyle,
  createSceneBackdrop,
  RETRO_COLORS,
} from "./shared/retroUi";

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
  private summaryText!: Phaser.GameObjects.Text;
  private purchaseStatusText!: Phaser.GameObjects.Text;

  constructor() {
    super("MaintenanceScene");
  }

  init(data: ShiftSceneData) {
    this.runState = hydrateRunState(data);
    this.day = this.runState.day;
    this.tokens = this.runState.tokens;
    this.accuracy = this.runState.accuracy;
    this.gameOver = this.runState.gameOver;
  }

  create() {
    const width = this.cameras.main.width;

    createSceneBackdrop(this);

    const textStyle = createRetroTextStyle();

    if (this.gameOver) {
      this.add
        .text(width / 2, 200, "SYSTEM FAILURE", {
          ...textStyle,
          fontSize: "48px",
          color: RETRO_COLORS.errorText,
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.add
        .text(
          width / 2,
          300,
          "HALLUCINATION CRITICAL MASS REACHED.\nSERVER MELTDOWN.",
          { ...textStyle, color: RETRO_COLORS.errorText },
        )
        .setOrigin(0.5);

      createRetroButton({
        scene: this,
        x: width / 2,
        y: 500,
        width: 200,
        height: 50,
        label: "REBOOT SYSTEM",
        onPress: () => {
          synth.playButtonPress();
          this.scene.start("BriefingScene", createInitialRunState());
        },
      });
    } else {
      this.add
        .text(width / 2, 100, `END OF DAY ${this.day}`, {
          ...textStyle,
          fontSize: "32px",
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      this.settleMaintenance();

      if (this.tokens < 0) {
        this.add
          .text(width / 2, 450, "BANKRUPT. SERVER SHUTDOWN.", {
            ...textStyle,
            color: RETRO_COLORS.errorText,
          })
          .setOrigin(0.5);
        createRetroButton({
          scene: this,
          x: width / 2,
          y: 600,
          width: 200,
          height: 50,
          label: "REBOOT SYSTEM",
          onPress: () => {
            synth.playButtonPress();
            this.scene.start("BriefingScene", createInitialRunState());
          },
        });
      } else {
        this.createSummaryPanel();
        this.createUpgradeShop();
        createRetroButton({
          scene: this,
          x: width / 2,
          y: 700,
          width: 250,
          height: 50,
          label: "START NEXT SHIFT",
          onPress: () => {
            synth.playButtonPress();
            const nextRunState = cloneRunState(this.runState);
            nextRunState.day = this.day + 1;
            nextRunState.accuracy = this.accuracy;
            nextRunState.heat = 0;
            nextRunState.gameOver = false;
            nextRunState.encounterProgress = {
              encounterIndex: 0,
              turnIndex: 0,
            };
            nextRunState.maintenanceSettledDay = null;
            nextRunState.maintenanceOfferIds = [];
            nextRunState.maintenancePurchasedItemId = null;
            nextRunState.maintenancePurchasedItemType = null;
            nextRunState.shiftEncounterIds = [];
            nextRunState.shiftModifierIds = [];
            this.scene.start("BriefingScene", nextRunState);
          },
        });
      }
    }

    this.addCRTEffects();
  }

  addCRTEffects() {
    addScanlines(this);
  }

  private settleMaintenance() {
    if (this.runState.maintenanceSettledDay === this.day) {
      this.tokens = this.runState.tokens;
      return;
    }

    this.tokens -= RUN_CONFIG.serverCostPerShift;
    this.runState.tokens = this.tokens;
    this.runState.maintenanceSettledDay = this.day;
    this.runState.maintenancePurchasedItemId = null;
    this.runState.maintenancePurchasedItemType = null;
    this.runState.maintenanceOfferIds = this.drawShopOffers().map(
      (offer) => offer.id,
    );
  }

  private createSummaryPanel() {
    this.add
      .rectangle(72, 140, 880, 92, 0x221d18)
      .setOrigin(0)
      .setStrokeStyle(2, 0x111111);

    this.summaryText = this.add
      .text(512, 186, "", {
        ...createRetroTextStyle({
          fontSize: "18px",
          color: RETRO_COLORS.mutedText,
        }),
        wordWrap: { width: 820 },
      })
      .setOrigin(0.5);

    this.purchaseStatusText = this.add
      .text(512, 654, "SELECT ONE UPGRADE OR SKIP.", {
        ...createRetroTextStyle({
          fontSize: "18px",
          color: RETRO_COLORS.mutedText,
        }),
      })
      .setOrigin(0.5);

    this.refreshMaintenanceSummary();
  }

  private createUpgradeShop() {
    this.add
      .rectangle(72, 250, 880, 360, 0x191611)
      .setOrigin(0)
      .setStrokeStyle(2, 0x111111);

    const offers = this.runState.maintenanceOfferIds
      .map((offerId) => this.resolveOfferCard(offerId))
      .filter((offer): offer is MaintenanceOfferCard => Boolean(offer));

    offers.forEach((offer, index) => {
      this.createUpgradeCard(offer, 200 + index * 264, 430);
    });
  }

  private createUpgradeCard(
    offer: MaintenanceOfferCard,
    centerX: number,
    centerY: number,
  ) {
    this.add
      .rectangle(centerX, centerY, 232, 300, 0x2a241d)
      .setStrokeStyle(2, 0x574d38);

    this.add
      .text(centerX, centerY - 112, offer.name, {
        ...createRetroTextStyle({
          fontSize: "20px",
          fontStyle: "bold",
        }),
        wordWrap: { width: 180 },
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, centerY - 34, offer.description, {
        ...createRetroTextStyle({
          fontSize: "18px",
          color: RETRO_COLORS.mutedText,
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
          ...createRetroTextStyle({
            fontSize: "18px",
            color: RETRO_COLORS.mutedText,
          }),
        },
      )
      .setOrigin(0.5);

    const canBuy = offer.canPurchase;
    const isPurchased = this.runState.maintenancePurchasedItemId === offer.id;
    const isLockedBySelection =
      Boolean(this.runState.maintenancePurchasedItemId) && !isPurchased;
    const buttonFill = canBuy ? RETRO_COLORS.panel : 0x5d5952;
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

    const { button, buttonLabel } = createRetroButton({
      scene: this,
      x: centerX,
      y: centerY + 116,
      width: 180,
      height: 42,
      label,
      fillColor: buttonFill,
      textStyle: {
        fontSize: "16px",
      },
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
      button.disableInteractive();
      button.setAlpha(0.65);
      buttonLabel.setAlpha(0.8);
    }
  }

  private refreshMaintenanceSummary() {
    this.summaryText.setText(
      `TOKENS AFTER UPKEEP: ${this.tokens}    |    UPKEEP: ${RUN_CONFIG.serverCostPerShift}\nACCURACY: ${this.accuracy}%    |    AGENT SLOTS: ${this.runState.loadout.agentCapacity}    |    SKILL SLOTS: ${this.runState.loadout.skillCapacity}    |    COOLANT: ${getActiveUtilityCharges(this.runState, "coolant_purge")}`,
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
      this.purchaseStatusText.setColor(RETRO_COLORS.amberText);
    }
  }

  private drawShopOffers() {
    const passiveOffers = this.getPassiveOfferCards();
    const utilityOffers = this.getUtilityOfferCards();
    const availableOffers = [...passiveOffers, ...utilityOffers];

    for (let index = availableOffers.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      const current = availableOffers[index];
      availableOffers[index] = availableOffers[randomIndex];
      availableOffers[randomIndex] = current;
    }

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
      ownedText: `CHARGES: ${charges}/${utility.maxCharges}`,
      isMaxed: charges >= utility.maxCharges,
      canPurchase: canPurchaseActiveUtility(this.runState, utility.id),
    };
  }
}
