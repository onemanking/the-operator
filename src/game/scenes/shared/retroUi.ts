import Phaser from "phaser";

export const RETRO_COLORS = {
  background: 0x1a1813,
  amberText: "#ffb000",
  mutedText: "#d4c5b0",
  errorText: "#ff0000",
  panel: 0x8c867a,
  shadow: 0x111111,
  stroke: 0x555555,
};

interface RetroButtonConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  textStyle?: Phaser.Types.GameObjects.Text.TextStyle;
  fillColor?: number;
  onPress: () => void;
}

export function createRetroTextStyle(
  overrides: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: "24px",
    color: RETRO_COLORS.amberText,
    align: "center",
    ...overrides,
  };
}

export function createSceneBackdrop(
  scene: Phaser.Scene,
  color: number = RETRO_COLORS.background,
) {
  const { width, height } = scene.cameras.main;
  return scene.add.rectangle(0, 0, width, height, color).setOrigin(0);
}

export function addScanlines(scene: Phaser.Scene) {
  const { width, height } = scene.cameras.main;
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x000000, 0.2);

  for (let index = 0; index < height; index += 4) {
    graphics.fillRect(0, index, width, 1);
  }

  graphics.setDepth(1000);
  return graphics;
}

export function createRetroButton({
  scene,
  x,
  y,
  width,
  height,
  label,
  textStyle,
  fillColor = RETRO_COLORS.panel,
  onPress,
}: RetroButtonConfig) {
  const shadowOffset = 4;
  scene.add
    .rectangle(x, y + shadowOffset, width, height, RETRO_COLORS.shadow)
    .setOrigin(0.5);

  const button = scene.add
    .rectangle(x, y, width, height, fillColor)
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
  button.setStrokeStyle(2, RETRO_COLORS.stroke);

  const buttonLabel = scene.add
    .text(
      x,
      y,
      label,
      createRetroTextStyle({
        color: "#111111",
        fontStyle: "bold",
        ...(textStyle ?? {}),
      }),
    )
    .setOrigin(0.5);

  button.on("pointerdown", () => {
    button.y = y + shadowOffset;
    buttonLabel.y = y + shadowOffset;

    scene.time.delayedCall(100, () => {
      button.y = y;
      buttonLabel.y = y;
      onPress();
    });
  });

  return { button, buttonLabel };
}
