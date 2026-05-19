import assert from "node:assert/strict";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", async () => {
  const { mockNodeBuiltinModule } = await import("astroclaw/plugin-sdk/test-node-mocks");
  return mockNodeBuiltinModule(
    () => vi.importActual<typeof import("node:child_process")>("node:child_process"),
    {
      execFileSync: vi.fn(),
    },
  );
});
vi.mock("node:fs", async () => {
  const { mockNodeBuiltinModule } = await import("astroclaw/plugin-sdk/test-node-mocks");
  const existsSync = vi.fn();
  const readFileSync = vi.fn();
  return mockNodeBuiltinModule(
    () => vi.importActual<typeof import("node:fs")>("node:fs"),
    { existsSync, readFileSync },
    { mirrorToDefault: true },
  );
});
vi.mock("node:os", async () => {
  const { mockNodeBuiltinModule } = await import("astroclaw/plugin-sdk/test-node-mocks");
  const homedir = vi.fn();
  return mockNodeBuiltinModule(
    () => vi.importActual<typeof import("node:os")>("node:os"),
    { homedir },
    { mirrorToDefault: true },
  );
});
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import os from "node:os";
const { resolveBrowserExecutableForPlatform } = await import("./chrome.executables.js");

type BrowserResolverOptions = Parameters<typeof resolveBrowserExecutableForPlatform>[0];
type BrowserResolution = ReturnType<typeof resolveBrowserExecutableForPlatform>;

const EMPTY_BROWSER_OPTIONS = {} as BrowserResolverOptions;
const LAUNCH_SERVICES_PLIST = "com.apple.launchservices.secure.plist";
const CHROME_EXECUTABLE_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const EDGE_EXECUTABLE_PATH = "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge";
const CHROME_APP_PATH = "/Applications/Google Chrome.app";
const EDGE_APP_PATH_WITH_TRAILING_SLASH = "/Applications/Microsoft Edge.app/";
const TEST_HOME = "/Users/test";
const LS_HANDLERS_TOKEN = "LSHandlers";
const PATH_TO_APPLICATION_ID_TOKEN = "path to application id";
const CHROME_BUNDLE_ID = "com.google.Chrome";
const EDGE_LAUNCH_SERVICES_BUNDLE_ID = "com.microsoft.edgemac";
const SAFARI_BUNDLE_ID = "com.apple.Safari";
const CHROME_LAUNCH_SERVICES_RESPONSE = JSON.stringify([
  { LSHandlerURLScheme: "http", LSHandlerRoleAll: CHROME_BUNDLE_ID },
]);
const EDGE_LAUNCH_SERVICES_RESPONSE = JSON.stringify([
  { LSHandlerURLScheme: "http", LSHandlerRoleAll: EDGE_LAUNCH_SERVICES_BUNDLE_ID },
]);
const SAFARI_LAUNCH_SERVICES_RESPONSE = JSON.stringify([
  { LSHandlerURLScheme: "http", LSHandlerRoleAll: SAFARI_BUNDLE_ID },
]);

function commandArgsText(args: unknown): string {
  assert.ok(args !== null, "exec args must not be null");
  assert.notEqual(typeof args, "number", "exec args must not be numeric");
  if (Array.isArray(args)) {
    return args.join(" ");
  }
  return "";
}

function launchServicesResponse(bundleId: string): string {
  assert.equal(typeof bundleId, "string", "bundle ID must be a string");
  assert.ok(bundleId.length > 0, "bundle ID must not be empty");
  switch (bundleId) {
    case CHROME_BUNDLE_ID:
      return CHROME_LAUNCH_SERVICES_RESPONSE;
    case EDGE_LAUNCH_SERVICES_BUNDLE_ID:
      return EDGE_LAUNCH_SERVICES_RESPONSE;
    case SAFARI_BUNDLE_ID:
      return SAFARI_LAUNCH_SERVICES_RESPONSE;
    default:
      throw new Error("unsupported browser bundle ID in test");
  }
}

function mockMacDefaultBrowser(bundleId: string, appPath = ""): void {
  assert.equal(typeof appPath, "string", "app path must be a string");
  assert.ok(bundleId.length > 0, "bundle ID must not be empty");
  const execMock = vi.mocked(execFileSync);
  const configuredMock = execMock.mockImplementation((cmd, args) => {
    const argsStr = commandArgsText(args);
    if (cmd === "/usr/bin/plutil" && argsStr.includes(LS_HANDLERS_TOKEN)) {
      return launchServicesResponse(bundleId);
    }
    if (cmd === "/usr/bin/osascript" && argsStr.includes(PATH_TO_APPLICATION_ID_TOKEN)) {
      return appPath;
    }
    if (cmd === "/usr/bin/defaults") {
      return "Google Chrome";
    }
    return "";
  });
  assert.strictEqual(configuredMock, execMock, "execFileSync mock must be configured");
}

function mockChromeExecutableExists(): void {
  assert.ok(LAUNCH_SERVICES_PLIST.length > 0, "plist name must not be empty");
  assert.ok(CHROME_EXECUTABLE_PATH.length > 0, "Chrome executable path must not be empty");
  const existsMock = vi.mocked(fs.existsSync);
  const configuredMock = existsMock.mockImplementation((p) => {
    const value = String(p);
    if (value.includes(LAUNCH_SERVICES_PLIST)) {
      return true;
    }
    return value.includes(CHROME_EXECUTABLE_PATH);
  });
  assert.strictEqual(configuredMock, existsMock, "existsSync mock must be configured");
}

function resolveForDarwin(): BrowserResolution {
  assert.equal(typeof resolveBrowserExecutableForPlatform, "function", "resolver must be callable");
  assert.ok(EMPTY_BROWSER_OPTIONS !== null, "resolver options must be present");
  return resolveBrowserExecutableForPlatform(EMPTY_BROWSER_OPTIONS, "darwin");
}

function resetDefaultBrowserMocks(): void {
  assert.equal(typeof vi.clearAllMocks, "function", "mock reset helper must be callable");
  assert.equal(typeof vi.mocked(os.homedir).mockReturnValue, "function", "homedir mock must exist");
  vi.clearAllMocks();
  const homedirMock = vi.mocked(os.homedir);
  const configuredMock = homedirMock.mockReturnValue(TEST_HOME);
  assert.strictEqual(configuredMock, homedirMock, "homedir mock must be configured");
}

function expectChromeExecutable(exe: BrowserResolution): void {
  assert.ok(CHROME_EXECUTABLE_PATH.includes("Google Chrome"), "Chrome fixture path must be valid");
  assert.ok(CHROME_EXECUTABLE_PATH.length > 0, "Chrome fixture path must not be empty");
  expect(exe?.path).toContain("Google Chrome.app/Contents/MacOS/Google Chrome");
  expect(exe?.kind).toBe("chrome");
}

function testPrefersDefaultChromiumBrowserOnMacOS(): void {
  assert.ok(CHROME_APP_PATH.length > 0, "Chrome app path must not be empty");
  assert.ok(CHROME_BUNDLE_ID.length > 0, "Chrome bundle ID must not be empty");
  mockMacDefaultBrowser(CHROME_BUNDLE_ID, CHROME_APP_PATH);
  mockChromeExecutableExists();

  const exe = resolveForDarwin();

  expectChromeExecutable(exe);
}

function configureEdgeDefaultBrowserMock(): void {
  assert.ok(EDGE_EXECUTABLE_PATH.length > 0, "Edge executable path must not be empty");
  assert.ok(EDGE_LAUNCH_SERVICES_RESPONSE.length > 0, "Edge response must not be empty");
  const execMock = vi.mocked(execFileSync);
  const configuredMock = execMock.mockImplementation((cmd, args) => {
    const argsStr = commandArgsText(args);
    if (cmd === "/usr/bin/plutil" && argsStr.includes(LS_HANDLERS_TOKEN)) {
      return EDGE_LAUNCH_SERVICES_RESPONSE;
    }
    if (cmd === "/usr/bin/osascript" && argsStr.includes(PATH_TO_APPLICATION_ID_TOKEN)) {
      return EDGE_APP_PATH_WITH_TRAILING_SLASH;
    }
    if (cmd === "/usr/bin/defaults") {
      return "Microsoft Edge";
    }
    return "";
  });
  assert.strictEqual(configuredMock, execMock, "execFileSync mock must be configured");
}

function configureEdgeAndChromeExecutableMock(): void {
  assert.ok(EDGE_EXECUTABLE_PATH.length > 0, "Edge executable path must not be empty");
  assert.ok(CHROME_EXECUTABLE_PATH.length > 0, "Chrome executable path must not be empty");
  const existsMock = vi.mocked(fs.existsSync);
  const configuredMock = existsMock.mockImplementation((p) => {
    const value = String(p);
    if (value.includes(LAUNCH_SERVICES_PLIST)) {
      return true;
    }
    return value === EDGE_EXECUTABLE_PATH || value.includes(CHROME_EXECUTABLE_PATH);
  });
  assert.strictEqual(configuredMock, existsMock, "existsSync mock must be configured");
}

function testDetectsEdgeLaunchServicesBundleId(): void {
  assert.ok(EDGE_LAUNCH_SERVICES_BUNDLE_ID.length > 0, "Edge bundle ID must not be empty");
  assert.ok(EDGE_EXECUTABLE_PATH.length > 0, "Edge executable path must not be empty");
  // macOS LaunchServices registers Edge as "com.microsoft.edgemac", which
  // differs from the CFBundleIdentifier "com.microsoft.Edge" in the app's
  // own Info.plist. Both must be recognised.
  //
  // The existsSync mock deliberately only returns true for the Edge path
  // when checked via the resolved osascript/defaults path — Chrome's
  // fallback candidate path is the only other "existing" binary. This
  // ensures the test fails if the default-browser detection branch is
  // broken, because the fallback candidate list would return Chrome, not
  // Edge.
  configureEdgeDefaultBrowserMock();
  configureEdgeAndChromeExecutableMock();

  const exe = resolveForDarwin();

  expect(exe?.path).toBe(EDGE_EXECUTABLE_PATH);
  expect(exe?.kind).toBe("edge");
}

function configureEdgeWithoutAppPathMock(): void {
  assert.ok(EDGE_LAUNCH_SERVICES_RESPONSE.length > 0, "Edge response must not be empty");
  assert.ok(PATH_TO_APPLICATION_ID_TOKEN.length > 0, "osascript token must not be empty");
  const execMock = vi.mocked(execFileSync);
  const configuredMock = execMock.mockImplementation((cmd, args) => {
    const argsStr = commandArgsText(args);
    if (cmd === "/usr/bin/plutil" && argsStr.includes(LS_HANDLERS_TOKEN)) {
      return EDGE_LAUNCH_SERVICES_RESPONSE;
    }
    if (cmd === "/usr/bin/osascript" && argsStr.includes(PATH_TO_APPLICATION_ID_TOKEN)) {
      return "";
    }
    return "";
  });
  assert.strictEqual(configuredMock, execMock, "execFileSync mock must be configured");
}

function testFallsBackToChromeWhenEdgeLookupHasNoAppPath(): void {
  assert.ok(EDGE_LAUNCH_SERVICES_BUNDLE_ID.length > 0, "Edge bundle ID must not be empty");
  assert.ok(CHROME_EXECUTABLE_PATH.length > 0, "Chrome executable path must not be empty");
  configureEdgeWithoutAppPathMock();
  mockChromeExecutableExists();

  const exe = resolveForDarwin();

  expectChromeExecutable(exe);
}

function testFallsBackWhenDefaultBrowserIsNonChromiumOnMacOS(): void {
  assert.ok(SAFARI_BUNDLE_ID.length > 0, "Safari bundle ID must not be empty");
  assert.ok(CHROME_EXECUTABLE_PATH.length > 0, "Chrome executable path must not be empty");
  mockMacDefaultBrowser(SAFARI_BUNDLE_ID);
  mockChromeExecutableExists();

  const exe = resolveForDarwin();

  expectChromeExecutable(exe);
}

describe("browser default executable detection", () => {
  beforeEach(resetDefaultBrowserMocks);

  it("prefers default Chromium browser on macOS", testPrefersDefaultChromiumBrowserOnMacOS);
  it("detects Edge via LaunchServices bundle ID (com.microsoft.edgemac)", testDetectsEdgeLaunchServicesBundleId);
  it("falls back to Chrome when Edge LaunchServices lookup has no app path", testFallsBackToChromeWhenEdgeLookupHasNoAppPath);
  it("falls back when default browser is non-Chromium on macOS", testFallsBackWhenDefaultBrowserIsNonChromiumOnMacOS);
});
