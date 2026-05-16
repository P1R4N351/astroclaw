import type { AstroclawConfig } from "../config/config.js";
import {
  createProliferationEvents,
  type ProliferationEventMap,
  type ProliferationEvents,
} from "./proliferation-events.js";

type AstroclawSidecarHandle = {
  shutdown: () => Promise<void>;
  /** Optional health contribution merged into /healthz responses. */
  getHealth?: () => Record<string, unknown> | undefined;
};

/** Decision the sidecar returns from beforeChannelSend. */
export type ChannelSendDecision = "allow" | "queue" | "deny";

export type BeforeChannelSendHook = (msg: {
  channelId: string;
  accountId?: string;
}) => Promise<ChannelSendDecision> | ChannelSendDecision;

type AstroclawRuntimeModule = {
  init: (args: { astroclaw: unknown; config: unknown }) => Promise<AstroclawSidecarHandle>;
};

export type ProliferationHandle = {
  shutdown: () => Promise<void>;
  /** Always-present event emitter — emit sites are no-ops when sidecar is inactive. */
  events: ProliferationEvents;
};

/** Module-scope reference for cross-module health contribution lookup. */
let currentSidecar: AstroclawSidecarHandle | null = null;

let currentBeforeChannelSend: BeforeChannelSendHook | null = null;

/**
 * Module-scope reference to the lifecycle event emitter so other gateway
 * modules can emit proliferation events without threading a handle through.
 * Always non-null between gateway start and shutdown, even when the sidecar
 * itself is inactive — emits are silently no-op when nobody subscribes.
 */
let currentEvents: ProliferationEvents | null = null;

/**
 * Emit a proliferation lifecycle event. Used by gateway modules that
 * announce work happening (session checkpoint, workspace write, etc.).
 * Safe to call before bootstrap has run; emits are dropped.
 */
export function emitProliferationEvent<K extends keyof ProliferationEventMap>(
  event: K,
  ...args: ProliferationEventMap[K]
): void {
  currentEvents?.emit(event, ...args);
}

/**
 * Called by the gateway's /healthz handler. Merges sidecar-reported health
 * fields into the response. Returns undefined when the sidecar is inactive,
 * in which case /healthz is unchanged.
 */
export function getProliferationHealth(): Record<string, unknown> | undefined {
  return currentSidecar?.getHealth?.();
}

/**
 * Called by channel send paths immediately before dispatch. Returns 'allow'
 * when the sidecar is inactive, so absence of sidecar leaves send behaviour
 * unchanged. Returns 'queue' or 'deny' when the sidecar wants to short-
 * circuit (e.g. this node is not the channel lease holder).
 */
export async function checkBeforeChannelSend(msg: {
  channelId: string;
  accountId?: string;
}): Promise<ChannelSendDecision> {
  if (!currentBeforeChannelSend) {
    return "allow";
  }
  try {
    return await currentBeforeChannelSend(msg);
  } catch {
    // Sidecar errors should never block sends — fail open.
    return "allow";
  }
}

const inactiveHandle = (events: ProliferationEvents): ProliferationHandle => ({
  shutdown: async () => {
    currentEvents = null;
    events.removeAllListeners();
  },
  events,
});

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
}): Promise<ProliferationHandle> {
  const events = createProliferationEvents();
  currentEvents = events;
  const cfg = params.cfg.proliferation;
  if (!cfg?.enabled) {
    return inactiveHandle(events);
  }
  const astroclawModule = (await import("@astroclaw/runtime").catch(
    () => null,
  )) as AstroclawRuntimeModule | null;
  if (!astroclawModule) {
    params.log.warn(
      "proliferation.enabled is set but @astroclaw/runtime is not installed; sidecar inactive",
    );
    return inactiveHandle(events);
  }
  try {
    const adapter = {
      events,
      setBeforeChannelSend: (hook: BeforeChannelSendHook | null) => {
        currentBeforeChannelSend = hook;
      },
    };
    const sidecarHandle = await astroclawModule.init({ astroclaw: adapter, config: cfg });
    currentSidecar = sidecarHandle;
    params.log.info(`astroclaw/runtime started for node ${cfg.nodeId ?? "(unset)"}`);
    return {
      events,
      shutdown: async () => {
        try {
          await sidecarHandle.shutdown();
        } finally {
          currentSidecar = null;
          currentBeforeChannelSend = null;
          currentEvents = null;
          events.removeAllListeners();
        }
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    params.log.warn(`astroclaw/runtime init failed: ${msg}`);
    return inactiveHandle(events);
  }
}
