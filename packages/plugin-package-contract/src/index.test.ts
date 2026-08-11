// Plugin Package Contract tests cover index behavior.
import { describe, expect, it } from "vitest";
import {
  EXTERNAL_CODE_PLUGIN_REQUIRED_FIELD_PATHS,
  listMissingExternalCodePluginFieldPaths,
  normalizeExternalPluginCompatibility,
  pluginPackageMetadata,
  pluginPackageMetadataKey,
  validateExternalCodePluginPackageJson,
} from "./index.js";

describe("@astroclaw/plugin-package-contract", () => {
  it("normalizes the compatibility block for external plugins", () => {
    expect(
      normalizeExternalPluginCompatibility({
        version: "1.2.3",
        astroclaw: {
          compat: {
            pluginApi: ">=2026.3.24-beta.2",
            minGatewayVersion: "2026.3.24-beta.2",
          },
          build: {
            astroclawVersion: "2026.3.24-beta.2",
            pluginSdkVersion: "0.9.0",
          },
        },
      }),
    ).toEqual({
      pluginApiRange: ">=2026.3.24-beta.2",
      builtWithOpenClawVersion: "2026.3.24-beta.2",
      pluginSdkVersion: "0.9.0",
      minGatewayVersion: "2026.3.24-beta.2",
    });
  });

  it("falls back to install.minHostVersion and package version when compatible", () => {
    expect(
      normalizeExternalPluginCompatibility({
        version: "1.2.3",
        astroclaw: {
          compat: {
            pluginApi: ">=1.0.0",
          },
          install: {
            minHostVersion: "2026.3.24-beta.2",
          },
        },
      }),
    ).toEqual({
      pluginApiRange: ">=1.0.0",
      builtWithOpenClawVersion: "1.2.3",
      minGatewayVersion: "2026.3.24-beta.2",
    });
  });

  it("lists the required external code-plugin fields", () => {
    expect(EXTERNAL_CODE_PLUGIN_REQUIRED_FIELD_PATHS).toEqual([
      "astroclaw.compat.pluginApi",
      "astroclaw.build.astroclawVersion",
    ]);
  });

  it("reports missing required fields with stable field paths", () => {
    const packageJson = {
      astroclaw: {
        compat: {},
        build: {},
      },
    };

    expect(listMissingExternalCodePluginFieldPaths(packageJson)).toEqual([
      "astroclaw.compat.pluginApi",
      "astroclaw.build.astroclawVersion",
    ]);
    expect(validateExternalCodePluginPackageJson(packageJson).issues).toEqual([
      {
        fieldPath: "astroclaw.compat.pluginApi",
        message: "astroclaw.compat.pluginApi is required for external code plugin packages.",
      },
      {
        fieldPath: "astroclaw.build.astroclawVersion",
        message: "astroclaw.build.astroclawVersion is required for external code plugin packages.",
      },
    ]);
  });

  // The pre-rebrand key is a read-only migration shim for external plugin packages published
  // before the rename. These cases pin it so it cannot quietly stop working, and so a later
  // audit that wants to retire it has to delete an explicit expectation rather than discover
  // the breakage in a third-party install.
  describe("pre-rebrand metadata key", () => {
    it("still resolves compatibility for a legacy external package", () => {
      expect(
        normalizeExternalPluginCompatibility({
          version: "1.2.3",
          openclaw: {
            compat: { pluginApi: ">=1.0.0" },
            build: { openclawVersion: "2026.3.24-beta.2" },
          },
        }),
      ).toEqual({
        pluginApiRange: ">=1.0.0",
        builtWithOpenClawVersion: "2026.3.24-beta.2",
      });
    });

    it("accepts a legacy external package as contract-valid", () => {
      expect(
        validateExternalCodePluginPackageJson({
          openclaw: {
            compat: { pluginApi: ">=1.0.0" },
            build: { openclawVersion: "2026.3.24-beta.2" },
          },
        }).issues,
      ).toEqual([]);
    });

    it("prefers the canonical key when a package carries both", () => {
      const packageJson = {
        astroclaw: { compat: { pluginApi: ">=2.0.0" }, build: { astroclawVersion: "2.0.0" } },
        openclaw: { compat: { pluginApi: ">=1.0.0" }, build: { openclawVersion: "1.0.0" } },
      };
      expect(pluginPackageMetadata(packageJson)).toBe(packageJson.astroclaw);
      expect(pluginPackageMetadataKey(packageJson)).toBe("astroclaw");
      expect(normalizeExternalPluginCompatibility(packageJson)).toEqual({
        pluginApiRange: ">=2.0.0",
        builtWithOpenClawVersion: "2.0.0",
      });
    });

    it("writes back through the key the source already carries", () => {
      expect(pluginPackageMetadataKey({ openclaw: { compat: {} } })).toBe("openclaw");
      expect(pluginPackageMetadataKey({ astroclaw: { compat: {} } })).toBe("astroclaw");
      expect(pluginPackageMetadataKey({})).toBe("astroclaw");
    });

    it("ignores non-object metadata under either key", () => {
      expect(pluginPackageMetadata({ astroclaw: "nope", openclaw: "nope" })).toBeUndefined();
      expect(pluginPackageMetadata(undefined)).toBeUndefined();
      expect(pluginPackageMetadataKey({ astroclaw: "nope" })).toBe("astroclaw");
    });
  });
});
