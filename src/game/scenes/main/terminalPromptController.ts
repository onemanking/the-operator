import Phaser from "phaser";
import {
  PromptTokenBounds,
  SAFETY_FILM_TEXT_ALPHA,
  SAFETY_FILM_TEXT_COLOR,
  SAFETY_REVEALED_TEXT_ALPHA,
  SAFETY_REVEALED_TEXT_COLOR,
  SAFETY_SCANNER_LANE_HEIGHT,
  SAFETY_SCANNER_LANE_WIDTH,
  SAFETY_SCANNER_LANE_X,
  SAFETY_SCANNER_LANE_Y,
  SafetyScannerController,
} from "./safetyScannerController";

interface TerminalPromptControllerBindings {
  isSearchModeSelected: () => boolean;
  isSafetyModeSelected: () => boolean;
  canStartSafetyScan: () => boolean;
  isSafetyScanning: () => boolean;
  getSafetyScanPointX: () => number;
  getSafetyScanPointY: () => number;
  getSafetyScanDirectionX: () => number;
  getSafetyScanNoiseIntensity: () => number;
  getSafetyScanBandWidth: () => number;
  getSelectedWordIndexes: () => number[];
  getSafetyMatchedWordIndexes: () => number[];
  getSafetyRevealedWordIndexes: () => number[];
  getSafetyRevealProgress: (wordIndex: number) => number;
  getSafetyRevealFlash: (wordIndex: number) => number;
  getPromptStartY: () => number;
  onToggleWord: (wordIndex: number, rawWord: string) => void;
  onSafetyScanStart: (
    pointerId: number,
    scanPointX: number,
    scanPointY: number,
  ) => void;
  onSafetyScanMove: (
    pointerId: number,
    scanPointX: number,
    scanPointY: number,
    intersectedWordIndexes: number[],
  ) => void;
  onSafetyScanEnd: (pointerId: number) => void;
  onPromptLayoutChanged: (bottomY: number) => void;
}

interface PromptTokenUi {
  index: number;
  rawWord: string;
  background: Phaser.GameObjects.Rectangle;
  selectionFrame: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  hitArea: Phaser.GameObjects.Rectangle;
  safetyGlowFx?: Phaser.FX.Glow;
  safetyBloomFx?: Phaser.FX.Bloom;
}

export const TERMINAL_TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: "14px",
  color: "#33ff33",
};

export const TERMINAL_PROMPT_START_X = 260;
export const TERMINAL_PROMPT_MAX_X = 760;
export const TERMINAL_PROMPT_LINE_HEIGHT = 33;
export const TERMINAL_PROMPT_WORD_SPACING = 7.85;
export const TERMINAL_PROMPT_DIVIDER =
  "-------------------------------------------------------------";

function clamp01(value: number) {
  return Phaser.Math.Clamp(value, 0, 1);
}

function mixHexColor(fromHex: string, toHex: string, amount: number) {
  const t = clamp01(amount);
  const from = Phaser.Display.Color.HexStringToColor(fromHex);
  const to = Phaser.Display.Color.HexStringToColor(toHex);
  const red = Math.round(Phaser.Math.Linear(from.red, to.red, t));
  const green = Math.round(Phaser.Math.Linear(from.green, to.green, t));
  const blue = Math.round(Phaser.Math.Linear(from.blue, to.blue, t));

  return Phaser.Display.Color.RGBToString(red, green, blue, 0, "#");
}

function toHexNumber(hexColor: string) {
  return Phaser.Display.Color.HexStringToColor(hexColor).color;
}

function drawDashedFrame(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  alpha: number,
) {
  const dashLength = 5;
  const gapLength = 3;

  graphics.clear();
  graphics.lineStyle(1, color, alpha);

  const drawDashedLine = (
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ) => {
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const stepX = deltaX / distance;
    const stepY = deltaY / distance;

    let drawn = 0;
    while (drawn < distance) {
      const dashStartX = startX + stepX * drawn;
      const dashStartY = startY + stepY * drawn;
      const dashEnd = Math.min(drawn + dashLength, distance);
      const dashEndX = startX + stepX * dashEnd;
      const dashEndY = startY + stepY * dashEnd;
      graphics.beginPath();
      graphics.moveTo(dashStartX, dashStartY);
      graphics.lineTo(dashEndX, dashEndY);
      graphics.strokePath();
      drawn += dashLength + gapLength;
    }
  };

  drawDashedLine(x, y, x + width, y);
  drawDashedLine(x + width, y, x + width, y + height);
  drawDashedLine(x + width, y + height, x, y + height);
  drawDashedLine(x, y + height, x, y);
}

export function getTerminalPromptLines(scene: Phaser.Scene, prompt: string) {
  const probeText = scene.add.text(0, 0, "", TERMINAL_TEXT_STYLE);
  const userLabelWidth = probeText.setText("USER:").width;
  let cursorX = TERMINAL_PROMPT_START_X + userLabelWidth + 8;
  const lines: string[] = [];
  let currentLine = "USER:";

  prompt
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .forEach((rawWord) => {
      const wordWidth = probeText.setText(rawWord).width;
      if (
        cursorX + wordWidth > TERMINAL_PROMPT_MAX_X &&
        cursorX > TERMINAL_PROMPT_START_X
      ) {
        lines.push(currentLine);
        currentLine = rawWord;
        cursorX =
          TERMINAL_PROMPT_START_X + wordWidth + TERMINAL_PROMPT_WORD_SPACING;
        return;
      }

      currentLine += currentLine === "USER:" ? ` ${rawWord}` : ` ${rawWord}`;
      cursorX += wordWidth + TERMINAL_PROMPT_WORD_SPACING;
    });

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  probeText.destroy();

  return lines;
}

export class TerminalPromptController {
  private readonly promptStartX = TERMINAL_PROMPT_START_X;
  private readonly promptMaxX = TERMINAL_PROMPT_MAX_X;
  private readonly lineHeight = TERMINAL_PROMPT_LINE_HEIGHT;
  private readonly wordSpacing = TERMINAL_PROMPT_WORD_SPACING;

  private userLabel?: Phaser.GameObjects.Text;
  private divider?: Phaser.GameObjects.Text;
  private tokens: PromptTokenUi[] = [];
  private hoverIndex: number | null = null;
  private scannerLayoutKey: string = "";
  private readonly safetyScannerController: SafetyScannerController;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bindings: TerminalPromptControllerBindings,
  ) {
    this.safetyScannerController = new SafetyScannerController(this.scene, {
      isSafetyModeSelected: () => this.bindings.isSafetyModeSelected(),
      canStartSafetyScan: () => this.bindings.canStartSafetyScan(),
      isSafetyScanning: () => this.bindings.isSafetyScanning(),
      getSafetyScanDirectionX: () => this.bindings.getSafetyScanDirectionX(),
      getSafetyScanBandWidth: () => this.bindings.getSafetyScanBandWidth(),
      getSafetyMatchedWordIndexes: () =>
        this.bindings.getSafetyMatchedWordIndexes(),
      getPromptStartY: () => this.bindings.getPromptStartY(),
      onSafetyScanStart: (pointerId, scanPointX, scanPointY) =>
        this.bindings.onSafetyScanStart(pointerId, scanPointX, scanPointY),
      onSafetyScanMove: (
        pointerId,
        scanPointX,
        scanPointY,
        intersectedWordIndexes,
      ) =>
        this.bindings.onSafetyScanMove(
          pointerId,
          scanPointX,
          scanPointY,
          intersectedWordIndexes,
        ),
      onSafetyScanEnd: (pointerId) => this.bindings.onSafetyScanEnd(pointerId),
    });
  }

  renderPrompt(prompt: string) {
    this.clear();

    const promptStartY = this.bindings.getPromptStartY();

    const promptLines = getTerminalPromptLines(this.scene, prompt);
    const promptWords = prompt.split(/\s+/).filter((word) => word.length > 0);

    this.userLabel = this.scene.add.text(
      this.promptStartX,
      promptStartY,
      "USER:",
      TERMINAL_TEXT_STYLE,
    );

    const probeText = this.scene.add.text(0, 0, "USER:", TERMINAL_TEXT_STYLE);
    const labelWidth = probeText.width;
    probeText.destroy();

    let cursorX = this.promptStartX + labelWidth + 8;
    let cursorY = promptStartY;

    promptWords.forEach((rawWord, index) => {
      const metrics = this.scene.add.text(0, 0, rawWord, TERMINAL_TEXT_STYLE);
      const wordWidth = metrics.width;
      const wordHeight = metrics.height;
      metrics.destroy();

      if (
        cursorX + wordWidth > this.promptMaxX &&
        cursorX > this.promptStartX
      ) {
        cursorX = this.promptStartX;
        cursorY += this.lineHeight;
      }

      const background = this.scene.add
        .rectangle(
          cursorX - 3,
          cursorY - 2,
          wordWidth + 8,
          wordHeight + 6,
          0x33ff33,
          0,
        )
        .setOrigin(0);
      const selectionFrame = this.scene.add.graphics();
      const text = this.scene.add.text(
        cursorX,
        cursorY,
        rawWord,
        TERMINAL_TEXT_STYLE,
      );
      const hitArea = this.scene.add
        .rectangle(
          cursorX - 4,
          cursorY - 3,
          wordWidth + 10,
          wordHeight + 8,
          0x000000,
          0.001,
        )
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });

      hitArea.on("pointerover", () => {
        this.hoverIndex = index;
        this.syncSelectionStates();
      });

      hitArea.on("pointerout", () => {
        if (this.hoverIndex === index) {
          this.hoverIndex = null;
          this.syncSelectionStates();
        }
      });

      hitArea.on("pointerdown", () => {
        if (this.bindings.isSearchModeSelected()) {
          this.bindings.onToggleWord(index, rawWord);
        }
      });

      this.tokens.push({
        index,
        rawWord,
        background,
        selectionFrame,
        text,
        hitArea,
      });
      cursorX += wordWidth + this.wordSpacing;
    });

    this.divider = this.scene.add.text(
      this.promptStartX,
      promptStartY + promptLines.length * this.lineHeight,
      TERMINAL_PROMPT_DIVIDER,
      TERMINAL_TEXT_STYLE,
    );

    this.bindings.onPromptLayoutChanged(
      this.divider.y + this.divider.height + 20,
    );

    this.syncScannerLayout(true);

    this.syncSelectionStates();
  }

  private syncScannerLayout(force: boolean = false) {
    if (!this.userLabel || !this.divider || this.tokens.length === 0) {
      return;
    }

    const promptBounds = new Phaser.Geom.Rectangle(
      SAFETY_SCANNER_LANE_X,
      SAFETY_SCANNER_LANE_Y,
      SAFETY_SCANNER_LANE_WIDTH,
      SAFETY_SCANNER_LANE_HEIGHT,
    );
    const layoutKey = [
      promptBounds.x,
      promptBounds.y,
      promptBounds.width,
      promptBounds.height,
      this.tokens.length,
      this.tokens[0]?.hitArea.x ?? 0,
      this.tokens[this.tokens.length - 1]?.hitArea.x ?? 0,
    ].join(":");
    if (!force && layoutKey === this.scannerLayoutKey) {
      return;
    }

    this.scannerLayoutKey = layoutKey;
    const tokenBounds: PromptTokenBounds[] = this.tokens.map((token) => ({
      index: token.index,
      left: token.hitArea.x,
      right: token.hitArea.x + token.hitArea.width,
    }));

    this.safetyScannerController.setLayout(promptBounds, tokenBounds);
  }

  syncSelectionStates() {
    const selectedWordIndexes = new Set(this.bindings.getSelectedWordIndexes());
    const safetyMatchedWordIndexes = new Set(
      this.bindings.getSafetyMatchedWordIndexes(),
    );
    const safetyRevealedWordIndexes = new Set(
      this.bindings.getSafetyRevealedWordIndexes(),
    );
    const isSearchModeSelected = this.bindings.isSearchModeSelected();
    const isSafetyModeSelected = this.bindings.isSafetyModeSelected();
    const safetyNoiseIntensity = this.bindings.getSafetyScanNoiseIntensity();

    this.syncScannerLayout();
    this.safetyScannerController.syncVisualState();

    this.userLabel?.setColor(isSafetyModeSelected ? "#995042" : "#33ff33");
    this.userLabel?.setAlpha(isSafetyModeSelected ? 0.72 : 1);
    this.divider?.setColor(isSafetyModeSelected ? "#884235" : "#33ff33");
    this.divider?.setAlpha(isSafetyModeSelected ? 0.66 : 1);

    this.tokens.forEach((token) => {
      const isSelected = selectedWordIndexes.has(token.index);
      const isHovered = isSearchModeSelected && this.hoverIndex === token.index;
      const isSafetyMatched = safetyMatchedWordIndexes.has(token.index);
      const isSafetyRevealed = safetyRevealedWordIndexes.has(token.index);
      const safetyRevealProgress = this.bindings.getSafetyRevealProgress(
        token.index,
      );
      const safetyRevealFlash = this.bindings.getSafetyRevealFlash(token.index);
      const safetyChargeGlow = clamp01(
        isSafetyRevealed ? 1 : safetyRevealProgress,
      );
      const displayGlow = clamp01(safetyChargeGlow + safetyRevealFlash * 0.85);
      const frameX = token.hitArea.x + 1;
      const frameY = token.hitArea.y + 1;
      const frameWidth = token.hitArea.width - 2;
      const frameHeight = token.hitArea.height - 2;

      token.background.setVisible(
        isSearchModeSelected && (isSelected || isHovered),
      );
      token.background.setFillStyle(isSelected ? 0x33ff33 : 0x1f5a1f);
      token.background.setAlpha(isSelected ? 0.32 : 0.18);
      token.selectionFrame.setVisible(isSearchModeSelected);
      if (isSearchModeSelected) {
        drawDashedFrame(
          token.selectionFrame,
          frameX,
          frameY,
          frameWidth,
          frameHeight,
          isSelected ? 0x9df79d : isHovered ? 0x77d977 : 0x3f8f3f,
          isSelected ? 0.95 : isHovered ? 0.75 : 0.45,
        );
      } else {
        token.selectionFrame.clear();
      }

      if (isSearchModeSelected) {
        token.text.setColor(isSelected ? "#081208" : "#33ff33");
        token.text.setAlpha(1);
        token.text.setShadow(0, 0, "#000000", 0, false, false);
        this.clearSafetyGlyphFx(token);
      } else if (isSafetyModeSelected) {
        const safetyGlowColor = mixHexColor(
          "#ff6c42",
          "#fff5ce",
          Math.pow(displayGlow, isSafetyRevealed ? 0.42 : 0.72),
        );
        token.text.setColor(
          isSafetyMatched
            ? mixHexColor(
                SAFETY_FILM_TEXT_COLOR,
                SAFETY_REVEALED_TEXT_COLOR,
                Math.pow(displayGlow, isSafetyRevealed ? 0.38 : 0.8),
              )
            : SAFETY_FILM_TEXT_COLOR,
        );
        token.text.setAlpha(
          isSafetyMatched
            ? Phaser.Math.Linear(
                SAFETY_FILM_TEXT_ALPHA,
                SAFETY_REVEALED_TEXT_ALPHA,
                displayGlow,
              )
            : SAFETY_FILM_TEXT_ALPHA,
        );
        token.text.setShadow(0, 0, "#000000", 0, false, false);
        this.syncSafetyGlyphFx(
          token,
          isSafetyMatched ? displayGlow : 0,
          safetyGlowColor,
          safetyNoiseIntensity,
        );
      } else {
        token.text.setColor("#33ff33");
        token.text.setAlpha(1);
        token.text.setShadow(0, 0, "#000000", 0, false, false);
        this.clearSafetyGlyphFx(token);
      }

      if (isSearchModeSelected) {
        token.hitArea.setInteractive({ useHandCursor: true });
        token.hitArea.setAlpha(0.001);
      } else {
        token.hitArea.disableInteractive();
        token.hitArea.setAlpha(0);
      }
    });
  }

  clear() {
    this.userLabel?.destroy();
    this.userLabel = undefined;
    this.divider?.destroy();
    this.divider = undefined;
    this.safetyScannerController.clearTokenLayout();
    this.tokens.forEach((token) => {
      token.background.destroy();
      this.clearSafetyGlyphFx(token);
      token.selectionFrame.destroy();
      token.text.destroy();
      token.hitArea.destroy();
    });
    this.tokens = [];
    this.hoverIndex = null;
    this.scannerLayoutKey = "";
    this.bindings.onPromptLayoutChanged(112);
  }

  destroy() {
    this.safetyScannerController.destroy();
    this.userLabel?.destroy();
    this.userLabel = undefined;
    this.divider?.destroy();
    this.divider = undefined;
    this.tokens.forEach((token) => {
      token.background.destroy();
      this.clearSafetyGlyphFx(token);
      token.selectionFrame.destroy();
      token.text.destroy();
      token.hitArea.destroy();
    });
    this.tokens = [];
    this.hoverIndex = null;
    this.scannerLayoutKey = "";
    this.bindings.onPromptLayoutChanged(112);
  }

  private syncSafetyGlyphFx(
    token: PromptTokenUi,
    displayGlow: number,
    glowColorHex: string,
    noiseIntensity: number,
  ) {
    const textObject = token.text;
    const fx = textObject.postFX;

    if (!fx || displayGlow <= 0.02) {
      this.clearSafetyGlyphFx(token);
      return;
    }

    token.safetyGlowFx ??= fx.addGlow(0xffe9b5, 1.2, 0.35, false, 0.08, 7);
    token.safetyBloomFx ??= fx.addBloom(0xfff1c2, 1, 1, 1.1, 1.2, 4);

    const glowColor = toHexNumber(glowColorHex);
    const bloomColor = toHexNumber(
      mixHexColor(glowColorHex, "#fffdf3", Math.min(1, displayGlow * 0.7)),
    );
    const jitterCompensation = 1 - noiseIntensity * 0.35;

    token.safetyGlowFx.color = glowColor;
    token.safetyGlowFx.outerStrength =
      Phaser.Math.Linear(0.5, 6.6, displayGlow) * jitterCompensation;
    token.safetyGlowFx.innerStrength = Phaser.Math.Linear(
      0.15,
      1.35,
      displayGlow,
    );

    token.safetyBloomFx.color = bloomColor;
    token.safetyBloomFx.offsetX = Phaser.Math.Linear(0.5, 1.4, displayGlow);
    token.safetyBloomFx.offsetY = Phaser.Math.Linear(0.5, 1.4, displayGlow);
    token.safetyBloomFx.blurStrength =
      Phaser.Math.Linear(0.4, 2.4, displayGlow) * jitterCompensation;
    token.safetyBloomFx.strength = Phaser.Math.Linear(0.25, 2.1, displayGlow);
  }

  private clearSafetyGlyphFx(token: PromptTokenUi) {
    const fx = token.text.postFX;

    if (!fx) {
      token.safetyGlowFx = undefined;
      token.safetyBloomFx = undefined;
      return;
    }

    if (token.safetyGlowFx) {
      fx.remove(token.safetyGlowFx);
      token.safetyGlowFx = undefined;
    }

    if (token.safetyBloomFx) {
      fx.remove(token.safetyBloomFx);
      token.safetyBloomFx = undefined;
    }
  }
}
