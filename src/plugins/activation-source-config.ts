import {
  getRuntimeConfigSnapshot,
  getRuntimeConfigSourceSnapshot,
} from "../config/runtime-snapshot.js";
import type { AstroclawConfig } from "../config/types.astroclaw.js";

export function resolvePluginActivationSourceConfig(params: {
  config?: AstroclawConfig;
  activationSourceConfig?: AstroclawConfig;
}): AstroclawConfig {
  if (params.activationSourceConfig !== undefined) {
    return params.activationSourceConfig;
  }
  const sourceSnapshot = getRuntimeConfigSourceSnapshot();
  if (sourceSnapshot && params.config === getRuntimeConfigSnapshot()) {
    return sourceSnapshot;
  }
  return params.config ?? {};
}
