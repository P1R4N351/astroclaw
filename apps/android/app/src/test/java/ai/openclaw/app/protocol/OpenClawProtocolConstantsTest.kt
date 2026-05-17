package ai.astroclaw.app.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class AstroclawProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", AstroclawCanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", AstroclawCanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", AstroclawCanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", AstroclawCanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", AstroclawCanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", AstroclawCanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", AstroclawCanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", AstroclawCanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", AstroclawCapability.Canvas.rawValue)
    assertEquals("camera", AstroclawCapability.Camera.rawValue)
    assertEquals("voiceWake", AstroclawCapability.VoiceWake.rawValue)
    assertEquals("talk", AstroclawCapability.Talk.rawValue)
    assertEquals("location", AstroclawCapability.Location.rawValue)
    assertEquals("sms", AstroclawCapability.Sms.rawValue)
    assertEquals("device", AstroclawCapability.Device.rawValue)
    assertEquals("notifications", AstroclawCapability.Notifications.rawValue)
    assertEquals("system", AstroclawCapability.System.rawValue)
    assertEquals("photos", AstroclawCapability.Photos.rawValue)
    assertEquals("contacts", AstroclawCapability.Contacts.rawValue)
    assertEquals("calendar", AstroclawCapability.Calendar.rawValue)
    assertEquals("motion", AstroclawCapability.Motion.rawValue)
    assertEquals("callLog", AstroclawCapability.CallLog.rawValue)
  }

  @Test
  fun cameraCommandsUseStableStrings() {
    assertEquals("camera.list", AstroclawCameraCommand.List.rawValue)
    assertEquals("camera.snap", AstroclawCameraCommand.Snap.rawValue)
    assertEquals("camera.clip", AstroclawCameraCommand.Clip.rawValue)
  }

  @Test
  fun notificationsCommandsUseStableStrings() {
    assertEquals("notifications.list", AstroclawNotificationsCommand.List.rawValue)
    assertEquals("notifications.actions", AstroclawNotificationsCommand.Actions.rawValue)
  }

  @Test
  fun deviceCommandsUseStableStrings() {
    assertEquals("device.status", AstroclawDeviceCommand.Status.rawValue)
    assertEquals("device.info", AstroclawDeviceCommand.Info.rawValue)
    assertEquals("device.permissions", AstroclawDeviceCommand.Permissions.rawValue)
    assertEquals("device.health", AstroclawDeviceCommand.Health.rawValue)
  }

  @Test
  fun systemCommandsUseStableStrings() {
    assertEquals("system.notify", AstroclawSystemCommand.Notify.rawValue)
  }

  @Test
  fun photosCommandsUseStableStrings() {
    assertEquals("photos.latest", AstroclawPhotosCommand.Latest.rawValue)
  }

  @Test
  fun contactsCommandsUseStableStrings() {
    assertEquals("contacts.search", AstroclawContactsCommand.Search.rawValue)
    assertEquals("contacts.add", AstroclawContactsCommand.Add.rawValue)
  }

  @Test
  fun calendarCommandsUseStableStrings() {
    assertEquals("calendar.events", AstroclawCalendarCommand.Events.rawValue)
    assertEquals("calendar.add", AstroclawCalendarCommand.Add.rawValue)
  }

  @Test
  fun motionCommandsUseStableStrings() {
    assertEquals("motion.activity", AstroclawMotionCommand.Activity.rawValue)
    assertEquals("motion.pedometer", AstroclawMotionCommand.Pedometer.rawValue)
  }

  @Test
  fun smsCommandsUseStableStrings() {
    assertEquals("sms.send", AstroclawSmsCommand.Send.rawValue)
    assertEquals("sms.search", AstroclawSmsCommand.Search.rawValue)
  }

  @Test
  fun talkCommandsUseStableStrings() {
    assertEquals("talk.ptt.start", AstroclawTalkCommand.PttStart.rawValue)
    assertEquals("talk.ptt.stop", AstroclawTalkCommand.PttStop.rawValue)
    assertEquals("talk.ptt.cancel", AstroclawTalkCommand.PttCancel.rawValue)
    assertEquals("talk.ptt.once", AstroclawTalkCommand.PttOnce.rawValue)
  }

  @Test
  fun callLogCommandsUseStableStrings() {
    assertEquals("callLog.search", AstroclawCallLogCommand.Search.rawValue)
  }
}
