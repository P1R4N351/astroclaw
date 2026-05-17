// Narrow Matrix monitor helper seam.
// Keep monitor internals off the broad package runtime-api barrel so monitor
// tests and shared workers do not pull unrelated Matrix helper surfaces.

export type { NormalizedLocation } from "astroclaw/plugin-sdk/channel-location";
export type { PluginRuntime, RuntimeLogger } from "astroclaw/plugin-sdk/plugin-runtime";
export type { BlockReplyContext, ReplyPayload } from "astroclaw/plugin-sdk/reply-runtime";
export type { MarkdownTableMode, AstroclawConfig } from "astroclaw/plugin-sdk/config-contracts";
export type { RuntimeEnv } from "astroclaw/plugin-sdk/runtime";
export {
  addAllowlistUserEntriesFromConfigEntry,
  buildAllowlistResolutionSummary,
  canonicalizeAllowlistWithResolvedIds,
  formatAllowlistMatchMeta,
  patchAllowlistUsersInConfigEntries,
  summarizeMapping,
} from "astroclaw/plugin-sdk/allow-from";
export {
  createReplyPrefixOptions,
  createTypingCallbacks,
} from "astroclaw/plugin-sdk/channel-reply-options-runtime";
export { formatLocationText, toLocationContext } from "astroclaw/plugin-sdk/channel-location";
export { getAgentScopedMediaLocalRoots } from "astroclaw/plugin-sdk/agent-media-payload";
export { logInboundDrop, logTypingFailure } from "astroclaw/plugin-sdk/channel-logging";
export {
  buildChannelKeyCandidates,
  resolveChannelEntryMatch,
} from "astroclaw/plugin-sdk/channel-targets";
