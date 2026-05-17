import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAstroclawTestState,
  type AstroclawTestState,
} from "../test-utils/astroclaw-test-state.js";

const note = vi.hoisted(() => vi.fn());

vi.mock("../terminal/note.js", () => ({
  note,
}));

import { noteSessionLockHealth } from "./doctor-session-locks.js";

async function expectPathMissing(targetPath: string): Promise<void> {
  try {
    await fs.access(targetPath);
    throw new Error(`expected missing path: ${targetPath}`);
  } catch (error) {
    expect((error as NodeJS.ErrnoException).code).toBe("ENOENT");
  }
}

function firstNoteCall(): [string, string] {
  const call = note.mock.calls[0];
  if (!call) {
    throw new Error("expected note call");
  }
  return call as [string, string];
}

describe("noteSessionLockHealth", () => {
  let state: AstroclawTestState;

  beforeEach(async () => {
    note.mockClear();
    state = await createAstroclawTestState({
      layout: "state-only",
      prefix: "astroclaw-doctor-locks-",
    });
  });

  afterEach(async () => {
    await state.cleanup();
  });

  it("reports existing lock files with pid status and age", async () => {
    const sessionsDir = state.sessionsDir();
    await fs.mkdir(sessionsDir, { recursive: true });
    const lockPath = path.join(sessionsDir, "active.jsonl.lock");
    await fs.writeFile(
      lockPath,
      JSON.stringify({ pid: process.pid, createdAt: new Date(Date.now() - 1500).toISOString() }),
      "utf8",
    );

    await noteSessionLockHealth({
      shouldRepair: false,
      staleMs: 60_000,
      readOwnerProcessArgs: () => ["node", "/opt/astroclaw/astroclaw.mjs", "doctor"],
    });

    expect(note).toHaveBeenCalledTimes(1);
    const [message, title] = firstNoteCall();
    expect(title).toBe("Session locks");
    expect(message).toContain("Found 1 session lock file");
    expect(message).toContain(`pid=${process.pid} (alive)`);
    expect(message).toContain("stale=no");
    await expect(fs.access(lockPath)).resolves.toBeUndefined();
  });

  it("removes stale locks in repair mode", async () => {
    const sessionsDir = state.sessionsDir();
    await fs.mkdir(sessionsDir, { recursive: true });

    const staleLock = path.join(sessionsDir, "stale.jsonl.lock");
    const freshLock = path.join(sessionsDir, "fresh.jsonl.lock");

    await fs.writeFile(
      staleLock,
      JSON.stringify({ pid: -1, createdAt: new Date(Date.now() - 120_000).toISOString() }),
      "utf8",
    );
    await fs.writeFile(
      freshLock,
      JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }),
      "utf8",
    );

    await noteSessionLockHealth({
      shouldRepair: true,
      staleMs: 30_000,
      readOwnerProcessArgs: () => ["node", "/opt/astroclaw/astroclaw.mjs", "doctor"],
    });

    expect(note).toHaveBeenCalledTimes(1);
    const [message] = firstNoteCall();
    expect(message).toContain("[removed]");
    expect(message).toContain("Removed 1 stale session lock file");

    await expectPathMissing(staleLock);
    await expect(fs.access(freshLock)).resolves.toBeUndefined();
  });

  it("removes fresh live locks when the owner is not an Astroclaw process", async () => {
    const sessionsDir = state.sessionsDir();
    await fs.mkdir(sessionsDir, { recursive: true });

    const falseLiveLock = path.join(sessionsDir, "false-live.jsonl.lock");
    await fs.writeFile(
      falseLiveLock,
      JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }),
      "utf8",
    );

    await noteSessionLockHealth({
      shouldRepair: true,
      staleMs: 60_000,
      readOwnerProcessArgs: () => ["python", "worker.py"],
    });

    expect(note).toHaveBeenCalledTimes(1);
    const [message] = firstNoteCall();
    expect(message).toContain("stale=yes (non-astroclaw-owner)");
    expect(message).toContain("[removed]");
    expect(message).toContain("Removed 1 stale session lock file");
    await expect(fs.access(falseLiveLock)).rejects.toThrow();
  });
});
