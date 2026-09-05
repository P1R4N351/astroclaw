package ai.astroclaw.app.pebble

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** Everything the Pebble screen renders. Produced only by [PebbleController]. */
data class PebbleUiState(
  val configured: Boolean = false,
  /** A request is in flight. Blocks a second submission of the same gesture. */
  val busy: Boolean = false,
  val screen: PebbleScreen? = null,
  val commit: String = "",
  /** The server speaks a newer protocol major version than this build implements. */
  val upgradeAvailable: Boolean = false,
  val failure: PebbleFailure? = null,
  val health: PebbleHealth? = null,
  /** True once a root fetch has been attempted, so an empty screen is not mistaken for loading. */
  val loaded: Boolean = false,
)

/**
 * Navigation state machine for the Pebble Iris surface.
 *
 * Deliberately free of Android and Compose types so it can be exercised directly.
 *
 * Three invariants this class exists to hold:
 *
 * - A CONFIRMATION IS NEVER SYNTHESISED. [confirm] re-posts the `action` and `rid` that the server
 *   put in the confirm screen, and nothing else. There is no code path that fabricates a rid for a
 *   confirmation, and none that confirms without the user pressing Confirm.
 * - THERE IS NO AUTOMATIC REPLAY. Nothing here retries. A failed action is reported and stops. The
 *   actions behind this surface are physical events; a retry is a second real thing happening.
 * - A FAILED OR UNPARSEABLE RESPONSE CLEARS THE SCREEN. The user is never left looking at a screen
 *   that may no longer describe the server's state.
 */
class PebbleController(
  private val api: PebbleApi,
  private val configured: Boolean,
  private val requestIds: PebbleRequestIdSource = RandomPebbleRequestIdSource,
) {
  private val _state = MutableStateFlow(PebbleUiState(configured = configured))
  val state: StateFlow<PebbleUiState> = _state

  /** The screen a confirm prompt was raised from, so Cancel restores it without a round trip. */
  private var priorScreen: PebbleScreen? = null

  /** Health first (it is unauthenticated and tells us whether a watchapp is published), then root. */
  suspend fun open() {
    refreshHealth()
    loadRoot()
  }

  /**
   * Fetch `/pebble/health`. Failures here are recorded on the health slot only and do NOT raise the
   * error banner: health is a side fact, and losing it must not look like the surface is broken.
   */
  suspend fun refreshHealth() {
    if (!configured) return
    when (val outcome = api.health()) {
      is PebbleOutcome.Success -> _state.value = _state.value.copy(health = outcome.value)
      is PebbleOutcome.Failure -> _state.value = _state.value.copy(health = null)
    }
  }

  /** Load the root menu. */
  suspend fun loadRoot() {
    if (!configured) {
      _state.value = _state.value.copy(loaded = true)
      return
    }
    if (!beginRequest()) return
    priorScreen = null
    val outcome = api.ui()
    applyOutcome(outcome)
  }

  /**
   * Act on a menu row. Mints a FRESH rid: this is a new user gesture, not a confirmation.
   *
   * @return false when the request was refused because another one is already in flight.
   */
  suspend fun activate(actionId: String): Boolean {
    if (!configured || actionId.isBlank()) return false
    if (!beginRequest()) return false
    val from = _state.value.screen
    val outcome = api.action(action = actionId, rid = requestIds.next(), confirm = false)
    priorScreen = from
    applyOutcome(outcome)
    return true
  }

  /**
   * Confirm the prompt currently on screen by re-posting ITS action and ITS rid with `confirm:true`.
   *
   * @return false when there is no confirm prompt on screen, or a request is already in flight.
   */
  suspend fun confirm(): Boolean {
    val prompt = _state.value.screen as? PebbleScreen.Confirm ?: return false
    if (!configured) return false
    if (!beginRequest()) return false
    val outcome = api.action(action = prompt.action, rid = prompt.rid, confirm = true)
    applyOutcome(outcome)
    return true
  }

  /**
   * Dismiss a confirm prompt locally. Sends nothing: declining to act is not an action, and the
   * server's rid simply expires unclaimed.
   *
   * @return false when there was no confirm prompt to cancel.
   */
  fun cancelConfirm(): Boolean {
    if (_state.value.screen !is PebbleScreen.Confirm) return false
    _state.value = _state.value.copy(screen = priorScreen, failure = null)
    priorScreen = null
    return true
  }

  /** Clear a displayed failure without sending anything. */
  fun dismissFailure() {
    _state.value = _state.value.copy(failure = null)
  }

  /** @return false when a request is already in flight, in which case the caller must not proceed. */
  private fun beginRequest(): Boolean {
    if (_state.value.busy) return false
    _state.value = _state.value.copy(busy = true, failure = null)
    return true
  }

  private fun applyOutcome(outcome: PebbleOutcome<PebbleEnvelope>) {
    _state.value =
      when (outcome) {
        is PebbleOutcome.Success ->
          _state.value.copy(
            busy = false,
            loaded = true,
            screen = outcome.value.screen,
            commit = outcome.value.commit,
            upgradeAvailable = outcome.value.newerProtocol,
            failure = null,
          )
        is PebbleOutcome.Failure ->
          _state.value.copy(
            busy = false,
            loaded = true,
            screen = null,
            failure = outcome.failure,
          )
      }
  }
}
