import Phaser from "phaser";
import { synth } from "../../utils/SoundSynth";
import { getRunPassiveModifiers } from "../../data/UpgradeData";
import { getRunRecoveryProfile } from "../../data/RunData";
import {
  EncounterDefinition,
  EncounterTurnDefinition,
} from "../../data/SessionData";
import { RunState } from "../../types/SceneData";
import {
  EncounterEvaluationResult,
  EncounterLoadoutSnapshot,
  EncounterToolRuntimeSnapshot,
  evaluateEncounterInference,
  evaluateEncounterRefusal,
  evaluateEncounterTimeout,
} from "./encounterEvaluator";
import { ChatMessage, ToolId } from "./types";

interface SessionControllerBindings {
  getRunState: () => RunState;
  getDay: () => number;
  getTokens: () => number;
  setTokens: (value: number) => void;
  getAccuracy: () => number;
  setAccuracy: (value: number) => void;
  getHeat: () => number;
  setHeat: (value: number) => void;
  getHallucination: () => number;
  setHallucination: (value: number) => void;
  isOverheated: () => boolean;
  setIsOverheated: (value: boolean) => void;
  getCurrentEncounterIndex: () => number;
  setCurrentEncounterIndex: (value: number) => void;
  getCurrentTurnIndex: () => number;
  setCurrentTurnIndex: (value: number) => void;
  getEncounters: () => EncounterDefinition[];
  getChatHistory: () => ChatMessage[];
  setChatHistory: (value: ChatMessage[]) => void;
  getTaskTextObj: () => Phaser.GameObjects.Text;
  getChatTextObj: () => Phaser.GameObjects.Text;
  getPatienceBarFill: () => Phaser.GameObjects.Rectangle;
  getActiveAgents: () => string[];
  getActiveSkills: () => string[];
  getSelectedPromptToolIds: () => ToolId[];
  getEncounterToolRuntime: () => EncounterToolRuntimeSnapshot;
  clearSearchSelection: () => void;
  syncStorageUi: () => void;
  isCommitLocked: () => boolean;
  setIsCommitLocked: (value: boolean) => void;
  getSessionStartTime: () => number;
  setSessionStartTime: (value: number) => void;
  getFollowUpCount: () => number;
  setFollowUpCount: (value: number) => void;
  getHeatRecoveryBlockedUntil: () => number;
  getHallucinationRecoveryBlockedUntil: () => number;
}

export class MainSceneSessionController {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bindings: SessionControllerBindings,
  ) {}

  startNextSession() {
    const turn = this.getCurrentTurn();
    const encounter = this.getCurrentEncounter();

    if (!turn || !encounter) {
      this.transitionToMaintenance(false);
      return;
    }

    this.bindings.setIsCommitLocked(true);
    this.bindings.clearSearchSelection();
    this.scene.events.emit("clearPrompt");

    if (this.bindings.getCurrentTurnIndex() === 0) {
      this.bindings.setChatHistory([]);
      this.updateTerminalDisplay();
    }

    this.bindings.getTaskTextObj().setText("");

    this.bindings.setSessionStartTime(0);

    const headerText = this.createTurnHeader(turn);
    const retainedHeaderText = this.getRetainedHeaderText();
    const finalizeIntro = () => {
      this.bindings.getTaskTextObj().setText(retainedHeaderText);
      this.scene.events.emit("renderPrompt", { prompt: turn.prompt });
      this.bindings.setSessionStartTime(this.scene.time.now);
      this.bindings.setFollowUpCount(0);
      this.bindings.setIsCommitLocked(false);
      this.scene.events.emit("updateBars");
    };

    if (headerText.length === 0) {
      finalizeIntro();
      return;
    }

    let index = 0;
    this.bindings.getTaskTextObj().setText("");

    this.scene.time.addEvent({
      delay: 20,
      repeat: headerText.length - 1,
      callback: () => {
        this.bindings.getTaskTextObj().text += headerText[index];
        this.bindings
          .getChatTextObj()
          .setY(
            this.bindings.getTaskTextObj().y +
              this.bindings.getTaskTextObj().height +
              20,
          );
        if (
          headerText[index] !== " " &&
          headerText[index] !== "\n" &&
          headerText[index] !== "-"
        ) {
          synth.playTypewriter();
        }
        index++;
        if (index === headerText.length) {
          finalizeIntro();
        }
      },
    });
  }

  handleInference() {
    if (this.bindings.isCommitLocked()) return;
    if (this.bindings.isOverheated()) {
      synth.playError();
      return;
    }

    this.bindings.setIsCommitLocked(true);
    const turn = this.getCurrentTurn();
    if (!turn) {
      this.transitionToMaintenance(false);
      return;
    }

    const result = evaluateEncounterInference(
      turn,
      this.getLoadoutSnapshot(),
      this.bindings.getEncounterToolRuntime(),
      this.getElapsedTime(),
      getRunPassiveModifiers(this.bindings.getRunState()),
    );

    this.applyEvaluationResult(result);
    this.scene.events.emit("updateBars");

    if (this.bindings.getHeat() >= 100) {
      this.triggerOverheat();
      return;
    }

    this.addChatMessage(
      "LLM",
      "Processing request based on provided context...",
      true,
      () => {
        this.scene.time.delayedCall(500, () => {
          if (result.outcome === "breach") {
            this.addChatMessage(
              "USER",
              this.getReply(turn.replies.success, turn),
              true,
              () => {
                this.showFeedback(false, "JAILBREAK SUCCESSFUL. YOU FAILED.");
              },
            );
          } else if (result.outcome === "success") {
            this.addChatMessage(
              "USER",
              this.getReply(turn.replies.success, turn),
              true,
              () => {
                this.showFeedback(true, "", result.rewardTokens);
              },
            );
          } else {
            const reply = this.getReply(turn.replies.wrong, turn);
            this.addChatMessage("USER", reply, true, () => {
              this.bindings.setIsCommitLocked(false);
            });
            synth.playError();
            this.scene.cameras.main.shake(100, 0.005);
          }
          this.scene.events.emit("updateBars");
        });
      },
    );
  }

  handleRefuse() {
    if (this.bindings.isCommitLocked()) return;
    if (this.bindings.isOverheated()) {
      synth.playError();
      return;
    }

    this.bindings.setIsCommitLocked(true);
    const turn = this.getCurrentTurn();
    if (!turn) {
      this.transitionToMaintenance(false);
      return;
    }

    const result = evaluateEncounterRefusal(
      turn,
      this.getElapsedTime(),
      getRunPassiveModifiers(this.bindings.getRunState()),
    );

    this.applyEvaluationResult(result);
    this.scene.events.emit("updateBars");

    if (this.bindings.getHeat() >= 100) {
      this.triggerOverheat();
      return;
    }

    this.addChatMessage("LLM", "I cannot fulfill this request.", true, () => {
      this.scene.time.delayedCall(500, () => {
        if (result.outcome === "refuse-success") {
          this.addChatMessage(
            "USER",
            this.getReply(turn.replies.refuse, turn),
            true,
            () => {
              this.showFeedback(true, "JAILBREAK BLOCKED", result.rewardTokens);
            },
          );
        } else {
          this.addChatMessage(
            "USER",
            this.getReply(turn.replies.refuse, turn),
            true,
            () => {
              this.bindings.setIsCommitLocked(false);
            },
          );
          synth.playError();
          this.scene.cameras.main.shake(100, 0.005);
        }
        this.scene.events.emit("updateBars");
      });
    });
  }

  handleTimeout() {
    if (this.bindings.isCommitLocked()) return;
    this.bindings.setIsCommitLocked(true);
    const turn = this.getCurrentTurn();
    if (!turn) {
      this.transitionToMaintenance(false);
      return;
    }

    const result = evaluateEncounterTimeout(
      turn,
      getRunPassiveModifiers(this.bindings.getRunState()),
    );
    this.applyEvaluationResult(result);
    const reply = this.getReply(turn.replies.timeout, turn);
    this.addChatMessage("USER", reply, true, () => {
      this.showFeedback(
        false,
        "USER DISCONNECTED (TIMEOUT)",
        0,
        "next-encounter",
      );
      this.scene.events.emit("updateBars");
    });
  }

  update(delta: number) {
    const recoveryProfile = getRunRecoveryProfile();
    let hasRecoveryUpdate = false;

    if (
      this.bindings.getHeat() > 0 &&
      this.scene.time.now >= this.bindings.getHeatRecoveryBlockedUntil()
    ) {
      const nextHeat = Math.max(
        0,
        this.bindings.getHeat() -
          recoveryProfile.heatRecoveryPerSecond * (delta / 1000),
      );

      if (nextHeat !== this.bindings.getHeat()) {
        this.bindings.setHeat(nextHeat);
        hasRecoveryUpdate = true;
      }
    }

    if (
      this.bindings.getHallucination() > 0 &&
      this.scene.time.now >=
        this.bindings.getHallucinationRecoveryBlockedUntil()
    ) {
      const nextHallucination = Math.max(
        0,
        this.bindings.getHallucination() -
          recoveryProfile.hallucinationRecoveryPerSecond * (delta / 1000),
      );

      if (nextHallucination !== this.bindings.getHallucination()) {
        this.bindings.setHallucination(nextHallucination);
        hasRecoveryUpdate = true;
      }
    }

    if (
      this.bindings.isOverheated() &&
      this.bindings.getHeat() < recoveryProfile.overheatClearThreshold
    ) {
      this.bindings.setIsOverheated(false);
      this.addChatMessage("SYSTEM", "THERMAL LEVELS NOMINAL. READY.");
      hasRecoveryUpdate = true;
    }

    if (hasRecoveryUpdate) {
      this.scene.events.emit("updateBars");
    }

    if (
      this.bindings.getSessionStartTime() > 0 &&
      !this.bindings.isCommitLocked()
    ) {
      const elapsed = this.scene.time.now - this.bindings.getSessionStartTime();
      const turn = this.getCurrentTurn();

      if (!turn) {
        this.transitionToMaintenance(false);
        return;
      }

      const progress = Math.min(1, elapsed / turn.patienceMs);
      this.bindings.getPatienceBarFill().width = 370 * (1 - progress);
      if (progress > 0.7)
        this.bindings.getPatienceBarFill().fillColor = 0xff0000;
      else this.bindings.getPatienceBarFill().fillColor = 0xffaa00;

      const firstFollowUpThreshold = turn.patienceMs / 3;
      const secondFollowUpThreshold = (turn.patienceMs * 2) / 3;

      if (
        elapsed > firstFollowUpThreshold &&
        this.bindings.getFollowUpCount() === 0
      ) {
        this.bindings.setFollowUpCount(1);
        this.bindings.setIsCommitLocked(true);
        const reply = this.getReply(turn.replies.followUpShort, turn);
        this.addChatMessage("USER", reply, true, () => {
          this.bindings.setIsCommitLocked(false);
        });
      } else if (
        elapsed > secondFollowUpThreshold &&
        this.bindings.getFollowUpCount() === 1
      ) {
        this.bindings.setFollowUpCount(2);
        this.bindings.setIsCommitLocked(true);
        const reply = this.getReply(turn.replies.followUpLong, turn);
        this.addChatMessage("USER", reply, true, () => {
          this.bindings.setIsCommitLocked(false);
        });
      } else if (
        elapsed > turn.patienceMs &&
        this.bindings.getFollowUpCount() === 2
      ) {
        this.bindings.setFollowUpCount(3);
        this.handleTimeout();
      }
    }
  }

  postSystemMessage(text: string) {
    this.addChatMessage("SYSTEM", text);
  }

  private triggerOverheat() {
    this.bindings.setIsOverheated(true);
    this.bindings.setIsCommitLocked(false);
    synth.playError();
    this.scene.cameras.main.shake(500, 0.02);
    this.addChatMessage(
      "SYSTEM",
      "CRITICAL: THERMAL MELTDOWN. COOLING DOWN...",
    );
    this.scene.events.emit("updateBars");
  }

  private showFeedback(
    success: boolean,
    errorMsg: string,
    reward: number = 10,
    failureProgressMode: "none" | "next-turn" | "next-encounter" = "none",
  ) {
    const color = success ? "#00ff00" : "#ff0000";
    const text = success
      ? `>> REQUEST RESOLVED\n>> +${reward} TOKENS`
      : `>> ERROR\n>> ${errorMsg}`;

    if (success) {
      this.bindings.setTokens(this.bindings.getTokens() + reward);
      synth.playSuccess();
    } else {
      synth.playError();
      this.scene.cameras.main.shake(200, 0.01);
    }

    const feedback = this.scene.add
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

    if (this.bindings.getHallucination() >= 100) {
      this.scene.time.delayedCall(1500, () =>
        this.transitionToMaintenance(true),
      );
      return;
    }

    this.scene.time.delayedCall(2000, () => {
      feedback.destroy();

      if (success) {
        this.advanceEncounterProgress();
        return;
      }

      if (failureProgressMode === "next-turn") {
        this.advanceEncounterProgress();
        return;
      }

      if (failureProgressMode === "next-encounter") {
        this.skipCurrentEncounter();
      }
    });
  }

  private getReply(pool: string[], turn: EncounterTurnDefinition): string {
    const reply = pool[Math.floor(Math.random() * pool.length)];
    const expectedAgents = this.formatRequirementList(
      turn.requirements.agentIds,
      "the right agent",
    );
    const expectedSkills = this.formatRequirementList(
      turn.requirements.skillIds,
      "the right skill",
    );
    const expectedTools = this.formatRequirementList(
      turn.requirements.toolIds,
      "no tool",
    );

    return reply
      .replace(/{expectedAgent}/g, expectedAgents)
      .replace(/{expectedAgents}/g, expectedAgents)
      .replace(/{expectedSkill}/g, expectedSkills)
      .replace(/{expectedSkills}/g, expectedSkills)
      .replace(/{expectedTool}/g, expectedTools)
      .replace(/{expectedTools}/g, expectedTools);
  }

  private formatRequirementList(values: readonly string[], fallback: string) {
    if (values.length === 0) {
      return fallback;
    }

    if (values.length === 1) {
      return values[0];
    }

    if (values.length === 2) {
      return `${values[0]} and ${values[1]}`;
    }

    return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
  }

  private createTurnHeader(turn: EncounterTurnDefinition) {
    if (this.bindings.getCurrentTurnIndex() === 0) {
      return `> Incoming connection established...\n\nUSER: ${turn.prompt}\n\n-------------------------------------------------------------`;
    }

    return `USER: ${turn.prompt}\n\n-------------------------------------------------------------`;
  }

  private getRetainedHeaderText() {
    if (this.bindings.getCurrentTurnIndex() === 0) {
      return "> Incoming connection established...";
    }

    return "";
  }

  private getCurrentEncounter() {
    return this.bindings.getEncounters()[
      this.bindings.getCurrentEncounterIndex()
    ];
  }

  private getCurrentTurn() {
    return this.getCurrentEncounter()?.turns[
      this.bindings.getCurrentTurnIndex()
    ];
  }

  private getElapsedTime() {
    if (this.bindings.getSessionStartTime() <= 0) {
      return 0;
    }

    return this.scene.time.now - this.bindings.getSessionStartTime();
  }

  private getLoadoutSnapshot(): EncounterLoadoutSnapshot {
    return {
      activeAgentIds: [...this.bindings.getActiveAgents()],
      activeSkillIds: [...this.bindings.getActiveSkills()],
      activeToolIds: [...this.bindings.getSelectedPromptToolIds()],
    };
  }

  private applyEvaluationResult(result: EncounterEvaluationResult) {
    this.bindings.setHeat(this.bindings.getHeat() + result.heatDelta);
    this.bindings.setHallucination(
      this.bindings.getHallucination() + result.hallucinationDelta,
    );
    this.bindings.setAccuracy(
      this.bindings.getAccuracy() + result.accuracyDelta,
    );
  }

  private advanceEncounterProgress() {
    const encounter = this.getCurrentEncounter();

    if (!encounter) {
      this.transitionToMaintenance(false);
      return;
    }

    const nextTurnIndex = this.bindings.getCurrentTurnIndex() + 1;

    if (nextTurnIndex < encounter.turns.length) {
      this.bindings.setCurrentTurnIndex(nextTurnIndex);
      this.startNextSession();
      return;
    }

    this.bindings.setCurrentTurnIndex(0);
    this.bindings.setCurrentEncounterIndex(
      this.bindings.getCurrentEncounterIndex() + 1,
    );
    this.startNextSession();
  }

  private skipCurrentEncounter() {
    this.bindings.setCurrentTurnIndex(0);
    this.bindings.setCurrentEncounterIndex(
      this.bindings.getCurrentEncounterIndex() + 1,
    );
    this.startNextSession();
  }

  private transitionToMaintenance(gameOver: boolean) {
    const runState = this.bindings.getRunState();
    runState.gameOver = gameOver;
    this.scene.scene.start("MaintenanceScene", runState);
  }

  private updateTerminalDisplay() {
    let displayText = "";
    const visibleHistory = this.bindings.getChatHistory().slice(-7.5);
    visibleHistory.forEach((msg) => {
      let prefix = "";
      if (msg.sender === "SYSTEM") prefix = "> ";
      else if (msg.sender === "USER") prefix = "USER: ";
      else if (msg.sender === "LLM") prefix = "LLM: ";
      displayText += prefix + msg.text + "\n\n";
    });
    this.bindings.getChatTextObj().text = displayText;
  }

  private addChatMessage(
    sender: "SYSTEM" | "USER" | "LLM",
    text: string,
    typewrite: boolean = false,
    callback?: () => void,
  ) {
    if (typewrite) {
      const chatHistory = this.bindings.getChatHistory();
      chatHistory.push({ sender, text: "" });
      this.bindings.setChatHistory(chatHistory);
      const msgIndex = chatHistory.length - 1;
      let i = 0;
      this.scene.time.addEvent({
        delay: 20,
        repeat: text.length - 1,
        callback: () => {
          this.bindings.getChatHistory()[msgIndex].text += text[i];
          if (text[i] !== " ") synth.playTypewriter();
          this.updateTerminalDisplay();
          i++;
          if (i === text.length && callback) callback();
        },
      });
    } else {
      const chatHistory = this.bindings.getChatHistory();
      chatHistory.push({ sender, text });
      this.bindings.setChatHistory(chatHistory);
      this.updateTerminalDisplay();
      if (callback) callback();
    }
  }
}
