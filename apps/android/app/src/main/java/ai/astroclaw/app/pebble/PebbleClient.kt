package ai.astroclaw.app.pebble

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/** Where the Pebble Iris app lives and the credential that opens it. */
data class PebbleConfig(
  val baseUrl: String,
  val token: String,
) {
  /**
   * True when both halves are present. An empty token must produce a setup hint, NOT a request:
   * firing an unauthenticated action at the server only earns a 401 and teaches the user nothing.
   */
  val isConfigured: Boolean
    get() = baseUrl.isNotBlank() && token.isNotBlank()
}

/** Protocol surface the UI talks to. Implemented by [PebbleClient]; faked in tests. */
interface PebbleApi {
  suspend fun health(): PebbleOutcome<PebbleHealth>

  suspend fun ui(): PebbleOutcome<PebbleEnvelope>

  suspend fun action(
    action: String,
    rid: String,
    confirm: Boolean,
  ): PebbleOutcome<PebbleEnvelope>

  suspend fun fetchPbw(): PebbleOutcome<PebblePbwPayload>
}

/** Raw `.pbw` bytes plus what the server said about them. Nothing here is trusted yet. */
data class PebblePbwPayload(
  val bytes: ByteArray,
  val declaredSha256: String,
  val declaredVersion: String,
  val declaredEtag: String,
) {
  override fun equals(other: Any?): Boolean {
    if (this === other) return true
    if (other !is PebblePbwPayload) return false
    return declaredSha256 == other.declaredSha256 &&
      declaredVersion == other.declaredVersion &&
      declaredEtag == other.declaredEtag &&
      bytes.contentEquals(other.bytes)
  }

  override fun hashCode(): Int {
    var result = bytes.contentHashCode()
    result = 31 * result + declaredSha256.hashCode()
    result = 31 * result + declaredVersion.hashCode()
    result = 31 * result + declaredEtag.hashCode()
    return result
  }
}

/**
 * HTTP client for the Pebble Iris protocol.
 *
 * Logging discipline: this class logs NOTHING. The token travels in a header and the endpoint URLs
 * are authenticated surfaces; neither may reach logcat, a crash report, or a diagnostics blob.
 * Failure text is assembled from [PebbleFailureClassifier], which propagates no exception message.
 */
class PebbleClient(
  private val config: PebbleConfig,
  private val callFactory: Call.Factory = defaultCallFactory(),
) : PebbleApi {
  companion object {
    /** Default Pebble Iris front. `tailscale serve` on trueblue proxies this to CT908. */
    const val DEFAULT_BASE_URL = "https://trueblue.tail8d99b6.ts.net:18879"

    const val TOKEN_HEADER = "X-Iris-Token"

    private const val CONNECT_TIMEOUT_SECONDS = 5L
    private const val READ_TIMEOUT_SECONDS = 20L

    /**
     * Ceiling on a downloaded `.pbw`. Real builds are a few hundred KB; this bounds the read loop
     * by a constant so a hostile or broken server cannot make the app allocate without limit.
     */
    const val PBW_MAX_BYTES: Int = 8 * 1024 * 1024

    private const val COPY_CHUNK_BYTES = 32 * 1024

    private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

    fun defaultCallFactory(): Call.Factory =
      OkHttpClient
        .Builder()
        .connectTimeout(CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .readTimeout(READ_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .writeTimeout(READ_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .retryOnConnectionFailure(false)
        .build()

    /**
     * Resolve an endpoint against a user-supplied base URL.
     *
     * @return null when the base URL is not a usable http(s) URL, which the caller reports as a
     *   configuration (protocol) failure rather than attempting a request.
     */
    fun endpoint(
      baseUrl: String,
      path: String,
    ): HttpUrl? {
      val trimmed = baseUrl.trim().trimEnd('/')
      if (trimmed.isEmpty()) return null
      val parsed = trimmed.toHttpUrlOrNull() ?: return null
      val builder = parsed.newBuilder()
      for (segment in path.split('/')) {
        if (segment.isNotEmpty()) builder.addPathSegment(segment)
      }
      return builder.build()
    }
  }

  override suspend fun health(): PebbleOutcome<PebbleHealth> {
    val url =
      endpoint(config.baseUrl, "pebble/health")
        ?: return configFailure()
    // Health is deliberately unauthenticated: it has to stay answerable when the token is the
    // thing that is broken.
    val request =
      Request
        .Builder()
        .url(url)
        .get()
        .build()
    return textRequest(request) { body ->
      val parsed = PebbleProtocol.parseHealth(body)
      if (parsed == null) {
        PebbleOutcome.Failure(PebbleFailure.Protocol("Health response was not protocol-shaped."))
      } else {
        PebbleOutcome.Success(parsed)
      }
    }
  }

  override suspend fun ui(): PebbleOutcome<PebbleEnvelope> {
    if (!config.isConfigured) return notConfigured()
    val url = endpoint(config.baseUrl, "pebble/ui") ?: return configFailure()
    val request = authenticated(Request.Builder().url(url).get()).build()
    return textRequest(request) { body -> envelopeOf(body) }
  }

  override suspend fun action(
    action: String,
    rid: String,
    confirm: Boolean,
  ): PebbleOutcome<PebbleEnvelope> {
    if (!config.isConfigured) return notConfigured()
    if (action.isBlank()) return PebbleOutcome.Failure(PebbleFailure.Protocol("Empty action."))
    if (!PebbleRequestIds.isValid(rid)) {
      return PebbleOutcome.Failure(PebbleFailure.Protocol("Malformed request id."))
    }
    val url = endpoint(config.baseUrl, "pebble/action") ?: return configFailure()
    val payload =
      buildJsonObject {
        put("action", JsonPrimitive(action))
        put("rid", JsonPrimitive(rid))
        if (confirm) put("confirm", JsonPrimitive(true))
      }.toString()
    val request =
      authenticated(
        Request.Builder().url(url).post(payload.toRequestBody(JSON_MEDIA_TYPE)),
      ).build()
    return textRequest(request) { body -> envelopeOf(body) }
  }

  override suspend fun fetchPbw(): PebbleOutcome<PebblePbwPayload> {
    if (!config.isConfigured) return notConfigured()
    val url = endpoint(config.baseUrl, "pebble/pbw") ?: return configFailure()
    val request = authenticated(Request.Builder().url(url).get()).build()
    return withContext(Dispatchers.IO) {
      try {
        execute(request).use { response -> readPbw(response) }
      } catch (cancelled: CancellationException) {
        throw cancelled
      } catch (error: Throwable) {
        PebbleOutcome.Failure(PebbleFailureClassifier.fromThrowable(error))
      }
    }
  }

  private fun readPbw(response: Response): PebbleOutcome<PebblePbwPayload> {
    PebbleFailureClassifier.fromStatus(response.code)?.let { return PebbleOutcome.Failure(it) }
    val declaredLength = response.header("Content-Length")?.trim()?.toLongOrNull()
    if (declaredLength != null && declaredLength > PBW_MAX_BYTES) {
      return PebbleOutcome.Failure(PebbleFailure.Integrity("Watchapp exceeds the size ceiling."))
    }
    val bytes = readBounded(response) ?: return truncated()
    if (declaredLength != null && declaredLength != bytes.size.toLong()) {
      return PebbleOutcome.Failure(
        PebbleFailure.Integrity("Download was incomplete (${bytes.size} of $declaredLength bytes)."),
      )
    }
    if (bytes.isEmpty()) return PebbleOutcome.Failure(PebbleFailure.Integrity("Empty download."))
    return PebbleOutcome.Success(
      PebblePbwPayload(
        bytes = bytes,
        declaredSha256 =
          response
            .header("X-Pbw-Sha256")
            ?.trim()
            ?.lowercase()
            .orEmpty(),
        declaredVersion = response.header("X-Pbw-Version")?.trim().orEmpty(),
        declaredEtag =
          response
            .header("ETag")
            ?.trim()
            ?.trim('"')
            .orEmpty(),
      ),
    )
  }

  /** Reads at most [PBW_MAX_BYTES]; returns null when the stream would exceed that. */
  private fun readBounded(response: Response): ByteArray? {
    val sink = ByteArrayOutputStream()
    val chunk = ByteArray(COPY_CHUNK_BYTES)
    response.body.byteStream().use { stream ->
      // Bounded: the ceiling divided by the chunk size is a constant number of iterations.
      val maxIterations = (PBW_MAX_BYTES / COPY_CHUNK_BYTES) + 1
      for (iteration in 0 until maxIterations) {
        val read = stream.read(chunk)
        if (read < 0) return sink.toByteArray()
        if (sink.size() + read > PBW_MAX_BYTES) return null
        sink.write(chunk, 0, read)
      }
    }
    return null
  }

  private fun truncated(): PebbleOutcome<Nothing> = PebbleOutcome.Failure(PebbleFailure.Integrity("Watchapp exceeds the size ceiling."))

  private fun envelopeOf(body: String): PebbleOutcome<PebbleEnvelope> =
    when (val parsed = PebbleProtocol.parseEnvelope(body)) {
      is PebbleParse.Ok -> PebbleOutcome.Success(parsed.envelope)
      is PebbleParse.Unsupported -> PebbleOutcome.Failure(PebbleFailure.Protocol(parsed.reason))
    }

  private fun authenticated(builder: Request.Builder): Request.Builder = builder.header(TOKEN_HEADER, config.token)

  private fun <T> notConfigured(): PebbleOutcome<T> = PebbleOutcome.Failure(PebbleFailure.Protocol("Pebble Iris is not configured."))

  private fun <T> configFailure(): PebbleOutcome<T> = PebbleOutcome.Failure(PebbleFailure.Protocol("Base URL is not a valid http(s) URL."))

  private suspend fun <T> textRequest(
    request: Request,
    parse: (String) -> PebbleOutcome<T>,
  ): PebbleOutcome<T> =
    withContext(Dispatchers.IO) {
      try {
        execute(request).use { response ->
          val failure = PebbleFailureClassifier.fromStatus(response.code)
          if (failure != null) {
            PebbleOutcome.Failure(failure)
          } else {
            parse(response.body.string())
          }
        }
      } catch (cancelled: CancellationException) {
        throw cancelled
      } catch (error: Throwable) {
        PebbleOutcome.Failure(PebbleFailureClassifier.fromThrowable(error))
      }
    }

  /** Enqueue-and-suspend so that cancelling the caller's scope cancels the socket. */
  private suspend fun execute(request: Request): Response =
    suspendCancellableCoroutine { continuation ->
      val pending = callFactory.newCall(request)
      continuation.invokeOnCancellation { pending.cancel() }
      pending.enqueue(
        object : Callback {
          override fun onFailure(
            call: Call,
            e: IOException,
          ) {
            continuation.resumeWithException(e)
          }

          override fun onResponse(
            call: Call,
            response: Response,
          ) {
            continuation.resume(response)
          }
        },
      )
    }
}
