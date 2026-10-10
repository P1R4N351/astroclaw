import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  resolveCanonicalExecApprovalsTarget,
  writeExecApprovalsRaw,
} from "./exec-approvals-file-io.js";

// The approvals file can sit directly in a shared, operator-managed state root.
// Re-chmodding that directory on every lock acquisition rewrites its POSIX ACL
// mask and zeroes every named ACE, so `ensureDir` must only tighten a directory
// it created itself.
const describeIfPosix = process.platform === "win32" ? describe.skip : describe;

function modeOf(target: string): number {
  return fs.statSync(target).mode & 0o7777;
}

describeIfPosix("exec approvals directory mode", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "exec-approvals-dir-mode-"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("leaves an existing state root's mode untouched when writing", () => {
    const stateRoot = path.join(root, "state");
    fs.mkdirSync(stateRoot);
    fs.chmodSync(stateRoot, 0o750);
    const filePath = path.join(stateRoot, "exec-approvals.json");

    writeExecApprovalsRaw(filePath, "{}\n");

    expect(modeOf(stateRoot)).toBe(0o750);
    expect(modeOf(filePath)).toBe(0o600);
  });

  it("leaves an existing state root's mode untouched when resolving the target", () => {
    const stateRoot = path.join(root, "state-resolve");
    fs.mkdirSync(stateRoot);
    fs.chmodSync(stateRoot, 0o755);
    const filePath = path.join(stateRoot, "exec-approvals.json");

    const resolved = resolveCanonicalExecApprovalsTarget(filePath);

    expect(path.basename(resolved)).toBe("exec-approvals.json");
    expect(modeOf(stateRoot)).toBe(0o755);
  });

  it("creates a missing approvals directory as 0700", () => {
    const stateRoot = path.join(root, "missing", "nested");
    const filePath = path.join(stateRoot, "exec-approvals.json");

    writeExecApprovalsRaw(filePath, "{}\n");

    expect(modeOf(stateRoot)).toBe(0o700);
    expect(modeOf(filePath)).toBe(0o600);
  });
});
