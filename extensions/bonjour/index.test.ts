import assert from "node:assert/strict";
import { createTestPluginApi } from "astroclaw/plugin-sdk/plugin-test-api";
import { afterAll, describe, expect, it, vi } from "vitest";

type TestApi = ReturnType<typeof createTestPluginApi>;
type DiscoveryService = Parameters<TestApi["registerGatewayDiscoveryService"]>[0];

const mocks = vi.hoisted(() => ({
  advertiserModuleLoaded: vi.fn(),
  runtimeModuleLoaded: vi.fn(),
  startGatewayBonjourAdvertiser: vi.fn(async () => ({ stop: vi.fn() })),
  registerUncaughtExceptionHandler: vi.fn(),
  registerUnhandledRejectionHandler: vi.fn(),
}));

vi.mock("./src/advertiser.js", () => {
  mocks.advertiserModuleLoaded();
  return {
    startGatewayBonjourAdvertiser: mocks.startGatewayBonjourAdvertiser,
  };
});

vi.mock("astroclaw/plugin-sdk/runtime", () => {
  mocks.runtimeModuleLoaded();
  return {
    registerUncaughtExceptionHandler: mocks.registerUncaughtExceptionHandler,
    registerUnhandledRejectionHandler: mocks.registerUnhandledRejectionHandler,
  };
});

const { default: bonjourPlugin } = await import("./index.js");

function requireDiscoveryService(service: DiscoveryService | undefined): DiscoveryService {
  expect(service).toBeDefined();
  assert.notEqual(service, undefined, "expected bonjour plugin to register a discovery service");
  expect(service.id).toBe("bonjour");
  assert.equal(service.id, "bonjour", "expected bonjour discovery service id");
  return service;
}

function expectRuntimeNotLoaded(): void {
  expect(mocks.advertiserModuleLoaded).not.toHaveBeenCalled();
  expect(mocks.runtimeModuleLoaded).not.toHaveBeenCalled();
}

afterAll(() => {
  vi.doUnmock("./src/advertiser.js");
  vi.doUnmock("astroclaw/plugin-sdk/runtime");
  vi.resetModules();
});

describe("bonjour plugin entry", () => {
  it("lazy-loads advertiser runtime when gateway discovery advertises", async () => {
    let discoveryService: DiscoveryService | undefined;
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    const api = createTestPluginApi({
      logger,
      registerGatewayDiscoveryService(service) {
        discoveryService = service;
      },
    });

    expectRuntimeNotLoaded();

    bonjourPlugin.register(api);

    const registeredDiscoveryService = requireDiscoveryService(discoveryService);
    expectRuntimeNotLoaded();

    const stop = vi.fn();
    mocks.startGatewayBonjourAdvertiser.mockResolvedValueOnce({ stop });

    await expect(
      registeredDiscoveryService.advertise({
        machineDisplayName: "Dev Box",
        gatewayPort: 3210,
        gatewayTlsEnabled: true,
        gatewayTlsFingerprintSha256: "abc123",
        canvasPort: 9876,
        sshPort: 22,
        tailnetDns: "dev.tailnet.ts.net",
        cliPath: "/usr/local/bin/astroclaw",
        minimal: false,
      }),
    ).resolves.toEqual({ stop });

    expect(mocks.advertiserModuleLoaded).toHaveBeenCalledTimes(1);
    expect(mocks.runtimeModuleLoaded).toHaveBeenCalledTimes(1);
    expect(mocks.startGatewayBonjourAdvertiser).toHaveBeenCalledWith(
      {
        instanceName: "Dev Box (Astroclaw)",
        gatewayPort: 3210,
        gatewayTlsEnabled: true,
        gatewayTlsFingerprintSha256: "abc123",
        canvasPort: 9876,
        sshPort: 22,
        tailnetDns: "dev.tailnet.ts.net",
        cliPath: "/usr/local/bin/astroclaw",
        minimal: false,
      },
      {
        logger,
        registerUncaughtExceptionHandler: mocks.registerUncaughtExceptionHandler,
        registerUnhandledRejectionHandler: mocks.registerUnhandledRejectionHandler,
      },
    );
  });
});
