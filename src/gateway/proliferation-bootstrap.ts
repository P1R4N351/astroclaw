import type { AstroclawConfig } from "../config/config.js";

type AstroclawRuntimeModule = {
  init: (args: { astroclaw: unknown; config: unknown }) => Promise<{
    shutdown: () => Promise<void>;
  }>;
};

export type ProliferationHandle = {
  shutdown: () => Promise<void>;
};

/**
 * Optional astroclaw sidecar bootstrap.
 *
 * No-op when `cfg.proliferation.enabled` is absent or false. When enabled,
 * dynamically imports `@astroclaw/runtime` so gateways that don't install the
 * sidecar pay no cost. Subsequent astroclaw hook patches extend the adapter
 * handed to the sidecar (lifecycle events, WorkspaceWriter, channel-send
 * gate, etc.); this initial patch only wires the call.
 */
export async function tryStartProliferation(params: {
  cfg: AstroclawConfig;
  log: { info: (msg: string) => void; warn: (msg: string) => void };
}): Promise<ProliferationHandle | null> {
  const cfg = params.cfg.proliferation;
  if (!cfg?.enabled) {
    return null;
  }
  const astroclawModule = (await import("@astroclaw/runtime").catch(
    () => null,
  )) as AstroclawRuntimeModule | null;
  if (!astroclawModule) {
    params.log.warn(
      "proliferation.enabled is set but @astroclaw/runtime is not installed; sidecar inactive",
    );
    return null;
  }
  try {
    const adapter = {};
    const handle = await astroclawModule.init({ astroclaw: adapter, config: cfg });
    params.log.info(`astroclaw/runtime started for node ${cfg.nodeId ?? "(unset)"}`);
    return handle;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    params.log.warn(`astroclaw/runtime init failed: ${msg}`);
    return null;
  }
}
