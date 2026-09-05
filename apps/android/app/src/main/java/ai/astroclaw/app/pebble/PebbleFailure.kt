package ai.astroclaw.app.pebble

import java.io.InterruptedIOException
import java.net.ConnectException
import java.net.NoRouteToHostException
import java.net.PortUnreachableException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.net.ssl.SSLException

/**
 * The distinct ways a Pebble Iris request can fail.
 *
 * These are kept apart on purpose, because they call for different human actions:
 * "the token was rejected" is a settings problem, "nothing was sent" is a network problem, and
 * "the outcome is unknown" means DO NOT blindly press again — the household action behind an
 * `announce` or a `workshop.light` is a real physical event.
 */
sealed interface PebbleFailure {
  /** HTTP 401. The stored `X-Iris-Token` is absent, wrong, or has been rotated server-side. */
  data object TokenRejected : PebbleFailure

  /** The connection never established. Nothing was sent. */
  data class Unreachable(
    val detail: String,
  ) : PebbleFailure

  /** The request was sent but no usable answer came back. Outcome unknown. */
  data class Timeout(
    val detail: String,
  ) : PebbleFailure

  /** A response arrived but was not protocol-shaped, or the configuration is unusable. */
  data class Protocol(
    val detail: String,
  ) : PebbleFailure

  /** The server answered with a non-2xx status other than 401. The action did not succeed. */
  data class ServerError(
    val status: Int,
    val detail: String,
  ) : PebbleFailure

  /** Downloaded bytes did not match the SHA-256 the server published. Never installed. */
  data class Integrity(
    val detail: String,
  ) : PebbleFailure
}

/** Result of one Pebble Iris request. */
sealed interface PebbleOutcome<out T> {
  data class Success<T>(
    val value: T,
  ) : PebbleOutcome<T>

  data class Failure(
    val failure: PebbleFailure,
  ) : PebbleOutcome<Nothing>
}

/** How prominently a failure should be drawn. Kept out of Compose so it can be asserted on. */
enum class PebbleFailureTone {
  /** The action definitely did not happen, or the surface is misconfigured. */
  Danger,

  /** The outcome is unknown, or the network is at fault. Do not blindly retry. */
  Caution,
}

/**
 * User-facing wording for each failure class.
 *
 * The five classes are given five DIFFERENT headlines on purpose. Collapsing "token rejected" and
 * "cannot reach the server" into one "something went wrong" would hide which of two completely
 * different repairs is needed.
 */
object PebbleFailureText {
  fun title(failure: PebbleFailure): String =
    when (failure) {
      is PebbleFailure.TokenRejected -> "Token rejected"
      is PebbleFailure.Unreachable -> "Cannot reach Pebble Iris"
      is PebbleFailure.Timeout -> "Outcome unknown"
      is PebbleFailure.Protocol -> "Unsupported response"
      is PebbleFailure.ServerError -> "Server error"
      is PebbleFailure.Integrity -> "Integrity check failed"
    }

  fun detail(failure: PebbleFailure): String =
    when (failure) {
      is PebbleFailure.TokenRejected ->
        "The server refused the Pebble Iris token. Check the token in Settings."
      is PebbleFailure.Unreachable -> failure.detail
      is PebbleFailure.Timeout -> failure.detail
      is PebbleFailure.Protocol -> failure.detail
      is PebbleFailure.ServerError -> failure.detail
      is PebbleFailure.Integrity -> failure.detail
    }

  fun tone(failure: PebbleFailure): PebbleFailureTone =
    when (failure) {
      is PebbleFailure.Unreachable, is PebbleFailure.Timeout -> PebbleFailureTone.Caution
      else -> PebbleFailureTone.Danger
    }

  /** True when the failure is the fail-closed "this build will not render that" case. */
  fun isUnsupportedResponse(failure: PebbleFailure): Boolean = failure is PebbleFailure.Protocol
}

/**
 * Maps transport exceptions and HTTP statuses onto [PebbleFailure].
 *
 * Split out of [PebbleClient] so the mapping is testable without a socket: the classification IS
 * the interesting behaviour, and a test that has to stand up a web server to check it ends up
 * testing the web server.
 *
 * NO EXCEPTION MESSAGE IS PROPAGATED. OkHttp's connect failures embed the target host, and this
 * app must never surface authenticated endpoint URLs. Callers get the exception's simple class
 * name, which is enough to distinguish causes and carries nothing secret.
 */
object PebbleFailureClassifier {
  private const val HTTP_OK_MIN = 200
  private const val HTTP_OK_MAX = 299
  private const val HTTP_UNAUTHORIZED = 401
  private const val HTTP_REQUEST_TIMEOUT = 408
  private const val HTTP_GATEWAY_TIMEOUT = 504

  /**
   * @return null when [status] is a success this client should try to parse, else the failure.
   */
  fun fromStatus(status: Int): PebbleFailure? {
    if (status in HTTP_OK_MIN..HTTP_OK_MAX) return null
    if (status == HTTP_UNAUTHORIZED) return PebbleFailure.TokenRejected
    if (status == HTTP_REQUEST_TIMEOUT || status == HTTP_GATEWAY_TIMEOUT) {
      return PebbleFailure.Timeout("Server reported a timeout (HTTP $status).")
    }
    return PebbleFailure.ServerError(status, "Server returned HTTP $status.")
  }

  /**
   * Classify a transport-level throwable.
   *
   * An UNRECOGNISED transport error is classified as a timeout, not as unreachable. "Unreachable"
   * asserts that the side effect did not happen; making that claim without knowing invites a
   * second press on a physical light. Erring toward "outcome unknown" is the safe direction, and
   * matches how the server classifies its own upstream failures.
   */
  fun fromThrowable(error: Throwable): PebbleFailure {
    val name = error.javaClass.simpleName
    return when (error) {
      is UnknownHostException ->
        PebbleFailure.Unreachable("Host could not be resolved. Nothing was sent.")
      is ConnectException, is NoRouteToHostException, is PortUnreachableException ->
        PebbleFailure.Unreachable("Connection refused or unroutable. Nothing was sent.")
      is SSLException ->
        PebbleFailure.Unreachable("TLS handshake failed. Nothing was sent. ($name)")
      is SocketTimeoutException ->
        PebbleFailure.Timeout("Request timed out. Outcome unknown — check before retrying.")
      is InterruptedIOException ->
        PebbleFailure.Timeout("Request was interrupted. Outcome unknown — check before retrying.")
      else ->
        PebbleFailure.Timeout("Transport error ($name). Outcome unknown — check before retrying.")
    }
  }
}
