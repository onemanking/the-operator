import Phaser from "phaser";
import {
  getPersistentDeathCount,
  recordPersistentDeath,
} from "../../data/RunHistoryData";
import { getActiveUtilityInventorySummary } from "../../data/UtilityData";
import { createInitialRunState, ShiftSceneData } from "../../types/SceneData";
import {
  MONITOR_COLORS,
  MonitorSequenceController,
  createMonitorFeed,
  createMonitorTextStyle,
} from "../shared/monitorPresentation";
import { MaintenancePageScene } from "./MaintenancePageScene";
import {
  formatFineTuneVersion,
  getFailureDigestText,
  getFineTuneRebootText,
} from "./runtime";

export class MaintenanceFailureScene extends MaintenancePageScene {
  private deathCount = 0;
  private metricsBody?: Phaser.GameObjects.Text;
  private purchaseStatusText!: Phaser.GameObjects.Text;

  constructor() {
    super("MaintenanceFailureScene");
  }

  init(data: ShiftSceneData) {
    super.init(data);
    this.deathCount = recordPersistentDeath(this.runState.runId);
    if (this.deathCount === 0) {
      this.deathCount = getPersistentDeathCount();
    }
  }

  protected getShellConfig() {
    return {
      title: "SYSTEM SAFE MODE // FAILURE REPORT",
      subtitle: `TOKENS ${this.tokens} // ACC ${this.accuracy}%`,
      footerLeft: "CHANNEL: MAINTENANCE.BUS",
      footerRight: "ENTER / SPACE // REBOOT SYSTEM",
    };
  }

  protected applySceneTheme() {
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

  protected buildPage() {
    const shell = this.shell;

    if (!shell) {
      return;
    }

    const feed = createMonitorFeed(this, shell, {
      headerText: "FAILURE ARCHIVE // LAST RECORDED METRICS",
      headerStyle: {
        color: MONITOR_COLORS.dangerText,
      },
      sections: [
        {
          label: "FAILURE DIGEST",
          text: getFailureDigestText(this.runState),
          reveal: "word",
          speedMs: 84,
          playSound: true,
          soundProfile: "danger",
          color: MONITOR_COLORS.dangerText,
          labelStyle: {
            color: MONITOR_COLORS.dangerText,
          },
          bodyStyle: {
            fontSize: "20px",
            lineSpacing: 8,
          },
        },
        {
          label: "RECORDED METRICS",
          text: this.getMetricsText(),
          reveal: "line",
          speedMs: 90,
          playSound: true,
          soundProfile: "soft",
          color: MONITOR_COLORS.dangerText,
          labelStyle: {
            color: MONITOR_COLORS.dangerText,
          },
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
        `REBOOT SYSTEM TO QUEUE ${formatFineTuneVersion(this.deathCount)} FOR THE NEXT PASS`,
        createMonitorTextStyle({
          fontSize: "16px",
          color: MONITOR_COLORS.dangerText,
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
        commandLabel: "REBOOT SYSTEM",
        hintText: "ENTER / SPACE // REBOOT SYSTEM",
        transitionHint: "FINE-TUNE PIPELINE LINKING...",
        transitionMessage: getFineTuneRebootText(this.deathCount),
        transitionColor: MONITOR_COLORS.dangerText,
        transitionHoldMs: 1000,
        action: () => {
          this.scene.start("BriefingScene", createInitialRunState());
        },
      });
    });
  }

  private getMetricsText() {
    return [
      `LAST DAY CLEARED........ ${this.day}`,
      `TOKENS BANKED........... ${this.tokens}`,
      `ACCURACY CACHE.......... ${this.accuracy}%`,
      `THERMAL LOAD............ ${Math.round(this.runState.heat)}%`,
      `HALLUCINATION DRIFT..... ${Math.round(this.runState.hallucination)}%`,
      `PROMPTS ARCHIVED........ ${this.runState.seenTurnIds.length}`,
      `UTILITY BUS............. ${getActiveUtilityInventorySummary(this.runState)}`,
      `LAST LOADOUT............ AGENT ${this.runState.loadout.agentCapacity} // SKILL ${this.runState.loadout.skillCapacity}`,
      `DEATH COUNT............. ${this.deathCount}`,
    ].join("\n");
  }
}
