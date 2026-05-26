// Streaming-aware embedded-run abort.  When the per-attempt watchdog
// fires while the upstream provider is still actively delivering an
// SSE response, an immediate `abortRun(true)` tears down the in-flight
// stream and truncates a response that was about to complete — the
// lane-timeout race documented in the gateway-lane-race memo
// (`project_gateway_lane_race_2026_05_25.md`).
//
// This helper bridges that race: if the stream is mid-delivery when
// the watchdog wants to abort, give it a short grace window to drain.
// If the stream finishes within the window, no abort is issued — the
// normal success path takes over.  If the stream is still active when
// the grace expires, abort as before.

export interface StreamingGraceParams {
  /** True iff the upstream SSE response is actively being delivered. */
  isStreaming: () => boolean;
  /** Called to actually abort the run.  Same shape as the inline
   *  `abortRun(true)` site this replaces — should set `timedOut` and
   *  trigger the run's abort controller. */
  abortRun: () => void;
  /** Grace ms — how long to let an in-flight stream drain.  Operator
   *  budget is per-attempt timeout + at most this; keep this small
   *  (≤2000) so the budget contract isn't materially extended. */
  graceMs: number;
  /** Warning logger; called once when the grace was consumed and the
   *  run was aborted after the stream still hadn't drained. */
  warn?: (message: string) => void;
  /** Diagnostic context appended to the warning ("runId=... sessionId=...").
   *  Pass undefined to suppress the appended context. */
  contextLabel?: string;
}

export interface StreamingGraceHandle {
  /** Cancel a pending deferred abort.  Safe to call multiple times;
   *  safe when no abort was deferred (eg the non-streaming path).
   *  Designed to be called from the run's cleanup `finally` block
   *  alongside the other timer-clear calls — if the stream completed
   *  through the success path, the deferred abort must not fire after
   *  the run has already returned. */
  cancel: () => void;
}

/** Schedule an abort that respects the in-flight stream.  See module
 *  header for the racy condition this resolves. */
export function abortWithStreamingGrace(p: StreamingGraceParams): StreamingGraceHandle {
  if (!p.isStreaming()) {
    // Common case: no stream in flight — abort immediately.  Preserves
    // the prior behavior verbatim for the non-racy path.
    p.abortRun();
    return { cancel: () => undefined };
  }
  // Streaming path: defer the abort.  Math.max(1, ...) matches the
  // existing `scheduleAbortTimer` pattern (setTimeout(0) edge case).
  const timer: ReturnType<typeof setTimeout> = setTimeout(
    () => {
      if (!p.isStreaming()) {
        // Stream drained cleanly in the grace window — no abort needed.
        // The normal success path will run the cleanup `finally`.
        return;
      }
      // Stream still active — actually abort.  Log once so operators
      // can correlate the timer-extended timeout with the eventual
      // failure.  Probe sessions caller passes `warn: undefined` to
      // suppress (same convention the prior log.warn site used).
      if (p.warn) {
        const label = p.contextLabel ? ` ${p.contextLabel}` : "";
        p.warn(`embedded run abort after streaming grace${label}`);
      }
      p.abortRun();
    },
    Math.max(1, p.graceMs),
  );
  return {
    cancel: () => {
      clearTimeout(timer);
    },
  };
}

/** Default grace.  Observed race in the gateway-lane-race memo had a
 *  15ms delivery window post-watchdog; 1500ms is ~100x that — a wide
 *  margin for slower variants, still small enough that the operator
 *  budget is honored within ~5% noise.  Exported for the call site
 *  and for tests. */
export const DEFAULT_STREAMING_ABORT_GRACE_MS = 1500;
