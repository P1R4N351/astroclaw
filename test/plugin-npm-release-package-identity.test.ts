import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  collectPublishablePluginPackageErrors,
  collectPublishablePluginPackages,
} from "../scripts/lib/plugin-npm-release.ts";

/**
 * Repo-wide guard against package-identity drift between the release tooling and the real
 * extension package.json files.
 *
 * The fixture-based suites in plugin-npm-release.test.ts author their own package.json blobs, so
 * they cannot catch a validator that agrees with its own fixtures but disagrees with the repo.
 * That is exactly the defect this file exists for: the publication gate read a metadata key that
 * no shipped manifest declares, so it selected zero packages, validated nothing, and reported
 * success. A silent no-op is indistinguishable from a green release, which is why every
 * expectation below is derived from the real `extensions/` tree rather than from fixtures, and
 * why the expectations are computed independently of the code under test.
 */

type ExtensionManifest = {
  astroclaw?: { release?: { publishToNpm?: unknown } };
};

/** Extension ids whose shipped manifest opts in to npm publication. */
function readPublishableExtensionIds(extensionsDir: string): string[] {
  const ids: string[] = [];
  for (const extensionId of fs.readdirSync(extensionsDir).toSorted()) {
    const packageJsonPath = path.join(extensionsDir, extensionId, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      continue;
    }
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as ExtensionManifest;
    if (packageJson.astroclaw?.release?.publishToNpm === true) {
      ids.push(extensionId);
    }
  }
  return ids;
}

/** Read `extensions/<id>/README.md`, or "" when the package ships without one. */
function readPackageReadme(extensionsDir: string, extensionId: string): string {
  const readmePath = path.join(extensionsDir, extensionId, "README.md");
  return fs.existsSync(readmePath) ? fs.readFileSync(readmePath, "utf8") : "";
}

/**
 * A publishable package still needs documentation to pass validation. That is a separate,
 * genuine content gap (22 of 30 publishable extensions ship no README.md as of 2026-08-11),
 * tracked apart from the metadata-key drift this suite guards. Deriving the expectation this way
 * means the selection assertion widens on its own as READMEs land, instead of needing an edit.
 */
function isDocumented(extensionsDir: string, extensionId: string): boolean {
  return readPackageReadme(extensionsDir, extensionId).trim().length > 0;
}

describe("plugin npm release package identity", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const extensionsDir = path.join(root, "extensions");

  it("selects the extensions whose shipped manifest opts in to npm publication", () => {
    const expected = readPublishableExtensionIds(extensionsDir).filter((extensionId) =>
      isDocumented(extensionsDir, extensionId),
    );
    // Denominator guard: an empty expectation would make the comparison vacuously true, which is
    // the same silent-pass failure mode this suite exists to catch.
    expect(expected.length).toBeGreaterThan(0);

    // Selection is filtered to the documented set on purpose. collectPublishablePluginPackages is
    // all-or-nothing: any candidate with a validation error aborts the whole call, so an
    // unfiltered call currently throws on the 22 undocumented packages and would report the
    // README gap rather than the metadata-key behaviour under test. Filtering skips candidates
    // before validation, which keeps this assertion pointed at the publication gate itself.
    const selected = collectPublishablePluginPackages(root, { extensionIds: expected })
      .map((plugin) => plugin.extensionId)
      .toSorted();
    expect(selected).toEqual(expected);
  });

  it("rejects no publishable extension for package-identity or metadata-key reasons", () => {
    const publishable = readPublishableExtensionIds(extensionsDir);
    expect(publishable.length).toBeGreaterThan(0);

    const failures: string[] = [];
    for (const extensionId of publishable) {
      const packageDir = path.join(extensionsDir, extensionId);
      const errors = collectPublishablePluginPackageErrors({
        extensionId,
        packageDir: path.join("extensions", extensionId),
        packageJson: JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8")),
        readmeText: readPackageReadme(extensionsDir, extensionId),
      });
      for (const error of errors) {
        // Pin the residual to the one known, separately tracked gap rather than allow-listing the
        // categories under test. An allow-list would let a brand new rejection class pass unseen;
        // this way any error that is not the documented README gap fails the suite.
        if (error.startsWith("README.md must exist")) {
          continue;
        }
        failures.push(`${extensionId}: ${error}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
