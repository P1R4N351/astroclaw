package ai.astroclaw.app.pebble

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import java.io.File

/** Where the watchapp sideload has got to. */
sealed interface PebbleSideloadState {
  data object Idle : PebbleSideloadState

  data object Working : PebbleSideloadState

  /** Bytes are on disk AND their SHA-256 matched what the server published. */
  data class Ready(
    val version: String,
    val sha256: String,
  ) : PebbleSideloadState

  data class Failed(
    val failure: PebbleFailure,
  ) : PebbleSideloadState
}

/** Outcome of handing the verified `.pbw` to whatever app handles Pebble bundles. */
sealed interface PebbleInstallResult {
  data object Launched : PebbleInstallResult

  /** No installed app claimed the file. */
  data class NoHandler(
    val guidance: String,
  ) : PebbleInstallResult

  /** Nothing verified is on disk, so there is nothing to install. */
  data object NotReady : PebbleInstallResult
}

/**
 * Downloads, verifies, caches and hands off the Pebble watchapp bundle.
 *
 * The hard rule: BYTES ARE VERIFIED BEFORE THEY REACH THE DISK, and a bundle whose digest does not
 * match the server's published SHA-256 is deleted rather than offered. A `.pbw` is executable code
 * for a device worn on the body; a truncated or substituted download must fail loudly and leave
 * nothing installable behind.
 *
 * This is the only class in the Pebble package that touches Android. The interesting decisions
 * (digest, verdict, cache expiry) live in [PebbleSideloadVerifier], where they can be tested.
 */
class PebbleSideloadManager(
  context: Context,
  private val api: PebbleApi,
) {
  companion object {
    private const val CACHE_DIR_NAME = "pebble"
    private const val FILE_PROVIDER_SUFFIX = ".fileprovider"
    private const val PBW_MIME_TYPE = "application/octet-stream"
    private const val CHOOSER_TITLE = "Install Pebble watchapp"

    /**
     * Shown when nothing on the phone claims a `.pbw`. Naming the app is the whole value of this
     * message: "no app can open this file" leaves the user with nowhere to go.
     */
    const val NO_HANDLER_GUIDANCE =
      "No app on this phone can open a Pebble bundle. Install the Pebble app by Core Devices, " +
        "then try again."
  }

  private val appContext = context.applicationContext
  private val _state = MutableStateFlow<PebbleSideloadState>(PebbleSideloadState.Idle)
  val state: StateFlow<PebbleSideloadState> = _state

  /**
   * Explicit user gesture: fetch, verify, cache.
   *
   * @param expected the `pbw` block from `/pebble/health`, used as a second independent claim
   *   about the digest.
   */
  suspend fun download(expected: PebblePbwInfo) {
    if (_state.value is PebbleSideloadState.Working) return
    _state.value = PebbleSideloadState.Working
    when (val outcome = api.fetchPbw()) {
      is PebbleOutcome.Failure -> _state.value = PebbleSideloadState.Failed(outcome.failure)
      is PebbleOutcome.Success -> store(outcome.value, expected)
    }
  }

  private suspend fun store(
    payload: PebblePbwPayload,
    expected: PebblePbwInfo,
  ) {
    val verdict =
      PebbleSideloadVerifier.verify(
        bytes = payload.bytes,
        headerSha256 = payload.declaredSha256,
        healthSha256 = expected.sha256,
      )
    if (verdict is PebbleIntegrity.Rejected) {
      // Nothing was written, so there is nothing to delete; sweep anyway in case an earlier
      // attempt left a file behind, and make sure no stale build can be mistaken for this one.
      pruneTo(expected.sha256)
      _state.value = PebbleSideloadState.Failed(PebbleFailure.Integrity(verdict.reason))
      return
    }
    val sha = (verdict as PebbleIntegrity.Verified).sha256
    val written = writeBundle(sha, payload.bytes)
    if (!written) {
      _state.value =
        PebbleSideloadState.Failed(PebbleFailure.Integrity("Could not write the bundle to cache."))
      return
    }
    pruneTo(sha)
    _state.value =
      PebbleSideloadState.Ready(
        version = expected.version.ifBlank { payload.declaredVersion },
        sha256 = sha,
      )
  }

  /**
   * Hand the verified bundle to whatever app handles it.
   *
   * @param activityContext an Activity context; the chooser needs one to avoid a new task.
   */
  fun install(activityContext: Context): PebbleInstallResult {
    val ready = _state.value as? PebbleSideloadState.Ready ?: return PebbleInstallResult.NotReady
    val file = File(cacheDir(), PebbleSideloadVerifier.fileNameFor(ready.sha256))
    if (!file.isFile) return PebbleInstallResult.NotReady
    val uri =
      FileProvider.getUriForFile(
        activityContext,
        activityContext.packageName + FILE_PROVIDER_SUFFIX,
        file,
      )
    val view =
      Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, PBW_MIME_TYPE)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
    return try {
      activityContext.startActivity(view)
      PebbleInstallResult.Launched
    } catch (_: ActivityNotFoundException) {
      launchChooser(activityContext, view)
    }
  }

  private fun launchChooser(
    activityContext: Context,
    view: Intent,
  ): PebbleInstallResult =
    try {
      val chooser = Intent.createChooser(view, CHOOSER_TITLE)
      chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      activityContext.startActivity(chooser)
      PebbleInstallResult.Launched
    } catch (_: ActivityNotFoundException) {
      PebbleInstallResult.NoHandler(NO_HANDLER_GUIDANCE)
    }

  /** Drop every cached bundle that is not [currentSha256]. */
  private suspend fun pruneTo(currentSha256: String) {
    withContext(Dispatchers.IO) {
      deleteAll(PebbleSideloadVerifier.staleAfterDownload(cachedFiles(), currentSha256))
    }
  }

  /** Best-effort age sweep, run when the screen opens. Failures here are not worth reporting. */
  suspend fun sweepExpired(nowMs: Long) {
    withContext(Dispatchers.IO) {
      deleteAll(PebbleSideloadVerifier.expired(cachedFiles(), nowMs))
    }
  }

  private suspend fun writeBundle(
    sha256: String,
    bytes: ByteArray,
  ): Boolean =
    withContext(Dispatchers.IO) {
      val dir = cacheDir()
      if (!dir.isDirectory && !dir.mkdirs()) return@withContext false
      val target = File(dir, PebbleSideloadVerifier.fileNameFor(sha256))
      try {
        target.writeBytes(bytes)
        true
      } catch (_: Throwable) {
        target.delete()
        false
      }
    }

  private fun cachedFiles(): List<PebbleCachedFile> {
    val listing = cacheDir().listFiles() ?: return emptyList()
    return listing.filter { it.isFile }.map { PebbleCachedFile(it.name, it.lastModified()) }
  }

  private fun deleteAll(names: List<String>) {
    val dir = cacheDir()
    for (name in names) {
      // Deletion is best effort: a file we failed to remove is stale cache, not a correctness bug.
      File(dir, name).delete()
    }
  }

  private fun cacheDir(): File = File(appContext.cacheDir, CACHE_DIR_NAME)
}
