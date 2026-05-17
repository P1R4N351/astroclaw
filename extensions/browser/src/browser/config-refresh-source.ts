import {
  getRuntimeConfig,
  getRuntimeConfigSourceSnapshot,
  type AstroclawConfig,
} from "../config/config.js";

export function loadBrowserConfigForRuntimeRefresh(): AstroclawConfig {
  return getRuntimeConfigSourceSnapshot() ?? getRuntimeConfig();
}
