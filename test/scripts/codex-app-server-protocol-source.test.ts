import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveCodexAppServerProtocolSource } from "../../scripts/lib/codex-app-server-protocol-source.js";
import { createScriptTestHarness } from "./test-helpers.js";

const { createTempDir } = createScriptTestHarness();
const originalAstroclawCodexRepo = process.env.ASTROCLAW_CODEX_REPO;

afterEach(() => {
  if (originalAstroclawCodexRepo === undefined) {
    delete process.env.ASTROCLAW_CODEX_REPO;
  } else {
    process.env.ASTROCLAW_CODEX_REPO = originalAstroclawCodexRepo;
  }
});

describe("codex app-server protocol source resolver", () => {
  it("uses ASTROCLAW_CODEX_REPO when provided", async () => {
    const root = createTempDir("astroclaw-protocol-source-root-");
    const codexRepo = createTempDir("astroclaw-protocol-source-codex-");
    createProtocolSchema(codexRepo);
    process.env.ASTROCLAW_CODEX_REPO = codexRepo;

    await expect(resolveCodexAppServerProtocolSource(root)).resolves.toEqual({
      codexRepo,
      sourceRoot: path.join(codexRepo, "codex-rs/app-server-protocol/schema"),
    });
  });

  it("finds the primary checkout sibling from a git worktree", async () => {
    const parentDir = createTempDir("astroclaw-protocol-source-parent-");
    const primaryAstroclaw = path.join(parentDir, "astroclaw");
    const codexRepo = path.join(parentDir, "codex");
    const worktreeRoot = createTempDir("astroclaw-protocol-source-worktree-");
    fs.mkdirSync(path.join(primaryAstroclaw, ".git", "worktrees", "codex-harness"), {
      recursive: true,
    });
    fs.mkdirSync(worktreeRoot, { recursive: true });
    fs.writeFileSync(
      path.join(worktreeRoot, ".git"),
      `gitdir: ${path.join(primaryAstroclaw, ".git", "worktrees", "codex-harness")}\n`,
    );
    createProtocolSchema(codexRepo);
    delete process.env.ASTROCLAW_CODEX_REPO;

    await expect(resolveCodexAppServerProtocolSource(worktreeRoot)).resolves.toEqual({
      codexRepo,
      sourceRoot: path.join(codexRepo, "codex-rs/app-server-protocol/schema"),
    });
  });
});

function createProtocolSchema(codexRepo: string): void {
  fs.mkdirSync(path.join(codexRepo, "codex-rs/app-server-protocol/schema/typescript"), {
    recursive: true,
  });
}
