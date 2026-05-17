// Private runtime barrel for the bundled Twitch extension.
// Keep this barrel thin and aligned with the local extension surface.

export type {
  ChannelAccountSnapshot,
  ChannelCapabilities,
  ChannelGatewayContext,
  ChannelLogSink,
  ChannelMessageActionAdapter,
  ChannelMessageActionContext,
  ChannelMeta,
  ChannelOutboundAdapter,
  ChannelOutboundContext,
  ChannelResolveKind,
  ChannelResolveResult,
  ChannelStatusAdapter,
} from "astroclaw/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "astroclaw/plugin-sdk/channel-core";
export type { OutboundDeliveryResult } from "astroclaw/plugin-sdk/channel-send-result";
export type { AstroclawConfig } from "astroclaw/plugin-sdk/config-contracts";
export type { RuntimeEnv } from "astroclaw/plugin-sdk/runtime";
export type { WizardPrompter } from "astroclaw/plugin-sdk/setup";
