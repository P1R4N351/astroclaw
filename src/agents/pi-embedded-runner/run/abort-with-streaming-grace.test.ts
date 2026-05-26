import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  abortWithStreamingGrace,
  DEFAULT_STREAMING_ABORT_GRACE_MS,
} from "./abort-with-streaming-grace.js";

describe("abortWithStreamingGrace", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("aborts immediately when no stream is in flight (no race window)", () => {
    const abortRun = vi.fn();
    const warn = vi.fn();
    const handle = abortWithStreamingGrace({
      isStreaming: () => false,
      abortRun,
      graceMs: 1500,
      warn,
    });
    expect(abortRun).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
    // cancel must be safe to call on the non-streaming path too
    expect(() => handle.cancel()).not.toThrow();
  });

  it("defers abort while streaming and skips abort if stream drains in grace window", () => {
    let streaming = true;
    const abortRun = vi.fn();
    const warn = vi.fn();
    abortWithStreamingGrace({
      isStreaming: () => streaming,
      abortRun,
      graceMs: 1500,
      warn,
    });
    // grace just started — no abort yet
    vi.advanceTimersByTime(500);
    expect(abortRun).not.toHaveBeenCalled();
    // stream finishes inside the grace
    streaming = false;
    vi.advanceTimersByTime(1500);
    expect(abortRun).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("aborts and logs when stream is still active after the grace window", () => {
    const abortRun = vi.fn();
    const warn = vi.fn();
    abortWithStreamingGrace({
      isStreaming: () => true, // never drains
      abortRun,
      graceMs: 1500,
      warn,
      contextLabel: "runId=abc sessionId=def",
    });
    vi.advanceTimersByTime(1499);
    expect(abortRun).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(abortRun).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("after streaming grace");
    expect(warn.mock.calls[0]?.[0]).toContain("runId=abc sessionId=def");
  });

  it("does not log when warn is undefined (probe session convention)", () => {
    const abortRun = vi.fn();
    abortWithStreamingGrace({
      isStreaming: () => true,
      abortRun,
      graceMs: 100,
    });
    vi.advanceTimersByTime(200);
    expect(abortRun).toHaveBeenCalledTimes(1);
    // No warn callback passed — silence is the contract for probe sessions.
  });

  it("cancel() prevents a pending deferred abort from firing", () => {
    const abortRun = vi.fn();
    const handle = abortWithStreamingGrace({
      isStreaming: () => true,
      abortRun,
      graceMs: 1500,
    });
    vi.advanceTimersByTime(500);
    handle.cancel();
    // Past the grace deadline — the timer would have fired, but cancel
    // killed it.  This is the cleanup-path contract: when the run's
    // finally block runs because the success path completed, no late
    // abort should ride in.
    vi.advanceTimersByTime(2000);
    expect(abortRun).not.toHaveBeenCalled();
  });

  it("cancel() on the non-streaming path is a safe no-op (abort already fired)", () => {
    const abortRun = vi.fn();
    const handle = abortWithStreamingGrace({
      isStreaming: () => false,
      abortRun,
      graceMs: 1500,
    });
    expect(abortRun).toHaveBeenCalledTimes(1);
    handle.cancel();
    vi.advanceTimersByTime(5000);
    // No second abort, no throw.
    expect(abortRun).toHaveBeenCalledTimes(1);
  });

  it("Math.max(1, graceMs) — graceMs <= 0 still defers by at least 1 tick", () => {
    let streaming = true;
    const abortRun = vi.fn();
    abortWithStreamingGrace({
      isStreaming: () => streaming,
      abortRun,
      graceMs: 0,
    });
    expect(abortRun).not.toHaveBeenCalled();
    streaming = false;
    vi.advanceTimersByTime(10);
    expect(abortRun).not.toHaveBeenCalled();
  });

  it("DEFAULT_STREAMING_ABORT_GRACE_MS is exported and reasonable", () => {
    // Sanity: must be >> observed 15ms race, << operator timeout budgets.
    expect(DEFAULT_STREAMING_ABORT_GRACE_MS).toBeGreaterThan(100);
    expect(DEFAULT_STREAMING_ABORT_GRACE_MS).toBeLessThan(5_000);
  });
});
