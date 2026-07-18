package ai.astroclaw.app.node

import ai.astroclaw.app.gateway.GatewaySession
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.provider.AlarmClock
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.Calendar

// Android exposes no content provider for alarms/timers; the only supported path
// is the AlarmClock intent API, which hands off to the device's clock app. With
// EXTRA_SKIP_UI the clock app creates the alarm/timer without opening its UI.
private const val TIMER_MAX_SECONDS = 86_400 // AOSP DeskClock / Google Clock cap timers at 24h.

internal data class AlarmSetRequest(
  val hour: Int,
  val minutes: Int,
  val message: String?,
  val days: List<Int>, // java.util.Calendar day-of-week ints (SUNDAY=1..SATURDAY=7)
  val vibrate: Boolean?,
  val ringtoneSilent: Boolean,
  val skipUi: Boolean,
)

internal data class AlarmTimerRequest(
  val seconds: Int,
  val message: String?,
  val skipUi: Boolean,
)

internal enum class AlarmSearchMode {
  Next,
  All,
  Label,
  Time,
}

internal data class AlarmDismissRequest(
  val mode: AlarmSearchMode,
  val hour: Int?,
  val minutes: Int?,
  val isPm: Boolean?,
  val message: String?,
)

internal class NoClockAppException : Exception("NO_CLOCK_APP: no clock app handles this action")

internal interface AlarmLauncher {
  fun set(
    context: Context,
    request: AlarmSetRequest,
  )

  fun setTimer(
    context: Context,
    request: AlarmTimerRequest,
  )

  fun show(context: Context)

  fun dismiss(
    context: Context,
    request: AlarmDismissRequest,
  )
}

private object SystemAlarmLauncher : AlarmLauncher {
  override fun set(
    context: Context,
    request: AlarmSetRequest,
  ) {
    val intent =
      Intent(AlarmClock.ACTION_SET_ALARM).apply {
        putExtra(AlarmClock.EXTRA_HOUR, request.hour)
        putExtra(AlarmClock.EXTRA_MINUTES, request.minutes)
        putExtra(AlarmClock.EXTRA_SKIP_UI, request.skipUi)
        request.message?.let { putExtra(AlarmClock.EXTRA_MESSAGE, it) }
        if (request.days.isNotEmpty()) {
          // EXTRA_DAYS is read back via getIntegerArrayListExtra, so it must be
          // stored as an integer ArrayList — not a plain Serializable extra.
          putIntegerArrayListExtra(AlarmClock.EXTRA_DAYS, ArrayList(request.days))
        }
        request.vibrate?.let { putExtra(AlarmClock.EXTRA_VIBRATE, it) }
        if (request.ringtoneSilent) {
          putExtra(AlarmClock.EXTRA_RINGTONE, AlarmClock.VALUE_RINGTONE_SILENT)
        }
      }
    launch(context, intent)
  }

  override fun setTimer(
    context: Context,
    request: AlarmTimerRequest,
  ) {
    val intent =
      Intent(AlarmClock.ACTION_SET_TIMER).apply {
        putExtra(AlarmClock.EXTRA_LENGTH, request.seconds)
        putExtra(AlarmClock.EXTRA_SKIP_UI, request.skipUi)
        request.message?.let { putExtra(AlarmClock.EXTRA_MESSAGE, it) }
      }
    launch(context, intent)
  }

  override fun show(context: Context) {
    launch(context, Intent(AlarmClock.ACTION_SHOW_ALARMS))
  }

  override fun dismiss(
    context: Context,
    request: AlarmDismissRequest,
  ) {
    val searchMode =
      when (request.mode) {
        AlarmSearchMode.Next -> AlarmClock.ALARM_SEARCH_MODE_NEXT
        AlarmSearchMode.All -> AlarmClock.ALARM_SEARCH_MODE_ALL
        AlarmSearchMode.Label -> AlarmClock.ALARM_SEARCH_MODE_LABEL
        AlarmSearchMode.Time -> AlarmClock.ALARM_SEARCH_MODE_TIME
      }
    val intent =
      Intent(AlarmClock.ACTION_DISMISS_ALARM).apply {
        putExtra(AlarmClock.EXTRA_ALARM_SEARCH_MODE, searchMode)
        request.hour?.let { putExtra(AlarmClock.EXTRA_HOUR, it) }
        request.minutes?.let { putExtra(AlarmClock.EXTRA_MINUTES, it) }
        request.isPm?.let { putExtra(AlarmClock.EXTRA_IS_PM, it) }
        request.message?.let { putExtra(AlarmClock.EXTRA_MESSAGE, it) }
      }
    launch(context, intent)
  }

  private fun launch(
    context: Context,
    intent: Intent,
  ) {
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      context.startActivity(intent)
    } catch (_: ActivityNotFoundException) {
      throw NoClockAppException()
    }
  }
}

class AlarmsHandler private constructor(
  private val appContext: Context,
  private val launcher: AlarmLauncher,
) {
  constructor(appContext: Context) : this(appContext = appContext, launcher = SystemAlarmLauncher)

  fun handleAlarmsSet(paramsJson: String?): GatewaySession.InvokeResult {
    val params =
      parseJsonParamsObject(paramsJson)
        ?: return invalid("expected JSON object")
    val hour =
      parseJsonInt(params, "hour")
        ?: return invalid("hour required (0-23)")
    if (hour !in 0..23) return invalid("hour must be 0-23")
    val minutes = parseJsonInt(params, "minutes") ?: 0
    if (minutes !in 0..59) return invalid("minutes must be 0-59")
    val days =
      parseDays(params["days"] as? JsonArray)
        ?: return invalid("days must be weekday names (e.g. monday) or daily/weekdays/weekends")
    val request =
      AlarmSetRequest(
        hour = hour,
        minutes = minutes,
        message = parseJsonString(params, "message")?.trim()?.ifEmpty { null },
        days = days,
        vibrate = parseJsonBooleanFlag(params, "vibrate"),
        ringtoneSilent = parseJsonBooleanFlag(params, "silent") ?: false,
        skipUi = parseJsonBooleanFlag(params, "skipUi") ?: true,
      )
    return fire {
      launcher.set(appContext, request)
      buildJsonObject {
        put("scheduled", true)
        put("hour", request.hour)
        put("minutes", request.minutes)
        put("recurring", request.days.isNotEmpty())
        put("skipUi", request.skipUi)
        request.message?.let { put("message", it) }
      }
    }
  }

  fun handleAlarmsSetTimer(paramsJson: String?): GatewaySession.InvokeResult {
    val params =
      parseJsonParamsObject(paramsJson)
        ?: return invalid("expected JSON object")
    val seconds =
      parseJsonInt(params, "seconds")
        ?: return invalid("seconds required")
    if (seconds < 1) return invalid("seconds must be >= 1")
    if (seconds > TIMER_MAX_SECONDS) return invalid("seconds must be <= $TIMER_MAX_SECONDS (24h)")
    val request =
      AlarmTimerRequest(
        seconds = seconds,
        message = parseJsonString(params, "message")?.trim()?.ifEmpty { null },
        skipUi = parseJsonBooleanFlag(params, "skipUi") ?: true,
      )
    return fire {
      launcher.setTimer(appContext, request)
      buildJsonObject {
        put("started", true)
        put("seconds", request.seconds)
        put("skipUi", request.skipUi)
        request.message?.let { put("message", it) }
      }
    }
  }

  fun handleAlarmsShow(): GatewaySession.InvokeResult =
    fire {
      launcher.show(appContext)
      buildJsonObject { put("shown", true) }
    }

  fun handleAlarmsDismiss(paramsJson: String?): GatewaySession.InvokeResult {
    val params = parseJsonParamsObject(paramsJson)
    val mode =
      parseSearchMode(parseJsonString(params, "mode"))
        ?: return invalid("mode must be one of: next, all, label, time")
    if (mode == AlarmSearchMode.Label && parseJsonString(params, "message").isNullOrBlank()) {
      return invalid("message required when mode=label")
    }
    val hour = parseJsonInt(params, "hour")
    if (mode == AlarmSearchMode.Time && hour == null) {
      return invalid("hour required when mode=time")
    }
    if (hour != null && hour !in 0..23) return invalid("hour must be 0-23")
    val minutes = parseJsonInt(params, "minutes")
    if (minutes != null && minutes !in 0..59) return invalid("minutes must be 0-59")
    val request =
      AlarmDismissRequest(
        mode = mode,
        hour = hour,
        minutes = minutes,
        isPm = parseJsonBooleanFlag(params, "isPm"),
        message = parseJsonString(params, "message")?.trim()?.ifEmpty { null },
      )
    return fire {
      launcher.dismiss(appContext, request)
      buildJsonObject {
        put("dismissed", true)
        put("mode", modeRawValue(request.mode))
      }
    }
  }

  private fun fire(block: () -> JsonObject): GatewaySession.InvokeResult =
    try {
      GatewaySession.InvokeResult.ok(block().toString())
    } catch (_: NoClockAppException) {
      GatewaySession.InvokeResult.error(
        code = "NO_CLOCK_APP",
        message = "NO_CLOCK_APP: no clock app is installed to handle alarms/timers",
      )
    } catch (err: Throwable) {
      GatewaySession.InvokeResult.error(
        code = "ALARMS_UNAVAILABLE",
        message = "ALARMS_UNAVAILABLE: ${err.message ?: "alarm request failed"}",
      )
    }

  private fun invalid(reason: String): GatewaySession.InvokeResult =
    GatewaySession.InvokeResult.error(code = "ALARMS_INVALID", message = "ALARMS_INVALID: $reason")

  private fun parseDays(array: JsonArray?): List<Int>? {
    if (array == null || array.isEmpty()) return emptyList()
    val out = mutableListOf<Int>()
    for (element in array) {
      val token = (element as? JsonPrimitive)?.content?.trim()?.lowercase().orEmpty()
      when (token) {
        "daily", "everyday", "every day", "all" -> return WEEKDAY_ORDER
        "weekdays" -> WEEKDAYS.forEach { if (it !in out) out += it }
        "weekends", "weekend" -> WEEKENDS.forEach { if (it !in out) out += it }
        else -> {
          val day = DAY_NAMES[token] ?: return null
          if (day !in out) out += day
        }
      }
    }
    return out
  }

  private fun parseSearchMode(raw: String?): AlarmSearchMode? =
    when (raw?.trim()?.lowercase()) {
      "next" -> AlarmSearchMode.Next
      "all" -> AlarmSearchMode.All
      "label" -> AlarmSearchMode.Label
      "time" -> AlarmSearchMode.Time
      else -> null
    }

  private fun modeRawValue(mode: AlarmSearchMode): String =
    when (mode) {
      AlarmSearchMode.Next -> "next"
      AlarmSearchMode.All -> "all"
      AlarmSearchMode.Label -> "label"
      AlarmSearchMode.Time -> "time"
    }

  companion object {
    private val DAY_NAMES: Map<String, Int> =
      mapOf(
        "sun" to Calendar.SUNDAY, "sunday" to Calendar.SUNDAY,
        "mon" to Calendar.MONDAY, "monday" to Calendar.MONDAY,
        "tue" to Calendar.TUESDAY, "tues" to Calendar.TUESDAY, "tuesday" to Calendar.TUESDAY,
        "wed" to Calendar.WEDNESDAY, "weds" to Calendar.WEDNESDAY, "wednesday" to Calendar.WEDNESDAY,
        "thu" to Calendar.THURSDAY, "thur" to Calendar.THURSDAY, "thurs" to Calendar.THURSDAY, "thursday" to Calendar.THURSDAY,
        "fri" to Calendar.FRIDAY, "friday" to Calendar.FRIDAY,
        "sat" to Calendar.SATURDAY, "saturday" to Calendar.SATURDAY,
      )
    private val WEEKDAY_ORDER: List<Int> =
      listOf(
        Calendar.SUNDAY, Calendar.MONDAY, Calendar.TUESDAY, Calendar.WEDNESDAY,
        Calendar.THURSDAY, Calendar.FRIDAY, Calendar.SATURDAY,
      )
    private val WEEKDAYS: List<Int> =
      listOf(Calendar.MONDAY, Calendar.TUESDAY, Calendar.WEDNESDAY, Calendar.THURSDAY, Calendar.FRIDAY)
    private val WEEKENDS: List<Int> = listOf(Calendar.SATURDAY, Calendar.SUNDAY)

    internal fun forTesting(
      appContext: Context,
      launcher: AlarmLauncher,
    ): AlarmsHandler = AlarmsHandler(appContext = appContext, launcher = launcher)
  }
}
