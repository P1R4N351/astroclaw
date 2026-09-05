package ai.astroclaw.app.pebble

import java.util.UUID

/**
 * Request ids for `/pebble/action`.
 *
 * The rid is the server's deduplication key, held for 60s. Two rules follow from that and they
 * pull in opposite directions, so both are stated explicitly:
 *
 * 1. EVERY USER GESTURE GETS A FRESH RID. Reusing one would make a deliberate second press look
 *    like a duplicate and be silently swallowed.
 * 2. A CONFIRMATION REUSES THE RID OF THE PROMPT IT CONFIRMS. The server claims the rid at the
 *    moment of dispatch, never for an unconfirmed request, so re-posting the same rid with
 *    `confirm:true` is what closes the loop. Minting a new rid there would dispatch a SECOND
 *    action rather than confirm the first.
 */
object PebbleRequestIds {
  /**
   * Mirrors the server's `RID_RE`: a leading hex digit, then hex digits and dashes, total length
   * 8..64. A random UUID satisfies it.
   */
  private val RID_PATTERN = Regex("^[0-9a-fA-F][0-9a-fA-F-]{7,63}$")

  /** @return a fresh rid for one user gesture. Never call this to confirm an existing prompt. */
  fun fresh(): String {
    val rid = UUID.randomUUID().toString()
    check(isValid(rid)) { "generated rid does not satisfy the protocol pattern" }
    return rid
  }

  fun isValid(rid: String): Boolean = RID_PATTERN.matches(rid)
}

/** Seam so tests can pin the rid sequence instead of guessing at randomness. */
fun interface PebbleRequestIdSource {
  fun next(): String
}

/** Production source: a fresh random UUID per gesture. */
object RandomPebbleRequestIdSource : PebbleRequestIdSource {
  override fun next(): String = PebbleRequestIds.fresh()
}
