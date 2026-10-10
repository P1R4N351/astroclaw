package ai.astroclaw.app.pebble

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException
import java.io.InterruptedIOException
import java.net.ConnectException
import java.net.NoRouteToHostException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.net.ssl.SSLHandshakeException

class PebbleFailureClassifierTest {
  @Test
  fun successStatusesAreNotFailures() {
    assertNull(PebbleFailureClassifier.fromStatus(200))
    assertNull(PebbleFailureClassifier.fromStatus(204))
    assertNull(PebbleFailureClassifier.fromStatus(299))
  }

  @Test
  fun unauthorizedIsTokenRejected() {
    assertEquals(PebbleFailure.TokenRejected, PebbleFailureClassifier.fromStatus(401))
  }

  @Test
  fun serverStatusesAreServerErrors() {
    val failure = PebbleFailureClassifier.fromStatus(500) as PebbleFailure.ServerError
    assertEquals(500, failure.status)
    assertTrue(PebbleFailureClassifier.fromStatus(403) is PebbleFailure.ServerError)
    assertTrue(PebbleFailureClassifier.fromStatus(404) is PebbleFailure.ServerError)
  }

  @Test
  fun upstreamTimeoutStatusesAreTimeouts() {
    assertTrue(PebbleFailureClassifier.fromStatus(408) is PebbleFailure.Timeout)
    assertTrue(PebbleFailureClassifier.fromStatus(504) is PebbleFailure.Timeout)
  }

  @Test
  fun connectionFailuresAreUnreachable() {
    assertTrue(PebbleFailureClassifier.fromThrowable(UnknownHostException("h")) is PebbleFailure.Unreachable)
    assertTrue(PebbleFailureClassifier.fromThrowable(ConnectException("refused")) is PebbleFailure.Unreachable)
    assertTrue(PebbleFailureClassifier.fromThrowable(NoRouteToHostException("no route")) is PebbleFailure.Unreachable)
    assertTrue(PebbleFailureClassifier.fromThrowable(SSLHandshakeException("tls")) is PebbleFailure.Unreachable)
  }

  @Test
  fun timeoutsAreTimeouts() {
    assertTrue(PebbleFailureClassifier.fromThrowable(SocketTimeoutException("t")) is PebbleFailure.Timeout)
    assertTrue(PebbleFailureClassifier.fromThrowable(InterruptedIOException("i")) is PebbleFailure.Timeout)
  }

  @Test
  fun unrecognisedTransportErrorsBecomeOutcomeUnknown() {
    // Erring toward "we do not know" is the safe direction: claiming "nothing was sent" about a
    // physical action invites a second press.
    val failure = PebbleFailureClassifier.fromThrowable(IOException("stream closed"))
    assertTrue(failure is PebbleFailure.Timeout)
  }

  @Test
  fun classifiedTextNeverLeaksTheExceptionMessage() {
    // OkHttp embeds the target host in connect failures; those must not reach the UI verbatim.
    val secretish = "https://trueblue.example:18879/pebble/action?token=hunter2"
    val failure = PebbleFailureClassifier.fromThrowable(ConnectException(secretish))
    assertFalse(PebbleFailureText.detail(failure).contains(secretish))
    assertFalse(PebbleFailureText.detail(failure).contains("hunter2"))
  }

  @Test
  fun everyFailureClassHasItsOwnHeadline() {
    val failures =
      listOf(
        PebbleFailure.TokenRejected,
        PebbleFailure.Unreachable("a"),
        PebbleFailure.Timeout("b"),
        PebbleFailure.Protocol("c"),
        PebbleFailure.ServerError(500, "d"),
        PebbleFailure.Integrity("e"),
      )
    val titles = failures.map { PebbleFailureText.title(it) }
    assertEquals(failures.size, titles.toSet().size)
  }

  @Test
  fun onlyProtocolFailuresAreTheUnsupportedResponseView() {
    assertTrue(PebbleFailureText.isUnsupportedResponse(PebbleFailure.Protocol("x")))
    assertFalse(PebbleFailureText.isUnsupportedResponse(PebbleFailure.TokenRejected))
    assertFalse(PebbleFailureText.isUnsupportedResponse(PebbleFailure.ServerError(500, "x")))
  }

  @Test
  fun networkFailuresAreDrawnAsCautionNotDanger() {
    assertEquals(PebbleFailureTone.Caution, PebbleFailureText.tone(PebbleFailure.Timeout("x")))
    assertEquals(PebbleFailureTone.Caution, PebbleFailureText.tone(PebbleFailure.Unreachable("x")))
    assertEquals(PebbleFailureTone.Danger, PebbleFailureText.tone(PebbleFailure.TokenRejected))
    assertEquals(PebbleFailureTone.Danger, PebbleFailureText.tone(PebbleFailure.Integrity("x")))
  }

  @Test
  fun endpointsResolveAgainstUserSuppliedBaseUrls() {
    assertEquals(
      "https://trueblue.tail8d99b6.ts.net:18879/pebble/action",
      PebbleClient.endpoint("https://trueblue.tail8d99b6.ts.net:18879", "pebble/action").toString(),
    )
    assertEquals(
      "https://example.org/pebble/ui",
      PebbleClient.endpoint("https://example.org///", "pebble/ui").toString(),
    )
    assertNull(PebbleClient.endpoint("", "pebble/ui"))
    assertNull(PebbleClient.endpoint("not a url", "pebble/ui"))
    assertNull(PebbleClient.endpoint("ftp://example.org", "pebble/ui"))
  }
}
