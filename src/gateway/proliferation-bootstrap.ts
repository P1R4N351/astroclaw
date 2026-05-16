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

/**
 * Channel-send-gate timeout. A slow sidecar must not be able to stall the
 * gateway's send path. After this timeout, the gate fails open (returns
 * "allow") and increments a counter so persistent timeouts surface in logs.
 */
const CHANNEL_SEND_GATE_TIMEOUT_MS = 1000;

/**
 * After this many consecutive failures (timeout, sidecar throw, etc.) we
 * log a warning. Reset on next successful invocation. Catches "the sidecar
 * is in a bad state" without spamming on every single tick.
 */
const PERSISTENT_FAILURE_LOG_THRESHOLD = 5;

/** Module-scope reference for cross-module health contribution lookup. */
let currentSidecar: AstroclawSidecarHandle | null = null;

let currentBeforeChannelSend: BeforeChannelSendHook | null = null;

let consecutiveChannelGateFailures = 0;
let currentLog: { info: (msg: string) => void; warn: (msg: string) => void } | null = null;

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
  const hook = currentBeforeChannelSend;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let succeeded = false;
  type Outcome = { ok: true; decision: ChannelSendDecision } | { ok: false };
  const timeoutPromise = new Promise<Outcome>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false }), CHANNEL_SEND_GATE_TIMEOUT_MS);
  });
  const hookPromise = Promise.resolve()
    .then(() => hook(msg))
    .then<Outcome>((decision) => ({ ok: true, decision }))
    .catch<Outcome>(() => ({ ok: false }));
  try {
    const outcome = await Promise.race([hookPromise, timeoutPromise]);
    if (outcome.ok) {
      succeeded = true;
      return outcome.decision;
    }
    return "allow";
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
    if (succeeded) {
      consecutiveChannelGateFailures = 0;
    } else {
      consecutiveChannelGateFailures += 1;
      if (consecutiveChannelGateFailures === PERSISTENT_FAILURE_LOG_THRESHOLD) {
        currentLog?.warn(
          `astroclaw beforeChannelSend has failed/timed out ${PERSISTENT_FAILURE_LOG_THRESHOLD}+ times in a row; channel sends are fail-open`,
        );
      }
    }
  }
}

/** Test-only helper to inspect the failure counter. */
export function _channelGateFailureCount(): number {
  return consecutiveChannelGateFailures;
}

const inactiveHandle = (events: ProliferationEvents): ProliferationHandle => ({
  shutdown: async () => {
    currentEvents = null;
    currentLog = null;
    events.removeAllListeners();
  },
  events,
});

/**
 * Optional astroclaw sidecar bootstrap.
 *
 * No-op when `cfg.proliferation.enabled` is absent or false. When enabled,
 * dynamically imports `@astroclaw/runtime` so gateways that don't install the
 * sidecar pay no cost. The adapter handed to the sidecar carries the
 * lifecycle event emitter and the channel-send-gate setter.
 *
 * Idempotent: if called while a previous sidecar is still live, the prior
 * sidecar is shut down before the new one starts. This protects against
 * double-init on hot config reload paths.
 */
export async function tryStartProliferation(params: {
  cfg: AstroclawConfig;
  log: { info: (msg: string) => void; warn: (msg: string) => void };
}): Promise<ProliferationHandle> {
  // Idempotency: tear down any pre-existing sidecar before starting fresh.
  if (currentSidecar) {
    try {
      await currentSidecar.shutdown();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      params.log.warn(`astroclaw/runtime stale-shutdown during re-init failed: ${msg}`);
    }
    currentSidecar = null;
    currentBeforeChannelSend = null;
    consecutiveChannelGateFailures = 0;
  }
  if (currentEvents) {
    currentEvents.removeAllListeners();
    currentEvents = null;
  }
  currentLog = params.log;
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
          currentLog = null;
          consecutiveChannelGateFailures = 0;
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
