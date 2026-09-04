import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  exports: Record<string, string>;
};

const packageJsonUrl = new URL("../package.json", import.meta.url);
const packageJsonPath = fileURLToPath(packageJsonUrl);
const manifest = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as PackageManifest;
const packageDir = fileURLToPath(new URL(".", packageJsonUrl));

describe("normalization-core package exports", () => {
  it("points every subpath export at its matching TypeScript source file", () => {
    for (const [subpath, target] of Object.entries(manifest.exports)) {
      const entryName = subpath === "." ? "index" : subpath.slice(2);
      // This package has no build step: exports resolve directly to src/*.ts
      // (consumed via tsx/vitest), unlike published packages that point at
      // compiled ./dist output.
      expect(target).toBe(`./src/${entryName}.ts`);
      expect(fs.existsSync(`${packageDir}${target.slice(2)}`)).toBe(true);
    }
  });
});
