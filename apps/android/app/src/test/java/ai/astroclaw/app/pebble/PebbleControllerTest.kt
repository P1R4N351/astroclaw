package ai.astroclaw.app.pebble

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** One recorded POST to `/pebble/action`. */
private data class ActionCall(
  val action: String,
  val rid: String,
  val confirm: Boolean,
)

private class FakePebbleApi : PebbleApi {
  val calls = mutableListOf<ActionCall>()
  var healthOutcome: PebbleOutcome<PebbleHealth> =
    PebbleOutcome.Success(PebbleHealth(ok = true, version = 1, commit = "abc", uptimeSeconds = 1L, pbw = null))
  var uiOutcome: PebbleOutcome<PebbleEnvelope> = envelope(PebbleScreen.Menu("ROOT", listOf(item("workshop.open"))))
  var actionOutcomes: MutableList<PebbleOutcome<PebbleEnvelope>> = mutableListOf()

  /** When set, `action` blocks until completed, so "busy" can be observed deterministically. */
  var gate: CompletableDeferred<Unit>? = null

  override suspend fun health(): PebbleOutcome<PebbleHealth> = healthOutcome

  override suspend fun ui(): PebbleOutcome<PebbleEnvelope> = uiOutcome

  override suspend fun action(
    action: String,
    rid: String,
    confirm: Boolean,
  ): PebbleOutcome<PebbleEnvelope> {
    gate?.await()
    calls.add(ActionCall(action, rid, confirm))
    return if (actionOutcomes.isEmpty()) uiOutcome else actionOutcomes.removeAt(0)
  }

  override suspend fun fetchPbw(): PebbleOutcome<PebblePbwPayload> =
    PebbleOutcome.Failure(PebbleFailure.Protocol("not used"))
}

private fun item(id: String): PebbleMenuItem = PebbleMenuItem(id = id, label = id, sub = null)

private fun envelope(
  screen: PebbleScreen,
  version: Int = 1,
): PebbleOutcome<PebbleEnvelope> =
  PebbleOutcome.Success(
    PebbleEnvelope(version = version, commit = "abc", screen = screen, newerProtocol = version > 1),
  )

private val confirmScreen =
  PebbleScreen.Confirm(
    title = "LIGHT",
    body = "Toggle the workshop light?",
    action = "workshop.light",
    rid = "7f3d9a10-0000-4000-8000-000000000001",
  )

/** Deterministic rid sequence so "fresh per gesture" is checked, not hoped for. */
private class SequenceIds : PebbleRequestIdSource {
  private var index = 0

  override fun next(): String {
    index += 1
    return "0000000$index-0000-4000-8000-00000000000$index"
  }
}

@OptIn(ExperimentalCoroutinesApi::class)
class PebbleControllerTest {
  @Test
  fun openLoadsHealthAndRootMenu() =
    runTest {
      val api = FakePebbleApi()
      val controller = PebbleController(api = api, configured = true, requestIds = SequenceIds())
      controller.open()
      val state = controller.state.value
      assertTrue(state.screen is PebbleScreen.Menu)
      assertEquals("abc", state.commit)
      assertTrue(state.loaded)
      assertNull(state.failure)
      assertFalse(state.busy)
    }

  @Test
  fun unconfiguredControllerSendsNothing() =
    runTest {
      val api = FakePebbleApi()
      val controller = PebbleController(api = api, configured = false, requestIds = SequenceIds())
      controller.open()
      assertFalse(controller.activate("workshop.light"))
      assertTrue(api.calls.isEmpty())
      assertNull(controller.state.value.screen)
    }

  @Test
  fun everyGestureMintsAFreshRid() =
    runTest {
      val api = FakePebbleApi()
      val controller = PebbleController(api = api, configured = true, requestIds = SequenceIds())
      controller.open()
      controller.activate("workshop.occupancy")
      controller.activate("workshop.occupancy")
      assertEquals(2, api.calls.size)
      assertNotEquals(api.calls[0].rid, api.calls[1].rid)
      assertFalse(api.calls[0].confirm)
      assertFalse(api.calls[1].confirm)
    }

  @Test
  fun confirmReusesThePromptsOwnRid() =
    runTest {
      val api = FakePebbleApi()
      api.actionOutcomes = mutableListOf(envelope(confirmScreen))
      val controller = PebbleController(api = api, configured = true, requestIds = SequenceIds())
      controller.open()
      controller.activate("workshop.light")
      assertTrue(controller.confirm())

      assertEquals(2, api.calls.size)
      val prompt = api.calls[0]
      val confirmation = api.calls[1]
      assertFalse(prompt.confirm)
      assertTrue(confirmation.confirm)
      assertEquals(confirmScreen.rid, confirmation.rid)
      assertEquals(confirmScreen.action, confirmation.action)
      // The confirmation must NOT invent a rid of its own.
      assertNotEquals(prompt.rid, confirmation.rid)
    }

  @Test
  fun confirmWithoutAPromptIsRefused() =
    runTest {
      val api = FakePebbleApi()
      val controller = PebbleController(api = api, configured = true, requestIds = SequenceIds())
      controller.open()
      assertFalse(controller.confirm())
      assertTrue(api.calls.isEmpty())
    }

  @Test
  fun cancelSendsNothingAndRestoresThePreviousScreen() =
    runTest {
      val api = FakePebbleApi()
      api.actionOutcomes = mutableListOf(envelope(confirmScreen))
      val controller = PebbleController(api = api, configured = true, requestIds = SequenceIds())
      controller.open()
      controller.activate("workshop.light")
      assertTrue(controller.state.value.screen is PebbleScreen.Confirm)

      assertTrue(controller.cancelConfirm())
      assertEquals(1, api.calls.size)
      assertTrue(controller.state.value.screen is PebbleScreen.Menu)
    }

  @Test
  fun busyBlocksASecondSubmissionOfTheSameGesture() =
    runTest {
      val api = FakePebbleApi()
      val controller = PebbleController(api = api, configured = true, requestIds = SequenceIds())
      controller.open()

      val gate = CompletableDeferred<Unit>()
      api.gate = gate
      val inFlight = launch { controller.activate("workshop.light") }
      runCurrent()
      assertTrue(controller.state.value.busy)
      assertFalse(controller.activate("workshop.light"))

      gate.complete(Unit)
      inFlight.join()
      assertEquals(1, api.calls.size)
      assertFalse(controller.state.value.busy)
    }

  @Test
  fun failureClearsTheScreenAndIsNeverRetried() =
    runTest {
      val api = FakePebbleApi()
      api.actionOutcomes = mutableListOf(PebbleOutcome.Failure(PebbleFailure.Timeout("unknown")))
      val controller = PebbleController(api = api, configured = true, requestIds = SequenceIds())
      controller.open()
      controller.activate("workshop.light")

      assertNull(controller.state.value.screen)
      assertTrue(controller.state.value.failure is PebbleFailure.Timeout)
      // Exactly one dispatch: nothing in this class replays a failed action.
      assertEquals(1, api.calls.size)
    }

  @Test
  fun newerProtocolIsSurfacedAsAnUpgradeHint() =
    runTest {
      val api = FakePebbleApi()
      api.uiOutcome = envelope(PebbleScreen.Card("T", "B", vibe = false), version = 2)
      val controller = PebbleController(api = api, configured = true, requestIds = SequenceIds())
      controller.open()
      assertTrue(controller.state.value.upgradeAvailable)
      assertTrue(controller.state.value.screen is PebbleScreen.Card)
    }

  @Test
  fun healthFailureDoesNotRaiseTheErrorBanner() =
    runTest {
      val api = FakePebbleApi()
      api.healthOutcome = PebbleOutcome.Failure(PebbleFailure.Unreachable("down"))
      val controller = PebbleController(api = api, configured = true, requestIds = SequenceIds())
      controller.open()
      assertNull(controller.state.value.health)
      assertNull(controller.state.value.failure)
      assertTrue(controller.state.value.screen is PebbleScreen.Menu)
    }
}
