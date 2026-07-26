import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { collectPublishablePluginPackageErrors } from "../scripts/lib/plugin-npm-release.ts";

/**
 * Repo-wide guard against package-identity drift between the release validator and the
 * real extension package.json files. The fixture-based suite in plugin-npm-release.test.ts
 * cannot catch a validator that agrees with its own fixtures but disagrees with the repo.
 */
describe("plugin npm release package identity", () => {
  it("accepts the name and repository url every publishable extension actually declares", () => {
    const root = path.resolve(import.meta.dirname, "..");
    const extensionsDir = path.join(root, "extensions");
    const failures: string[] = [];
    let checked = 0;
    for (const extensionId of fs.readdirSync(extensionsDir)) {
      const packageJsonPath = path.join(extensionsDir, extensionId, "package.json");
      if (!fs.existsSync(packageJsonPath)) {
        continue;
      }
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      if (packageJson.astroclaw?.release?.publishToNpm !== true) {
        continue;
      }
      checked += 1;
      const readmePath = path.join(extensionsDir, extensionId, "README.md");
      const errors = collectPublishablePluginPackageErrors({
        extensionId,
        packageDir: path.join("extensions", extensionId),
        packageJson,
        readmeText: fs.existsSync(readmePath) ? fs.readFileSync(readmePath, "utf8") : "",
      } as never);
      for (const error of errors) {
        if (/package name must start with|repository\.url must be/u.test(error)) {
          failures.push(`${extensionId}: ${error}`);
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
    expect(failures).toEqual([]);
  });
});
