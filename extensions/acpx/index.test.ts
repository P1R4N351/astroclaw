import { strict as assert } from "node:assert";
import type { AstroclawPluginApi } from "astroclaw/plugin-sdk/plugin-entry";
import { createTestPluginApi } from "astroclaw/plugin-sdk/plugin-test-api";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import setupPlugin from "./setup-api.js";

const { createAcpxRuntimeServiceMock, tryDispatchAcpReplyHookMock } = vi.hoisted(() => ({
  createAcpxRuntimeServiceMock: vi.fn(),
  tryDispatchAcpReplyHookMock: vi.fn(),
}));

vi.mock("./register.runtime.js", () => ({
  createAcpxRuntimeService: createAcpxRuntimeServiceMock,
}));

vi.mock("astroclaw/plugin-sdk/acp-runtime-backend", () => ({
  tryDispatchAcpReplyHook: tryDispatchAcpReplyHookMock,
}));

import plugin from "./index.js";

const MAX_REGISTERED_HOOKS = 8;

type AcpxAutoEnableProbe = Parameters<AstroclawPluginApi["registerAutoEnableProbe"]>[0];
type PluginOnMock = Mock<AstroclawPluginApi["on"]>;
type PluginRegisterServiceMock = Mock<AstroclawPluginApi["registerService"]>;

type ReplyCounts = {
  readonly tool: number;
  readonly block: number;
  readonly final: number;
};

type ReplyDispatchResult = {
  readonly handled: boolean;
  readonly queuedFinal: boolean;
  readonly counts: ReplyCounts;
};

type ReplyDispatchEvent = {
  readonly ctx: { readonly raw: string };
  readonly runId: string;
  readonly sessionKey: string;
  readonly inboundAudio: boolean;
  readonly shouldRouteToOriginating: boolean;
  readonly shouldSendToolSummaries: boolean;
  readonly sendPolicy: "allow";
};

type ReplyDispatchContext = {
  readonly cfg: Record<string, never>;
  readonly dispatcher: {
    readonly dispatch: Mock<() => void>;
    readonly getQueuedCounts: Mock<() => ReplyCounts>;
    readonly getFailedCounts: Mock<() => ReplyCounts>;
  };
  readonly recordProcessed: Mock<() => void>;
  readonly markIdle: Mock<() => void>;
};

type ReplyDispatchHook = (
  event: ReplyDispatchEvent,
  ctx: ReplyDispatchContext,
) => Promise<ReplyDispatchResult>;

type TestRuntimeService = {
  readonly id: "acpx-service";
  readonly start: Mock<() => void>;
};

function createRuntimeServiceFixture(): TestRuntimeService {
  const start = vi.fn<() => void>();
  assert.equal(typeof start, "function", "runtime service start must be callable");
  assert.equal(start.mock.calls.length, 0, "runtime service start mock must begin unused");
  return { id: "acpx-service", start };
}

function createReplyDispatchContextFixture(): ReplyDispatchContext {
  const dispatch = vi.fn<() => void>();
  const getQueuedCounts = vi.fn<() => ReplyCounts>();
  const getFailedCounts = vi.fn<() => ReplyCounts>();
  assert.equal(typeof dispatch, "function", "dispatcher dispatch must be callable");
  assert.equal(typeof getQueuedCounts, "function", "queued-count getter must be callable");
  return {
    cfg: {},
    dispatcher: { dispatch, getQueuedCounts, getFailedCounts },
    recordProcessed: vi.fn<() => void>(),
    markIdle: vi.fn<() => void>(),
  };
}

function registerAcpxAutoEnableProbe(): AcpxAutoEnableProbe {
  let probe: AcpxAutoEnableProbe | undefined;
  const api = createTestPluginApi({
    registerAutoEnableProbe(candidate) {
      assert.equal(typeof candidate, "function", "auto-enable probe must be callable");
      assert.equal(probe, undefined, "ACPX setup plugin must register one probe");
      probe = candidate;
    },
  });

  assert.equal(typeof setupPlugin.register, "function", "setup plugin register must be callable");
  assert.equal(typeof api.registerAutoEnableProbe, "function", "test API probe hook must exist");

  const registerResult = setupPlugin.register(api);
  assert.equal(registerResult, undefined, "setup plugin register must not return a value");
  assert.equal(typeof probe, "function", "ACPX setup plugin must register an auto-enable probe");
  return probe;
}

function getReplyDispatchHook(on: PluginOnMock): ReplyDispatchHook {
  const calls = on.mock.calls;
  assert.ok(calls.length > 0, "plugin must register at least one hook");
  assert.ok(calls.length <= MAX_REGISTERED_HOOKS, "registered hook count must stay bounded");

  let hook: unknown;
  for (let index = 0; index < MAX_REGISTERED_HOOKS; index += 1) {
    if (index >= calls.length) {
      break;
    }

    const call = calls[index];
    assert.ok(call, "registered hook call must exist");
    if (call[0] === "reply_dispatch") {
      hook = call[1];
      break;
    }
  }

  assert.equal(typeof hook, "function", "reply_dispatch hook must be callable");
  return hook as ReplyDispatchHook;
}

describe("acpx plugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assert.equal(createAcpxRuntimeServiceMock.mock.calls.length, 0, "runtime mock must be cleared");
    assert.equal(tryDispatchAcpReplyHookMock.mock.calls.length, 0, "reply hook mock must be cleared");
  });

  it("registers the runtime service and reply_dispatch hook", () => {
    const service = createRuntimeServiceFixture();
    const runtimeMock = createAcpxRuntimeServiceMock.mockReturnValue(service);
    const registerService: PluginRegisterServiceMock = vi.fn<AstroclawPluginApi["registerService"]>();
    const on: PluginOnMock = vi.fn<AstroclawPluginApi["on"]>();
    const api = createTestPluginApi({
      pluginConfig: { stateDir: "/tmp/acpx" },
      registerService,
      on,
    });

    assert.equal(runtimeMock, createAcpxRuntimeServiceMock, "mockReturnValue must return the mock");
    assert.equal(typeof plugin.register, "function", "plugin register must be callable");

    const registerResult = plugin.register(api);

    expect(registerResult).toBeUndefined();
    expect(createAcpxRuntimeServiceMock).toHaveBeenCalledWith({
      pluginConfig: api.pluginConfig,
    });
    expect(registerService).toHaveBeenCalledWith(service);
    expect(on).toHaveBeenCalledWith("reply_dispatch", tryDispatchAcpReplyHookMock);
  });

  it("preserves the ACP reply_dispatch runtime path through the registered hook", async () => {
    const service = createRuntimeServiceFixture();
    const runtimeMock = createAcpxRuntimeServiceMock.mockReturnValue(service);
    const hookMock = tryDispatchAcpReplyHookMock.mockResolvedValue({
      handled: true,
      queuedFinal: true,
      counts: { tool: 1, block: 0, final: 1 },
    } satisfies ReplyDispatchResult);
    const on: PluginOnMock = vi.fn<AstroclawPluginApi["on"]>();
    const api = createTestPluginApi({
      pluginConfig: { stateDir: "/tmp/acpx" },
      registerService: vi.fn<AstroclawPluginApi["registerService"]>(),
      on,
    });

    assert.equal(runtimeMock, createAcpxRuntimeServiceMock, "mockReturnValue must return the mock");
    assert.equal(hookMock, tryDispatchAcpReplyHookMock, "mockResolvedValue must return the mock");

    const registerResult = plugin.register(api);
    const hook = getReplyDispatchHook(on);
    const event: ReplyDispatchEvent = {
      ctx: { raw: "reply ctx" },
      runId: "run-1",
      sessionKey: "agent:test:session",
      inboundAudio: false,
      shouldRouteToOriginating: false,
      shouldSendToolSummaries: true,
      sendPolicy: "allow",
    };
    const ctx = createReplyDispatchContextFixture();

    expect(registerResult).toBeUndefined();
    await expect(hook(event, ctx)).resolves.toEqual({
      handled: true,
      queuedFinal: true,
      counts: { tool: 1, block: 0, final: 1 },
    });
    expect(tryDispatchAcpReplyHookMock).toHaveBeenCalledWith(event, ctx);
  });

  it("declares setup auto-enable reasons for ACPX-owned ACP config", () => {
    const probe = registerAcpxAutoEnableProbe();

    assert.equal(typeof probe, "function", "auto-enable probe must be callable");
    assert.equal(probe({ config: {}, env: {} }), null, "empty config must not enable ACPX");
    expect(probe({ config: { acp: { enabled: true } }, env: {} })).toBe("ACP runtime configured");
    expect(probe({ config: { acp: { backend: "acpx" } }, env: {} })).toBe("ACP runtime configured");
    expect(probe({ config: { acp: { enabled: true, backend: "custom-runtime" } }, env: {} })).toBe(
      null,
    );
  });
});
