import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PluginLoadOptions } from "../loader.js";

const loadConfigMock = vi.fn();
const applyPluginAutoEnableMock = vi.fn();
const loadAstroclawPluginsMock = vi.fn();

let loadPluginMetadataRegistrySnapshot: typeof import("./metadata-registry-loader.js").loadPluginMetadataRegistrySnapshot;

vi.mock("../../config/config.js", () => ({
  getRuntimeConfig: () => loadConfigMock(),
  loadConfig: () => loadConfigMock(),
}));

vi.mock("../../config/plugin-auto-enable.js", () => ({
  applyPluginAutoEnable: (...args: unknown[]) => applyPluginAutoEnableMock(...args),
}));

vi.mock("../loader.js", () => ({
  loadAstroclawPlugins: (...args: unknown[]) => loadAstroclawPluginsMock(...args),
}));

vi.mock("../../agents/agent-scope.js", () => ({
  resolveAgentWorkspaceDir: () => "/resolved-workspace",
  resolveDefaultAgentId: () => "default",
}));

function getOnlyLoadAstroclawPluginsOptions(): PluginLoadOptions {
  expect(loadAstroclawPluginsMock).toHaveBeenCalledTimes(1);
  const options = loadAstroclawPluginsMock.mock.calls[0]?.[0];
  if (!options || typeof options !== "object") {
    throw new Error("expected loadAstroclawPlugins to receive plugin load options");
  }
  return options as PluginLoadOptions;
}

describe("loadPluginMetadataRegistrySnapshot", () => {
  beforeAll(async () => {
    ({ loadPluginMetadataRegistrySnapshot } = await import("./metadata-registry-loader.js"));
  });

  beforeEach(() => {
    loadConfigMock.mockReset();
    applyPluginAutoEnableMock.mockReset();
    loadAstroclawPluginsMock.mockReset();
    loadConfigMock.mockReturnValue({ plugins: {} });
    applyPluginAutoEnableMock.mockImplementation((params: { config: unknown }) => ({
      config: params.config,
      changes: [],
      autoEnabledReasons: {},
    }));
    loadAstroclawPluginsMock.mockReturnValue({ plugins: [], diagnostics: [] });
  });

  it("defaults to a non-activating validate snapshot", () => {
    loadPluginMetadataRegistrySnapshot({
      config: { plugins: {} },
      activationSourceConfig: { plugins: { allow: ["demo"] } },
      env: { HOME: "/tmp/astroclaw-home" } as NodeJS.ProcessEnv,
      workspaceDir: "/workspace",
      onlyPluginIds: ["demo"],
    });

    const loadOptions = getOnlyLoadAstroclawPluginsOptions();
    expect(loadOptions).toEqual({
      config: { plugins: {} },
      activationSourceConfig: { plugins: { allow: ["demo"] } },
      autoEnabledReasons: {},
      workspaceDir: "/workspace",
      env: { HOME: "/tmp/astroclaw-home" },
      logger: loadOptions.logger,
      throwOnLoadError: true,
      cache: false,
      activate: false,
      mode: "validate",
      loadModules: undefined,
      onlyPluginIds: ["demo"],
    });
  });

  it("forwards explicit manifest-only requests", () => {
    loadPluginMetadataRegistrySnapshot({
      config: { plugins: {} },
      loadModules: false,
    });

    const loadOptions = getOnlyLoadAstroclawPluginsOptions();
    expect(loadOptions).toEqual({
      config: { plugins: {} },
      activationSourceConfig: { plugins: {} },
      autoEnabledReasons: {},
      workspaceDir: "/resolved-workspace",
      env: loadOptions.env,
      logger: loadOptions.logger,
      throwOnLoadError: true,
      cache: false,
      activate: false,
      mode: "validate",
      loadModules: false,
    });
  });

  it("forwards an explicit logger through metadata snapshots", () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    loadPluginMetadataRegistrySnapshot({
      config: { plugins: {} },
      logger,
      workspaceDir: "/workspace",
    });

    expect(getOnlyLoadAstroclawPluginsOptions()).toEqual({
      config: { plugins: {} },
      activationSourceConfig: { plugins: {} },
      autoEnabledReasons: {},
      workspaceDir: "/workspace",
      env: process.env,
      logger,
      throwOnLoadError: true,
      cache: false,
      activate: false,
      mode: "validate",
      loadModules: undefined,
    });
  });

  it("honors explicit load options when reusing a resolved runtime context", () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const env = { HOME: "/tmp/context-home" } as NodeJS.ProcessEnv;
    const manifestRegistry = { plugins: [], diagnostics: [] };

    loadPluginMetadataRegistrySnapshot({
      config: { plugins: { allow: ["compat-provider"] } },
      activationSourceConfig: { plugins: { allow: ["raw-plugin"] } },
      workspaceDir: "/compat-workspace",
      env,
      logger,
      manifestRegistry,
      runtimeContext: {
        rawConfig: { plugins: { allow: ["raw-plugin"] } },
        config: { plugins: { allow: ["raw-plugin"] } },
        activationSourceConfig: { plugins: { allow: ["raw-plugin"] } },
        autoEnabledReasons: {},
        workspaceDir: "/context-workspace",
        env,
        logger,
      },
    });

    expect(applyPluginAutoEnableMock).not.toHaveBeenCalled();
    expect(getOnlyLoadAstroclawPluginsOptions()).toEqual({
      config: { plugins: { allow: ["compat-provider"] } },
      activationSourceConfig: { plugins: { allow: ["raw-plugin"] } },
      autoEnabledReasons: {},
      workspaceDir: "/compat-workspace",
      env,
      logger,
      throwOnLoadError: true,
      cache: false,
      activate: false,
      mode: "validate",
      loadModules: undefined,
      manifestRegistry,
    });
  });

  it("preserves explicit empty plugin scopes on metadata snapshots", () => {
    loadPluginMetadataRegistrySnapshot({
      config: { plugins: {} },
      onlyPluginIds: [],
    });

    const loadOptions = getOnlyLoadAstroclawPluginsOptions();
    expect(loadOptions).toEqual({
      config: { plugins: {} },
      activationSourceConfig: { plugins: {} },
      autoEnabledReasons: {},
      workspaceDir: "/resolved-workspace",
      env: loadOptions.env,
      logger: loadOptions.logger,
      throwOnLoadError: true,
      cache: false,
      activate: false,
      mode: "validate",
      loadModules: undefined,
      onlyPluginIds: [],
    });
  });
});
