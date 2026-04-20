import Phaser from "phaser";
import { RUN_CONFIG } from "../../data/RunData";
import { getActiveUtilityInventorySummary } from "../../data/UtilityData";
import { createInitialRunState } from "../../types/SceneData";
import {
  MONITOR_COLORS,
  MonitorSequenceController,
  createMonitorFeed,
  createMonitorTextStyle,
} from "../shared/monitorPresentation";
import { MaintenancePageScene } from "./MaintenancePageScene";

export class MaintenanceRunCompleteScene extends MaintenancePageScene {
  private metricsBody?: Phaser.GameObjects.Text;
  private purchaseStatusText!: Phaser.GameObjects.Text;

  constructor() {
    super("MaintenanceRunCompleteScene");
  }

  protected getShellConfig() {
    return {
      title: "SYSTEM SAFE MODE // RUN COMPLETE",
      subtitle: `DAY ${this.day}/${RUN_CONFIG.maxDay} // TOKENS ${this.tokens} // ACC ${this.accuracy}%`,
      footerLeft: "CHANNEL: MAINTENANCE.BUS",
      footerRight: "ENTER / SPACE // ARCHIVE RUN",
    };
  }

  protected buildPage() {
    const shell = this.shell;

    if (!shell) {
      return;
    }

    const feed = createMonitorFeed(this, shell, {
      headerText: "FINAL RUN ARCHIVE // STORED METRICS",
      sections: [
        {
          label: "RUN DIGEST",
          text: [
            "FIVE-DAY OPERATOR CONTRACT COMPLETE.",
            "MAINFRAME LOAD STABILIZED.",
            "ARCHIVE THE RUN AND PREP THE NEXT CREW.",
          ].join("\n"),
          reveal: "word",
          speedMs: 82,
          playSound: true,
          soundProfile: "bright",
          bodyStyle: {
            fontSize: "20px",
            lineSpacing: 8,
          },
        },
        {
          label: "FINAL METRICS",
          text: this.getMetricsText(),
          reveal: "line",
          speedMs: 90,
          playSound: true,
          soundProfile: "soft",
          bodyStyle: {
            fontSize: "16px",
            lineSpacing: 4,
          },
        },
      ],
    });

    this.metricsBody = feed.sections[1]?.body;
    this.purchaseStatusText = this.add
      .text(
        shell.contentX + shell.contentWidth / 2,
        shell.screenY + shell.screenHeight - 74,
        "RUN COMPLETE // ARCHIVE AND CYCLE THE NEXT CREW",
        createMonitorTextStyle({
          fontSize: "16px",
          color: MONITOR_COLORS.text,
          align: "center",
          wordWrap: { width: shell.contentWidth },
        }),
      )
      .setOrigin(0.5)
      .setAlpha(0);

    this.sequenceController = new MonitorSequenceController(this);
    this.sequenceController.play(feed.steps, () => {
      this.metricsBody?.setText(this.getMetricsText());
      this.purchaseStatusText.setAlpha(1);
      this.setReadyState({
        commandLabel: "ARCHIVE RUN",
        hintText: "ENTER / SPACE // ARCHIVE RUN",
        transitionHint: "NEXT CONTRACT STAGING...",
        transitionMessage: "NEW CONTRACT STAGED // DAY 1 READY",
        transitionColor: MONITOR_COLORS.text,
        action: () => {
          this.scene.start("BriefingScene", createInitialRunState());
        },
      });
    });
  }

  private getMetricsText() {
    const installedUpgradeCount =
      this.runState.loadout.passiveUpgradeIds.length;
    const utilityChargeCount = Object.values(
      this.runState.utilityInventory.chargesById,
    ).reduce((total, charges) => total + (charges ?? 0), 0);

    return [
      `DAYS CLEARED............ ${this.day}/${RUN_CONFIG.maxDay}`,
      `TOKENS BANKED........... ${this.tokens}`,
      `ACCURACY CACHE.......... ${this.accuracy}%`,
      `THERMAL LOAD............ ${Math.round(this.runState.heat)}%`,
      `HALLUCINATION DRIFT..... ${Math.round(this.runState.hallucination)}%`,
      `PROMPTS ARCHIVED........ ${this.runState.seenTurnIds.length}`,
      `UPGRADES INSTALLED...... ${installedUpgradeCount}`,
      `UTILITY CHARGES......... ${utilityChargeCount}`,
      `UTILITY BUS............. ${getActiveUtilityInventorySummary(this.runState)}`,
      `FINAL LOADOUT........... AGENT ${this.runState.loadout.agentCapacity} // SKILL ${this.runState.loadout.skillCapacity}`,
    ].join("\n");
  }
}
