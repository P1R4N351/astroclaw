// Private runtime barrel for the bundled Mattermost extension.
// Keep this barrel thin and generic-only.

export type {
  BaseProbeResult,
  ChannelAccountSnapshot,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelPlugin,
  ChatType,
  HistoryEntry,
  AstroclawConfig,
  AstroclawPluginApi,
  PluginRuntime,
} from "astroclaw/plugin-sdk/core";
export type { RuntimeEnv } from "astroclaw/plugin-sdk/runtime";
export type { ReplyPayload } from "astroclaw/plugin-sdk/reply-runtime";
export type { ModelsProviderData } from "astroclaw/plugin-sdk/models-provider-runtime";
export type {
  BlockStreamingCoalesceConfig,
  DmPolicy,
  GroupPolicy,
} from "astroclaw/plugin-sdk/config-contracts";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  createDedupeCache,
  parseStrictPositiveInteger,
  resolveClientIp,
  isTrustedProxyAddress,
} from "astroclaw/plugin-sdk/core";
export { buildComputedAccountStatusSnapshot } from "astroclaw/plugin-sdk/channel-status";
export { createAccountStatusSink } from "astroclaw/plugin-sdk/channel-lifecycle";
export { buildAgentMediaPayload } from "astroclaw/plugin-sdk/agent-media-payload";
export {
  listSkillCommandsForAgents,
  resolveControlCommandGate,
  resolveStoredModelOverride,
} from "astroclaw/plugin-sdk/command-auth-native";
export { buildModelsProviderData } from "astroclaw/plugin-sdk/models-provider-runtime";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "astroclaw/plugin-sdk/runtime-group-policy";
export { isDangerousNameMatchingEnabled } from "astroclaw/plugin-sdk/dangerous-name-runtime";
export { loadSessionStore, resolveStorePath } from "astroclaw/plugin-sdk/session-store-runtime";
export { formatInboundFromLabel } from "astroclaw/plugin-sdk/channel-inbound";
export { logInboundDrop } from "astroclaw/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "astroclaw/plugin-sdk/channel-pairing";
export { createChannelMessageReplyPipeline } from "astroclaw/plugin-sdk/channel-message";
export { logTypingFailure } from "astroclaw/plugin-sdk/channel-feedback";
export { loadOutboundMediaFromUrl } from "astroclaw/plugin-sdk/outbound-media";
export { rawDataToString } from "astroclaw/plugin-sdk/webhook-ingress";
export { chunkTextForOutbound } from "astroclaw/plugin-sdk/text-chunking";
// Legacy map-helper exports stay for older plugin consumers. New message-turn
// code should use createChannelHistoryWindow.
export {
  DEFAULT_GROUP_HISTORY_LIMIT,
  createChannelHistoryWindow,
  buildPendingHistoryContextFromMap,
  clearHistoryEntriesIfEnabled,
  recordPendingHistoryEntryIfEnabled,
} from "astroclaw/plugin-sdk/reply-history";
export { normalizeAccountId, resolveThreadSessionKeys } from "astroclaw/plugin-sdk/routing";
export { resolveAllowlistMatchSimple } from "astroclaw/plugin-sdk/allow-from";
export { registerPluginHttpRoute } from "astroclaw/plugin-sdk/webhook-targets";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
} from "astroclaw/plugin-sdk/webhook-ingress";
export {
  applyAccountNameToChannelSection,
  applySetupAccountConfigPatch,
  migrateBaseNameToDefaultAccount,
} from "astroclaw/plugin-sdk/setup";
export {
  getAgentScopedMediaLocalRoots,
  resolveChannelMediaMaxBytes,
} from "astroclaw/plugin-sdk/media-runtime";
export { normalizeProviderId } from "astroclaw/plugin-sdk/provider-model-shared";
export { setMattermostRuntime } from "./src/runtime.js";
