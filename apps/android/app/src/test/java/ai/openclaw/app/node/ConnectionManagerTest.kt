package ai.astroclaw.app.node

import ai.astroclaw.app.LocationMode
import ai.astroclaw.app.SecurePrefs
import ai.astroclaw.app.VoiceWakeMode
import ai.astroclaw.app.gateway.GatewayEndpoint
import ai.astroclaw.app.gateway.isLoopbackGatewayHost
import ai.astroclaw.app.gateway.isPrivateLanGatewayHost
import ai.astroclaw.app.protocol.AstroclawCallLogCommand
import ai.astroclaw.app.protocol.AstroclawCameraCommand
import ai.astroclaw.app.protocol.AstroclawCapability
import ai.astroclaw.app.protocol.AstroclawLocationCommand
import ai.astroclaw.app.protocol.AstroclawMotionCommand
import ai.astroclaw.app.protocol.AstroclawSmsCommand
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment

@RunWith(RobolectricTestRunner::class)
class ConnectionManagerTest {
  @Test
  fun resolveTlsParamsForEndpoint_prefersStoredPinOverAdvertisedFingerprint() {
    val endpoint =
      GatewayEndpoint(
        stableId = "_astroclaw-gw._tcp.|local.|Test",
        name = "Test",
        host = "10.0.0.2",
        port = 18789,
        tlsEnabled = true,
        tlsFingerprintSha256 = "attacker",
      )

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = "legit",
        manualTlsEnabled = false,
      )

    assertEquals("legit", params?.expectedFingerprint)
    assertEquals(false, params?.allowTOFU)
  }

  @Test
  fun resolveTlsParamsForEndpoint_doesNotTrustAdvertisedFingerprintWhenNoStoredPin() {
    val endpoint =
      GatewayEndpoint(
        stableId = "_astroclaw-gw._tcp.|local.|Test",
        name = "Test",
        host = "10.0.0.2",
        port = 18789,
        tlsEnabled = true,
        tlsFingerprintSha256 = "attacker",
      )

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )

    assertNull(params?.expectedFingerprint)
    assertEquals(false, params?.allowTOFU)
  }

  @Test
  fun resolveTlsParamsForEndpoint_manualRespectsManualTlsToggle() {
    val endpoint = GatewayEndpoint.manual(host = "127.0.0.1", port = 443)

    val off =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )
    assertNull(off)

    val on =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = true,
      )
    assertNull(on?.expectedFingerprint)
    assertEquals(false, on?.allowTOFU)
  }

  @Test
  fun resolveTlsParamsForEndpoint_manualNonLoopbackForcesTlsWhenToggleIsOff() {
    val endpoint = GatewayEndpoint.manual(host = "example.com", port = 443)

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )

    assertEquals(true, params?.required)
    assertNull(params?.expectedFingerprint)
    assertEquals(false, params?.allowTOFU)
  }

  @Test
  fun resolveTlsParamsForEndpoint_manualPrivateLanForcesTlsWhenToggleIsOff() {
    val endpoint = GatewayEndpoint.manual(host = "192.168.1.20", port = 18789)

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )

    assertEquals(true, params?.required)
    assertNull(params?.expectedFingerprint)
    assertEquals(false, params?.allowTOFU)
  }

  @Test
  fun resolveTlsParamsForEndpoint_discoveryTailnetWithoutHintsStillRequiresTls() {
    val endpoint =
      GatewayEndpoint(
        stableId = "_astroclaw-gw._tcp.|local.|Test",
        name = "Test",
        host = "100.64.0.9",
        port = 18789,
        tlsEnabled = false,
        tlsFingerprintSha256 = null,
      )

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )

    assertEquals(true, params?.required)
    assertNull(params?.expectedFingerprint)
    assertEquals(false, params?.allowTOFU)
  }

  @Test
  fun resolveTlsParamsForEndpoint_discoveryPrivateLanWithoutHintsStillRequiresTls() {
    val endpoint =
      GatewayEndpoint(
        stableId = "_astroclaw-gw._tcp.|local.|Test",
        name = "Test",
        host = "192.168.1.20",
        port = 18789,
        tlsEnabled = false,
        tlsFingerprintSha256 = null,
      )

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )

    assertEquals(true, params?.required)
    assertNull(params?.expectedFingerprint)
    assertEquals(false, params?.allowTOFU)
  }

  @Test
  fun resolveTlsParamsForEndpoint_discoveryLoopbackWithoutHintsCanStayCleartext() {
    val endpoint =
      GatewayEndpoint(
        stableId = "_astroclaw-gw._tcp.|local.|Test",
        name = "Test",
        host = "127.0.0.1",
        port = 18789,
        tlsEnabled = false,
        tlsFingerprintSha256 = null,
      )

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )

    assertNull(params)
  }

  @Test
  fun resolveTlsParamsForEndpoint_discoveryLocalhostWithoutHintsCanStayCleartext() {
    val endpoint =
      GatewayEndpoint(
        stableId = "_astroclaw-gw._tcp.|local.|Test",
        name = "Test",
        host = "localhost",
        port = 18789,
        tlsEnabled = false,
        tlsFingerprintSha256 = null,
      )

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )

    assertNull(params)
  }

  @Test
  fun resolveTlsParamsForEndpoint_discoveryAndroidEmulatorWithoutHintsCanStayCleartext() {
    val endpoint =
      GatewayEndpoint(
        stableId = "_astroclaw-gw._tcp.|local.|Test",
        name = "Test",
        host = "10.0.2.2",
        port = 18789,
        tlsEnabled = false,
        tlsFingerprintSha256 = null,
      )

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )

    assertNull(params)
  }

  @Test
  fun isLoopbackGatewayHost_onlyTreatsEmulatorBridgeAsLocalWhenAllowed() {
    assertTrue(isLoopbackGatewayHost("10.0.2.2", allowEmulatorBridgeAlias = true))
    assertFalse(isLoopbackGatewayHost("10.0.2.2", allowEmulatorBridgeAlias = false))
  }

  @Test
  fun isPrivateLanGatewayHost_acceptsLanIpsButRejectsMdnsAndTailnetHosts() {
    assertTrue(isPrivateLanGatewayHost("192.168.1.20"))
    assertFalse(isPrivateLanGatewayHost("gateway.local"))
    assertFalse(isPrivateLanGatewayHost("100.64.0.9"))
    assertFalse(isPrivateLanGatewayHost("gateway.tailnet.ts.net"))
  }

  @Test
  fun resolveTlsParamsForEndpoint_discoveryIpv6LoopbackWithoutHintsCanStayCleartext() {
    val endpoint =
      GatewayEndpoint(
        stableId = "_astroclaw-gw._tcp.|local.|Test",
        name = "Test",
        host = "::1",
        port = 18789,
        tlsEnabled = false,
        tlsFingerprintSha256 = null,
      )

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )

    assertNull(params)
  }

  @Test
  fun resolveTlsParamsForEndpoint_discoveryMappedIpv4LoopbackWithoutHintsCanStayCleartext() {
    val endpoint =
      GatewayEndpoint(
        stableId = "_astroclaw-gw._tcp.|local.|Test",
        name = "Test",
        host = "::ffff:127.0.0.1",
        port = 18789,
        tlsEnabled = false,
        tlsFingerprintSha256 = null,
      )

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )

    assertNull(params)
  }

  @Test
  fun resolveTlsParamsForEndpoint_discoveryNonLoopbackIpv6WithoutHintsRequiresTls() {
    val endpoint =
      GatewayEndpoint(
        stableId = "_astroclaw-gw._tcp.|local.|Test",
        name = "Test",
        host = "2001:db8::1",
        port = 18789,
        tlsEnabled = false,
        tlsFingerprintSha256 = null,
      )

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )

    assertEquals(true, params?.required)
    assertNull(params?.expectedFingerprint)
    assertEquals(false, params?.allowTOFU)
  }

  @Test
  fun resolveTlsParamsForEndpoint_discoveryUnspecifiedIpv4WithoutHintsRequiresTls() {
    val endpoint =
      GatewayEndpoint(
        stableId = "_astroclaw-gw._tcp.|local.|Test",
        name = "Test",
        host = "0.0.0.0",
        port = 18789,
        tlsEnabled = false,
        tlsFingerprintSha256 = null,
      )

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )

    assertEquals(true, params?.required)
    assertNull(params?.expectedFingerprint)
    assertEquals(false, params?.allowTOFU)
  }

  @Test
  fun resolveTlsParamsForEndpoint_discoveryUnspecifiedIpv6WithoutHintsRequiresTls() {
    val endpoint =
      GatewayEndpoint(
        stableId = "_astroclaw-gw._tcp.|local.|Test",
        name = "Test",
        host = "::",
        port = 18789,
        tlsEnabled = false,
        tlsFingerprintSha256 = null,
      )

    val params =
      ConnectionManager.resolveTlsParamsForEndpoint(
        endpoint,
        storedFingerprint = null,
        manualTlsEnabled = false,
      )

    assertEquals(true, params?.required)
    assertNull(params?.expectedFingerprint)
    assertEquals(false, params?.allowTOFU)
  }

  @Test
  fun buildNodeConnectOptions_advertisesRequestableSmsSearchWithoutSmsCapability() {
    val options =
      newManager(
        sendSmsAvailable = false,
        readSmsAvailable = false,
        smsSearchPossible = true,
      ).buildNodeConnectOptions()

    assertTrue(options.commands.contains(AstroclawSmsCommand.Search.rawValue))
    assertFalse(options.commands.contains(AstroclawSmsCommand.Send.rawValue))
    assertFalse(options.caps.contains(AstroclawCapability.Sms.rawValue))
  }

  @Test
  fun buildNodeConnectOptions_doesNotAdvertiseSmsWhenSearchIsImpossible() {
    val options =
      newManager(
        sendSmsAvailable = false,
        readSmsAvailable = false,
        smsSearchPossible = false,
      ).buildNodeConnectOptions()

    assertFalse(options.commands.contains(AstroclawSmsCommand.Search.rawValue))
    assertFalse(options.commands.contains(AstroclawSmsCommand.Send.rawValue))
    assertFalse(options.caps.contains(AstroclawCapability.Sms.rawValue))
  }

  @Test
  fun buildNodeConnectOptions_advertisesSmsCapabilityWhenReadSmsIsAvailable() {
    val options =
      newManager(
        sendSmsAvailable = false,
        readSmsAvailable = true,
        smsSearchPossible = true,
      ).buildNodeConnectOptions()

    assertTrue(options.commands.contains(AstroclawSmsCommand.Search.rawValue))
    assertTrue(options.caps.contains(AstroclawCapability.Sms.rawValue))
  }

  @Test
  fun buildNodeConnectOptions_advertisesSmsSendWithoutSearchWhenOnlySendIsAvailable() {
    val options =
      newManager(
        sendSmsAvailable = true,
        readSmsAvailable = false,
        smsSearchPossible = false,
      ).buildNodeConnectOptions()

    assertTrue(options.commands.contains(AstroclawSmsCommand.Send.rawValue))
    assertFalse(options.commands.contains(AstroclawSmsCommand.Search.rawValue))
    assertTrue(options.caps.contains(AstroclawCapability.Sms.rawValue))
  }

  @Test
  fun buildNodeConnectOptions_advertisesAvailableNonSmsCommandsAndCapabilities() {
    val options =
      newManager(
        cameraEnabled = true,
        locationMode = LocationMode.WhileUsing,
        voiceWakeMode = VoiceWakeMode.Always,
        motionActivityAvailable = true,
        callLogAvailable = true,
        hasRecordAudioPermission = true,
      ).buildNodeConnectOptions()

    assertTrue(options.commands.contains(AstroclawCameraCommand.List.rawValue))
    assertTrue(options.commands.contains(AstroclawLocationCommand.Get.rawValue))
    assertTrue(options.commands.contains(AstroclawMotionCommand.Activity.rawValue))
    assertTrue(options.commands.contains(AstroclawCallLogCommand.Search.rawValue))
    assertTrue(options.caps.contains(AstroclawCapability.Camera.rawValue))
    assertTrue(options.caps.contains(AstroclawCapability.Location.rawValue))
    assertTrue(options.caps.contains(AstroclawCapability.Motion.rawValue))
    assertTrue(options.caps.contains(AstroclawCapability.CallLog.rawValue))
    assertTrue(options.caps.contains(AstroclawCapability.VoiceWake.rawValue))
  }

  @Test
  fun buildNodeConnectOptions_omitsVoiceWakeWithoutMicrophonePermission() {
    val options =
      newManager(
        voiceWakeMode = VoiceWakeMode.Always,
        hasRecordAudioPermission = false,
      ).buildNodeConnectOptions()

    assertFalse(options.caps.contains(AstroclawCapability.VoiceWake.rawValue))
  }

  @Test
  fun buildNodeConnectOptions_omitsUnavailableCameraLocationAndCallLogSurfaces() {
    val options =
      newManager(
        cameraEnabled = false,
        locationMode = LocationMode.Off,
        callLogAvailable = false,
      ).buildNodeConnectOptions()

    assertFalse(options.commands.contains(AstroclawCameraCommand.List.rawValue))
    assertFalse(options.commands.contains(AstroclawCameraCommand.Snap.rawValue))
    assertFalse(options.commands.contains(AstroclawCameraCommand.Clip.rawValue))
    assertFalse(options.commands.contains(AstroclawLocationCommand.Get.rawValue))
    assertFalse(options.commands.contains(AstroclawCallLogCommand.Search.rawValue))
    assertFalse(options.caps.contains(AstroclawCapability.Camera.rawValue))
    assertFalse(options.caps.contains(AstroclawCapability.Location.rawValue))
    assertFalse(options.caps.contains(AstroclawCapability.CallLog.rawValue))
  }

  @Test
  fun buildNodeConnectOptions_advertisesOnlyAvailableMotionCommand() {
    val options =
      newManager(
        motionActivityAvailable = false,
        motionPedometerAvailable = true,
      ).buildNodeConnectOptions()

    assertFalse(options.commands.contains(AstroclawMotionCommand.Activity.rawValue))
    assertTrue(options.commands.contains(AstroclawMotionCommand.Pedometer.rawValue))
    assertTrue(options.caps.contains(AstroclawCapability.Motion.rawValue))
  }

  @Test
  fun buildNodeConnectOptions_omitsMotionSurfaceWhenMotionApisUnavailable() {
    val options =
      newManager(
        motionActivityAvailable = false,
        motionPedometerAvailable = false,
      ).buildNodeConnectOptions()

    assertFalse(options.commands.contains(AstroclawMotionCommand.Activity.rawValue))
    assertFalse(options.commands.contains(AstroclawMotionCommand.Pedometer.rawValue))
    assertFalse(options.caps.contains(AstroclawCapability.Motion.rawValue))
  }

  private fun newManager(
    cameraEnabled: Boolean = false,
    locationMode: LocationMode = LocationMode.Off,
    voiceWakeMode: VoiceWakeMode = VoiceWakeMode.Off,
    motionActivityAvailable: Boolean = false,
    motionPedometerAvailable: Boolean = false,
    sendSmsAvailable: Boolean = false,
    readSmsAvailable: Boolean = false,
    smsSearchPossible: Boolean = false,
    callLogAvailable: Boolean = false,
    hasRecordAudioPermission: Boolean = false,
  ): ConnectionManager {
    val context = RuntimeEnvironment.getApplication()
    val prefs =
      SecurePrefs(
        context,
        securePrefsOverride = context.getSharedPreferences("connection-manager-test", android.content.Context.MODE_PRIVATE),
      )

    return ConnectionManager(
      prefs = prefs,
      cameraEnabled = { cameraEnabled },
      locationMode = { locationMode },
      voiceWakeMode = { voiceWakeMode },
      motionActivityAvailable = { motionActivityAvailable },
      motionPedometerAvailable = { motionPedometerAvailable },
      sendSmsAvailable = { sendSmsAvailable },
      readSmsAvailable = { readSmsAvailable },
      smsSearchPossible = { smsSearchPossible },
      callLogAvailable = { callLogAvailable },
      hasRecordAudioPermission = { hasRecordAudioPermission },
      manualTls = { false },
    )
  }
}
