package ai.astroclaw.app.gateway

import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.nfc.tech.IsoDep

/**
 * ISO 7816-4 transport to an OpenPGP smart card, over either NFC or USB-C.
 *
 * Both transports carry the same APDUs; only the framing differs. NFC gets ISO-DEP for
 * free from the platform, USB has to speak CCID block framing itself.
 */
interface CardTransport : AutoCloseable {
  /** Human-readable transport name, for logs and for telling the user which one engaged. */
  val label: String

  /** Send one command APDU, return the full response including the two SW bytes. */
  fun transceive(apdu: ByteArray): ByteArray
}

/**
 * NFC transport. Only card1 (YubiKey 5C NFC) exposes an NFC interface; card2 is a 5C Nano
 * and card3 is a Feitian ePass, both USB-only. Callers must treat NFC as optional.
 */
class NfcCardTransport(private val isoDep: IsoDep) : CardTransport {
  override val label = "nfc"

  init {
    if (!isoDep.isConnected) {
      isoDep.connect()
    }
    // OpenPGP operations on a slow card can exceed the default ~300ms presence timeout;
    // an ed25519 INTERNAL AUTHENTICATE plus PIN verify comfortably fits 5s.
    runCatching { isoDep.timeout = 5_000 }
  }

  override fun transceive(apdu: ByteArray): ByteArray = isoDep.transceive(apdu)

  override fun close() {
    runCatching { isoDep.close() }
  }
}

/**
 * USB CCID (chip-card interface device) transport.
 *
 * CCID wraps each APDU in a 10-byte header:
 *   [0]      bMessageType
 *   [1..4]   dwLength   (little endian, payload length AFTER the header)
 *   [5]      bSlot
 *   [6]      bSeq
 *   [7..9]   message-specific (on responses: bStatus, bError, bChainParameter)
 *
 * The card must be powered on before it will answer APDUs, so [open] issues IccPowerOn
 * and discards the ATR — we do not parse it, we only require that the card answered.
 */
class UsbCcidCardTransport private constructor(
  private val connection: UsbDeviceConnection,
  private val usbInterface: UsbInterface,
  private val bulkOut: UsbEndpoint,
  private val bulkIn: UsbEndpoint,
) : CardTransport {
  override val label = "usb-c"

  private var sequence: Byte = 0

  override fun transceive(apdu: ByteArray): ByteArray = sendCcid(MSG_XFR_BLOCK, apdu)

  private fun sendCcid(messageType: Byte, payload: ByteArray): ByteArray {
    val frame = ByteArray(CCID_HEADER_LEN + payload.size)
    frame[0] = messageType
    frame[1] = (payload.size and 0xFF).toByte()
    frame[2] = ((payload.size shr 8) and 0xFF).toByte()
    frame[3] = ((payload.size shr 16) and 0xFF).toByte()
    frame[4] = ((payload.size shr 24) and 0xFF).toByte()
    frame[5] = 0 // bSlot
    frame[6] = sequence
    payload.copyInto(frame, CCID_HEADER_LEN)
    sequence = (sequence + 1).toByte()

    val written = connection.bulkTransfer(bulkOut, frame, frame.size, IO_TIMEOUT_MS)
    if (written < 0) throw CardIoException("CCID write failed")
    return readCcidResponse()
  }

  /**
   * Reads one CCID response. The reader may emit "time extension" frames (bStatus bit 0x80
   * with bError 0xFE) while the card is busy — an ed25519 signature routinely triggers one.
   * Those are not failures and must be waited through, so the loop is bounded rather than
   * single-shot; an unbounded wait would hang the UI thread on a wedged reader.
   */
  private fun readCcidResponse(): ByteArray {
    val buffer = ByteArray(MAX_CCID_FRAME)
    var attempt = 0
    while (attempt < MAX_TIME_EXTENSIONS) {
      attempt += 1
      val read = connection.bulkTransfer(bulkIn, buffer, buffer.size, IO_TIMEOUT_MS)
      if (read < CCID_HEADER_LEN) throw CardIoException("short CCID response ($read bytes)")
      val status = buffer[7].toInt() and 0xFF
      val error = buffer[8].toInt() and 0xFF
      val timeExtension = (status and 0xC0) == 0x80 && error == 0xFE
      if (timeExtension) continue
      if ((status and 0xC0) == 0x40) throw CardIoException("CCID command failed, bError=0x%02X".format(error))
      val length = (buffer[1].toInt() and 0xFF) or
        ((buffer[2].toInt() and 0xFF) shl 8) or
        ((buffer[3].toInt() and 0xFF) shl 16) or
        ((buffer[4].toInt() and 0xFF) shl 24)
      if (length < 0 || CCID_HEADER_LEN + length > read) {
        throw CardIoException("CCID length $length overruns the $read-byte frame")
      }
      return buffer.copyOfRange(CCID_HEADER_LEN, CCID_HEADER_LEN + length)
    }
    throw CardIoException("card still busy after $MAX_TIME_EXTENSIONS time extensions")
  }

  override fun close() {
    runCatching { connection.releaseInterface(usbInterface) }
    runCatching { connection.close() }
  }

  companion object {
    private const val CCID_HEADER_LEN = 10
    private const val MAX_CCID_FRAME = 512
    private const val IO_TIMEOUT_MS = 5_000
    private const val MAX_TIME_EXTENSIONS = 20
    private const val MSG_POWER_ON: Byte = 0x62
    private const val MSG_XFR_BLOCK: Byte = 0x6F
    private const val CCID_INTERFACE_CLASS = 0x0B

    /** True when this USB device exposes a CCID smart-card interface we can drive. */
    fun isSmartCard(device: UsbDevice): Boolean = findCcidInterface(device) != null

    private fun findCcidInterface(device: UsbDevice): UsbInterface? {
      var i = 0
      while (i < device.interfaceCount) { // bounded by the device's own descriptor
        val candidate = device.getInterface(i)
        if (candidate.interfaceClass == CCID_INTERFACE_CLASS) return candidate
        i += 1
      }
      return null
    }

    /**
     * Claims the CCID interface and powers the card on. Returns null when the device is not
     * a smart card, permission was not granted, or the card never answered — all of which
     * are ordinary "no card here" conditions, not errors worth throwing at the caller.
     */
    fun open(manager: UsbManager, device: UsbDevice): UsbCcidCardTransport? {
      val iface = findCcidInterface(device) ?: return null
      var bulkIn: UsbEndpoint? = null
      var bulkOut: UsbEndpoint? = null
      var e = 0
      while (e < iface.endpointCount) { // bounded by the interface descriptor
        val ep = iface.getEndpoint(e)
        if (ep.type == UsbConstants.USB_ENDPOINT_XFER_BULK) {
          if (ep.direction == UsbConstants.USB_DIR_IN) bulkIn = ep else bulkOut = ep
        }
        e += 1
      }
      if (bulkIn == null || bulkOut == null) return null
      val connection = manager.openDevice(device) ?: return null
      if (!connection.claimInterface(iface, true)) {
        connection.close()
        return null
      }
      val transport = UsbCcidCardTransport(connection, iface, bulkOut, bulkIn)
      return try {
        transport.sendCcid(MSG_POWER_ON, ByteArray(0)) // ATR discarded; we only need an answer
        transport
      } catch (_: CardIoException) {
        transport.close()
        null
      }
    }
  }
}

class CardIoException(message: String) : Exception(message)
