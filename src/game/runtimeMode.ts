type RuntimeImportMeta = ImportMeta & {
  env?: { MODE?: string };
};

const DEBUG_MODE_SUFFIX = "-debug";

export function getConfiguredRuntimeMode() {
  return ((import.meta as RuntimeImportMeta).env?.MODE ?? null) as
    | string
    | null;
}

export function stripRuntimeDebugSuffix(mode: string) {
  return mode.endsWith(DEBUG_MODE_SUFFIX)
    ? mode.slice(0, -DEBUG_MODE_SUFFIX.length)
    : mode;
}

export function isDebugOverlayMode() {
  const mode = getConfiguredRuntimeMode();

  return mode === "debug" || Boolean(mode?.endsWith(DEBUG_MODE_SUFFIX));
}
