import type { SessionRow } from "@astroclaw/gateway-protocol";

export type { AgentsListResult } from "@astroclaw/gateway-protocol";
export type GatewaySessionRow = SessionRow & {
  hasActiveRun?: boolean;
  abortedLastRun?: boolean;
};
