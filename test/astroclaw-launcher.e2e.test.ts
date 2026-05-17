import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempDirs, makeTempDir } from "./helpers/temp-dir.js";

async function makeLauncherFixture(fixtureRoots: string[]): Promise<string> {
  const fixtureRoot = makeTempDir(fixtureRoots, "astroclaw-launcher-");
  await fs.copyFile(
    path.resolve(process.cwd(), "astroclaw.mjs"),
    path.join(fixtureRoot, "astroclaw.mjs"),
  );
  await fs.mkdir(path.join(fixtureRoot, "dist"), { recursive: true });
  return fixtureRoot;
}

async function addSourceTreeMarker(fixtureRoot: string): Promise<void> {
  await fs.mkdir(path.join(fixtureRoot, "src"), { recursive: true });
  await fs.writeFile(path.join(fixtureRoot, "src", "entry.ts"), "export {};\n", "utf8");
}

async function addGitMarker(fixtureRoot: string): Promise<void> {
  await fs.writeFile(path.join(fixtureRoot, ".git"), "gitdir: .git/worktrees/astroclaw\n", "utf8");
}

async function addCompileCacheProbe(fixtureRoot: string): Promise<void> {
  await fs.writeFile(
    path.join(fixtureRoot, "dist", "entry.js"),
    [
      'import module from "node:module";',
      "process.stdout.write(",
      '  `${module.getCompileCacheDir?.() ? "cache:enabled" : "cache:disabled"};respawn:${process.env.ASTROCLAW_SOURCE_COMPILE_CACHE_RESPAWNED ?? "0"}`',
      ");",
    ].join("\n"),
    "utf8",
  );
}

async function waitForJsonFile<T>(filePath: string, timeoutMs: number): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() <= deadline) {
    try {
      return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw new Error(`timed out waiting for parseable JSON in ${filePath}`, { cause: lastError });
}

async function waitForProcessExit(
  child: ReturnType<typeof spawn>,
  label: string,
  timeoutMs: number,
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return { code: child.exitCode, signal: child.signalCode };
  }

  const signal = AbortSignal.timeout(timeoutMs);
  try {
    const [code, exitSignal] = (await once(child, "exit", { signal })) as [
      number | null,
      NodeJS.Signals | null,
    ];
    return { code, signal: exitSignal };
  } catch (error) {
    throw new Error(`timed out waiting for ${label} to exit`, { cause: error });
  }
}

function isProcessAlive(pid: number | undefined): boolean {
  if (!pid) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function launcherEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env = { ...process.env, ...extra };
  delete env.NODE_COMPILE_CACHE;
  delete env.NODE_DISABLE_COMPILE_CACHE;
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) {
      delete env[key];
    } else {
      env[key] = value;
    }
  }
  return env;
}

describe("astroclaw launcher", () => {
  const fixtureRoots: string[] = [];

  afterEach(async () => {
    cleanupTempDirs(fixtureRoots);
  });

  it("keeps the bootstrap Node floor aligned with package and runtime guards", async () => {
    const [launcher, runtimeGuard, packageJsonRaw] = await Promise.all([
      fs.readFile(path.resolve(process.cwd(), "astroclaw.mjs"), "utf8"),
      fs.readFile(path.resolve(process.cwd(), "src/infra/runtime-guard.ts"), "utf8"),
      fs.readFile(path.resolve(process.cwd(), "package.json"), "utf8"),
    ]);
    const packageJson = JSON.parse(packageJsonRaw) as { engines?: { node?: string } };
    const launcherMatch = launcher.match(
      /const MIN_NODE_MAJOR = (\d+);\s+const MIN_NODE_MINOR = (\d+);/u,
    );
    const runtimeMatch = runtimeGuard.match(
      /const MIN_NODE: Semver = \{ major: (\d+), minor: (\d+), patch: (\d+) \};/u,
    );
    const engineMatch = packageJson.engines?.node?.match(/^>=(\d+)\.(\d+)\.(\d+)$/u);

    expect(launcherMatch).not.toBeNull();
    expect(runtimeMatch).not.toBeNull();
    expect(engineMatch).not.toBeNull();
    expect(`${launcherMatch?.[1]}.${launcherMatch?.[2]}.0`).toBe(
      `${engineMatch?.[1]}.${engineMatch?.[2]}.${engineMatch?.[3]}`,
    );
    expect(runtimeMatch?.slice(1, 4)).toEqual(engineMatch?.slice(1, 4));
  });

  it("surfaces transitive entry import failures instead of masking them as missing dist", async () => {
    const fixtureRoot = await makeLauncherFixture(fixtureRoots);
    await fs.writeFile(
      path.join(fixtureRoot, "dist", "entry.js"),
      'import "missing-astroclaw-launcher-dep";\nexport {};\n',
      "utf8",
    );

    const result = spawnSync(process.execPath, [path.join(fixtureRoot, "astroclaw.mjs"), "--help"], {
      cwd: fixtureRoot,
      env: launcherEnv(),
      encoding: "utf8",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("missing-astroclaw-launcher-dep");
    expect(result.stderr).not.toContain("missing dist/entry.(m)js");
  });

  it("keeps the friendly launcher error for a truly missing entry build output", async () => {
    const fixtureRoot = await makeLauncherFixture(fixtureRoots);

    const result = spawnSync(process.execPath, [path.join(fixtureRoot, "astroclaw.mjs"), "--help"], {
      cwd: fixtureRoot,
      env: launcherEnv(),
      encoding: "utf8",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("missing dist/entry.(m)js");
  });

  it("explains how to recover from an unbuilt source install", async () => {
    const fixtureRoot = await makeLauncherFixture(fixtureRoots);
    await addSourceTreeMarker(fixtureRoot);

    const result = spawnSync(process.execPath, [path.join(fixtureRoot, "astroclaw.mjs"), "--help"], {
      cwd: fixtureRoot,
      env: launcherEnv(),
      encoding: "utf8",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("missing dist/entry.(m)js");
    expect(result.stderr).toContain("unbuilt source tree or GitHub source archive");
    expect(result.stderr).toContain("pnpm install && pnpm build");
    expect(result.stderr).toContain("github:astroclaw/astroclaw#<ref>");
  });

  it("keeps compile cache off for source-checkout launchers", async () => {
    const fixtureRoot = await makeLauncherFixture(fixtureRoots);
    await addSourceTreeMarker(fixtureRoot);
    await addCompileCacheProbe(fixtureRoot);

    const result = spawnSync(process.execPath, [path.join(fixtureRoot, "astroclaw.mjs")], {
      cwd: fixtureRoot,
      env: launcherEnv(),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("cache:disabled;respawn:0");
  });

  it("respawns source-checkout launchers without inherited NODE_COMPILE_CACHE", async () => {
    const fixtureRoot = await makeLauncherFixture(fixtureRoots);
    await addGitMarker(fixtureRoot);
    await addCompileCacheProbe(fixtureRoot);

    const result = spawnSync(process.execPath, [path.join(fixtureRoot, "astroclaw.mjs")], {
      cwd: fixtureRoot,
      env: launcherEnv({
        NODE_COMPILE_CACHE: path.join(fixtureRoot, ".node-compile-cache"),
      }),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("cache:disabled;respawn:1");
  });

  it.runIf(process.platform !== "win32")(
    "forwards SIGTERM to source-checkout compile-cache respawn children",
    async () => {
      const fixtureRoot = await makeLauncherFixture(fixtureRoots);
      await addGitMarker(fixtureRoot);
      const childInfoPath = path.join(fixtureRoot, "child-info.json");
      const signalPath = path.join(fixtureRoot, "sigterm-received.txt");
      await fs.writeFile(
        path.join(fixtureRoot, "dist", "entry.js"),
        [
          'import { writeFileSync } from "node:fs";',
          'process.title = "astroclaw-launcher-sigterm-test-child";',
          `process.on("SIGTERM", () => { writeFileSync(${JSON.stringify(signalPath)}, "SIGTERM\\n"); process.exit(0); });`,
          `writeFileSync(${JSON.stringify(childInfoPath)}, JSON.stringify({ pid: process.pid }) + "\\n");`,
          "setInterval(() => {}, 1000);",
          "",
        ].join("\n"),
        "utf8",
      );

      const launcher = spawn(process.execPath, [path.join(fixtureRoot, "astroclaw.mjs")], {
        cwd: fixtureRoot,
        env: launcherEnv({
          NODE_COMPILE_CACHE: path.join(fixtureRoot, ".node-compile-cache"),
        }),
        stdio: "ignore",
      });
      let respawnChildPid: number | undefined;

      try {
        const childInfo = await waitForJsonFile<{ pid: number }>(childInfoPath, 5000);
        respawnChildPid = childInfo.pid;

        launcher.kill("SIGTERM");

        await expect(waitForProcessExit(launcher, "launcher", 5000)).resolves.toEqual({
          code: 0,
          signal: null,
        });
        await expect(fs.readFile(signalPath, "utf8")).resolves.toBe("SIGTERM\n");
        expect(isProcessAlive(respawnChildPid)).toBe(false);
      } finally {
        if (isProcessAlive(respawnChildPid)) {
          process.kill(respawnChildPid!, "SIGKILL");
        }
        if (isProcessAlive(launcher.pid)) {
          process.kill(launcher.pid!, "SIGKILL");
        }
      }
    },
  );

  it.runIf(process.platform !== "win32")(
    "exits after SIGTERM when the respawn child ignores the forwarded signal",
    async () => {
      const fixtureRoot = await makeLauncherFixture(fixtureRoots);
      await addGitMarker(fixtureRoot);
      const childInfoPath = path.join(fixtureRoot, "child-info.json");
      await fs.writeFile(
        path.join(fixtureRoot, "dist", "entry.js"),
        [
          'import { writeFileSync } from "node:fs";',
          `writeFileSync(${JSON.stringify(childInfoPath)}, JSON.stringify({ pid: process.pid }) + "\\n");`,
          'process.title = "astroclaw-launcher-sigterm-ignore-test-child";',
          'process.on("SIGTERM", () => {});',
          "setInterval(() => {}, 1000);",
          "",
        ].join("\n"),
        "utf8",
      );

      const launcher = spawn(process.execPath, [path.join(fixtureRoot, "astroclaw.mjs")], {
        cwd: fixtureRoot,
        env: launcherEnv({
          NODE_COMPILE_CACHE: path.join(fixtureRoot, ".node-compile-cache"),
        }),
        stdio: "ignore",
      });
      let respawnChildPid: number | undefined;

      try {
        const childInfo = await waitForJsonFile<{ pid: number }>(childInfoPath, 5000);
        respawnChildPid = childInfo.pid;

        launcher.kill("SIGTERM");

        await expect(waitForProcessExit(launcher, "launcher", 5000)).resolves.toEqual({
          code: 1,
          signal: null,
        });
        expect(isProcessAlive(launcher.pid)).toBe(false);
        expect(isProcessAlive(respawnChildPid)).toBe(false);
      } finally {
        if (isProcessAlive(respawnChildPid)) {
          process.kill(respawnChildPid!, "SIGKILL");
        }
        if (isProcessAlive(launcher.pid)) {
          process.kill(launcher.pid!, "SIGKILL");
        }
      }
    },
  );

  it.runIf(process.platform !== "win32")(
    "respawns symlinked source-checkout launchers without inherited NODE_COMPILE_CACHE",
    async () => {
      const fixtureRoot = await makeLauncherFixture(fixtureRoots);
      await addGitMarker(fixtureRoot);
      await addCompileCacheProbe(fixtureRoot);
      const linkParent = makeTempDir(fixtureRoots, "astroclaw-launcher-link-");
      const linkedRoot = path.join(linkParent, "astroclaw-linked");
      await fs.symlink(fixtureRoot, linkedRoot, "dir");

      const result = spawnSync(process.execPath, [path.join(linkedRoot, "astroclaw.mjs")], {
        cwd: linkParent,
        env: launcherEnv({
          NODE_COMPILE_CACHE: path.join(linkParent, ".node-compile-cache"),
        }),
        encoding: "utf8",
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toBe("cache:disabled;respawn:1");
    },
  );

  it("keeps compile cache enabled for packaged launchers when NODE_COMPILE_CACHE is configured", async () => {
    const fixtureRoot = await makeLauncherFixture(fixtureRoots);
    await addCompileCacheProbe(fixtureRoot);

    const result = spawnSync(process.execPath, [path.join(fixtureRoot, "astroclaw.mjs")], {
      cwd: fixtureRoot,
      env: launcherEnv({
        NODE_COMPILE_CACHE: path.join(fixtureRoot, ".node-compile-cache"),
      }),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("cache:enabled;respawn:0");
  });

  it("scopes packaged launcher compile cache inside configured cache roots", async () => {
    const fixtureRoot = await makeLauncherFixture(fixtureRoots);
    await fs.writeFile(path.join(fixtureRoot, "package.json"), '{"version":"2026.4.29"}\n');
    await fs.writeFile(
      path.join(fixtureRoot, "dist", "entry.js"),
      [
        'import module from "node:module";',
        'process.stdout.write(module.getCompileCacheDir?.() ?? "cache:disabled");',
      ].join("\n"),
      "utf8",
    );

    const result = spawnSync(process.execPath, [path.join(fixtureRoot, "astroclaw.mjs")], {
      cwd: fixtureRoot,
      env: launcherEnv({
        NODE_COMPILE_CACHE: path.join(fixtureRoot, ".node-compile-cache"),
      }),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(path.join(".node-compile-cache", "astroclaw", "2026.4.29"));
  });

  it("falls back to the default packaged launcher compile cache when NODE_COMPILE_CACHE is empty", async () => {
    const fixtureRoot = await makeLauncherFixture(fixtureRoots);
    const runCwd = makeTempDir(fixtureRoots, "astroclaw-launcher-cwd-");
    const tmpRoot = makeTempDir(fixtureRoots, "astroclaw-launcher-tmp-");
    await fs.writeFile(path.join(fixtureRoot, "package.json"), '{"version":"2026.4.29"}\n');
    await fs.writeFile(
      path.join(fixtureRoot, "dist", "entry.js"),
      [
        'import module from "node:module";',
        'process.stdout.write(module.getCompileCacheDir?.() ?? "cache:disabled");',
      ].join("\n"),
      "utf8",
    );

    const result = spawnSync(process.execPath, [path.join(fixtureRoot, "astroclaw.mjs")], {
      cwd: runCwd,
      env: launcherEnv({
        NODE_COMPILE_CACHE: "",
        TMP: tmpRoot,
        TEMP: tmpRoot,
        TMPDIR: tmpRoot,
      }),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(path.join("node-compile-cache", "astroclaw", "2026.4.29"));
    expect(result.stdout).not.toContain(path.join(runCwd, "astroclaw"));
  });

  it("enables compile cache for packaged launchers", async () => {
    const fixtureRoot = await makeLauncherFixture(fixtureRoots);
    const tmpRoot = makeTempDir(fixtureRoots, "astroclaw-launcher-tmp-");
    await addCompileCacheProbe(fixtureRoot);

    const result = spawnSync(process.execPath, [path.join(fixtureRoot, "astroclaw.mjs")], {
      cwd: fixtureRoot,
      env: launcherEnv({
        TMP: tmpRoot,
        TEMP: tmpRoot,
        TMPDIR: tmpRoot,
      }),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("cache:enabled;respawn:0");
  });
});
