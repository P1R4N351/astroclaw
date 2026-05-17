/**
 * Engine import boundary test.
 *
 * Ensures that engine/ sources only import from `astroclaw/plugin-sdk/*`
 * and never reach into other astroclaw internals directly.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ENGINE_DIR = path.resolve(import.meta.dirname);

/** Recursively collect all non-test .ts files under a directory. */
function walkSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") {
        continue;
      }
      walkSourceFiles(fullPath, files);
      continue;
    }
    if (
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".spec.ts")
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Extract all `astroclaw/...` import specifiers from source text.
 * Matches: import ... from "astroclaw/...", import("astroclaw/...")
 */
function findAstroclawImports(source: string): string[] {
  return [
    ...source.matchAll(/from\s+["'](astroclaw\/[^"']+)["']/g),
    ...source.matchAll(/import\(\s*["'](astroclaw\/[^"']+)["']\s*\)/g),
  ].map((match) => match[1]);
}

/** Check if an import specifier is an allowed astroclaw/plugin-sdk subpath. */
const ALLOWED_PREFIX = ["astroclaw", "plugin-sdk"].join("/");
function isAllowedImport(specifier: string): boolean {
  return specifier.startsWith(ALLOWED_PREFIX);
}

describe("engine import boundary", () => {
  it("only imports from astroclaw/plugin-sdk, never from other astroclaw internals", () => {
    const sourceFiles = walkSourceFiles(ENGINE_DIR);
    const offenders: Array<{ file: string; imports: string[] }> = [];

    for (const file of sourceFiles) {
      const source = fs.readFileSync(file, "utf8");
      const astroclawImports = findAstroclawImports(source);
      const forbidden = astroclawImports.filter((specifier) => !isAllowedImport(specifier));

      if (forbidden.length > 0) {
        offenders.push({
          file: path.relative(ENGINE_DIR, file),
          imports: forbidden,
        });
      }
    }

    expect(offenders).toStrictEqual([]);
  });
});
