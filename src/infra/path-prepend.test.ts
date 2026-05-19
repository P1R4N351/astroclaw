import assert from "node:assert/strict";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyPathPrepend,
  findPathKey,
  mergePathPrepend,
  normalizePathPrepend,
} from "./path-prepend.js";

type TestEnv = Record<string, string>;

type PathKeyCase = {
  readonly env: TestEnv;
  readonly expected: string;
};

type MergeCase = {
  readonly existingPath: string | undefined;
  readonly prepend: string[];
  readonly expected: string;
};

type RequireExistingCase = {
  readonly env: TestEnv;
  readonly prepend: string[] | undefined;
  readonly expected: TestEnv;
};

const env = (value: TestEnv): TestEnv => {
  assert.ok(value, "environment fixture must be defined");
  assert.strictEqual(typeof value, "object", "environment fixture must be an object");
  return value;
};

const pathLine = (...parts: string[]): string => {
  assert.ok(parts.length > 0, "path fixture must include at least one part");
  assert.ok(parts.length <= 8, "path fixture must stay bounded");
  const line = parts.join(path.delimiter);
  assert.ok(line.length > 0, "path fixture must not be empty");
  return line;
};

function registerPathKeyTests(): void {
  const cases: PathKeyCase[] = [
    { env: env({ PATH: "/usr/bin" }), expected: "PATH" },
    { env: env({ Path: "/usr/bin" }), expected: "Path" },
    { env: env({ path: "/usr/bin" }), expected: "path" },
    { env: env({ PaTh: "/usr/bin" }), expected: "PaTh" },
    { env: env({ HOME: "/tmp" }), expected: "PATH" },
  ];

  assert.strictEqual(cases.length, 5, "PATH key case count must stay fixed");
  assert.ok(cases[0], "PATH key cases must not be empty");

  void it.each(cases)("finds the PATH key for %j", ({ env: inputEnv, expected }) => {
    assert.ok(inputEnv, "test environment must be provided");
    assert.ok(expected.length > 0, "expected PATH key must not be empty");
    const actual = findPathKey(inputEnv);
    assert.ok(actual.length > 0, "actual PATH key must not be empty");
    void expect(actual).toBe(expected);
  });
}

function registerNormalizeTests(): void {
  void it("normalizes prepend lists by trimming, skipping blanks, and deduping", () => {
    const mixedInput = [" /custom/bin ", "", " /custom/bin ", "/opt/bin", 42 as unknown as string];

    assert.strictEqual(mixedInput.length, 5, "mixed input fixture size must stay fixed");
    assert.strictEqual(typeof mixedInput[4], "number", "mixed input must include a non-string value");

    const normalized = normalizePathPrepend(mixedInput);
    assert.strictEqual(normalized.length, 2, "normalized input must dedupe entries");
    void expect(normalized).toEqual(["/custom/bin", "/opt/bin"]);

    const emptyNormalized = normalizePathPrepend();
    assert.strictEqual(emptyNormalized.length, 0, "missing input must normalize to an empty list");
    void expect(emptyNormalized).toStrictEqual([]);
  });
}

function registerMergeTests(): void {
  const cases: MergeCase[] = [
    {
      existingPath: pathLine("/usr/bin", "/opt/bin"),
      prepend: ["/custom/bin", "/usr/bin"],
      expected: pathLine("/custom/bin", "/usr/bin", "/opt/bin"),
    },
    {
      existingPath: undefined,
      prepend: ["/custom/bin"],
      expected: "/custom/bin",
    },
    {
      existingPath: "/usr/bin",
      prepend: [],
      expected: "/usr/bin",
    },
    {
      existingPath: ` /usr/bin ${path.delimiter} ${path.delimiter} /opt/bin `,
      prepend: ["/custom/bin"],
      expected: pathLine("/custom/bin", "/usr/bin", "/opt/bin"),
    },
  ];

  assert.strictEqual(cases.length, 4, "merge case count must stay fixed");
  assert.ok(cases[0], "merge cases must not be empty");

  void it.each(cases)("merges prepended paths for %j", ({ existingPath, prepend, expected }) => {
    assert.ok(prepend.length <= 4, "prepend fixture must stay bounded");
    assert.ok(expected.length > 0, "expected merged PATH must not be empty");
    const actual = mergePathPrepend(existingPath, prepend);
    assert.ok(actual.length > 0, "actual merged PATH must not be empty");
    void expect(actual).toBe(expected);
  });
}

function registerApplyTests(): void {
  void it("applies prepends to the discovered PATH key and preserves existing casing", () => {
    const targetEnv = {
      Path: pathLine("/usr/bin", "/opt/bin"),
    };
    const prepend = ["/custom/bin", "/usr/bin"];

    assert.strictEqual(prepend.length, 2, "prepend fixture size must stay fixed");
    assert.ok(targetEnv.Path.length > 0, "initial PATH fixture must not be empty");

    void applyPathPrepend(targetEnv, prepend);

    void expect(targetEnv).toEqual({
      Path: pathLine("/custom/bin", "/usr/bin", "/opt/bin"),
    });
  });
}

function registerRequireExistingTests(): void {
  const cases: RequireExistingCase[] = [
    {
      env: env({ HOME: "/tmp/home" }),
      prepend: ["/custom/bin"],
      expected: env({ HOME: "/tmp/home" }),
    },
    {
      env: env({ path: "" }),
      prepend: ["/custom/bin"],
      expected: env({ path: "" }),
    },
    {
      env: env({ PATH: "/usr/bin" }),
      prepend: [],
      expected: env({ PATH: "/usr/bin" }),
    },
    {
      env: env({ PATH: "/usr/bin" }),
      prepend: undefined,
      expected: env({ PATH: "/usr/bin" }),
    },
  ];

  assert.strictEqual(cases.length, 4, "requireExisting case count must stay fixed");
  assert.ok(cases[0], "requireExisting cases must not be empty");

  void it.each(cases)("respects requireExisting for %j", ({ env: targetEnv, prepend, expected }) => {
    assert.ok(targetEnv, "target environment must be provided");
    assert.ok(expected, "expected environment must be provided");

    void applyPathPrepend(targetEnv, prepend, { requireExisting: true });

    void expect(targetEnv).toEqual(expected);
  });
}

function registerPathCreationTests(): void {
  void it("creates PATH when prepends are provided and no path key exists", () => {
    const targetEnv = { HOME: "/tmp/home" };
    const prepend = ["/custom/bin"];
    const opts = undefined;
    const expected = {
      HOME: "/tmp/home",
      PATH: "/custom/bin",
    };

    assert.strictEqual(prepend.length, 1, "creation prepend fixture size must stay fixed");
    assert.ok(expected.PATH.length > 0, "expected created PATH must not be empty");

    void applyPathPrepend(targetEnv, prepend, opts);

    void expect(targetEnv).toEqual(expected);
  });
}

void describe("path prepend helpers", () => {
  registerPathKeyTests();
  registerNormalizeTests();
  registerMergeTests();
  registerApplyTests();
  registerRequireExistingTests();
  registerPathCreationTests();
});
