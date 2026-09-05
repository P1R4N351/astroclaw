package ai.astroclaw.app.pebble

import java.security.MessageDigest
import java.util.concurrent.TimeUnit

/** Verdict on a downloaded `.pbw`. Only [Verified] may ever be handed to an installer. */
sealed interface PebbleIntegrity {
  data class Verified(
    val sha256: String,
  ) : PebbleIntegrity

  data class Rejected(
    val reason: String,
  ) : PebbleIntegrity
}

/** One cached `.pbw` on disk, described without touching the filesystem so the policy stays pure. */
data class PebbleCachedFile(
  val name: String,
  val lastModifiedMs: Long,
)

/**
 * Integrity and cache policy for the watchapp sideload.
 *
 * The trust model: the server publishes a SHA-256 in `/pebble/health` and repeats it in the
 * `X-Pbw-Sha256` response header. The client computes the digest of the bytes it actually received
 * and requires all three to agree. A `.pbw` is an executable payload for a device on the
 * household's person; "the download probably worked" is not a standard worth installing against.
 */
object PebbleSideloadVerifier {
  /** Cached builds older than this are swept on screen open, best effort. */
  val MAX_CACHE_AGE_MS: Long = TimeUnit.DAYS.toMillis(7)

  private const val FILE_PREFIX = "pebble-iris-"
  private const val FILE_SUFFIX = ".pbw"
  private const val DIGEST_ALGORITHM = "SHA-256"
  private const val HEX_DIGITS = "0123456789abcdef"

  /** Lowercase hex SHA-256 of [bytes]. */
  fun sha256Hex(bytes: ByteArray): String {
    val digest = MessageDigest.getInstance(DIGEST_ALGORITHM).digest(bytes)
    val out = StringBuilder(digest.size * 2)
    for (byte in digest) {
      val value = byte.toInt() and 0xFF
      out.append(HEX_DIGITS[value ushr 4])
      out.append(HEX_DIGITS[value and 0x0F])
    }
    return out.toString()
  }

  /**
   * Verify received bytes against what the server said.
   *
   * @param bytes the payload as received.
   * @param headerSha256 value of `X-Pbw-Sha256`, or empty when the header was absent.
   * @param healthSha256 the SHA-256 advertised by `/pebble/health`, or null when unknown.
   * @return [PebbleIntegrity.Verified] only when every known claim matches the computed digest.
   */
  fun verify(
    bytes: ByteArray,
    headerSha256: String,
    healthSha256: String?,
  ): PebbleIntegrity {
    if (bytes.isEmpty()) return PebbleIntegrity.Rejected("The download was empty.")
    val header = headerSha256.trim().lowercase()
    if (header.isEmpty()) {
      return PebbleIntegrity.Rejected("The server published no checksum for this build.")
    }
    if (!PebbleProtocol.isSha256Hex(header)) {
      return PebbleIntegrity.Rejected("The server's checksum was not a SHA-256.")
    }
    val actual = sha256Hex(bytes)
    if (actual != header) {
      return PebbleIntegrity.Rejected("Checksum mismatch — the download does not match the server.")
    }
    val advertised = healthSha256?.trim()?.lowercase()
    if (!advertised.isNullOrEmpty() && advertised != actual) {
      return PebbleIntegrity.Rejected("The build changed mid-download. Try again.")
    }
    return PebbleIntegrity.Verified(actual)
  }

  /** Cache file name for a verified digest. The digest IS the identity of the build. */
  fun fileNameFor(sha256: String): String = FILE_PREFIX + sha256 + FILE_SUFFIX

  /** Inverse of [fileNameFor]; null when [name] is not one of ours. */
  fun sha256FromFileName(name: String): String? {
    if (!name.startsWith(FILE_PREFIX) || !name.endsWith(FILE_SUFFIX)) return null
    val middle = name.substring(FILE_PREFIX.length, name.length - FILE_SUFFIX.length)
    return if (PebbleProtocol.isSha256Hex(middle)) middle else null
  }

  /**
   * After a successful download, every cached build that is not the current one is dead weight.
   *
   * @return names to delete. Files that are not ours are left alone.
   */
  fun staleAfterDownload(
    cached: List<PebbleCachedFile>,
    currentSha256: String,
  ): List<String> =
    cached
      .filter { file ->
        val sha = sha256FromFileName(file.name)
        sha != null && sha != currentSha256
      }.map { it.name }

  /**
   * Best-effort age sweep run when the screen opens.
   *
   * @return names of our own cached files older than [maxAgeMs]. A file with a future timestamp is
   *   left alone rather than treated as infinitely old.
   */
  fun expired(
    cached: List<PebbleCachedFile>,
    nowMs: Long,
    maxAgeMs: Long = MAX_CACHE_AGE_MS,
  ): List<String> =
    cached
      .filter { file ->
        sha256FromFileName(file.name) != null && nowMs - file.lastModifiedMs > maxAgeMs
      }.map { it.name }
}
