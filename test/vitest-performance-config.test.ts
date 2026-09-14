// Vitest performance config tests validate performance test project setup.
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadVitestPerformanceConfig } from "./vitest/vitest.performance-config.ts";

describe("loadVitestPerformanceConfig", () => {
  it("enables the filesystem module cache by default", () => {
    expect(loadVitestPerformanceConfig({}, "linux")).toEqual({
      fsModuleCache: true,
      fsModuleCachePath: path.join(process.cwd(), ".cache", "vitest", "default"),
    });
  });

  it("enables the filesystem module cache explicitly", () => {
    expect(
      loadVitestPerformanceConfig(
        {
          OPENCLAW_VITEST_FS_MODULE_CACHE: "1",
        },
        "linux",
      ),
    ).toEqual({
      fsModuleCache: true,
      fsModuleCachePath: path.join(process.cwd(), ".cache", "vitest", "default"),
    });
  });

  it("passes through the filesystem module cache path when provided", () => {
    expect(
      loadVitestPerformanceConfig(
        {
          OPENCLAW_VITEST_FS_MODULE_CACHE_PATH: "/tmp/openclaw-vitest-cache",
        },
        "linux",
      ),
    ).toEqual({
      fsModuleCache: true,
      fsModuleCachePath: "/tmp/openclaw-vitest-cache",
    });
  });

  it("disables the filesystem module cache by default on Windows", () => {
    expect(loadVitestPerformanceConfig({}, "win32")).toStrictEqual({});
  });

  it("still allows enabling the filesystem module cache explicitly on Windows", () => {
    expect(
      loadVitestPerformanceConfig(
        {
          OPENCLAW_VITEST_FS_MODULE_CACHE: "1",
        },
        "win32",
      ),
    ).toEqual({
      fsModuleCache: true,
      fsModuleCachePath: path.join(process.cwd(), ".cache", "vitest", "default"),
    });
  });

  it("allows disabling the filesystem module cache explicitly", () => {
    expect(
      loadVitestPerformanceConfig(
        {
          OPENCLAW_VITEST_FS_MODULE_CACHE: "0",
        },
        "linux",
      ),
    ).toStrictEqual({});
  });

  it("enables import timing output and import breakdown reporting", () => {
    expect(
      loadVitestPerformanceConfig(
        {
          OPENCLAW_VITEST_IMPORT_DURATIONS: "true",
          OPENCLAW_VITEST_PRINT_IMPORT_BREAKDOWN: "1",
        },
        "linux",
      ),
    ).toEqual({
      fsModuleCache: true,
      fsModuleCachePath: path.join(process.cwd(), ".cache", "vitest", "default"),
      experimental: {
        importDurations: { print: true },
        printImportBreakdown: true,
      },
    });
  });

  it("uses RUNNER_OS to detect Windows even when the platform is not win32", () => {
    expect(loadVitestPerformanceConfig({ RUNNER_OS: "Windows" }, "linux")).toStrictEqual({});
  });
});
