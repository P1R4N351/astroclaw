package ai.astroclaw.app.node

import android.content.Context
import android.provider.AlarmClock
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import java.util.Calendar

class AlarmsHandlerTest : NodeHandlerRobolectricTest() {
  private class RecordingAlarmLauncher : AlarmLauncher {
    var lastSet: AlarmSetRequest? = null
    var lastTimer: AlarmTimerRequest? = null
    var lastDismiss: AlarmDismissRequest? = null
    var showCount = 0
    var throwNoClockApp = false

    override fun set(
      context: Context,
      request: AlarmSetRequest,
    ) {
      if (throwNoClockApp) throw NoClockAppException()
      lastSet = request
    }

    override fun setTimer(
      context: Context,
      request: AlarmTimerRequest,
    ) {
      if (throwNoClockApp) throw NoClockAppException()
      lastTimer = request
    }

    override fun show(context: Context) {
      if (throwNoClockApp) throw NoClockAppException()
      showCount += 1
    }

    override fun dismiss(
      context: Context,
      request: AlarmDismissRequest,
    ) {
      if (throwNoClockApp) throw NoClockAppException()
      lastDismiss = request
    }
  }

  private fun handler(launcher: AlarmLauncher = RecordingAlarmLauncher()): AlarmsHandler =
    AlarmsHandler.forTesting(appContext(), launcher)

  @Test
  fun set_withValidTime_launchesAndEchoesPayload() {
    val launcher = RecordingAlarmLauncher()
    val result = handler(launcher).handleAlarmsSet("""{"hour":7,"minutes":30,"message":"Wake up"}""")

    assertTrue(result.ok)
    val request = launcher.lastSet!!
    assertEquals(7, request.hour)
    assertEquals(30, request.minutes)
    assertEquals("Wake up", request.message)
    assertTrue(request.skipUi)
    assertTrue(request.days.isEmpty())

    val payload = Json.parseToJsonElement(result.payloadJson!!).jsonObject
    assertEquals("7", payload["hour"]!!.jsonPrimitive.content)
    assertEquals("false", payload["recurring"]!!.jsonPrimitive.content)
  }

  @Test
  fun set_defaultsMinutesToZeroAndSkipUiTrue() {
    val launcher = RecordingAlarmLauncher()
    val result = handler(launcher).handleAlarmsSet("""{"hour":6}""")

    assertTrue(result.ok)
    assertEquals(0, launcher.lastSet!!.minutes)
    assertTrue(launcher.lastSet!!.skipUi)
  }

  @Test
  fun set_missingHour_returnsInvalid() {
    val result = handler().handleAlarmsSet("""{"minutes":30}""")

    assertFalse(result.ok)
    assertEquals("ALARMS_INVALID", result.error?.code)
  }

  @Test
  fun set_hourOutOfRange_returnsInvalid() {
    val result = handler().handleAlarmsSet("""{"hour":24}""")

    assertFalse(result.ok)
    assertEquals("ALARMS_INVALID", result.error?.code)
  }

  @Test
  fun set_weekdaysShortcut_expandsToMondayThroughFriday() {
    val launcher = RecordingAlarmLauncher()
    val result = handler(launcher).handleAlarmsSet("""{"hour":8,"days":["weekdays"]}""")

    assertTrue(result.ok)
    assertEquals(
      listOf(
        Calendar.MONDAY,
        Calendar.TUESDAY,
        Calendar.WEDNESDAY,
        Calendar.THURSDAY,
        Calendar.FRIDAY,
      ),
      launcher.lastSet!!.days,
    )
  }

  @Test
  fun set_namedDays_mapToCalendarConstants() {
    val launcher = RecordingAlarmLauncher()
    val result = handler(launcher).handleAlarmsSet("""{"hour":8,"days":["mon","Saturday"]}""")

    assertTrue(result.ok)
    assertEquals(listOf(Calendar.MONDAY, Calendar.SATURDAY), launcher.lastSet!!.days)
  }

  @Test
  fun set_unknownDay_returnsInvalid() {
    val result = handler().handleAlarmsSet("""{"hour":8,"days":["someday"]}""")

    assertFalse(result.ok)
    assertEquals("ALARMS_INVALID", result.error?.code)
  }

  @Test
  fun setTimer_withSeconds_launchesTimer() {
    val launcher = RecordingAlarmLauncher()
    val result = handler(launcher).handleAlarmsSetTimer("""{"seconds":600,"message":"Tea"}""")

    assertTrue(result.ok)
    assertEquals(600, launcher.lastTimer!!.seconds)
    assertEquals("Tea", launcher.lastTimer!!.message)
  }

  @Test
  fun setTimer_missingSeconds_returnsInvalid() {
    val result = handler().handleAlarmsSetTimer("""{"message":"Tea"}""")

    assertFalse(result.ok)
    assertEquals("ALARMS_INVALID", result.error?.code)
  }

  @Test
  fun setTimer_zeroSeconds_returnsInvalid() {
    val result = handler().handleAlarmsSetTimer("""{"seconds":0}""")

    assertFalse(result.ok)
    assertEquals("ALARMS_INVALID", result.error?.code)
  }

  @Test
  fun setTimer_beyondTwentyFourHours_returnsInvalid() {
    val result = handler().handleAlarmsSetTimer("""{"seconds":90000}""")

    assertFalse(result.ok)
    assertEquals("ALARMS_INVALID", result.error?.code)
  }

  @Test
  fun show_launchesAlarmList() {
    val launcher = RecordingAlarmLauncher()
    val result = handler(launcher).handleAlarmsShow()

    assertTrue(result.ok)
    assertEquals(1, launcher.showCount)
  }

  @Test
  fun dismiss_nextMode_launches() {
    val launcher = RecordingAlarmLauncher()
    val result = handler(launcher).handleAlarmsDismiss("""{"mode":"next"}""")

    assertTrue(result.ok)
    assertEquals(AlarmSearchMode.Next, launcher.lastDismiss!!.mode)
  }

  @Test
  fun dismiss_unknownMode_returnsInvalid() {
    val result = handler().handleAlarmsDismiss("""{"mode":"whenever"}""")

    assertFalse(result.ok)
    assertEquals("ALARMS_INVALID", result.error?.code)
  }

  @Test
  fun dismiss_labelModeWithoutMessage_returnsInvalid() {
    val result = handler().handleAlarmsDismiss("""{"mode":"label"}""")

    assertFalse(result.ok)
    assertEquals("ALARMS_INVALID", result.error?.code)
  }

  @Test
  fun dismiss_timeModeWithoutHour_returnsInvalid() {
    val result = handler().handleAlarmsDismiss("""{"mode":"time"}""")

    assertFalse(result.ok)
    assertEquals("ALARMS_INVALID", result.error?.code)
  }

  @Test
  fun set_whenNoClockApp_returnsNoClockApp() {
    val launcher = RecordingAlarmLauncher().apply { throwNoClockApp = true }
    val result = handler(launcher).handleAlarmsSet("""{"hour":7}""")

    assertFalse(result.ok)
    assertEquals("NO_CLOCK_APP", result.error?.code)
  }

  @Test
  fun systemLauncher_buildsSetAlarmIntentWithExtras() {
    val result = AlarmsHandler(appContext()).handleAlarmsSet("""{"hour":9,"minutes":15,"message":"Standup"}""")

    assertTrue(result.ok)
    val intent = shadowOf(RuntimeEnvironment.getApplication()).nextStartedActivity!!
    assertEquals(AlarmClock.ACTION_SET_ALARM, intent.action)
    assertEquals(9, intent.getIntExtra(AlarmClock.EXTRA_HOUR, -1))
    assertEquals(15, intent.getIntExtra(AlarmClock.EXTRA_MINUTES, -1))
    assertEquals("Standup", intent.getStringExtra(AlarmClock.EXTRA_MESSAGE))
    assertTrue(intent.getBooleanExtra(AlarmClock.EXTRA_SKIP_UI, false))
  }

  @Test
  fun systemLauncher_buildsSetTimerIntentWithLength() {
    val result = AlarmsHandler(appContext()).handleAlarmsSetTimer("""{"seconds":300}""")

    assertTrue(result.ok)
    val intent = shadowOf(RuntimeEnvironment.getApplication()).nextStartedActivity!!
    assertEquals(AlarmClock.ACTION_SET_TIMER, intent.action)
    assertEquals(300, intent.getIntExtra(AlarmClock.EXTRA_LENGTH, -1))
  }

  @Test
  fun set_invalidJson_returnsInvalid() {
    val result = handler().handleAlarmsSet("not json")

    assertFalse(result.ok)
    assertEquals("ALARMS_INVALID", result.error?.code)
    assertNull(result.payloadJson)
  }
}
