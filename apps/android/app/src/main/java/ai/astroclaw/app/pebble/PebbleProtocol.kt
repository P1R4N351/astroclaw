package ai.astroclaw.app.pebble

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.longOrNull

/**
 * Pebble Iris protocol v1 — strict client-side renderer contract.
 *
 * The server (`pebble-iris`, Node-RED on CT908) owns every decision; this app renders what it is
 * told and reports which row was pressed. Parsing is therefore deliberately asymmetric:
 *
 * - UNKNOWN FIELDS ARE TOLERATED. The protocol evolves additively, so an object carrying keys this
 *   build has never heard of still parses.
 * - UNKNOWN SHAPES FAIL CLOSED. An unrecognised `screen.type`, a wrong-typed field, or a missing
 *   load-bearing field yields [PebbleParse.Unsupported], never a partially rendered screen and
 *   never a guess. A confirm prompt with no `rid` is the case that matters: guessing there would
 *   mean fabricating a confirmation for a physical side effect.
 * - A NEWER MAJOR VERSION IS NOT FATAL BY ITSELF. `v > 1` carrying a screen type this build knows
 *   renders, flagged [PebbleEnvelope.newerProtocol] so the UI can say an upgrade is available.
 *   `v > 1` carrying an unknown screen type is unsupported, same as any other unknown shape.
 */
object PebbleProtocol {
  /** Protocol major version this client implements. */
  const val VERSION: Int = 1

  /** Screen types this build can render. Anything else is unsupported, at any protocol version. */
  private val KNOWN_SCREEN_TYPES = setOf("menu", "card", "confirm", "result")

  private const val COMMIT_MAX = 16
  private const val SHA256_HEX_LENGTH = 64

  /**
   * Hard ceiling on rendered menu rows. The server caps a menu at 8 and treats a 9th as a
   * programming error; this larger client-side ceiling leaves room for the server's cap to rise
   * without a client release, while still bounding the parse loop by a constant rather than by
   * whatever the network hands us.
   */
  private const val MENU_ITEMS_MAX = 64

  private val json = Json { ignoreUnknownKeys = true }

  /**
   * Parse a `/pebble/ui` or `/pebble/action` response body.
   *
   * @param raw response body as received; never logged by this class.
   * @return [PebbleParse.Ok] with a fully typed envelope, or [PebbleParse.Unsupported] with a
   *   human-readable reason suitable for the fail-closed view.
   */
  fun parseEnvelope(raw: String): PebbleParse {
    val root = parseObject(raw) ?: return PebbleParse.Unsupported("Response was not a JSON object.")
    val version =
      root.intField("v")
        ?: return PebbleParse.Unsupported("Response carried no protocol version.")
    if (version < 1) {
      return PebbleParse.Unsupported("Unknown protocol version $version.")
    }
    val screenObject =
      root["screen"] as? JsonObject
        ?: return PebbleParse.Unsupported("Response carried no screen.")
    val type =
      screenObject.stringField("type")
        ?: return PebbleParse.Unsupported("Screen carried no type.")
    if (type !in KNOWN_SCREEN_TYPES) {
      return PebbleParse.Unsupported("Unsupported screen type \"$type\".")
    }
    val screen = parseScreen(type, screenObject) ?: return PebbleParse.Unsupported(malformed(type))
    return PebbleParse.Ok(
      PebbleEnvelope(
        version = version,
        commit = root.stringField("commit").orEmpty().take(COMMIT_MAX),
        screen = screen,
        newerProtocol = version > VERSION,
      ),
    )
  }

  /**
   * Parse a `/pebble/health` response body.
   *
   * @return null when the body is not a recognisable health document, which the caller reports as
   *   a protocol error rather than as an unhealthy server.
   */
  fun parseHealth(raw: String): PebbleHealth? {
    val root = parseObject(raw) ?: return null
    val version = root.intField("v") ?: return null
    val ok = (root["ok"] as? JsonPrimitive)?.booleanOrNull ?: return null
    return PebbleHealth(
      ok = ok,
      version = version,
      commit = root.stringField("commit").orEmpty().take(COMMIT_MAX),
      uptimeSeconds = (root["uptime_s"] as? JsonPrimitive)?.longOrNull ?: 0L,
      pbw = parsePbw(root["pbw"] as? JsonObject),
    )
  }

  /**
   * A malformed `pbw` block is reported as ABSENT, not as an error: the only thing it gates is the
   * sideload offer, and withholding that offer is the safe direction.
   */
  private fun parsePbw(node: JsonObject?): PebblePbwInfo? {
    if (node == null) return null
    val version = node.stringField("version")?.trim().orEmpty()
    val sha =
      node
        .stringField("sha256")
        ?.trim()
        ?.lowercase()
        .orEmpty()
    if (version.isEmpty()) return null
    if (!isSha256Hex(sha)) return null
    return PebblePbwInfo(version = version, sha256 = sha)
  }

  /** True when [value] is exactly 64 lowercase hex characters. */
  fun isSha256Hex(value: String): Boolean {
    if (value.length != SHA256_HEX_LENGTH) return false
    return value.all { it in '0'..'9' || it in 'a'..'f' }
  }

  private fun parseScreen(
    type: String,
    node: JsonObject,
  ): PebbleScreen? =
    when (type) {
      "menu" -> parseMenu(node)
      "card" -> PebbleScreen.Card(title = node.title(), body = node.body(), vibe = node.vibe())
      "confirm" -> parseConfirm(node)
      "result" -> PebbleScreen.Result(title = node.title(), body = node.body(), vibe = node.vibe())
      else -> null
    }

  private fun parseMenu(node: JsonObject): PebbleScreen? {
    val rawItems = node["items"] as? JsonArray ?: return null
    if (rawItems.size > MENU_ITEMS_MAX) return null
    val items = ArrayList<PebbleMenuItem>(rawItems.size)
    for (element in rawItems) {
      val item = element as? JsonObject ?: return null
      val id = item.stringField("id")?.trim().orEmpty()
      val label = item.stringField("label") ?: return null
      if (id.isEmpty()) return null
      items.add(PebbleMenuItem(id = id, label = label, sub = item.stringField("sub")))
    }
    return PebbleScreen.Menu(title = node.title(), items = items)
  }

  /**
   * `action` and `rid` are mandatory. The client re-posts exactly these two values with
   * `confirm:true`; without them there is nothing to confirm and nothing may be invented.
   */
  private fun parseConfirm(node: JsonObject): PebbleScreen? {
    val action = node.stringField("action")?.trim().orEmpty()
    val rid = node.stringField("rid")?.trim().orEmpty()
    if (action.isEmpty() || rid.isEmpty()) return null
    return PebbleScreen.Confirm(
      title = node.title(),
      body = node.body(),
      action = action,
      rid = rid,
    )
  }

  private fun malformed(type: String): String = "Malformed \"$type\" screen."

  private fun parseObject(raw: String): JsonObject? =
    try {
      json.parseToJsonElement(raw) as? JsonObject
    } catch (_: Throwable) {
      // Any parse failure is one fact to the user: the response was not protocol-shaped.
      null
    }

  private fun JsonObject.title(): String = stringField("title").orEmpty()

  private fun JsonObject.body(): String = stringField("body").orEmpty()

  private fun JsonObject.vibe(): Boolean = (this["vibe"] as? JsonPrimitive)?.booleanOrNull ?: false

  /** Reads a JSON string field. A number or boolean in a string slot is a type error, not a value. */
  private fun JsonObject.stringField(key: String): String? {
    val primitive = this[key] as? JsonPrimitive ?: return null
    return if (primitive.isString) primitive.content else null
  }

  /** Reads a JSON integer field. A quoted number is a type error, not a value. */
  private fun JsonObject.intField(key: String): Int? {
    val primitive = this[key] as? JsonPrimitive ?: return null
    return if (primitive.isString) null else primitive.intOrNull
  }
}

/** One row of a `menu` screen. [id] is the action to POST when the row is pressed. */
data class PebbleMenuItem(
  val id: String,
  val label: String,
  val sub: String?,
)

/** The four screen types of protocol v1. The allowlist is closed by design. */
sealed interface PebbleScreen {
  data class Menu(
    val title: String,
    val items: List<PebbleMenuItem>,
  ) : PebbleScreen

  data class Card(
    val title: String,
    val body: String,
    val vibe: Boolean,
  ) : PebbleScreen

  data class Confirm(
    val title: String,
    val body: String,
    val action: String,
    val rid: String,
  ) : PebbleScreen

  data class Result(
    val title: String,
    val body: String,
    val vibe: Boolean,
  ) : PebbleScreen
}

/** A parsed protocol envelope. */
data class PebbleEnvelope(
  val version: Int,
  val commit: String,
  val screen: PebbleScreen,
  /** True when the server speaks a newer major version than this build implements. */
  val newerProtocol: Boolean,
)

/** Outcome of [PebbleProtocol.parseEnvelope]. */
sealed interface PebbleParse {
  data class Ok(
    val envelope: PebbleEnvelope,
  ) : PebbleParse

  /** Fail-closed: the response was not something this build is willing to render. */
  data class Unsupported(
    val reason: String,
  ) : PebbleParse
}

/** `pbw` block of `/pebble/health`; present only when the server publishes a watchapp build. */
data class PebblePbwInfo(
  val version: String,
  /** Lowercase 64-char hex SHA-256 of the `.pbw` bytes. */
  val sha256: String,
)

/** Parsed `/pebble/health` document. This endpoint is unauthenticated by design. */
data class PebbleHealth(
  val ok: Boolean,
  val version: Int,
  val commit: String,
  val uptimeSeconds: Long,
  val pbw: PebblePbwInfo?,
)
