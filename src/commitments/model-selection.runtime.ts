import { resolveDefaultModelForAgent } from "../agents/model-selection.js";
import type { AstroclawConfig } from "../config/config.js";

export function resolveCommitmentDefaultModelRef(params: {
  cfg: AstroclawConfig;
  agentId?: string;
}): { provider: string; model: string } {
  return resolveDefaultModelForAgent(params);
}
