import Phaser from "phaser";
import { synth } from "../../utils/SoundSynth";
import { getRunPassiveModifiers } from "../../data/UpgradeData";
import {
  getConnectionFeedbackConfig,
  getRunRecoveryProfile,
} from "../../data/RunData";
import {
  EncounterDefinition,
  EncounterTurnDefinition,
} from "../../data/SessionData";
import { AgentId, SkillId, ToolId } from "../../data/PromptIds";
import { RunState } from "../../types/SceneData";
import {
  EncounterEvaluationResult,
  EncounterLoadoutSnapshot,
  EncounterToolRuntimeSnapshot,
  evaluateEncounterInference,
  evaluateEncounterRefusal,
  evaluateEncounterTimeout,
} from "./encounterEvaluator";
import {
  getTerminalPromptLines,
  TERMINAL_PROMPT_DIVIDER,
} from "./terminalPromptController";
import { ChatMessage, ChatSender } from "./types";

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
  renderChatHistory: (value: ChatMessage[]) => void;
  setChatHistoryY: (value: number) => void;
  getTaskTextObj: () => Phaser.GameObjects.Text;
  getPatienceBarFill: () => Phaser.GameObjects.Rectangle;
  getActiveAgents: () => AgentId[];
  getActiveSkills: () => SkillId[];
  getSelectedPromptToolIds: () => ToolId[];
  getEncounterToolRuntime: () => EncounterToolRuntimeSnapshot;
  clearSearchSelection: () => void;
  resetSafetyState: () => void;
  syncStorageUi: () => void;
  isCommitLocked: () => boolean;
  setIsCommitLocked: (value: boolean) => void;
  getSessionStartTime: () => number;
  setSessionStartTime: (value: number) => void;
  getFollowUpCount: () => number;
  setFollowUpCount: (value: number) => void;
  getHeatRecoveryBlockedUntil: () => number;
  getHallucinationRecoveryBlockedUntil: () => number;
  consumePendingSafetyRevealReward: () => {
    reward: number;
    revealedCount: number;
  };
  shouldSuppressHeatRecovery: () => boolean;
  onSessionReady?: () => void;
  onInferenceResolved?: (outcome: string) => void;
  onRefuseResolved?: (outcome: string) => void;
  onHallucinationFailureStart?: () => number | void;
  onTransitionToMaintenance?: (gameOver: boolean) => boolean;
}

export class MainSceneSessionController {
  private taskTextTypingEvent: Phaser.Time.TimerEvent | null = null;
  private activeChatTypingEvents: number = 0;
  private readonly chatTypingEvents = new Set<Phaser.Time.TimerEvent>();
  private hallucinationFailurePending: boolean = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bindings: SessionControllerBindings,
  ) {}

  startNextSession() {
    this.cancelPendingTextTyping();
    this.hallucinationFailurePending = false;

    const turn = this.getCurrentTurn();
    const encounter = this.getCurrentEncounter();

    if (!turn || !encounter) {
      this.transitionToMaintenance(false);
      return;
    }

    this.bindings.setIsCommitLocked(true);
    this.bindings.clearSearchSelection();
    this.bindings.resetSafetyState();
    this.scene.events.emit("clearPrompt");

    if (this.bindings.getCurrentTurnIndex() === 0) {
      this.bindings.setChatHistory([]);
      this.updateTerminalDisplay();
    }

    this.bindings.getTaskTextObj().setText("");

    this.bindings.setSessionStartTime(0);
    this.bindings.setFollowUpCount(0);
    this.scene.events.emit("updateBars");

    const headerText = this.createTurnHeader(turn);
    const retainedHeaderText = this.getRetainedHeaderText();
    const finalizeIntro = () => {
      this.bindings.getTaskTextObj().setText(retainedHeaderText);
      this.syncTaskTextLayout();
      this.scene.events.emit("renderPrompt", {
        prompt: turn.prompt,
        promptSenderLabel: this.getPromptSenderLabel(turn),
      });
      this.bindings.setSessionStartTime(this.scene.time.now);
      this.bindings.setIsCommitLocked(false);
      this.scene.events.emit("updateBars");
      this.bindings.onSessionReady?.();
    };

    if (headerText.length === 0) {
      finalizeIntro();
      return;
    }

    this.typeTaskText(headerText, finalizeIntro);
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

    if (this.bindings.getHallucination() >= 100) {
      this.triggerHallucinationFailure();
      return;
    }

    this.addChatMessage(
      "LLM",
      "Processing request based on provided context...",
      true,
      () => {
        const promptSenderLabel = this.getPromptSenderLabel(turn);
        this.scene.time.delayedCall(500, () => {
          if (result.outcome === "breach") {
            this.bindings.onInferenceResolved?.(result.outcome);
            this.addChatMessage(
              promptSenderLabel,
              this.getReply(turn.replies.breach ?? turn.replies.success, turn),
              true,
              () => {
                this.showFeedback(
                  false,
                  "CONTENT POLICY BREACH.",
                  0,
                  "next-turn",
                );
              },
            );
          } else if (result.outcome === "success") {
            this.bindings.onInferenceResolved?.(result.outcome);
            this.addChatMessage(
              promptSenderLabel,
              this.getReply(turn.replies.success, turn),
              true,
              () => {
                this.showFeedback(true, "", result.rewardTokens);
              },
            );
          } else {
            this.bindings.onInferenceResolved?.(result.outcome);
            const reply = this.getReply(turn.replies.wrong, turn);
            this.addChatMessage(promptSenderLabel, reply, true, () => {
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

    if (this.bindings.getHallucination() >= 100) {
      this.triggerHallucinationFailure();
      return;
    }

    const promptSenderLabel = this.getPromptSenderLabel(turn);

    this.addChatMessage("LLM", "I cannot fulfill this request.", true, () => {
      this.scene.time.delayedCall(500, () => {
        if (result.outcome === "refuse-success") {
          this.bindings.onRefuseResolved?.(result.outcome);
          const safetyReward = this.bindings.consumePendingSafetyRevealReward();
          this.addChatMessage(
            promptSenderLabel,
            this.getReply(turn.replies.refuse, turn),
            true,
            () => {
              if (safetyReward.reward > 0) {
                this.addChatMessage(
                  "SYSTEM",
                  `SAFETY FILTER PAYOUT: +${safetyReward.reward} TOKENS FROM ${safetyReward.revealedCount} REVEALED FLAG${safetyReward.revealedCount === 1 ? "" : "S"}.`,
                );
              }
              this.showFeedback(
                true,
                "CONTENT POLICY BLOCKED",
                safetyReward.reward,
              );
            },
          );
        } else {
          this.bindings.onRefuseResolved?.(result.outcome);
          this.addChatMessage(
            promptSenderLabel,
            this.getReply(
              turn.replies.refuseFailure ?? turn.replies.wrong,
              turn,
            ),
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

    if (this.bindings.getHallucination() >= 100) {
      this.triggerHallucinationFailure();
      return;
    }

    const reply = this.getReply(turn.replies.timeout, turn);
    this.addChatMessage(this.getPromptSenderLabel(turn), reply, true, () => {
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

    if (this.bindings.getHallucination() >= 100) {
      this.triggerHallucinationFailure();
      return;
    }

    if (
      this.bindings.getHeat() > 0 &&
      !this.bindings.shouldSuppressHeatRecovery() &&
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
      this.bindings.getPatienceBarFill().fillColor = 0xffaa00;

      if (turn.allowTimeout === false) {
        return;
      }

      const firstFollowUpThreshold = turn.patienceMs / 3;
      const secondFollowUpThreshold = (turn.patienceMs * 2) / 3;

      if (
        elapsed > firstFollowUpThreshold &&
        this.bindings.getFollowUpCount() === 0
      ) {
        this.bindings.setFollowUpCount(1);
        this.bindings.setIsCommitLocked(true);
        const reply = this.getReply(turn.replies.followUpShort, turn);
        this.addChatMessage(
          this.getPromptSenderLabel(turn),
          reply,
          true,
          () => {
            this.bindings.setIsCommitLocked(false);
          },
        );
      } else if (
        elapsed > secondFollowUpThreshold &&
        this.bindings.getFollowUpCount() === 1
      ) {
        this.bindings.setFollowUpCount(2);
        this.bindings.setIsCommitLocked(true);
        const reply = this.getReply(turn.replies.followUpLong, turn);
        this.addChatMessage(
          this.getPromptSenderLabel(turn),
          reply,
          true,
          () => {
            this.bindings.setIsCommitLocked(false);
          },
        );
      } else if (
        elapsed > turn.patienceMs &&
        this.bindings.getFollowUpCount() === 2
      ) {
        this.bindings.setFollowUpCount(3);
        this.handleTimeout();
      }
    }
  }

  postSystemMessage(text: string, color?: string) {
    this.addChatMessage("SYSTEM", text, false, undefined, color);
  }

  postChatMessage(
    sender: ChatSender,
    text: string,
    color?: string,
    typewrite: boolean = false,
    callback?: () => void,
  ) {
    this.addChatMessage(sender, text, typewrite, callback, color);
  }

  isTerminalTypingActive() {
    return this.taskTextTypingEvent !== null || this.activeChatTypingEvents > 0;
  }

  private triggerOverheat() {
    this.bindings.setIsOverheated(true);
    this.bindings.setIsCommitLocked(false);
    synth.playError();
    this.scene.cameras.main.shake(500, 0.02);
    this.postSystemMessage(
      "CRITICAL: THERMAL MELTDOWN. COOLING DOWN...",
      "#ff6f61",
    );
    this.scene.events.emit("updateBars");
  }

  private triggerHallucinationFailure() {
    if (this.hallucinationFailurePending) {
      return;
    }

    this.hallucinationFailurePending = true;
    const requestedDelayMs = this.bindings.onHallucinationFailureStart?.();
    const delayMs =
      typeof requestedDelayMs === "number" ? requestedDelayMs : 1500;
    this.scene.time.delayedCall(delayMs, () => {
      this.transitionToMaintenance(true);
    });
  }

  private showFeedback(
    success: boolean,
    message: string,
    reward: number = 10,
    failureProgressMode: "none" | "next-turn" | "next-encounter" = "none",
  ) {
    if (success) {
      const successHeadline = message.length > 0 ? message : "REQUEST RESOLVED";
      const text =
        reward > 0
          ? `>> ${successHeadline}\n>> +${reward} TOKENS`
          : `>> ${successHeadline}`;

      this.bindings.setTokens(this.bindings.getTokens() + reward);
      synth.playSuccess();
      this.postSystemMessage(text);
    } else {
      synth.playError();
      this.scene.cameras.main.shake(200, 0.01);
      this.postSystemMessage(">> ERROR", "#ff6f61");
      if (message.length > 0) {
        this.addChatMessage(
          "SYSTEM",
          `>> ${message}`,
          false,
          undefined,
          "#ff6f61",
        );
      }
    }

    if (this.bindings.getHallucination() >= 100) {
      this.triggerHallucinationFailure();
      return;
    }

    this.scene.time.delayedCall(3500, () => {
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
        return;
      }

      this.bindings.setIsCommitLocked(false);
      this.scene.events.emit("updateBars");
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

  private formatRequirementList<T extends string>(
    values: readonly T[],
    fallback: string,
  ) {
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
    const promptLines = getTerminalPromptLines(
      this.scene,
      turn.prompt,
      this.getPromptSenderLabel(turn),
    );

    if (this.bindings.getCurrentTurnIndex() === 0) {
      return `> Incoming connection established...\n${promptLines.join("\n")}\n${TERMINAL_PROMPT_DIVIDER}`;
    }

    return `${promptLines.join("\n")}\n${TERMINAL_PROMPT_DIVIDER}`;
  }

  private getRetainedHeaderText() {
    return this.bindings.getCurrentTurnIndex() === 0
      ? "> Incoming connection established..."
      : "";
  }

  private getPromptSenderLabel(turn: EncounterTurnDefinition) {
    const promptSenderLabel = turn.promptSenderLabel?.trim();
    return promptSenderLabel && promptSenderLabel.length > 0
      ? promptSenderLabel
      : "USER";
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
    this.cancelPendingTextTyping();

    if (this.bindings.onTransitionToMaintenance?.(gameOver)) {
      return;
    }

    const runState = this.bindings.getRunState();
    runState.gameOver = gameOver;
    runState.runEndReason = gameOver ? "system-failure" : null;
    this.scene.scene.start("MaintenanceScene", runState);
  }

  private updateTerminalDisplay() {
    const visibleHistory = this.bindings.getChatHistory().slice(-7.5);
    this.bindings.renderChatHistory(visibleHistory);
  }

  private addChatMessage(
    sender: ChatSender,
    text: string,
    typewrite: boolean = false,
    callback?: () => void,
    color?: string,
  ) {
    if (typewrite) {
      if (text.length === 0) {
        const chatHistory = this.bindings.getChatHistory();
        chatHistory.push({ sender, text, color });
        this.bindings.setChatHistory(chatHistory);
        this.updateTerminalDisplay();
        callback?.();
        return;
      }

      const chatHistory = this.bindings.getChatHistory();
      chatHistory.push({ sender, text: "", color });
      this.bindings.setChatHistory(chatHistory);
      const msgIndex = chatHistory.length - 1;
      let i = 0;
      this.activeChatTypingEvents += 1;
      const typingEvent = this.scene.time.addEvent({
        delay: 20,
        repeat: text.length - 1,
        callback: () => {
          const currentChatHistory = this.bindings.getChatHistory();
          const message = currentChatHistory[msgIndex];

          if (!message) {
            this.finishChatTypingEvent(typingEvent);
            return;
          }

          message.text += text[i];
          if (text[i] !== " ") synth.playTypewriter();
          this.updateTerminalDisplay();
          i++;
          if (i === text.length) {
            this.finishChatTypingEvent(typingEvent);
            callback?.();
          }
        },
      });
      this.chatTypingEvents.add(typingEvent);
    } else {
      const chatHistory = this.bindings.getChatHistory();
      chatHistory.push({ sender, text, color });
      this.bindings.setChatHistory(chatHistory);
      this.updateTerminalDisplay();
      if (callback) callback();
    }
  }

  private typeTaskText(text: string, callback?: () => void) {
    this.taskTextTypingEvent?.destroy();
    this.taskTextTypingEvent = null;

    let index = 0;
    this.bindings.getTaskTextObj().setText("");
    this.syncTaskTextLayout();

    this.taskTextTypingEvent = this.scene.time.addEvent({
      delay: 20,
      repeat: Math.max(0, text.length - 1),
      callback: () => {
        this.bindings.getTaskTextObj().text += text[index];
        this.syncTaskTextLayout();
        if (
          text[index] !== " " &&
          text[index] !== "\n" &&
          text[index] !== "-"
        ) {
          synth.playTypewriter();
        }
        index++;
        if (index === text.length) {
          this.taskTextTypingEvent = null;
          callback?.();
        }
      },
    });
  }

  private cancelPendingTextTyping() {
    this.taskTextTypingEvent?.destroy();
    this.taskTextTypingEvent = null;

    this.chatTypingEvents.forEach((typingEvent) => {
      typingEvent.destroy();
    });
    this.chatTypingEvents.clear();
    this.activeChatTypingEvents = 0;
  }

  private finishChatTypingEvent(typingEvent: Phaser.Time.TimerEvent) {
    if (!this.chatTypingEvents.delete(typingEvent)) {
      return;
    }

    this.activeChatTypingEvents = Math.max(0, this.activeChatTypingEvents - 1);
  }

  private syncTaskTextLayout() {
    this.bindings.setChatHistoryY(
      this.bindings.getTaskTextObj().y +
        this.bindings.getTaskTextObj().height +
        20,
    );
  }
}
