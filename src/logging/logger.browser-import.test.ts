// Logger browser import tests cover safe import behavior in browser-like runtimes.
import { importFreshModule } from "openclaw/plugin-sdk/test-fixtures";
import { afterEach, describe, expect, it, vi } from "vitest";

type LoggerModule = typeof import("./logger.js");

const originalGetBuiltinModule = (
  process as NodeJS.Process & { getBuiltinModule?: (id: string) => unknown }
).getBuiltinModule;

async function importBrowserSafeLogger(params?: {
  resolvePreferredAstroclawTmpDir?: ReturnType<typeof vi.fn>;
}): Promise<{
  module: LoggerModule;
  resolvePreferredAstroclawTmpDir: ReturnType<typeof vi.fn>;
}> {
  const resolvePreferredAstroclawTmpDir =
    params?.resolvePreferredAstroclawTmpDir ??
    vi.fn(() => {
      throw new Error("resolvePreferredAstroclawTmpDir should not run during browser-safe import");
    });

  vi.doMock("../infra/tmp-astroclaw-dir.js", async () => {
    const actual = await vi.importActual<typeof import("../infra/tmp-astroclaw-dir.js")>(
      "../infra/tmp-astroclaw-dir.js",
    );
    return {
      ...actual,
      resolvePreferredAstroclawTmpDir,
    };
  });

  Object.defineProperty(process, "getBuiltinModule", {
    configurable: true,
    value: undefined,
  });

  const module = await importFreshModule<LoggerModule>(
    import.meta.url,
    "./logger.js?scope=browser-safe",
  );
  return { module, resolvePreferredAstroclawTmpDir };
}

describe("logging/logger browser-safe import", () => {
  afterEach(() => {
    vi.doUnmock("../infra/tmp-astroclaw-dir.js");
    Object.defineProperty(process, "getBuiltinModule", {
      configurable: true,
      value: originalGetBuiltinModule,
    });
  });

  it("does not resolve the preferred temp dir at import time when node fs is unavailable", async () => {
    const { module, resolvePreferredAstroclawTmpDir } = await importBrowserSafeLogger();

    expect(resolvePreferredAstroclawTmpDir).not.toHaveBeenCalled();
    expect(module.DEFAULT_LOG_DIR).toBe("/tmp/openclaw");
    expect(module.DEFAULT_LOG_FILE).toBe("/tmp/openclaw/openclaw.log");
  });

  it("disables file logging when imported in a browser-like environment", async () => {
    const { module, resolvePreferredAstroclawTmpDir } = await importBrowserSafeLogger();

    expect(module.getResolvedLoggerSettings()).toStrictEqual({
      level: "silent",
      file: "/tmp/openclaw/openclaw.log",
      maxFileBytes: 100 * 1024 * 1024,
    });
    expect(module.isFileLogLevelEnabled("info")).toBe(false);
    expect(module.getLogger().info("browser-safe")).toBeUndefined();
    expect(resolvePreferredAstroclawTmpDir).not.toHaveBeenCalled();
  });
});
