package ai.astroclaw.app.node

import ai.astroclaw.app.protocol.AstroclawCalendarCommand
import ai.astroclaw.app.protocol.AstroclawCallLogCommand
import ai.astroclaw.app.protocol.AstroclawCameraCommand
import ai.astroclaw.app.protocol.AstroclawCapability
import ai.astroclaw.app.protocol.AstroclawContactsCommand
import ai.astroclaw.app.protocol.AstroclawDeviceCommand
import ai.astroclaw.app.protocol.AstroclawLocationCommand
import ai.astroclaw.app.protocol.AstroclawMotionCommand
import ai.astroclaw.app.protocol.AstroclawNotificationsCommand
import ai.astroclaw.app.protocol.AstroclawPhotosCommand
import ai.astroclaw.app.protocol.AstroclawSmsCommand
import ai.astroclaw.app.protocol.AstroclawSystemCommand
import ai.astroclaw.app.protocol.AstroclawTalkCommand
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class InvokeCommandRegistryTest {
  private val coreCapabilities =
    setOf(
      AstroclawCapability.Canvas.rawValue,
      AstroclawCapability.Device.rawValue,
      AstroclawCapability.Notifications.rawValue,
      AstroclawCapability.System.rawValue,
      AstroclawCapability.Talk.rawValue,
      AstroclawCapability.Photos.rawValue,
      AstroclawCapability.Contacts.rawValue,
      AstroclawCapability.Calendar.rawValue,
    )

  private val optionalCapabilities =
    setOf(
      AstroclawCapability.Camera.rawValue,
      AstroclawCapability.Location.rawValue,
      AstroclawCapability.Sms.rawValue,
      AstroclawCapability.CallLog.rawValue,
      AstroclawCapability.VoiceWake.rawValue,
      AstroclawCapability.Motion.rawValue,
    )

  private val coreCommands =
    setOf(
      AstroclawDeviceCommand.Status.rawValue,
      AstroclawDeviceCommand.Info.rawValue,
      AstroclawDeviceCommand.Permissions.rawValue,
      AstroclawDeviceCommand.Health.rawValue,
      AstroclawNotificationsCommand.List.rawValue,
      AstroclawNotificationsCommand.Actions.rawValue,
      AstroclawSystemCommand.Notify.rawValue,
      AstroclawTalkCommand.PttStart.rawValue,
      AstroclawTalkCommand.PttStop.rawValue,
      AstroclawTalkCommand.PttCancel.rawValue,
      AstroclawTalkCommand.PttOnce.rawValue,
      AstroclawPhotosCommand.Latest.rawValue,
      AstroclawContactsCommand.Search.rawValue,
      AstroclawContactsCommand.Add.rawValue,
      AstroclawCalendarCommand.Events.rawValue,
      AstroclawCalendarCommand.Add.rawValue,
    )

  private val optionalCommands =
    setOf(
      AstroclawCameraCommand.Snap.rawValue,
      AstroclawCameraCommand.Clip.rawValue,
      AstroclawCameraCommand.List.rawValue,
      AstroclawLocationCommand.Get.rawValue,
      AstroclawMotionCommand.Activity.rawValue,
      AstroclawMotionCommand.Pedometer.rawValue,
      AstroclawSmsCommand.Send.rawValue,
      AstroclawSmsCommand.Search.rawValue,
      AstroclawCallLogCommand.Search.rawValue,
    )

  private val debugCommands = setOf("debug.logs", "debug.ed25519")

  @Test
  fun advertisedCapabilities_respectsFeatureAvailability() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags())

    assertContainsAll(capabilities, coreCapabilities)
    assertMissingAll(capabilities, optionalCapabilities)
  }

  @Test
  fun advertisedCapabilities_includesFeatureCapabilitiesWhenEnabled() {
    val capabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(
          cameraEnabled = true,
          locationEnabled = true,
          sendSmsAvailable = true,
          readSmsAvailable = true,
          smsSearchPossible = true,
          callLogAvailable = true,
          voiceWakeEnabled = true,
          motionActivityAvailable = true,
          motionPedometerAvailable = true,
        ),
      )

    assertContainsAll(capabilities, coreCapabilities + optionalCapabilities)
  }

  @Test
  fun advertisedCommands_respectsFeatureAvailability() {
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags())

    assertContainsAll(commands, coreCommands)
    assertMissingAll(commands, optionalCommands + debugCommands)
  }

  @Test
  fun advertisedCommands_includesFeatureCommandsWhenEnabled() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(
          cameraEnabled = true,
          locationEnabled = true,
          sendSmsAvailable = true,
          readSmsAvailable = true,
          smsSearchPossible = true,
          callLogAvailable = true,
          motionActivityAvailable = true,
          motionPedometerAvailable = true,
          debugBuild = true,
        ),
      )

    assertContainsAll(commands, coreCommands + optionalCommands + debugCommands)
  }

  @Test
  fun advertisedCommands_onlyIncludesSupportedMotionCommands() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        NodeRuntimeFlags(
          cameraEnabled = false,
          locationEnabled = false,
          sendSmsAvailable = false,
          readSmsAvailable = false,
          smsSearchPossible = false,
          callLogAvailable = false,
          voiceWakeEnabled = false,
          motionActivityAvailable = true,
          motionPedometerAvailable = false,
          debugBuild = false,
        ),
      )

    assertTrue(commands.contains(AstroclawMotionCommand.Activity.rawValue))
    assertFalse(commands.contains(AstroclawMotionCommand.Pedometer.rawValue))
  }

  @Test
  fun advertisedCommands_splitsSmsSendAndSearchAvailability() {
    val readOnlyCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(readSmsAvailable = true, smsSearchPossible = true),
      )
    val sendOnlyCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(sendSmsAvailable = true),
      )
    val requestableSearchCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(smsSearchPossible = true),
      )

    assertTrue(readOnlyCommands.contains(AstroclawSmsCommand.Search.rawValue))
    assertFalse(readOnlyCommands.contains(AstroclawSmsCommand.Send.rawValue))
    assertTrue(sendOnlyCommands.contains(AstroclawSmsCommand.Send.rawValue))
    assertFalse(sendOnlyCommands.contains(AstroclawSmsCommand.Search.rawValue))
    assertTrue(requestableSearchCommands.contains(AstroclawSmsCommand.Search.rawValue))
  }

  @Test
  fun advertisedCapabilities_includeSmsWhenEitherSmsPathIsAvailable() {
    val readOnlyCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(readSmsAvailable = true),
      )
    val sendOnlyCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(sendSmsAvailable = true),
      )
    val requestableSearchCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(smsSearchPossible = true),
      )

    assertTrue(readOnlyCapabilities.contains(AstroclawCapability.Sms.rawValue))
    assertTrue(sendOnlyCapabilities.contains(AstroclawCapability.Sms.rawValue))
    assertFalse(requestableSearchCapabilities.contains(AstroclawCapability.Sms.rawValue))
  }

  @Test
  fun advertisedCommands_excludesCallLogWhenUnavailable() {
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags(callLogAvailable = false))

    assertFalse(commands.contains(AstroclawCallLogCommand.Search.rawValue))
  }

  @Test
  fun advertisedCapabilities_excludesCallLogWhenUnavailable() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags(callLogAvailable = false))

    assertFalse(capabilities.contains(AstroclawCapability.CallLog.rawValue))
  }

  @Test
  fun advertisedCapabilities_includesVoiceWakeWithoutAdvertisingCommands() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags(voiceWakeEnabled = true))
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags(voiceWakeEnabled = true))

    assertTrue(capabilities.contains(AstroclawCapability.VoiceWake.rawValue))
    assertFalse(commands.any { it.contains("voice", ignoreCase = true) })
  }

  @Test
  fun find_returnsForegroundMetadataForCameraCommands() {
    val list = InvokeCommandRegistry.find(AstroclawCameraCommand.List.rawValue)
    val location = InvokeCommandRegistry.find(AstroclawLocationCommand.Get.rawValue)

    assertNotNull(list)
    assertEquals(true, list?.requiresForeground)
    assertNotNull(location)
    assertEquals(false, location?.requiresForeground)
  }

  @Test
  fun find_returnsNullForUnknownCommand() {
    assertNull(InvokeCommandRegistry.find("not.real"))
  }

  private fun defaultFlags(
    cameraEnabled: Boolean = false,
    locationEnabled: Boolean = false,
    sendSmsAvailable: Boolean = false,
    readSmsAvailable: Boolean = false,
    smsSearchPossible: Boolean = false,
    callLogAvailable: Boolean = false,
    voiceWakeEnabled: Boolean = false,
    motionActivityAvailable: Boolean = false,
    motionPedometerAvailable: Boolean = false,
    debugBuild: Boolean = false,
  ): NodeRuntimeFlags =
    NodeRuntimeFlags(
      cameraEnabled = cameraEnabled,
      locationEnabled = locationEnabled,
      sendSmsAvailable = sendSmsAvailable,
      readSmsAvailable = readSmsAvailable,
      smsSearchPossible = smsSearchPossible,
      callLogAvailable = callLogAvailable,
      voiceWakeEnabled = voiceWakeEnabled,
      motionActivityAvailable = motionActivityAvailable,
      motionPedometerAvailable = motionPedometerAvailable,
      debugBuild = debugBuild,
    )

  private fun assertContainsAll(
    actual: List<String>,
    expected: Set<String>,
  ) {
    expected.forEach { value -> assertTrue(actual.contains(value)) }
  }

  private fun assertMissingAll(
    actual: List<String>,
    forbidden: Set<String>,
  ) {
    forbidden.forEach { value -> assertFalse(actual.contains(value)) }
  }
}
