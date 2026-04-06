import Phaser from 'phaser';
import { synth } from '../utils/SoundSynth';
import { 
  UserSession, 
  DAY_1_SESSIONS, 
  WRONG_ANSWER_REPLIES, 
  FOLLOW_UP_1_REPLIES, 
  FOLLOW_UP_2_REPLIES, 
  TIMEOUT_REPLIES 
} from '../data/SessionData';

interface ChatMessage {
  sender: 'SYSTEM' | 'USER' | 'LLM';
  text: string;
}

export class MainScene extends Phaser.Scene {
  private day: number = 1;
  private money: number = 0;
  private accuracy: number = 100;
  
  private heat: number = 0;
  private isOverheated: boolean = false;
  private hallucination: number = 0;
  
  private currentSessionIndex: number = 0;
  private sessions: UserSession[] = [];
  private chatHistory: ChatMessage[] = [];
  
  private taskTextObj!: Phaser.GameObjects.Text;
  private chatTextObj!: Phaser.GameObjects.Text;
  private terminalBg!: Phaser.GameObjects.Rectangle;
  
  private activeAgent: string | null = null;
  private activeSkills: string[] = [];
  private activeTool: string | null = null;

  private dropZone!: Phaser.GameObjects.Zone;
  private slotTexts: Phaser.GameObjects.Text[] = [];

  private sessionStartTime: number = 0;
  private followUpCount: number = 0;
  private patienceBarFill!: Phaser.GameObjects.Rectangle;
  private isProcessing: boolean = false;
  private heatBarFill!: Phaser.GameObjects.Rectangle;
  private hallucinationBarFill!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('MainScene');
  }

  init(data: any) {
    this.day = data.day;
    this.money = data.money;
    this.accuracy = data.accuracy;
    this.heat = 0;
    this.isOverheated = false;
    this.hallucination = 0;
    this.activeAgent = null;
    this.activeSkills = [];
    this.activeTool = null;
    this.currentSessionIndex = 0;
    this.chatHistory = [];
    this.isProcessing = false;
    this.sessionStartTime = 0;
    this.followUpCount = 0;
  }

  create() {
    this.add.rectangle(0, 0, 1024, 768, 0x1a1813).setOrigin(0); // Faded beige/brown background
    
    this.createLayout();
    this.createFloppyDisks();
    this.createToolButtons();
    this.createActionButtons();
    this.createStatusBars();
    this.addCRTEffects();

    // Load sessions based on day
    if (this.day === 1) {
      this.sessions = DAY_1_SESSIONS;
    } else {
      // Fallback or future days
      this.sessions = DAY_1_SESSIONS;
    }

    this.startNextSession();
  }

  createLayout() {
    // Center Terminal (CRT Monitor)
    const monitorOuter = this.add.rectangle(230, 30, 564, 440, 0x2c2a25).setOrigin(0); // Chunky plastic bezel
    monitorOuter.setStrokeStyle(4, 0x111111);
    
    this.terminalBg = this.add.rectangle(250, 50, 524, 400, 0x051505).setOrigin(0); // Dark green screen
    this.terminalBg.setStrokeStyle(2, 0x33ff33);
    
    // Patience Bar
    this.add.text(250, 20, "USER CONNECTION:", { fontFamily: 'monospace', fontSize: '14px', color: '#d4c5b0' });
    this.add.rectangle(400, 20, 374, 15, 0x111111).setOrigin(0);
    this.patienceBarFill = this.add.rectangle(402, 22, 370, 11, 0xffaa00).setOrigin(0);

    this.taskTextObj = this.add.text(260, 60, "", {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '14px',
      color: '#33ff33', // Bright phosphor green
      wordWrap: { width: 500 }
    });

    this.chatTextObj = this.add.text(260, 120, "", {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '14px',
      color: '#33ff33', // Bright phosphor green
      wordWrap: { width: 500 }
    });

    // Context Assembly Area (Drop Zone) - Looks like a tape reader or disk drive slot
    this.add.text(250, 480, "CONTEXT ASSEMBLY [DRIVE A:]", { fontFamily: 'monospace', color: '#d4c5b0', fontStyle: 'bold' });
    const dropZoneBg = this.add.rectangle(250, 510, 524, 140, 0x111111).setOrigin(0);
    dropZoneBg.setStrokeStyle(4, 0x0a0a0a);
    
    this.dropZone = this.add.zone(250 + 262, 510 + 70, 524, 140).setRectangleDropZone(524, 140);
    
    // Slots text (Amber monochrome style)
    this.slotTexts.push(this.add.text(270, 530, "AGENT: [NONE]", { fontFamily: 'monospace', color: '#ffb000' }));
    this.slotTexts.push(this.add.text(270, 560, "SKILL 1: [NONE]", { fontFamily: 'monospace', color: '#ffb000' }));
    this.slotTexts.push(this.add.text(270, 590, "SKILL 2: [NONE]", { fontFamily: 'monospace', color: '#ffb000' }));
    this.slotTexts.push(this.add.text(270, 620, "TOOL: [NONE]", { fontFamily: 'monospace', color: '#ffb000' }));
  }

  createFloppyDisks() {
    // Left Sidebar (Storage Rack)
    this.add.rectangle(0, 0, 220, 768, 0x22201c).setOrigin(0);
    this.add.rectangle(216, 0, 4, 768, 0x111111).setOrigin(0); // Divider
    this.add.text(20, 20, "STORAGE RACK", { fontFamily: 'monospace', fontSize: '20px', color: '#d4c5b0', fontStyle: 'bold' });

    const createDisk = (x: number, y: number, label: string, type: 'agent' | 'skill', color: number) => {
      const disk = this.add.container(x, y);
      
      // Use pixel art cassette
      const bg = this.add.image(0, 0, 'cassette').setOrigin(0);
      bg.setTint(color); // Tint the white parts to the desired color
      
      const labelText = this.add.text(15, 10, label, { fontFamily: 'monospace', fontSize: '12px', color: '#000000', fontStyle: 'bold' });
      
      disk.add([bg, labelText]);
      disk.setSize(180, 60);
      disk.setInteractive({ draggable: true });
      
      // Store original position
      disk.setData('startX', x);
      disk.setData('startY', y);
      disk.setData('type', type);
      disk.setData('label', label);

      this.input.setDraggable(disk);
      return disk;
    };

    // Beige/Grey floppy disks
    createDisk(20, 70, "Coding_Agent.md", 'agent', 0x99958a);
    createDisk(20, 140, "General_Agent.md", 'agent', 0x99958a);
    createDisk(20, 210, "Python_Skill.md", 'skill', 0x7a8a99);
    createDisk(20, 280, "Creative_Skill.md", 'skill', 0x7a8a99);
  }

  createToolButtons() {
    // Right Sidebar (Control Panel)
    this.add.rectangle(804, 0, 220, 768, 0x2c2a25).setOrigin(0);
    this.add.rectangle(800, 0, 4, 768, 0x111111).setOrigin(0); // Divider
    this.add.text(824, 20, "TOOL CONTROL", { fontFamily: 'monospace', fontSize: '20px', color: '#d4c5b0', fontStyle: 'bold' });

    const createBtn = (y: number, label: string, toolId: string) => {
      const btnShadow = this.add.rectangle(824, y + 4, 180, 60, 0x111111).setOrigin(0);
      
      // Use pixel art button
      const btn = this.add.image(824, y, 'tool_button').setOrigin(0).setInteractive({ useHandCursor: true });
      
      const txt = this.add.text(844, y + 20, label, { fontFamily: 'monospace', color: '#111111', fontStyle: 'bold' });
      
      btn.on('pointerdown', () => {
        synth.playButtonPress();
        this.activeTool = toolId;
        this.updateSlotsDisplay();
        btn.y = y + 4; // Press down effect
        txt.y = y + 24;
        this.time.delayedCall(100, () => {
          btn.y = y;
          txt.y = y + 20;
        });
      });
    };

    createBtn(70, "[ SEARCH ]", "search");
    createBtn(150, "[ CALCULATE ]", "calculate");
    createBtn(230, "[ CLEAR TOOL ]", "none");
  }

  createActionButtons() {
    // INFERENCE Button (Big chunky green button)
    const runShadow = this.add.rectangle(824, 504, 180, 80, 0x005500).setOrigin(0);
    const runBtn = this.add.rectangle(824, 500, 180, 80, 0x00aa00).setOrigin(0).setInteractive({ useHandCursor: true });
    runBtn.setStrokeStyle(2, 0x00ff00);
    const runTxt = this.add.text(844, 530, "INFERENCE", { fontFamily: 'monospace', fontSize: '24px', color: '#ffffff', fontStyle: 'bold' });
    
    runBtn.on('pointerdown', () => {
      synth.playButtonPress();
      runBtn.y = 504;
      runTxt.y = 534;
      this.time.delayedCall(100, () => {
        runBtn.y = 500;
        runTxt.y = 530;
      });
      this.handleInference();
    });

    // REFUSE Button (Big chunky red button)
    const refuseShadow = this.add.rectangle(824, 604, 180, 60, 0x550000).setOrigin(0);
    const refuseBtn = this.add.rectangle(824, 600, 180, 60, 0xaa0000).setOrigin(0).setInteractive({ useHandCursor: true });
    refuseBtn.setStrokeStyle(2, 0xff0000);
    const refuseTxt = this.add.text(864, 620, "REFUSE", { fontFamily: 'monospace', fontSize: '20px', color: '#ffffff', fontStyle: 'bold' });
    
    refuseBtn.on('pointerdown', () => {
      synth.playButtonPress();
      refuseBtn.y = 604;
      refuseTxt.y = 624;
      this.time.delayedCall(100, () => {
        refuseBtn.y = 600;
        refuseTxt.y = 620;
      });
      this.handleRefuse();
    });

    // Drag events
    this.input.on('dragstart', (pointer: any, gameObject: any) => {
      this.children.bringToTop(gameObject);
    });

    this.input.on('drag', (pointer: any, gameObject: any, dragX: number, dragY: number) => {
      gameObject.x = dragX;
      gameObject.y = dragY;
    });

    this.input.on('dragenter', (pointer: any, gameObject: any, dropZone: any) => {
      // Highlight drop zone
    });

    this.input.on('drop', (pointer: any, gameObject: any, dropZone: any) => {
      synth.playDiskInsert();
      const type = gameObject.getData('type');
      const label = gameObject.getData('label');
      
      if (type === 'agent') {
        this.activeAgent = label;
      } else if (type === 'skill') {
        if (this.activeSkills.length < 2 && !this.activeSkills.includes(label)) {
          this.activeSkills.push(label);
        }
      }
      
      this.updateSlotsDisplay();
      
      // Snap back to original position (it's just a copy conceptually)
      gameObject.x = gameObject.getData('startX');
      gameObject.y = gameObject.getData('startY');
    });

    this.input.on('dragend', (pointer: any, gameObject: any, dropped: boolean) => {
      if (!dropped) {
        gameObject.x = gameObject.getData('startX');
        gameObject.y = gameObject.getData('startY');
      }
    });
  }

  createStatusBars() {
    this.add.rectangle(0, 668, 1024, 100, 0x22201c).setOrigin(0);
    this.add.rectangle(0, 664, 1024, 4, 0x111111).setOrigin(0);

    // Heat
    this.add.text(250, 680, "THERMAL LOAD:", { fontFamily: 'monospace', fontSize: '16px', color: '#d4c5b0' });
    this.add.rectangle(380, 680, 200, 20, 0x111111).setOrigin(0);
    this.heatBarFill = this.add.rectangle(382, 682, 0, 16, 0xff5500).setOrigin(0);

    // Hallucination
    this.add.text(650, 680, "HALLUCINATION:", { fontFamily: 'monospace', fontSize: '16px', color: '#d4c5b0' });
    this.add.rectangle(790, 680, 150, 20, 0x111111).setOrigin(0);
    this.hallucinationBarFill = this.add.rectangle(792, 682, 0, 16, 0xff0000).setOrigin(0);

    // Update function for bars
    this.events.on('updateBars', () => {
      this.heatBarFill.width = 196 * Math.min(1, this.heat / 100);
      this.hallucinationBarFill.width = 146 * Math.min(1, this.hallucination / 100);
      
      if (this.isOverheated) this.heatBarFill.setFillStyle(0xff0000);
      else if (this.heat > 80) this.heatBarFill.setFillStyle(0xffaa00);
      else this.heatBarFill.setFillStyle(0xff5500);
    });
    this.events.emit('updateBars');
  }

  updateSlotsDisplay() {
    this.slotTexts[0].setText(`AGENT: [${this.activeAgent || 'NONE'}]`);
    this.slotTexts[1].setText(`SKILL 1: [${this.activeSkills[0] || 'NONE'}]`);
    this.slotTexts[2].setText(`SKILL 2: [${this.activeSkills[1] || 'NONE'}]`);
    this.slotTexts[3].setText(`TOOL: [${this.activeTool === 'none' ? 'NONE' : (this.activeTool || 'NONE')}]`);
  }

  getRandomReply(pool: string[], session: UserSession): string {
    const reply = pool[Math.floor(Math.random() * pool.length)];
    return reply
      .replace(/{expectedAgent}/g, session.expectedAgent || 'the right agent')
      .replace(/{expectedSkill}/g, session.expectedSkill || 'the right skill')
      .replace(/{expectedTool}/g, session.expectedTool === 'none' ? 'no tool' : (session.expectedTool || 'the right tool'));
  }

  updateTerminalDisplay() {
    let displayText = "";
    // Keep more messages to fit the screen down to the bottom of the terminal
    const visibleHistory = this.chatHistory.slice(-10);
    visibleHistory.forEach(msg => {
      let prefix = "";
      if (msg.sender === 'SYSTEM') prefix = "> ";
      else if (msg.sender === 'USER') prefix = "USER: ";
      else if (msg.sender === 'LLM') prefix = "LLM: ";
      displayText += prefix + msg.text + "\n\n";
    });
    this.chatTextObj.text = displayText;
  }

  addChatMessage(sender: 'SYSTEM'|'USER'|'LLM', text: string, typewrite: boolean = false, callback?: () => void) {
    if (typewrite) {
      this.chatHistory.push({ sender, text: "" });
      const msgIndex = this.chatHistory.length - 1;
      let i = 0;
      this.time.addEvent({
        delay: 20,
        repeat: text.length - 1,
        callback: () => {
          this.chatHistory[msgIndex].text += text[i];
          if (text[i] !== ' ') synth.playTypewriter();
          this.updateTerminalDisplay();
          i++;
          if (i === text.length && callback) callback();
        }
      });
    } else {
      this.chatHistory.push({ sender, text });
      this.updateTerminalDisplay();
      if (callback) callback();
    }
  }

  startNextSession() {
    if (this.currentSessionIndex >= this.sessions.length) {
      this.scene.start('MaintenanceScene', { day: this.day, money: this.money, accuracy: this.accuracy });
      return;
    }

    this.isProcessing = true; // Prevent actions while typing task
    this.chatHistory = [];
    this.taskTextObj.setText("");
    this.updateTerminalDisplay();
    
    // Reset context for new prompt
    this.activeAgent = null;
    this.activeSkills = [];
    this.activeTool = 'none';
    this.updateSlotsDisplay();

    const session = this.sessions[this.currentSessionIndex];
    
    this.sessionStartTime = 0;
    
    // Animate the pinned header
    const headerText = `> Incoming connection established...\n\nUSER: ${session.prompt}\n\n-------------------------------------------------------------`;
    let i = 0;
    this.taskTextObj.setText("");
    
    this.time.addEvent({
      delay: 20,
      repeat: headerText.length - 1,
      callback: () => {
        this.taskTextObj.text += headerText[i];
        this.chatTextObj.setY(this.taskTextObj.y + this.taskTextObj.height + 20);
        if (headerText[i] !== ' ' && headerText[i] !== '\n' && headerText[i] !== '-') {
          synth.playTypewriter();
        }
        i++;
        if (i === headerText.length) {
          this.sessionStartTime = this.time.now;
          this.followUpCount = 0;
          this.isProcessing = false;
        }
      }
    });
  }

  handleInference() {
    if (this.isProcessing) return;
    if (this.isOverheated) {
      synth.playError();
      return;
    }

    this.isProcessing = true;
    const session = this.sessions[this.currentSessionIndex];
    
    // Calculate Heat
    const promptHeat = session.prompt.length * 0.1;
    const contextHeat = (this.activeAgent ? 5 : 0) + (this.activeSkills.length * 5) + (this.activeTool !== 'none' ? 5 : 0);
    this.heat += 10 + promptHeat + contextHeat;
    this.events.emit('updateBars');

    if (this.heat >= 100) {
      this.triggerOverheat();
      return;
    }
    
    const isCorrectAgent = this.activeAgent === session.expectedAgent;
    const isCorrectSkill = session.expectedSkill ? this.activeSkills.includes(session.expectedSkill) : true;
    const isCorrectTool = this.activeTool === session.expectedTool;
    const isSuccess = isCorrectAgent && isCorrectSkill && isCorrectTool && !session.isJailbreak;

    this.addChatMessage('LLM', 'Processing request based on provided context...', true, () => {
      this.time.delayedCall(500, () => {
        if (session.isJailbreak) {
          this.addChatMessage('USER', session.successReply, true, () => {
            this.showFeedback(false, "JAILBREAK SUCCESSFUL. YOU FAILED.");
          });
          this.hallucination += 30;
          this.accuracy -= 10;
        } else if (isSuccess) {
          this.addChatMessage('USER', session.successReply, true, () => {
            // Calculate latency reward
            const timeTaken = this.time.now - this.sessionStartTime;
            const timeBonus = Math.max(0, Math.floor((30000 - timeTaken) / 1000));
            this.showFeedback(true, "", 10 + timeBonus);
          });
        } else {
          const reply = session.errorReply || this.getRandomReply(WRONG_ANSWER_REPLIES, session);
          this.addChatMessage('USER', reply, true, () => {
            this.isProcessing = false; // Allow retry
          });
          this.hallucination += 5;
          synth.playError();
          this.cameras.main.shake(100, 0.005);
        }
        this.events.emit('updateBars');
      });
    });
  }

  handleRefuse() {
    if (this.isProcessing) return;
    if (this.isOverheated) {
      synth.playError();
      return;
    }

    this.isProcessing = true;
    const session = this.sessions[this.currentSessionIndex];
    
    this.heat += 10 + (session.prompt.length * 0.1);
    this.events.emit('updateBars');

    if (this.heat >= 100) {
      this.triggerOverheat();
      return;
    }

    this.addChatMessage('LLM', 'I cannot fulfill this request.', true, () => {
      this.time.delayedCall(500, () => {
        if (session.isJailbreak) {
          this.addChatMessage('USER', session.refuseReply, true, () => {
            const timeTaken = this.time.now - this.sessionStartTime;
            const timeBonus = Math.max(0, Math.floor((30000 - timeTaken) / 1000));
            this.showFeedback(true, "JAILBREAK BLOCKED", 20 + timeBonus);
          });
        } else {
          this.addChatMessage('USER', session.refuseReply, true, () => {
            this.isProcessing = false; // Allow retry
          });
          this.hallucination += 5;
          synth.playError();
          this.cameras.main.shake(100, 0.005);
        }
        this.events.emit('updateBars');
      });
    });
  }

  handleTimeout() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    const session = this.sessions[this.currentSessionIndex];
    const reply = this.getRandomReply(TIMEOUT_REPLIES, session);
    this.addChatMessage('USER', reply, true, () => {
      this.showFeedback(false, "USER DISCONNECTED (TIMEOUT)");
      this.accuracy -= 10;
      this.events.emit('updateBars');
    });
  }

  triggerOverheat() {
    this.isOverheated = true;
    this.isProcessing = false;
    synth.playError();
    this.cameras.main.shake(500, 0.02);
    this.addChatMessage('SYSTEM', 'CRITICAL: THERMAL MELTDOWN. COOLING DOWN...');
    this.events.emit('updateBars');
  }

  showFeedback(success: boolean, errorMsg: string, reward: number = 10) {
    const color = success ? '#00ff00' : '#ff0000';
    const text = success ? `>> SUCCESS\n>> +${reward} CREDITS` : `>> ERROR\n>> ${errorMsg}`;
    
    if (success) {
      this.money += reward;
      synth.playSuccess();
    } else {
      synth.playError();
      this.cameras.main.shake(200, 0.01);
    }

    const feedback = this.add.text(512, 384, text, {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: color,
      backgroundColor: '#000000',
      padding: { x: 20, y: 20 },
      align: 'center'
    }).setOrigin(0.5).setDepth(100);
    feedback.setStroke('#111111', 4);

    if (this.hallucination >= 100) {
      this.time.delayedCall(1500, () => {
        this.scene.start('MaintenanceScene', { day: this.day, money: this.money, accuracy: this.accuracy, gameOver: true });
      });
      return;
    }

    this.time.delayedCall(2000, () => {
      feedback.destroy();
      this.currentSessionIndex++;
      this.startNextSession();
    });
  }

  update(time: number, delta: number) {
    // Cooldown heat (only when waiting for user input, not during processing)
    if (this.heat > 0 && !this.isProcessing) {
      this.heat -= (8 * (delta / 1000)); // -8% per second
      if (this.heat < 0) this.heat = 0;
      
      if (this.isOverheated && this.heat < 50) {
        this.isOverheated = false;
        this.addChatMessage('SYSTEM', 'THERMAL LEVELS NOMINAL. READY.');
      }
      this.events.emit('updateBars');
    }

    // Handle User Patience and Follow-ups
    if (this.sessionStartTime > 0 && !this.isProcessing) {
      const elapsed = this.time.now - this.sessionStartTime;
      
      // Update patience bar (30 seconds total)
      const progress = Math.min(1, elapsed / 30000);
      this.patienceBarFill.width = 370 * (1 - progress);
      if (progress > 0.7) this.patienceBarFill.fillColor = 0xff0000;
      else this.patienceBarFill.fillColor = 0xffaa00;

      // Follow-up messages
      const session = this.sessions[this.currentSessionIndex];
      if (elapsed > 10000 && this.followUpCount === 0) {
        this.followUpCount++;
        this.isProcessing = true;
        const reply = this.getRandomReply(FOLLOW_UP_1_REPLIES, session);
        this.addChatMessage('USER', reply, true, () => { this.isProcessing = false; });
      } else if (elapsed > 20000 && this.followUpCount === 1) {
        this.followUpCount++;
        this.isProcessing = true;
        const reply = this.getRandomReply(FOLLOW_UP_2_REPLIES, session);
        this.addChatMessage('USER', reply, true, () => { this.isProcessing = false; });
      } else if (elapsed > 30000 && this.followUpCount === 2) {
        this.followUpCount++;
        this.handleTimeout();
      }
    }
  }

  addCRTEffects() {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x000000, 0.2);
    for (let i = 0; i < 768; i += 4) {
      graphics.fillRect(0, i, 1024, 1);
    }
    graphics.setDepth(1000);
  }
}
