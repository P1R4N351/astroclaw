/**
 * Active runtime config provider for the QQBot engine.
 *
 * Routing must re-evaluate `bindings[]` on every inbound message so that
 * peer/account binding edits made via the CLI take effect without
 * restarting the gateway. The provider hides the per-event lookup
 * behind a typed seam and falls back to the startup snapshot when the
 * runtime registry getter throws (e.g. snapshot not yet initialised).
 *
 * Issue #69546.
 */

import type { AstroclawConfig } from "astroclaw/plugin-sdk/core";
import { getRuntimeConfig } from "astroclaw/plugin-sdk/runtime-config-snapshot";

export type GatewayCfg = AstroclawConfig;

export type GatewayCfgLoader = () => AstroclawConfig;

export interface ActiveCfgProvider {
  getActiveCfg(): AstroclawConfig;
}

export interface ActiveCfgProviderOptions {
  fallback: AstroclawConfig;
  load?: GatewayCfgLoader;
}

export function createActiveCfgProvider(options: ActiveCfgProviderOptions): ActiveCfgProvider {
  const loader = options.load ?? defaultGatewayCfgLoader;
  const fallback = options.fallback;
  return {
    getActiveCfg(): AstroclawConfig {
      return resolveActiveCfg(loader, fallback);
    },
  };
}

export function resolveActiveCfg(
  loader: GatewayCfgLoader,
  fallback: AstroclawConfig,
): AstroclawConfig {
  try {
    return loader();
  } catch {
    return fallback;
  }
}

function defaultGatewayCfgLoader(): AstroclawConfig {
  return getRuntimeConfig();
}
