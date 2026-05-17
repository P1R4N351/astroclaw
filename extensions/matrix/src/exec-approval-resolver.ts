import { resolveApprovalOverGateway } from "astroclaw/plugin-sdk/approval-gateway-runtime";
import type { ExecApprovalReplyDecision } from "astroclaw/plugin-sdk/approval-runtime";
import type { AstroclawConfig } from "astroclaw/plugin-sdk/config-contracts";
import { isApprovalNotFoundError } from "astroclaw/plugin-sdk/error-runtime";

export { isApprovalNotFoundError };

export async function resolveMatrixApproval(params: {
  cfg: AstroclawConfig;
  approvalId: string;
  decision: ExecApprovalReplyDecision;
  senderId?: string | null;
  gatewayUrl?: string;
}): Promise<void> {
  await resolveApprovalOverGateway({
    cfg: params.cfg,
    approvalId: params.approvalId,
    decision: params.decision,
    senderId: params.senderId,
    gatewayUrl: params.gatewayUrl,
    clientDisplayName: `Matrix approval (${params.senderId?.trim() || "unknown"})`,
  });
}
