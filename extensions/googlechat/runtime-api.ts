// Private runtime barrel for the bundled Google Chat extension.
// Keep this barrel thin and avoid broad plugin-sdk surfaces during bootstrap.

export { DEFAULT_ACCOUNT_ID } from "astroclaw/plugin-sdk/account-id";
export {
  createActionGate,
  jsonResult,
  readNumberParam,
  readReactionParams,
  readStringParam,
} from "astroclaw/plugin-sdk/channel-actions";
export { buildChannelConfigSchema } from "astroclaw/plugin-sdk/channel-config-primitives";
export type {
  ChannelMessageActionAdapter,
  ChannelMessageActionName,
  ChannelStatusIssue,
} from "astroclaw/plugin-sdk/channel-contract";
export { missingTargetError } from "astroclaw/plugin-sdk/channel-feedback";
export {
  createAccountStatusSink,
  runPassiveAccountLifecycle,
} from "astroclaw/plugin-sdk/channel-lifecycle";
export { createChannelPairingController } from "astroclaw/plugin-sdk/channel-pairing";
export { createChannelMessageReplyPipeline } from "astroclaw/plugin-sdk/channel-message";
export { PAIRING_APPROVED_MESSAGE } from "astroclaw/plugin-sdk/channel-status";
export { chunkTextForOutbound } from "astroclaw/plugin-sdk/text-chunking";
export type { AstroclawConfig } from "astroclaw/plugin-sdk/config-contracts";
export { GoogleChatConfigSchema } from "astroclaw/plugin-sdk/bundled-channel-config-schema";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "astroclaw/plugin-sdk/runtime-group-policy";
export { isDangerousNameMatchingEnabled } from "astroclaw/plugin-sdk/dangerous-name-runtime";
export {
  readRemoteMediaBuffer,
  resolveChannelMediaMaxBytes,
} from "astroclaw/plugin-sdk/media-runtime";
export { loadOutboundMediaFromUrl } from "astroclaw/plugin-sdk/outbound-media";
export type { PluginRuntime } from "astroclaw/plugin-sdk/runtime-store";
export { fetchWithSsrFGuard } from "astroclaw/plugin-sdk/ssrf-runtime";
export type {
  GoogleChatAccountConfig,
  GoogleChatConfig,
} from "astroclaw/plugin-sdk/config-contracts";
export { extractToolSend } from "astroclaw/plugin-sdk/tool-send";
export { resolveInboundMentionDecision } from "astroclaw/plugin-sdk/channel-inbound";
export { resolveInboundRouteEnvelopeBuilderWithRuntime } from "astroclaw/plugin-sdk/inbound-envelope";
export { resolveWebhookPath } from "astroclaw/plugin-sdk/webhook-ingress";
export {
  registerWebhookTargetWithPluginRoute,
  resolveWebhookTargetWithAuthOrReject,
  withResolvedWebhookRequestPipeline,
} from "astroclaw/plugin-sdk/webhook-targets";
export {
  createWebhookInFlightLimiter,
  readJsonWebhookBodyOrReject,
  type WebhookInFlightLimiter,
} from "astroclaw/plugin-sdk/webhook-request-guards";
export { setGoogleChatRuntime } from "./src/runtime.js";
