// ask-sat gateway methods proxy the operator's corporeality question queue.
//
// The control UI cannot reach the ask-sat service directly: the bearer token
// must stay server-side. These handlers forward to the ask-sat HTTP API
// (ASKSAT_URL) with ASKSAT_TOKEN attached, so the browser only ever talks to
// the gateway over its authenticated WebSocket channel.
import { ErrorCodes, errorShape } from "../../../packages/gateway-protocol/src/index.js";
import type { GatewayRequestHandlers } from "./types.js";

const REQUEST_TIMEOUT_MS = 10_000;

type AskSatConfig = { base: string; token: string };

/** Resolve the ask-sat base URL + token from the environment, or null if unconfigured. */
function resolveAskSatConfig(): AskSatConfig | null {
  const base = (process.env.ASKSAT_URL ?? "").trim().replace(/\/+$/, "");
  if (!base) {
    return null;
  }
  return { base, token: (process.env.ASKSAT_TOKEN ?? "").trim() };
}

/** Fetch JSON from the ask-sat service with a bounded timeout and bearer auth. */
async function askSatFetch(
  config: AskSatConfig,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (config.token) {
      headers.Authorization = `Bearer ${config.token}`;
    }
    let body: string | undefined;
    if (init.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(init.body);
    }
    const res = await fetch(`${config.base}${path}`, {
      method: init.method,
      headers,
      body,
      signal: controller.signal,
    });
    const raw = await res.text();
    if (!res.ok) {
      throw new Error(`ask-sat HTTP ${res.status}: ${raw.slice(0, 200)}`);
    }
    return raw.trim() ? (JSON.parse(raw) as unknown) : null;
  } finally {
    clearTimeout(timer);
  }
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/** Gateway handlers proxying the ask-sat corporeality queue for the control UI. */
export const askSatHandlers: GatewayRequestHandlers = {
  "askSat.questions": async ({ respond }) => {
    const config = resolveAskSatConfig();
    if (!config) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, "ask-sat not configured (ASKSAT_URL unset)"),
      );
      return;
    }
    try {
      const result = await askSatFetch(config, "/api/questions", { method: "GET" });
      respond(true, result ?? { pending: [], answered: [] }, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `ask-sat questions read failed: ${String(err)}`),
      );
    }
  },
  "askSat.answer": async ({ params, respond }) => {
    const p = (params ?? {}) as { id?: unknown; value?: unknown; text?: unknown };
    const id = asNonEmptyString(p.id);
    if (!id) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "id required"));
      return;
    }
    const value = typeof p.value === "string" ? p.value : "";
    const text = typeof p.text === "string" ? p.text : "";
    const config = resolveAskSatConfig();
    if (!config) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, "ask-sat not configured (ASKSAT_URL unset)"),
      );
      return;
    }
    try {
      const result = await askSatFetch(config, "/api/answer", {
        method: "POST",
        body: { id, value, text },
      });
      respond(true, result ?? { ok: true }, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `ask-sat answer failed: ${String(err)}`),
      );
    }
  },
};
