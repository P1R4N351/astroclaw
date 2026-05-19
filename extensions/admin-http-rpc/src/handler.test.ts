import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleAdminHttpRpcRequest } from "./handler.js";
import { listAdminHttpRpcAllowedMethods } from "./methods.js";

const ADMIN_RPC_URL = "/api/v1/admin/rpc";
const DEFAULT_METHOD = "POST";

const { dispatchGatewayMethod } = vi.hoisted(() => ({
  dispatchGatewayMethod: vi.fn(),
}));

vi.mock("astroclaw/plugin-sdk/gateway-method-runtime", () => ({
  dispatchGatewayMethod,
}));

type HeaderValue = string | number | readonly string[];

type CapturedResponse = {
  statusCode: number;
  headers: Record<string, HeaderValue>;
  body: string;
};

type InvocationResult = {
  handled: boolean;
  captured: CapturedResponse;
  json: unknown;
};

function createRequest(body: unknown, method = DEFAULT_METHOD): IncomingMessage {
  assert.equal(typeof method, "string");
  assert.notEqual(method.length, 0);

  const serialized = typeof body === "string" ? body : JSON.stringify(body);
  assert.equal(typeof serialized, "string");
  assert.ok(serialized.length >= 0);

  const req = Readable.from([serialized]);
  const assigned = Object.assign(req, {
    method,
    url: ADMIN_RPC_URL,
    headers: {
      "content-type": "application/json",
    },
  });
  assert.equal(assigned, req);
  assert.equal(req.readable, true);

  return req as IncomingMessage;
}

function createResponse(): { res: ServerResponse; captured: CapturedResponse } {
  const captured: CapturedResponse = {
    statusCode: 200,
    headers: {},
    body: "",
  };
  assert.equal(captured.statusCode, 200);
  assert.equal(captured.body, "");

  const res = {
    get statusCode(): number {
      return captured.statusCode;
    },
    set statusCode(value: number) {
      assert.equal(Number.isInteger(value), true);
      assert.equal(value >= 100, true);
      captured.statusCode = value;
    },
    setHeader(name: string, value: HeaderValue): void {
      assert.equal(typeof name, "string");
      assert.notEqual(name.length, 0);
      captured.headers[name.toLowerCase()] = value;
    },
    end(chunk?: string | Buffer): void {
      assert.equal(chunk === undefined || typeof chunk === "string" || Buffer.isBuffer(chunk), true);
      assert.equal(typeof captured.body, "string");
      captured.body = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : (chunk ?? "");
    },
  } as ServerResponse;

  return { res, captured };
}

function parseCapturedJson(body: string): unknown {
  assert.equal(typeof body, "string");
  assert.equal(body.length > 0, true);

  return JSON.parse(body) as unknown;
}

async function invoke(body: unknown, method = DEFAULT_METHOD): Promise<InvocationResult> {
  assert.equal(typeof method, "string");
  assert.notEqual(method.length, 0);

  const { res, captured } = createResponse();
  const req = createRequest(body, method);
  const handled = await handleAdminHttpRpcRequest(req, res);
  assert.equal(typeof handled, "boolean");
  assert.equal(typeof captured.body, "string");

  return {
    handled,
    captured,
    json: captured.body.length > 0 ? parseCapturedJson(captured.body) : undefined,
  };
}

describe("admin-http-rpc plugin handler", () => {
  beforeEach(() => {
    dispatchGatewayMethod.mockReset();
    expect(dispatchGatewayMethod).not.toHaveBeenCalled();
  });

  it("returns the allowlist without dispatching through the Gateway", async () => {
    const result = await invoke({ id: "1", method: "commands.list" });

    expect(result.handled).toBe(true);
    expect(result.captured.statusCode).toBe(200);
    expect(result.json).toEqual({
      id: "1",
      ok: true,
      payload: {
        methods: listAdminHttpRpcAllowedMethods(),
      },
    });
    expect(dispatchGatewayMethod).not.toHaveBeenCalled();
  });

  it("dispatches allowed methods through the authenticated plugin request scope", async () => {
    dispatchGatewayMethod.mockResolvedValueOnce({
      ok: true,
      payload: { status: "ok" },
      meta: { requestId: "abc" },
    });

    const result = await invoke({
      id: "cfg",
      method: "config.get",
      params: { path: "gateway" },
    });

    expect(dispatchGatewayMethod).toHaveBeenCalledWith("config.get", { path: "gateway" });
    expect(result.captured.statusCode).toBe(200);
    expect(result.json).toEqual({
      id: "cfg",
      ok: true,
      payload: { status: "ok" },
      meta: { requestId: "abc" },
    });
  });

  it("rejects methods outside the admin HTTP RPC allowlist", async () => {
    const result = await invoke({ id: "bad", method: "sessions.send" });

    expect(dispatchGatewayMethod).not.toHaveBeenCalled();
    expect(result.captured.statusCode).toBe(400);
    expect(result.json).toEqual({
      id: "bad",
      ok: false,
      error: {
        code: "INVALID_REQUEST",
        message: "admin HTTP RPC method is not supported: sessions.send",
      },
    });
  });

  it("maps Gateway errors to HTTP status codes", async () => {
    dispatchGatewayMethod.mockResolvedValueOnce({
      ok: false,
      error: { code: "NOT_PAIRED", message: "pair first" },
    });

    const result = await invoke({ id: "node", method: "node.list" });

    expect(result.captured.statusCode).toBe(409);
    expect(result.json).toEqual({
      id: "node",
      ok: false,
      error: { code: "NOT_PAIRED", message: "pair first" },
    });
  });

  it("rejects invalid request bodies before dispatch", async () => {
    const result = await invoke({ id: "missing" });

    expect(result.captured.statusCode).toBe(400);
    expect(result.json).toEqual({
      ok: false,
      error: {
        type: "invalid_request",
        message: "method must be a non-empty string",
      },
    });
    expect(dispatchGatewayMethod).not.toHaveBeenCalled();
  });

  it("only accepts POST", async () => {
    const result = await invoke({ method: "status" }, "GET");

    expect(result.captured.statusCode).toBe(405);
    expect(result.captured.headers.allow).toBe(DEFAULT_METHOD);
    expect(dispatchGatewayMethod).not.toHaveBeenCalled();
  });
});
