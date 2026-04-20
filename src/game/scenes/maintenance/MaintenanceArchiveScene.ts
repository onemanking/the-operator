import { createInitialRunState } from "../../types/SceneData";
import {
  MONITOR_COLORS,
  MonitorSequenceController,
  createMonitorFeed,
} from "../shared/monitorPresentation";
import { MaintenancePageScene } from "./MaintenancePageScene";

export class MaintenanceArchiveScene extends MaintenancePageScene {
  constructor() {
    super("MaintenanceArchiveScene");
  }

  protected getShellConfig() {
    return {
      title: "SYSTEM SAFE MODE // FAILURE REPORT",
      subtitle: `TOKENS ${this.tokens} // ACC ${this.accuracy}%`,
      footerLeft: "CHANNEL: MAINTENANCE.BUS",
      footerRight: "ENTER / SPACE // REBOOT SYSTEM",
    };
  }

  protected buildPage() {
    const shell = this.shell;

    if (!shell) {
      return;
    }

    const feed = createMonitorFeed(this, shell, {
      headerText: "ARCHIVE DIGEST // CONTENT POOL EXHAUSTED",
      sections: [
        {
          label: "ARCHIVE NOTICE",
          text: [
            "NO FRESH PROMPTS REMAIN IN THE AUTHORED POOL.",
            "SHIFT ARCHIVE COMPLETE.",
            "SYSTEM REBOOT REQUIRED BEFORE NEXT SHIFT.",
          ].join("\n"),
          reveal: "word",
          speedMs: 86,
          playSound: true,
          soundProfile: "warning",
          color: MONITOR_COLORS.warningText,
          labelStyle: {
            color: MONITOR_COLORS.warningText,
          },
          bodyStyle: {
            fontSize: "22px",
            lineSpacing: 8,
          },
        },
      ],
    });

    this.sequenceController = new MonitorSequenceController(this);
    this.sequenceController.play(feed.steps, () => {
      this.setReadyState({
        commandLabel: "REBOOT SYSTEM",
        hintText: "ENTER / SPACE // REBOOT SYSTEM",
        transitionHint: "ARCHIVE REINDEX LINKING...",
        transitionMessage: "ARCHIVE RESET // DAY 1 STAGED",
        transitionColor: MONITOR_COLORS.text,
        action: () => {
          this.scene.start("BriefingScene", createInitialRunState());
        },
      });
    });
  }
}
