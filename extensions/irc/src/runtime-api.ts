// Private runtime barrel for the bundled IRC extension.
// Keep this barrel thin and generic-only.

export type { BaseProbeResult } from "astroclaw/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "astroclaw/plugin-sdk/channel-core";
export type { AstroclawConfig } from "astroclaw/plugin-sdk/config-contracts";
export type { PluginRuntime } from "astroclaw/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "astroclaw/plugin-sdk/runtime";
export type {
  BlockStreamingCoalesceConfig,
  DmConfig,
  DmPolicy,
  GroupPolicy,
  GroupToolPolicyBySenderConfig,
  GroupToolPolicyConfig,
  MarkdownConfig,
} from "astroclaw/plugin-sdk/config-contracts";
export type { OutboundReplyPayload } from "astroclaw/plugin-sdk/reply-payload";
export { DEFAULT_ACCOUNT_ID } from "astroclaw/plugin-sdk/account-id";
export { buildChannelConfigSchema } from "astroclaw/plugin-sdk/channel-config-primitives";
export {
  PAIRING_APPROVED_MESSAGE,
  buildBaseChannelStatusSummary,
} from "astroclaw/plugin-sdk/channel-status";
export { createChannelPairingController } from "astroclaw/plugin-sdk/channel-pairing";
export { createAccountStatusSink } from "astroclaw/plugin-sdk/channel-lifecycle";
export { resolveControlCommandGate } from "astroclaw/plugin-sdk/command-auth-native";
export { createChannelMessageReplyPipeline } from "astroclaw/plugin-sdk/channel-message";
export { chunkTextForOutbound } from "astroclaw/plugin-sdk/text-chunking";
export {
  deliverFormattedTextWithAttachments,
  formatTextWithAttachmentLinks,
  resolveOutboundMediaUrls,
} from "astroclaw/plugin-sdk/reply-payload";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "astroclaw/plugin-sdk/runtime-group-policy";
export { isDangerousNameMatchingEnabled } from "astroclaw/plugin-sdk/dangerous-name-runtime";
export { logInboundDrop } from "astroclaw/plugin-sdk/channel-inbound";
