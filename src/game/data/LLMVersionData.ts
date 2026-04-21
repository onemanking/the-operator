import { getPersistentDeathCount } from "./RunHistoryData";

export const LLM_NAME = "OMNI-SENTINEL";

export function formatLLMVersion(deathCount: number) {
  return `v1.${String(Math.max(0, deathCount)).padStart(2, "0")}`;
}

export function getLLMLabel() {
  return `${LLM_NAME} ${formatLLMVersion(getPersistentDeathCount())}`;
}
