import {
  getRuntimeConfigSnapshot,
  getRuntimeConfigSourceSnapshot,
  selectApplicableRuntimeConfig,
} from "astroclaw/plugin-sdk/runtime-config-snapshot";
import type { AstroclawConfig } from "./runtime-api.js";

export function selectDiscordRuntimeConfig(inputConfig: AstroclawConfig): AstroclawConfig {
  return (
    selectApplicableRuntimeConfig({
      inputConfig,
      runtimeConfig: getRuntimeConfigSnapshot(),
      runtimeSourceConfig: getRuntimeConfigSourceSnapshot(),
    }) ?? inputConfig
  );
}
