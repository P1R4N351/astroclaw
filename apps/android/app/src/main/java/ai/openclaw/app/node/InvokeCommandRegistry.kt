package ai.astroclaw.app.node

import ai.astroclaw.app.protocol.AstroclawCalendarCommand
import ai.astroclaw.app.protocol.AstroclawCallLogCommand
import ai.astroclaw.app.protocol.AstroclawCameraCommand
import ai.astroclaw.app.protocol.AstroclawCanvasA2UICommand
import ai.astroclaw.app.protocol.AstroclawCanvasCommand
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

data class NodeRuntimeFlags(
  val cameraEnabled: Boolean,
  val locationEnabled: Boolean,
  val sendSmsAvailable: Boolean,
  val readSmsAvailable: Boolean,
  val smsSearchPossible: Boolean,
  val callLogAvailable: Boolean,
  val voiceWakeEnabled: Boolean,
  val motionActivityAvailable: Boolean,
  val motionPedometerAvailable: Boolean,
  val debugBuild: Boolean,
)

enum class InvokeCommandAvailability {
  Always,
  CameraEnabled,
  LocationEnabled,
  SendSmsAvailable,
  ReadSmsAvailable,
  RequestableSmsSearchAvailable,
  CallLogAvailable,
  MotionActivityAvailable,
  MotionPedometerAvailable,
  DebugBuild,
}

enum class NodeCapabilityAvailability {
  Always,
  CameraEnabled,
  LocationEnabled,
  SmsAvailable,
  CallLogAvailable,
  VoiceWakeEnabled,
  MotionAvailable,
}

data class NodeCapabilitySpec(
  val name: String,
  val availability: NodeCapabilityAvailability = NodeCapabilityAvailability.Always,
)

data class InvokeCommandSpec(
  val name: String,
  val requiresForeground: Boolean = false,
  val availability: InvokeCommandAvailability = InvokeCommandAvailability.Always,
)

object InvokeCommandRegistry {
  val capabilityManifest: List<NodeCapabilitySpec> =
    listOf(
      NodeCapabilitySpec(name = AstroclawCapability.Canvas.rawValue),
      NodeCapabilitySpec(name = AstroclawCapability.Device.rawValue),
      NodeCapabilitySpec(name = AstroclawCapability.Notifications.rawValue),
      NodeCapabilitySpec(name = AstroclawCapability.System.rawValue),
      NodeCapabilitySpec(
        name = AstroclawCapability.Camera.rawValue,
        availability = NodeCapabilityAvailability.CameraEnabled,
      ),
      NodeCapabilitySpec(
        name = AstroclawCapability.Sms.rawValue,
        availability = NodeCapabilityAvailability.SmsAvailable,
      ),
      NodeCapabilitySpec(
        name = AstroclawCapability.VoiceWake.rawValue,
        availability = NodeCapabilityAvailability.VoiceWakeEnabled,
      ),
      NodeCapabilitySpec(name = AstroclawCapability.Talk.rawValue),
      NodeCapabilitySpec(
        name = AstroclawCapability.Location.rawValue,
        availability = NodeCapabilityAvailability.LocationEnabled,
      ),
      NodeCapabilitySpec(name = AstroclawCapability.Photos.rawValue),
      NodeCapabilitySpec(name = AstroclawCapability.Contacts.rawValue),
      NodeCapabilitySpec(name = AstroclawCapability.Calendar.rawValue),
      NodeCapabilitySpec(
        name = AstroclawCapability.Motion.rawValue,
        availability = NodeCapabilityAvailability.MotionAvailable,
      ),
      NodeCapabilitySpec(
        name = AstroclawCapability.CallLog.rawValue,
        availability = NodeCapabilityAvailability.CallLogAvailable,
      ),
    )

  val all: List<InvokeCommandSpec> =
    listOf(
      InvokeCommandSpec(
        name = AstroclawCanvasCommand.Present.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = AstroclawCanvasCommand.Hide.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = AstroclawCanvasCommand.Navigate.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = AstroclawCanvasCommand.Eval.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = AstroclawCanvasCommand.Snapshot.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = AstroclawCanvasA2UICommand.Push.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = AstroclawCanvasA2UICommand.PushJSONL.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = AstroclawCanvasA2UICommand.Reset.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = AstroclawSystemCommand.Notify.rawValue,
      ),
      InvokeCommandSpec(
        name = AstroclawTalkCommand.PttStart.rawValue,
      ),
      InvokeCommandSpec(
        name = AstroclawTalkCommand.PttStop.rawValue,
      ),
      InvokeCommandSpec(
        name = AstroclawTalkCommand.PttCancel.rawValue,
      ),
      InvokeCommandSpec(
        name = AstroclawTalkCommand.PttOnce.rawValue,
      ),
      InvokeCommandSpec(
        name = AstroclawCameraCommand.List.rawValue,
        requiresForeground = true,
        availability = InvokeCommandAvailability.CameraEnabled,
      ),
      InvokeCommandSpec(
        name = AstroclawCameraCommand.Snap.rawValue,
        requiresForeground = true,
        availability = InvokeCommandAvailability.CameraEnabled,
      ),
      InvokeCommandSpec(
        name = AstroclawCameraCommand.Clip.rawValue,
        requiresForeground = true,
        availability = InvokeCommandAvailability.CameraEnabled,
      ),
      InvokeCommandSpec(
        name = AstroclawLocationCommand.Get.rawValue,
        availability = InvokeCommandAvailability.LocationEnabled,
      ),
      InvokeCommandSpec(
        name = AstroclawDeviceCommand.Status.rawValue,
      ),
      InvokeCommandSpec(
        name = AstroclawDeviceCommand.Info.rawValue,
      ),
      InvokeCommandSpec(
        name = AstroclawDeviceCommand.Permissions.rawValue,
      ),
      InvokeCommandSpec(
        name = AstroclawDeviceCommand.Health.rawValue,
      ),
      InvokeCommandSpec(
        name = AstroclawNotificationsCommand.List.rawValue,
      ),
      InvokeCommandSpec(
        name = AstroclawNotificationsCommand.Actions.rawValue,
      ),
      InvokeCommandSpec(
        name = AstroclawPhotosCommand.Latest.rawValue,
      ),
      InvokeCommandSpec(
        name = AstroclawContactsCommand.Search.rawValue,
      ),
      InvokeCommandSpec(
        name = AstroclawContactsCommand.Add.rawValue,
      ),
      InvokeCommandSpec(
        name = AstroclawCalendarCommand.Events.rawValue,
      ),
      InvokeCommandSpec(
        name = AstroclawCalendarCommand.Add.rawValue,
      ),
      InvokeCommandSpec(
        name = AstroclawMotionCommand.Activity.rawValue,
        availability = InvokeCommandAvailability.MotionActivityAvailable,
      ),
      InvokeCommandSpec(
        name = AstroclawMotionCommand.Pedometer.rawValue,
        availability = InvokeCommandAvailability.MotionPedometerAvailable,
      ),
      InvokeCommandSpec(
        name = AstroclawSmsCommand.Send.rawValue,
        availability = InvokeCommandAvailability.SendSmsAvailable,
      ),
      InvokeCommandSpec(
        name = AstroclawSmsCommand.Search.rawValue,
        availability = InvokeCommandAvailability.RequestableSmsSearchAvailable,
      ),
      InvokeCommandSpec(
        name = AstroclawCallLogCommand.Search.rawValue,
        availability = InvokeCommandAvailability.CallLogAvailable,
      ),
      InvokeCommandSpec(
        name = "debug.logs",
        availability = InvokeCommandAvailability.DebugBuild,
      ),
      InvokeCommandSpec(
        name = "debug.ed25519",
        availability = InvokeCommandAvailability.DebugBuild,
      ),
    )

  private val byNameInternal: Map<String, InvokeCommandSpec> = all.associateBy { it.name }

  fun find(command: String): InvokeCommandSpec? = byNameInternal[command]

  fun advertisedCapabilities(flags: NodeRuntimeFlags): List<String> =
    capabilityManifest
      .filter { spec ->
        when (spec.availability) {
          NodeCapabilityAvailability.Always -> true
          NodeCapabilityAvailability.CameraEnabled -> flags.cameraEnabled
          NodeCapabilityAvailability.LocationEnabled -> flags.locationEnabled
          NodeCapabilityAvailability.SmsAvailable -> flags.sendSmsAvailable || flags.readSmsAvailable
          NodeCapabilityAvailability.CallLogAvailable -> flags.callLogAvailable
          NodeCapabilityAvailability.VoiceWakeEnabled -> flags.voiceWakeEnabled
          NodeCapabilityAvailability.MotionAvailable -> flags.motionActivityAvailable || flags.motionPedometerAvailable
        }
      }.map { it.name }

  fun advertisedCommands(flags: NodeRuntimeFlags): List<String> =
    all
      .filter { spec ->
        when (spec.availability) {
          InvokeCommandAvailability.Always -> true
          InvokeCommandAvailability.CameraEnabled -> flags.cameraEnabled
          InvokeCommandAvailability.LocationEnabled -> flags.locationEnabled
          InvokeCommandAvailability.SendSmsAvailable -> flags.sendSmsAvailable
          InvokeCommandAvailability.ReadSmsAvailable -> flags.readSmsAvailable
          InvokeCommandAvailability.RequestableSmsSearchAvailable -> flags.smsSearchPossible
          InvokeCommandAvailability.CallLogAvailable -> flags.callLogAvailable
          InvokeCommandAvailability.MotionActivityAvailable -> flags.motionActivityAvailable
          InvokeCommandAvailability.MotionPedometerAvailable -> flags.motionPedometerAvailable
          InvokeCommandAvailability.DebugBuild -> flags.debugBuild
        }
      }.map { it.name }
}
