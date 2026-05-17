import { describe, expect, it } from "vitest";
import { normalizePackageTagInput } from "./package-tag.js";

describe("normalizePackageTagInput", () => {
  const packageNames = ["astroclaw", "@astroclaw/plugin"] as const;

  it.each([
    { input: undefined, expected: null },
    { input: "   ", expected: null },
    { input: "astroclaw@beta", expected: "beta" },
    { input: "@astroclaw/plugin@2026.2.24", expected: "2026.2.24" },
    { input: "astroclaw@   ", expected: null },
    { input: "astroclaw", expected: null },
    { input: " @astroclaw/plugin ", expected: null },
    { input: " latest ", expected: "latest" },
    { input: "@other/plugin@beta", expected: "@other/plugin@beta" },
    { input: "astroclawer@beta", expected: "astroclawer@beta" },
  ] satisfies ReadonlyArray<{ input: string | undefined; expected: string | null }>)(
    "normalizes %j",
    ({ input, expected }) => {
      expect(normalizePackageTagInput(input, packageNames)).toBe(expected);
    },
  );
});
