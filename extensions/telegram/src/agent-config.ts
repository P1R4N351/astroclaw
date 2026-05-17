import type { AstroclawConfig } from "astroclaw/plugin-sdk/config-contracts";

type ReasoningDefault = "on" | "stream" | "off";

const DEFAULT_AGENT_ID = "main";

function normalizeAgentId(value: string | undefined | null): string {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized || DEFAULT_AGENT_ID;
}

export function resolveTelegramConfigReasoningDefault(
  cfg: AstroclawConfig,
  agentId: string,
): ReasoningDefault {
  const id = normalizeAgentId(agentId);
  const agentDefault = cfg.agents?.list?.find(
    (entry) => normalizeAgentId(entry?.id) === id,
  )?.reasoningDefault;
  return agentDefault ?? cfg.agents?.defaults?.reasoningDefault ?? "off";
}
