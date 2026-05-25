// MCP federation endpoint: POST /mcp proxies JSON-RPC traffic into the
// in-process MCP loopback server. Enables cross-wing tool calls between
// sibling gateways (per wiki/concepts/siblings-as-nodes.md). Authenticates
// via PIRANESI_MCP_FEDERATION_TOKEN env var compared against the
// x-mcp-federation-token request header (operationally acceptable for an
// internal tailnet-only path; same model as the /internal/queue-depth
// endpoint).
//
// Security boundary:
//  - Method gate: POST only; other methods → 405.
//  - Token gate: PIRANESI_MCP_FEDERATION_TOKEN env var unset → 503
//    (fail-closed). Header missing/mismatched → 401.
//  - Body cap: 4 MiB inbound (loopback's own cap is the second wall).
//  - Loopback runtime resolved at request time; nonOwnerToken never
//    logged or echoed in responses (only forwarded as Authorization
//    Bearer header to the 127.0.0.1:<port>/mcp fetch).
//  - 60s AbortController timeout on the loopback fetch (MCP calls are
//    tool-bounded, not long-running streams).
//
// Migrated to astroclaw source from patch-mcp-federation.js 2026-05-25
// per Piranesi-Main DECIDE: A. The runtime patch's dynamic-import hash
// discovery (mcp-http-<hash>.js bundle filename) is gone — source can
// just import the helpers directly.

import type { IncomingMessage, ServerResponse } from "node:http";
import { ensureMcpLoopbackServer } from "./mcp-http.js";
import { getActiveMcpLoopbackRuntime } from "./mcp-http.loopback-runtime.js";

const MCP_FEDERATION_BODY_CAP_BYTES = 4 * 1024 * 1024;
const MCP_FEDERATION_TIMEOUT_MS = 60_000;
const MCP_FEDERATION_PATH = "/mcp";

function sendJsonRpcError(
  res: ServerResponse,
  statusCode: number,
  code: number,
  message: string,
): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code, message },
      id: null,
    }),
  );
}

async function readRequestBodyCapped(
  req: IncomingMessage,
  capBytes: number,
): Promise<{ chunks: Buffer[]; aborted: boolean; error?: Error }> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let bodyLen = 0;
    let settled = false;
    const finish = (result: { chunks: Buffer[]; aborted: boolean; error?: Error }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const onData = (chunk: Buffer) => {
      bodyLen += chunk.length;
      if (bodyLen > capBytes) {
        req.destroy();
        finish({ chunks: [], aborted: true });
        return;
      }
      chunks.push(chunk);
    };
    req.on("data", onData);
    req.once("end", () => finish({ chunks, aborted: false }));
    req.once("error", (error) => finish({ chunks: [], aborted: false, error }));
  });
}

async function resolveLoopback(): Promise<
  | { ok: true; runtime: { port: number; nonOwnerToken: string } }
  | { ok: false; reason: "unavailable" | "not-running" }
> {
  let runtime = getActiveMcpLoopbackRuntime();
  if (!runtime) {
    try {
      const server = await ensureMcpLoopbackServer();
      if (!server) {
        return { ok: false, reason: "unavailable" };
      }
    } catch {
      return { ok: false, reason: "unavailable" };
    }
    runtime = getActiveMcpLoopbackRuntime();
  }
  if (!runtime || typeof runtime.port !== "number" || !runtime.nonOwnerToken) {
    return { ok: false, reason: "not-running" };
  }
  return { ok: true, runtime: { port: runtime.port, nonOwnerToken: runtime.nonOwnerToken } };
}

/**
 * Returns true when the request was handled (response written), false to
 * fall through to the next stage. Mirrors the gateway-http request-stage
 * contract.
 */
export async function handleMcpFederationRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    sendJsonRpcError(res, 405, -32601, "POST required");
    return true;
  }
  const serverToken = process.env.PIRANESI_MCP_FEDERATION_TOKEN;
  if (!serverToken || serverToken.length < 16) {
    sendJsonRpcError(res, 503, -32603, "mcp federation not configured");
    return true;
  }
  const clientToken = req.headers["x-mcp-federation-token"];
  if (typeof clientToken !== "string" || clientToken !== serverToken) {
    sendJsonRpcError(res, 401, -32001, "unauthorized");
    return true;
  }
  const bodyResult = await readRequestBodyCapped(req, MCP_FEDERATION_BODY_CAP_BYTES);
  if (bodyResult.aborted) {
    if (!res.headersSent) {
      sendJsonRpcError(res, 413, -32600, "request body exceeds 4MiB cap");
    }
    return true;
  }
  if (bodyResult.error) {
    if (!res.headersSent) {
      sendJsonRpcError(res, 400, -32600, "invalid request");
    }
    return true;
  }
  const loopback = await resolveLoopback();
  if (!loopback.ok) {
    sendJsonRpcError(
      res,
      503,
      -32603,
      loopback.reason === "not-running" ? "mcp loopback not running" : "mcp loopback unavailable",
    );
    return true;
  }
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), MCP_FEDERATION_TIMEOUT_MS);
  let upstream: Response;
  try {
    upstream = await fetch(`http://127.0.0.1:${loopback.runtime.port}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${loopback.runtime.nonOwnerToken}`,
      },
      body: Buffer.concat(bodyResult.chunks),
      signal: abortController.signal,
    });
  } catch {
    clearTimeout(timer);
    sendJsonRpcError(res, 502, -32603, "mcp loopback fetch failed");
    return true;
  }
  res.statusCode = upstream.status;
  res.setHeader(
    "Content-Type",
    upstream.headers.get("content-type") || "application/json; charset=utf-8",
  );
  try {
    const buf = Buffer.from(await upstream.arrayBuffer());
    clearTimeout(timer);
    res.end(buf);
  } catch {
    clearTimeout(timer);
    if (!res.headersSent) {
      sendJsonRpcError(res, 502, -32603, "mcp loopback response failed");
    }
  }
  return true;
}

/** Path constant exported for the server-http requestStages registration. */
export const MCP_FEDERATION_PATH_ROUTE = MCP_FEDERATION_PATH;
