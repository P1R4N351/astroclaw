// Private runtime barrel for the bundled Nextcloud Talk extension.
// Keep this barrel thin and aligned with the local extension surface.

export type { AllowlistMatch } from "astroclaw/plugin-sdk/allow-from";
export type { ChannelGroupContext } from "astroclaw/plugin-sdk/channel-contract";
export { logInboundDrop } from "astroclaw/plugin-sdk/channel-logging";
export { createChannelPairingController } from "astroclaw/plugin-sdk/channel-pairing";
export type {
  BlockStreamingCoalesceConfig,
  DmConfig,
  DmPolicy,
  GroupPolicy,
  GroupToolPolicyConfig,
  AstroclawConfig,
} from "astroclaw/plugin-sdk/config-contracts";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "astroclaw/plugin-sdk/runtime-group-policy";
export { createChannelMessageReplyPipeline } from "astroclaw/plugin-sdk/channel-message";
export type { OutboundReplyPayload } from "astroclaw/plugin-sdk/reply-payload";
export { deliverFormattedTextWithAttachments } from "astroclaw/plugin-sdk/reply-payload";
export type { PluginRuntime } from "astroclaw/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "astroclaw/plugin-sdk/runtime";
export type { SecretInput } from "astroclaw/plugin-sdk/secret-input";
export { fetchWithSsrFGuard } from "astroclaw/plugin-sdk/ssrf-runtime";
export { setNextcloudTalkRuntime } from "./src/runtime.js";
