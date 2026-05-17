import type { ChannelDoctorConfigMutation } from "astroclaw/plugin-sdk/channel-contract";
import type { AstroclawConfig } from "astroclaw/plugin-sdk/config-contracts";
import { normalizeCompatibilityConfig as normalizeCompatibilityConfigImpl } from "./doctor.js";

export function normalizeCompatibilityConfig({
  cfg,
}: {
  cfg: AstroclawConfig;
}): ChannelDoctorConfigMutation {
  return normalizeCompatibilityConfigImpl({ cfg });
}
