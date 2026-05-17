// Private runtime barrel for the bundled Microsoft Teams extension.
// Keep this barrel thin and aligned with the local extension surface.

export { DEFAULT_ACCOUNT_ID } from "astroclaw/plugin-sdk/account-id";
export type { AllowlistMatch } from "astroclaw/plugin-sdk/allow-from";
export {
  mergeAllowlist,
  resolveAllowlistMatchSimple,
  summarizeMapping,
} from "astroclaw/plugin-sdk/allow-from";
export type {
  BaseProbeResult,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelOutboundAdapter,
} from "astroclaw/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "astroclaw/plugin-sdk/channel-core";
export { logTypingFailure } from "astroclaw/plugin-sdk/channel-logging";
export { createChannelPairingController } from "astroclaw/plugin-sdk/channel-pairing";
export { resolveToolsBySender } from "astroclaw/plugin-sdk/channel-policy";
export { createChannelMessageReplyPipeline } from "astroclaw/plugin-sdk/channel-message";
export {
  PAIRING_APPROVED_MESSAGE,
  buildProbeChannelStatusSummary,
  createDefaultChannelRuntimeState,
} from "astroclaw/plugin-sdk/channel-status";
export {
  buildChannelKeyCandidates,
  normalizeChannelSlug,
  resolveChannelEntryMatchWithFallback,
  resolveNestedAllowlistDecision,
} from "astroclaw/plugin-sdk/channel-targets";
export type {
  GroupPolicy,
  GroupToolPolicyConfig,
  MSTeamsChannelConfig,
  MSTeamsConfig,
  MSTeamsReplyStyle,
  MSTeamsTeamConfig,
  MarkdownTableMode,
  AstroclawConfig,
} from "astroclaw/plugin-sdk/config-contracts";
export { isDangerousNameMatchingEnabled } from "astroclaw/plugin-sdk/dangerous-name-runtime";
export { resolveDefaultGroupPolicy } from "astroclaw/plugin-sdk/runtime-group-policy";
export { withFileLock } from "astroclaw/plugin-sdk/file-lock";
export { keepHttpServerTaskAlive } from "astroclaw/plugin-sdk/channel-lifecycle";
export {
  detectMime,
  extensionForMime,
  extractOriginalFilename,
  getFileExtension,
  resolveChannelMediaMaxBytes,
} from "astroclaw/plugin-sdk/media-runtime";
export { dispatchReplyFromConfigWithSettledDispatcher } from "astroclaw/plugin-sdk/inbound-reply-dispatch";
export { loadOutboundMediaFromUrl } from "astroclaw/plugin-sdk/outbound-media";
export { buildMediaPayload } from "astroclaw/plugin-sdk/reply-payload";
export type { ReplyPayload } from "astroclaw/plugin-sdk/reply-payload";
export type { PluginRuntime } from "astroclaw/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "astroclaw/plugin-sdk/runtime";
export type { SsrFPolicy } from "astroclaw/plugin-sdk/ssrf-runtime";
export { fetchWithSsrFGuard } from "astroclaw/plugin-sdk/ssrf-runtime";
export { normalizeStringEntries } from "astroclaw/plugin-sdk/string-normalization-runtime";
export { chunkTextForOutbound } from "astroclaw/plugin-sdk/text-chunking";
export { DEFAULT_WEBHOOK_MAX_BODY_BYTES } from "astroclaw/plugin-sdk/webhook-ingress";
export { setMSTeamsRuntime } from "./src/runtime.js";
