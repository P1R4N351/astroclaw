package ai.astroclaw.app.pebble

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.TimeUnit

class PebbleSideloadVerifierTest {
  private companion object {
    /**
     * Golden vector from FIPS 180-2 / `python3 -c "hashlib.sha256(b'abc')"`, cross-checked with
     * `printf 'abc' | sha256sum`. Deliberately NOT produced by the class under test: a digest
     * asserted against its own output proves only that the function is deterministic.
     */
    const val ABC_SHA256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"

    /** `python3 -c "hashlib.sha256(b'pebble-iris test bundle')"`. */
    const val BUNDLE_SHA256 = "3a545e06b08fb1e6ecb3e1dfff3df45cf2f3a8c1d90d34296edc270d523b7ff1"

    val BUNDLE_BYTES: ByteArray = "pebble-iris test bundle".toByteArray()
  }

  @Test
  fun digestMatchesAnIndependentImplementation() {
    assertEquals(ABC_SHA256, PebbleSideloadVerifier.sha256Hex("abc".toByteArray()))
    assertEquals(BUNDLE_SHA256, PebbleSideloadVerifier.sha256Hex(BUNDLE_BYTES))
  }

  @Test
  fun verifyAcceptsMatchingHeaderAndHealthClaims() {
    val verdict = PebbleSideloadVerifier.verify(BUNDLE_BYTES, BUNDLE_SHA256, BUNDLE_SHA256)
    assertEquals(PebbleIntegrity.Verified(BUNDLE_SHA256), verdict)
  }

  @Test
  fun verifyAcceptsUppercaseHeaderCasing() {
    val verdict = PebbleSideloadVerifier.verify(BUNDLE_BYTES, BUNDLE_SHA256.uppercase(), null)
    assertEquals(PebbleIntegrity.Verified(BUNDLE_SHA256), verdict)
  }

  @Test
  fun verifyRejectsHeaderMismatch() {
    val verdict = PebbleSideloadVerifier.verify(BUNDLE_BYTES, ABC_SHA256, null)
    assertTrue(verdict is PebbleIntegrity.Rejected)
  }

  @Test
  fun verifyRejectsWhenHealthDisagreesWithTheDownload() {
    // The build changed between /pebble/health and /pebble/pbw. Neither claim wins; nothing installs.
    val verdict = PebbleSideloadVerifier.verify(BUNDLE_BYTES, BUNDLE_SHA256, ABC_SHA256)
    assertTrue(verdict is PebbleIntegrity.Rejected)
  }

  @Test
  fun verifyRejectsMissingOrMalformedChecksum() {
    assertTrue(PebbleSideloadVerifier.verify(BUNDLE_BYTES, "", BUNDLE_SHA256) is PebbleIntegrity.Rejected)
    assertTrue(PebbleSideloadVerifier.verify(BUNDLE_BYTES, "deadbeef", null) is PebbleIntegrity.Rejected)
    assertTrue(PebbleSideloadVerifier.verify(BUNDLE_BYTES, "z".repeat(64), null) is PebbleIntegrity.Rejected)
  }

  @Test
  fun verifyRejectsEmptyDownload() {
    assertTrue(PebbleSideloadVerifier.verify(ByteArray(0), BUNDLE_SHA256, null) is PebbleIntegrity.Rejected)
  }

  @Test
  fun truncatedBytesDoNotVerify() {
    val truncated = BUNDLE_BYTES.copyOf(BUNDLE_BYTES.size - 1)
    assertTrue(PebbleSideloadVerifier.verify(truncated, BUNDLE_SHA256, BUNDLE_SHA256) is PebbleIntegrity.Rejected)
  }

  @Test
  fun fileNamesRoundTrip() {
    val name = PebbleSideloadVerifier.fileNameFor(BUNDLE_SHA256)
    assertEquals("pebble-iris-$BUNDLE_SHA256.pbw", name)
    assertEquals(BUNDLE_SHA256, PebbleSideloadVerifier.sha256FromFileName(name))
    assertNull(PebbleSideloadVerifier.sha256FromFileName("something-else.pbw"))
    assertNull(PebbleSideloadVerifier.sha256FromFileName("pebble-iris-short.pbw"))
  }

  @Test
  fun staleAfterDownloadKeepsOnlyTheCurrentBuild() {
    val cached =
      listOf(
        PebbleCachedFile(PebbleSideloadVerifier.fileNameFor(BUNDLE_SHA256), 0L),
        PebbleCachedFile(PebbleSideloadVerifier.fileNameFor(ABC_SHA256), 0L),
        PebbleCachedFile("unrelated.txt", 0L),
      )
    val stale = PebbleSideloadVerifier.staleAfterDownload(cached, BUNDLE_SHA256)
    assertEquals(listOf(PebbleSideloadVerifier.fileNameFor(ABC_SHA256)), stale)
  }

  @Test
  fun expiredSweepsOnlyOurOwnOldFiles() {
    val now = TimeUnit.DAYS.toMillis(30)
    val old = now - TimeUnit.DAYS.toMillis(8)
    val recent = now - TimeUnit.DAYS.toMillis(1)
    val cached =
      listOf(
        PebbleCachedFile(PebbleSideloadVerifier.fileNameFor(BUNDLE_SHA256), old),
        PebbleCachedFile(PebbleSideloadVerifier.fileNameFor(ABC_SHA256), recent),
        PebbleCachedFile("unrelated.txt", old),
        PebbleCachedFile(PebbleSideloadVerifier.fileNameFor(ABC_SHA256), now + 1_000L),
      )
    val expired = PebbleSideloadVerifier.expired(cached, now)
    assertEquals(listOf(PebbleSideloadVerifier.fileNameFor(BUNDLE_SHA256)), expired)
  }

  @Test
  fun sevenDaysIsTheSweepHorizon() {
    assertEquals(TimeUnit.DAYS.toMillis(7), PebbleSideloadVerifier.MAX_CACHE_AGE_MS)
  }
}
