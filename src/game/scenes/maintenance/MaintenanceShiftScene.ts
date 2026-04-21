import Phaser from "phaser";
import { RUN_CONFIG, canMakeMaintenancePurchase } from "../../data/RunData";
import {
  PassiveUpgradeId,
  applyPassiveUpgrade,
  getPassiveUpgradeDefinition,
} from "../../data/UpgradeData";
import {
  ActiveUtilityId,
  applyActiveUtilityPurchase,
  getActiveUtilityDefinition,
  getActiveUtilityInventorySummary,
} from "../../data/UtilityData";
import { synth } from "../../utils/SoundSynth";
import {
  MONITOR_COLORS,
  MonitorSequenceController,
  createMonitorCommandButton,
  createMonitorFeed,
  createMonitorTextStyle,
} from "../shared/monitorPresentation";
import { MaintenancePageScene } from "./MaintenancePageScene";
import {
  MaintenanceOfferCard,
  buildNextRunState,
  getMaintenanceOfferCards,
} from "./runtime";
import { getLLMLabel } from "../../data/LLMVersionData";

interface MaintenanceOfferCardView {
  offerId: string;
  frame: Phaser.GameObjects.Rectangle;
  accentLine: Phaser.GameObjects.Rectangle;
  titleText: Phaser.GameObjects.Text;
  descriptionText: Phaser.GameObjects.Text;
  metaText: Phaser.GameObjects.Text;
  commandButton: ReturnType<typeof createMonitorCommandButton>;
}

const DEFAULT_CARD_THEME = {
  fillColor: 0x030703,
  hoverFillColor: 0x33ff33,
  strokeColor: 0x33ff33,
  hoverStrokeColor: 0x33ff33,
  textColor: MONITOR_COLORS.text,
  hoverTextColor: MONITOR_COLORS.invertText,
  disabledFillColor: 0x050705,
  disabledStrokeColor: 0x1d7a1d,
  disabledTextColor: MONITOR_COLORS.dimText,
  cursorColor: 0x33ff33,
  hoverCursorColor: 0x020602,
} as const;

const PURCHASED_CARD_THEME = {
  fillColor: 0x261404,
  hoverFillColor: 0xffb347,
  strokeColor: 0xffb347,
  hoverStrokeColor: 0xffb347,
  textColor: MONITOR_COLORS.warningText,
  hoverTextColor: MONITOR_COLORS.invertText,
  disabledFillColor: 0x261404,
  disabledStrokeColor: 0xffb347,
  disabledTextColor: MONITOR_COLORS.warningText,
  cursorColor: 0xffb347,
  hoverCursorColor: 0x020602,
} as const;

export class MaintenanceShiftScene extends MaintenancePageScene {
  private diagnosticsBody?: Phaser.GameObjects.Text;
  private purchaseStatusText!: Phaser.GameObjects.Text;
  private offerCardViews: MaintenanceOfferCardView[] = [];
  private purchasedOfferIds = new Set<string>();
  private shopObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super("MaintenanceShiftScene");
  }

  protected getShellConfig() {
    return {
      title: `SYSTEM SAFE MODE // DAY ${this.day} COMPLETE`,
      subtitle: `TOKENS ${this.tokens}`,
      footerLeft: "CHANNEL: MAINTENANCE.BUS",
      footerRight: "ENTER / SPACE // ADVANCE",
    };
  }

  protected buildPage() {
    const shell = this.shell;

    if (!shell) {
      return;
    }

    this.purchasedOfferIds.clear();
    if (this.runState.maintenancePurchasedItemId) {
      this.purchasedOfferIds.add(this.runState.maintenancePurchasedItemId);
    }
    this.shopObjects = [];

    const feed = createMonitorFeed(this, shell, {
      headerText: "SHIFT WINDOW SEALED // RECOVERY BUS ONLINE",
      sections: [
        {
          label: "SHIFT HANDOFF",
          text: [
            "SHIFT WINDOW SEALED.",
            `DAY ${this.day + 1} BRIEFING PAYLOAD QUEUED.`,
            "SELECT UP TO TWO MAINTENANCE SLOTS BEFORE BOOT.",
          ].join("\n"),
          reveal: "word",
          speedMs: 76,
          pauseAfterMs: 140,
          playSound: true,
          soundProfile: "bright",
          bodyStyle: {
            fontSize: "20px",
            lineSpacing: 6,
          },
        },
        {
          label: "POST-SHIFT DIAGNOSTICS",
          text: this.getDiagnosticsText(),
          reveal: "line",
          speedMs: 100,
          playSound: true,
          soundProfile: "soft",
          bodyStyle: {
            fontSize: "16px",
            lineSpacing: 4,
          },
        },
      ],
    });

    this.diagnosticsBody = feed.sections[1]?.body;
    this.offerCardViews = [];
    const revealStartIndex = this.children.list.length;
    const shopLayout = this.createUpgradeShop(feed.bottomY + 24);
    this.purchaseStatusText = this.add
      .text(
        shopLayout.statusX,
        shopLayout.statusY,
        "SELECT UP TO TWO OFFERS OR SKIP.",
        createMonitorTextStyle({
          fontSize: "13px",
          color: MONITOR_COLORS.text,
          align: "right",
          wordWrap: { width: shopLayout.statusWidth },
        }),
      )
      .setOrigin(1, 0)
      .setAlpha(0);
    this.shopObjects.push(this.purchaseStatusText);

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

    this.sequenceController = new MonitorSequenceController(this);
    this.sequenceController.play(feed.steps, () => {
      this.refreshMaintenanceView();
      this.revealTargets(revealTargets);
      this.setReadyState({
        commandLabel: "BOOT NEXT SHIFT",
        hintText: "ENTER / SPACE // BOOT NEXT SHIFT",
        transitionHint: "NEXT SHIFT LINKING...",
        transitionMessage: `SYSTEM START // DAY ${this.day + 1} STAGED`,
        transitionColor: MONITOR_COLORS.text,
        action: () => {
          this.scene.start("BriefingScene", buildNextRunState(this.runState));
        },
      });
    });
  }

  private createUpgradeShop(panelY: number): {
    statusX: number;
    statusY: number;
    statusWidth: number;
  } {
    const shell = this.shell;

    if (!shell) {
      return {
        statusX: this.cameras.main.width / 2,
        statusY: panelY,
        statusWidth: 320,
      };
    }

    const panelX = shell.contentX;
    const panelWidth = shell.contentWidth;
    const panelHeight = 240;
    const statusWidth = 320;

    const panel = this.add
      .rectangle(panelX, panelY, panelWidth, panelHeight, 0x08120a, 0.92)
      .setOrigin(0)
      .setStrokeStyle(1, 0x33ff33, 0.34);
    this.shopObjects.push(panel);

    const title = this.add
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
    this.shopObjects.push(title);

    const statusX = panelX + panelWidth - 18;
    const statusY = panelY + 12;

    const divider = this.add
      .rectangle(panelX + 18, panelY + 34, panelWidth - 36, 1, 0x33ff33, 0.16)
      .setOrigin(0, 0.5);
    this.shopObjects.push(divider);

    getMaintenanceOfferCards(this.runState).forEach((offer, index) => {
      this.createUpgradeCard(offer, panelX + 122 + index * 262, panelY + 130);
    });

    return {
      statusX,
      statusY,
      statusWidth,
    };
  }

  private createUpgradeCard(
    offer: MaintenanceOfferCard,
    centerX: number,
    centerY: number,
  ) {
    const frame = this.add
      .rectangle(centerX, centerY, 224, 176, 0x0b160d, 0.96)
      .setStrokeStyle(1, 0x33ff33, 0.45);

    const accentLine = this.add
      .rectangle(centerX - 94, centerY - 65, 188, 1, 0x33ff33, 0.14)
      .setOrigin(0, 0.5);

    const titleText = this.add
      .text(centerX, centerY - 76, offer.name, {
        ...createMonitorTextStyle({
          fontSize: "18px",
          fontStyle: "bold",
          color: MONITOR_COLORS.text,
          align: "center",
        }),
        wordWrap: { width: 180 },
      })
      .setOrigin(0.5);

    const descriptionText = this.add
      .text(centerX, centerY - 8, offer.description, {
        ...createMonitorTextStyle({
          fontSize: "15px",
          color: MONITOR_COLORS.mutedText,
          align: "center",
        }),
        wordWrap: { width: 180 },
      })
      .setOrigin(0.5);

    const metaText = this.add
      .text(
        centerX,
        centerY + 48,
        `COST: ${offer.cost} TOKENS\n${offer.ownedText}`,
        createMonitorTextStyle({
          fontSize: "14px",
          color: MONITOR_COLORS.mutedText,
          align: "center",
        }),
      )
      .setOrigin(0.5);

    const commandButton = createMonitorCommandButton({
      scene: this,
      x: centerX,
      y: centerY + 86,
      width: 182,
      label: "BUY UPGRADE",
      onPress: () => this.purchaseOffer(offer),
    });

    const cardView: MaintenanceOfferCardView = {
      offerId: offer.id,
      frame,
      accentLine,
      titleText,
      descriptionText,
      metaText,
      commandButton,
    };

    this.shopObjects.push(
      frame,
      accentLine,
      titleText,
      descriptionText,
      metaText,
      commandButton.container,
    );
    this.offerCardViews.push(cardView);
    this.applyOfferCardState(cardView, offer);
  }

  private purchaseOffer(offer: MaintenanceOfferCard) {
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
    this.purchasedOfferIds.add(offer.id);
    this.refreshMaintenanceView();
  }

  protected getTransitionHideTargets() {
    return [
      ...super.getTransitionHideTargets(),
      ...this.shopObjects.filter((gameObject) => gameObject.active),
    ];
  }

  private getDiagnosticsText() {
    return [
      `TOKENS AFTER UPKEEP..... ${this.tokens}`,
      `UPKEEP COST............. ${RUN_CONFIG.serverCostPerShift}`,
      `ACCURACY CACHE.......... ${this.accuracy}%`,
      `UTILITY BUS............. ${getActiveUtilityInventorySummary(this.runState)}`,
    ].join("\n");
  }

  private refreshMaintenanceView() {
    this.shell?.subtitleText.setText(
      `TOKENS ${this.tokens} // ${getLLMLabel()}`,
    );
    this.diagnosticsBody?.setText(this.getDiagnosticsText());

    const offerById = new Map(
      getMaintenanceOfferCards(this.runState).map((offer) => [offer.id, offer]),
    );
    this.offerCardViews.forEach((cardView) => {
      const offer = offerById.get(cardView.offerId);
      if (!offer) {
        return;
      }

      this.applyOfferCardState(cardView, offer);
    });

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
            ? `STOCKED: ${purchasedLabel}`
            : `INSTALLED: ${purchasedLabel}`
          : "PURCHASE REGISTERED.",
      );
      this.purchaseStatusText.setColor(MONITOR_COLORS.warningText);
      return;
    }

    this.purchaseStatusText.setText("SELECT UP TO TWO OFFERS OR SKIP.");
    this.purchaseStatusText.setColor(MONITOR_COLORS.text);
  }

  private applyOfferCardState(
    cardView: MaintenanceOfferCardView,
    offer: MaintenanceOfferCard,
  ) {
    const canBuy = offer.canPurchase;
    const isPurchased = this.purchasedOfferIds.has(offer.id);
    const isLockedBySelection =
      !canMakeMaintenancePurchase(this.runState.maintenancePurchaseCount) &&
      !isPurchased;

    const strokeColor = isPurchased ? 0xffb347 : canBuy ? 0x33ff33 : 0x1d7a1d;
    const titleColor = isPurchased
      ? MONITOR_COLORS.warningText
      : canBuy
        ? MONITOR_COLORS.text
        : MONITOR_COLORS.mutedText;
    const bodyColor = isPurchased
      ? MONITOR_COLORS.warningText
      : MONITOR_COLORS.mutedText;
    const cardFill = isPurchased ? 0x251604 : 0x0b160d;
    const cardAlpha = isPurchased ? 0.98 : 0.96;
    const accentAlpha = isPurchased ? 0.34 : 0.14;
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

    cardView.frame.setFillStyle(cardFill, cardAlpha);
    cardView.frame.setStrokeStyle(1, strokeColor, isPurchased ? 0.85 : 0.45);
    cardView.accentLine.setFillStyle(strokeColor, accentAlpha);
    cardView.titleText.setText(offer.name).setColor(titleColor);
    cardView.descriptionText.setText(offer.description).setColor(bodyColor);
    cardView.metaText
      .setText(`COST: ${offer.cost} TOKENS\n${offer.ownedText}`)
      .setColor(bodyColor);
    cardView.commandButton.setLabel(label);
    cardView.commandButton.setTheme(
      isPurchased ? PURCHASED_CARD_THEME : DEFAULT_CARD_THEME,
    );
    cardView.commandButton.setEnabled(canBuy);
  }
}
