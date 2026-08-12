import type { OpenClawConfig } from "../../config/types.astroclaw.js";
import { tryResolveSessionCompatibilityOwnerAgentId } from "../session-request-agent.js";

export function resolveChatSendStopOwnerScope(params: {
  cfg: OpenClawConfig;
  selectedAgentId?: string;
  sessionKey: string;
}): { agentId?: string; defaultAgentId?: string } {
  return {
    agentId: params.selectedAgentId,
    defaultAgentId: tryResolveSessionCompatibilityOwnerAgentId(params.cfg, params.sessionKey),
  };
}
