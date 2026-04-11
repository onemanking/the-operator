import { getUtilityMinigameConfig } from "../../data/RunData";

export const UTILITY_PANEL_LAYOUT = {
  panelX: 804,
  panelY: 220,
  panelWidth: 200,
  panelHeight: 316,
  signalPanelInsetX: 16,
  signalPanelInsetY: 94,
  signalPanelWidth: 168,
  signalPanelHeight: 198,
  signalCellSize: 42,
} as const;

export function getSignalPanelBounds() {
  return {
    left: UTILITY_PANEL_LAYOUT.panelX + UTILITY_PANEL_LAYOUT.signalPanelInsetX,
    top: UTILITY_PANEL_LAYOUT.panelY + UTILITY_PANEL_LAYOUT.signalPanelInsetY,
    width: UTILITY_PANEL_LAYOUT.signalPanelWidth,
    height: UTILITY_PANEL_LAYOUT.signalPanelHeight,
  };
}

export function getSignalGridBounds() {
  const panelBounds = getSignalPanelBounds();
  const gridSize = UTILITY_PANEL_LAYOUT.signalCellSize * 3;

  return {
    left: panelBounds.left + (panelBounds.width - gridSize) / 2,
    top: panelBounds.top + (panelBounds.height - gridSize) / 2,
    size: gridSize,
    cellSize: UTILITY_PANEL_LAYOUT.signalCellSize,
  };
}

export function getSignalBoardMetrics() {
  const panelBounds = getSignalPanelBounds();
  const signalConfig = getUtilityMinigameConfig().signal;
  const blockGridSize = signalConfig.gridSize - 1;
  const nodeSpacing = UTILITY_PANEL_LAYOUT.signalCellSize;
  const blockSize = 28;
  const boardSize = nodeSpacing * blockGridSize;
  const nodeOffsetX = Math.round((panelBounds.width - boardSize) / 2);
  const nodeOffsetY = Math.round((panelBounds.height - boardSize) / 2);
  const blockInset = Math.round((nodeSpacing - blockSize) / 2);

  return {
    gridSize: signalConfig.gridSize,
    blockGridSize,
    nodeSpacing,
    blockSize,
    boardSize,
    nodeOriginX: panelBounds.left + nodeOffsetX,
    nodeOriginY: panelBounds.top + nodeOffsetY,
    blockOriginX: panelBounds.left + nodeOffsetX + blockInset,
    blockOriginY: panelBounds.top + nodeOffsetY + blockInset,
  };
}

export function getSignalInteractionBounds() {
  const metrics = getSignalBoardMetrics();
  const padding = 10;

  return {
    left: metrics.nodeOriginX - metrics.nodeSpacing * 0.5,
    top: metrics.nodeOriginY - metrics.nodeSpacing * 0.5,
    width: metrics.nodeSpacing * metrics.gridSize,
    height: metrics.nodeSpacing * metrics.gridSize,
    renderLeft: metrics.nodeOriginX - padding,
    renderTop: metrics.nodeOriginY - padding,
    renderWidth: metrics.boardSize + padding * 2,
    renderHeight: metrics.boardSize + padding * 2,
  };
}

export function getSignalNodePosition(cellIndex: number) {
  const metrics = getSignalBoardMetrics();
  const column = cellIndex % metrics.gridSize;
  const row = Math.floor(cellIndex / metrics.gridSize);

  return {
    centerX: metrics.nodeOriginX + column * metrics.nodeSpacing,
    centerY: metrics.nodeOriginY + row * metrics.nodeSpacing,
  };
}

export function getSignalNodeIndexFromPointer(
  pointerX: number,
  pointerY: number,
) {
  const metrics = getSignalBoardMetrics();
  const interactionBounds = getSignalInteractionBounds();
  const minX = interactionBounds.left;
  const minY = interactionBounds.top;
  const maxX = interactionBounds.left + interactionBounds.width;
  const maxY = interactionBounds.top + interactionBounds.height;

  if (
    pointerX < minX ||
    pointerY < minY ||
    pointerX >= maxX ||
    pointerY >= maxY
  ) {
    return null;
  }

  const column = Math.max(
    0,
    Math.min(
      metrics.gridSize - 1,
      Math.round((pointerX - metrics.nodeOriginX) / metrics.nodeSpacing),
    ),
  );
  const row = Math.max(
    0,
    Math.min(
      metrics.gridSize - 1,
      Math.round((pointerY - metrics.nodeOriginY) / metrics.nodeSpacing),
    ),
  );

  return row * metrics.gridSize + column;
}
