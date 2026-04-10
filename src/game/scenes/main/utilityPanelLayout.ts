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
