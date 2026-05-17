// Private runtime barrel for the bundled Feishu extension.
// Keep this barrel thin and generic-only.

export type {
  AllowlistMatch,
  AnyAgentTool,
  BaseProbeResult,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelMeta,
  ChannelOutboundAdapter,
  ChannelPlugin,
  HistoryEntry,
  AstroclawConfig,
  AstroclawPluginApi,
  OutboundIdentity,
  PluginRuntime,
  ReplyPayload,
} from "astroclaw/plugin-sdk/core";
export type { AstroclawConfig as ClawdbotConfig } from "astroclaw/plugin-sdk/core";
export type { RuntimeEnv } from "astroclaw/plugin-sdk/runtime";
export type { GroupToolPolicyConfig } from "astroclaw/plugin-sdk/config-contracts";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  createActionGate,
  createDedupeCache,
} from "astroclaw/plugin-sdk/core";
export {
  PAIRING_APPROVED_MESSAGE,
  buildProbeChannelStatusSummary,
  createDefaultChannelRuntimeState,
} from "astroclaw/plugin-sdk/channel-status";
export { buildAgentMediaPayload } from "astroclaw/plugin-sdk/agent-media-payload";
export { createChannelPairingController } from "astroclaw/plugin-sdk/channel-pairing";
export { createReplyPrefixContext } from "astroclaw/plugin-sdk/channel-message";
export {
  evaluateSupplementalContextVisibility,
  filterSupplementalContextItems,
  resolveChannelContextVisibilityMode,
} from "astroclaw/plugin-sdk/context-visibility-runtime";
export {
  loadSessionStore,
  resolveSessionStoreEntry,
} from "astroclaw/plugin-sdk/session-store-runtime";
export { readJsonFileWithFallback } from "astroclaw/plugin-sdk/json-store";
export { createPersistentDedupe } from "astroclaw/plugin-sdk/persistent-dedupe";
export { normalizeAgentId } from "astroclaw/plugin-sdk/routing";
export { chunkTextForOutbound } from "astroclaw/plugin-sdk/text-chunking";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
  requestBodyErrorToText,
} from "astroclaw/plugin-sdk/webhook-ingress";
export { setFeishuRuntime } from "./src/runtime.js";
