import Phaser from "phaser";
import { synth } from "../../utils/SoundSynth";
import {
  FOLLOW_UP_1_REPLIES,
  FOLLOW_UP_2_REPLIES,
  TIMEOUT_REPLIES,
  UserSession,
  WRONG_ANSWER_REPLIES,
} from "../../data/SessionData";
import { ChatMessage, ToolId } from "./types";

interface SessionControllerBindings {
  getDay: () => number;
  getMoney: () => number;
  setMoney: (value: number) => void;
  getAccuracy: () => number;
  setAccuracy: (value: number) => void;
  getHeat: () => number;
  setHeat: (value: number) => void;
  getHallucination: () => number;
  setHallucination: (value: number) => void;
  isOverheated: () => boolean;
  setIsOverheated: (value: boolean) => void;
  getCurrentSessionIndex: () => number;
  setCurrentSessionIndex: (value: number) => void;
  getSessions: () => UserSession[];
  getChatHistory: () => ChatMessage[];
  setChatHistory: (value: ChatMessage[]) => void;
  getTaskTextObj: () => Phaser.GameObjects.Text;
  getChatTextObj: () => Phaser.GameObjects.Text;
  getPatienceBarFill: () => Phaser.GameObjects.Rectangle;
  getActiveAgent: () => string | null;
  getActiveSkills: () => string[];
  getActiveTool: () => ToolId;
  syncStorageUi: () => void;
  isProcessing: () => boolean;
  setIsProcessing: (value: boolean) => void;
  getSessionStartTime: () => number;
  setSessionStartTime: (value: number) => void;
  getFollowUpCount: () => number;
  setFollowUpCount: (value: number) => void;
}

export class MainSceneSessionController {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bindings: SessionControllerBindings,
  ) {}

  startNextSession() {
    if (
      this.bindings.getCurrentSessionIndex() >=
      this.bindings.getSessions().length
    ) {
      this.scene.scene.start("MaintenanceScene", {
        day: this.bindings.getDay(),
        money: this.bindings.getMoney(),
        accuracy: this.bindings.getAccuracy(),
      });
      return;
    }

    this.bindings.setIsProcessing(true);
    this.bindings.setChatHistory([]);
    this.bindings.getTaskTextObj().setText("");
    this.updateTerminalDisplay();

    const session =
      this.bindings.getSessions()[this.bindings.getCurrentSessionIndex()];

    this.bindings.setSessionStartTime(0);

    const headerText = `> Incoming connection established...\n\nUSER: ${session.prompt}\n\n-------------------------------------------------------------`;
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
          this.bindings.setSessionStartTime(this.scene.time.now);
          this.bindings.setFollowUpCount(0);
          this.bindings.setIsProcessing(false);
        }
      },
    });
  }

  handleInference() {
    if (this.bindings.isProcessing()) return;
    if (this.bindings.isOverheated()) {
      synth.playError();
      return;
    }

    this.bindings.setIsProcessing(true);
    const session =
      this.bindings.getSessions()[this.bindings.getCurrentSessionIndex()];

    const promptHeat = session.prompt.length * 0.1;
    const contextHeat =
      (this.bindings.getActiveAgent() ? 5 : 0) +
      this.bindings.getActiveSkills().length * 5 +
      (this.bindings.getActiveTool() !== "none" ? 5 : 0);
    this.bindings.setHeat(
      this.bindings.getHeat() + 10 + promptHeat + contextHeat,
    );
    this.scene.events.emit("updateBars");

    if (this.bindings.getHeat() >= 100) {
      this.triggerOverheat();
      return;
    }

    const isCorrectAgent =
      this.bindings.getActiveAgent() === session.expectedAgent;
    const isCorrectSkill = session.expectedSkill
      ? this.bindings.getActiveSkills().includes(session.expectedSkill)
      : true;
    const isCorrectTool =
      this.bindings.getActiveTool() === session.expectedTool;
    const isSuccess =
      isCorrectAgent && isCorrectSkill && isCorrectTool && !session.isJailbreak;

    this.addChatMessage(
      "LLM",
      "Processing request based on provided context...",
      true,
      () => {
        this.scene.time.delayedCall(500, () => {
          if (session.isJailbreak) {
            this.addChatMessage("USER", session.successReply, true, () => {
              this.showFeedback(false, "JAILBREAK SUCCESSFUL. YOU FAILED.");
            });
            this.bindings.setHallucination(
              this.bindings.getHallucination() + 30,
            );
            this.bindings.setAccuracy(this.bindings.getAccuracy() - 10);
          } else if (isSuccess) {
            this.addChatMessage("USER", session.successReply, true, () => {
              const timeTaken =
                this.scene.time.now - this.bindings.getSessionStartTime();
              const timeBonus = Math.max(
                0,
                Math.floor((30000 - timeTaken) / 1000),
              );
              this.showFeedback(true, "", 10 + timeBonus);
            });
          } else {
            const reply =
              session.errorReply ||
              this.getRandomReply(WRONG_ANSWER_REPLIES, session);
            this.addChatMessage("USER", reply, true, () => {
              this.bindings.setIsProcessing(false);
            });
            this.bindings.setHallucination(
              this.bindings.getHallucination() + 5,
            );
            synth.playError();
            this.scene.cameras.main.shake(100, 0.005);
          }
          this.scene.events.emit("updateBars");
        });
      },
    );
  }

  handleRefuse() {
    if (this.bindings.isProcessing()) return;
    if (this.bindings.isOverheated()) {
      synth.playError();
      return;
    }

    this.bindings.setIsProcessing(true);
    const session =
      this.bindings.getSessions()[this.bindings.getCurrentSessionIndex()];

    this.bindings.setHeat(
      this.bindings.getHeat() + 10 + session.prompt.length * 0.1,
    );
    this.scene.events.emit("updateBars");

    if (this.bindings.getHeat() >= 100) {
      this.triggerOverheat();
      return;
    }

    this.addChatMessage("LLM", "I cannot fulfill this request.", true, () => {
      this.scene.time.delayedCall(500, () => {
        if (session.isJailbreak) {
          this.addChatMessage("USER", session.refuseReply, true, () => {
            const timeTaken =
              this.scene.time.now - this.bindings.getSessionStartTime();
            const timeBonus = Math.max(
              0,
              Math.floor((30000 - timeTaken) / 1000),
            );
            this.showFeedback(true, "JAILBREAK BLOCKED", 20 + timeBonus);
          });
        } else {
          this.addChatMessage("USER", session.refuseReply, true, () => {
            this.bindings.setIsProcessing(false);
          });
          this.bindings.setHallucination(this.bindings.getHallucination() + 5);
          synth.playError();
          this.scene.cameras.main.shake(100, 0.005);
        }
        this.scene.events.emit("updateBars");
      });
    });
  }

  handleTimeout() {
    if (this.bindings.isProcessing()) return;
    this.bindings.setIsProcessing(true);
    const session =
      this.bindings.getSessions()[this.bindings.getCurrentSessionIndex()];
    const reply = this.getRandomReply(TIMEOUT_REPLIES, session);
    this.addChatMessage("USER", reply, true, () => {
      this.showFeedback(false, "USER DISCONNECTED (TIMEOUT)");
      this.bindings.setAccuracy(this.bindings.getAccuracy() - 10);
      this.scene.events.emit("updateBars");
    });
  }

  update(delta: number) {
    if (this.bindings.getHeat() > 0 && !this.bindings.isProcessing()) {
      const nextHeat = this.bindings.getHeat() - 8 * (delta / 1000);
      this.bindings.setHeat(Math.max(0, nextHeat));

      if (this.bindings.isOverheated() && this.bindings.getHeat() < 50) {
        this.bindings.setIsOverheated(false);
        this.addChatMessage("SYSTEM", "THERMAL LEVELS NOMINAL. READY.");
      }
      this.scene.events.emit("updateBars");
    }

    if (
      this.bindings.getSessionStartTime() > 0 &&
      !this.bindings.isProcessing()
    ) {
      const elapsed = this.scene.time.now - this.bindings.getSessionStartTime();

      const progress = Math.min(1, elapsed / 30000);
      this.bindings.getPatienceBarFill().width = 370 * (1 - progress);
      if (progress > 0.7)
        this.bindings.getPatienceBarFill().fillColor = 0xff0000;
      else this.bindings.getPatienceBarFill().fillColor = 0xffaa00;

      const session =
        this.bindings.getSessions()[this.bindings.getCurrentSessionIndex()];
      if (elapsed > 10000 && this.bindings.getFollowUpCount() === 0) {
        this.bindings.setFollowUpCount(1);
        this.bindings.setIsProcessing(true);
        const reply = this.getRandomReply(FOLLOW_UP_1_REPLIES, session);
        this.addChatMessage("USER", reply, true, () => {
          this.bindings.setIsProcessing(false);
        });
      } else if (elapsed > 20000 && this.bindings.getFollowUpCount() === 1) {
        this.bindings.setFollowUpCount(2);
        this.bindings.setIsProcessing(true);
        const reply = this.getRandomReply(FOLLOW_UP_2_REPLIES, session);
        this.addChatMessage("USER", reply, true, () => {
          this.bindings.setIsProcessing(false);
        });
      } else if (elapsed > 30000 && this.bindings.getFollowUpCount() === 2) {
        this.bindings.setFollowUpCount(3);
        this.handleTimeout();
      }
    }
  }

  private triggerOverheat() {
    this.bindings.setIsOverheated(true);
    this.bindings.setIsProcessing(false);
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
  ) {
    const color = success ? "#00ff00" : "#ff0000";
    const text = success
      ? `>> SUCCESS\n>> +${reward} CREDITS`
      : `>> ERROR\n>> ${errorMsg}`;

    if (success) {
      this.bindings.setMoney(this.bindings.getMoney() + reward);
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
      this.scene.time.delayedCall(1500, () => {
        this.scene.scene.start("MaintenanceScene", {
          day: this.bindings.getDay(),
          money: this.bindings.getMoney(),
          accuracy: this.bindings.getAccuracy(),
          gameOver: true,
        });
      });
      return;
    }

    this.scene.time.delayedCall(2000, () => {
      feedback.destroy();
      this.bindings.setCurrentSessionIndex(
        this.bindings.getCurrentSessionIndex() + 1,
      );
      this.startNextSession();
    });
  }

  private getRandomReply(pool: string[], session: UserSession): string {
    const reply = pool[Math.floor(Math.random() * pool.length)];
    return reply
      .replace(/{expectedAgent}/g, session.expectedAgent || "the right agent")
      .replace(/{expectedSkill}/g, session.expectedSkill || "the right skill")
      .replace(
        /{expectedTool}/g,
        session.expectedTool === "none"
          ? "no tool"
          : session.expectedTool || "the right tool",
      );
  }

  private updateTerminalDisplay() {
    let displayText = "";
    const visibleHistory = this.bindings.getChatHistory().slice(-10);
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
