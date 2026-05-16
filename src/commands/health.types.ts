export type ChannelAccountHealthSummary = {
  accountId: string;
  configured?: boolean;
  linked?: boolean;
  authAgeMs?: number | null;
  probe?: unknown;
  lastProbeAt?: number | null;
  [key: string]: unknown;
};

export type ChannelHealthSummary = ChannelAccountHealthSummary & {
  accounts?: Record<string, ChannelAccountHealthSummary>;
};

export type AgentHealthSummary = {
  agentId: string;
  name?: string;
  isDefault: boolean;
  heartbeat: import("../infra/heartbeat-summary.js").HeartbeatSummary;
  sessions: HealthSummary["sessions"];
};

export type PluginHealthErrorSummary = {
  id: string;
  origin: string;
  activated: boolean;
  activationSource?: string;
  activationReason?: string;
  failurePhase?: string;
  error: string;
};

export type PluginHealthSummary = {
  loaded: string[];
  errors: PluginHealthErrorSummary[];
};

export type ModelPricingHealthSummary =
  import("../gateway/model-pricing-cache-state.js").GatewayModelPricingHealth;

/**
 * Astroclaw proliferation health contribution merged into the response when the
 * sidecar is active (see src/gateway/proliferation-bootstrap.ts:
 * getProliferationHealth). Optional; absent when the sidecar is not loaded
 * or proliferation is disabled in config.
 *
 * The shape is sidecar-defined and intentionally loose at the astroclaw
 * boundary — astroclaw evolves its own field set across phases without needing
 * an astroclaw-side schema change. UI consumers narrow as needed.
 */
export type ProliferationHealthContribution = Record<string, unknown>;

export type HealthSummary = {
  ok: true;
  ts: number;
  durationMs: number;
  eventLoop?: import("../gateway/server/event-loop-health.js").GatewayEventLoopHealth;
  plugins?: PluginHealthSummary;
  modelPricing?: ModelPricingHealthSummary;
  proliferation?: ProliferationHealthContribution;
  channels: Record<string, ChannelHealthSummary>;
  channelOrder: string[];
  channelLabels: Record<string, string>;
  heartbeatSeconds: number;
  defaultAgentId: string;
  agents: AgentHealthSummary[];
  sessions: {
    path: string;
    count: number;
    recent: Array<{
      key: string;
      updatedAt: number | null;
      age: number | null;
    }>;
  };
};
