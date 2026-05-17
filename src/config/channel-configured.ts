import { getBootstrapChannelPlugin } from "../channels/plugins/bootstrap-registry.js";
import { hasBundledChannelConfiguredState } from "../channels/plugins/configured-state.js";
import {
  hasMeaningfulChannelConfigShallow,
  resolveChannelConfigRecord,
} from "./channel-configured-shared.js";
import type { AstroclawConfig } from "./types.astroclaw.js";

export function isChannelConfigured(
  cfg: AstroclawConfig,
  channelId: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (hasMeaningfulChannelConfigShallow(resolveChannelConfigRecord(cfg, channelId))) {
    return true;
  }
  if (hasBundledChannelConfiguredState({ channelId, cfg, env })) {
    return true;
  }
  const plugin = getBootstrapChannelPlugin(channelId);
  return Boolean(plugin?.config?.hasConfiguredState?.({ cfg, env }));
}
