import Phaser from "phaser";

interface TerminalPromptControllerBindings {
  isSearchModeSelected: () => boolean;
  getSelectedWordIndexes: () => number[];
  getPromptStartY: () => number;
  onToggleWord: (wordIndex: number, rawWord: string) => void;
  onPromptLayoutChanged: (bottomY: number) => void;
}

interface PromptTokenUi {
  index: number;
  rawWord: string;
  background: Phaser.GameObjects.Rectangle;
  selectionFrame: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  hitArea: Phaser.GameObjects.Rectangle;
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

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bindings: TerminalPromptControllerBindings,
  ) {}

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
        if (!this.bindings.isSearchModeSelected()) {
          return;
        }

        this.bindings.onToggleWord(index, rawWord);
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

    this.syncSelectionStates();
  }

  syncSelectionStates() {
    const selectedWordIndexes = new Set(this.bindings.getSelectedWordIndexes());
    const isSearchModeSelected = this.bindings.isSearchModeSelected();

    this.tokens.forEach((token) => {
      const isSelected = selectedWordIndexes.has(token.index);
      const isHovered = isSearchModeSelected && this.hoverIndex === token.index;
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
      token.text.setColor(isSelected ? "#081208" : "#33ff33");
      token.hitArea.setAlpha(isSearchModeSelected ? 0.001 : 0);
    });
  }

  clear() {
    this.userLabel?.destroy();
    this.userLabel = undefined;
    this.divider?.destroy();
    this.divider = undefined;
    this.tokens.forEach((token) => {
      token.background.destroy();
      token.selectionFrame.destroy();
      token.text.destroy();
      token.hitArea.destroy();
    });
    this.tokens = [];
    this.hoverIndex = null;
    this.bindings.onPromptLayoutChanged(112);
  }

  destroy() {
    this.clear();
  }
}
