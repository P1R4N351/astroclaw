package ai.astroclaw.app.gateway

import java.security.MessageDigest

/**
 * OpenPGP smart-card authentication for the collective gateway.
 *
 * The gateway verifies raw Ed25519 signatures over the connect payload
 * (`verifyDeviceSignature` -> `crypto.verify(null, payload, key, sig)`), and an OpenPGP
 * card's AUT key performs exactly that operation via INTERNAL AUTHENTICATE. So a card can
 * BE the device credential with no gateway protocol change at all — the private key stays
 * on the card and never exists on the phone.
 *
 * APDU constants below are taken from Yubico's own `yubikit/openpgp.py`, not from memory.
 * Two details there are easy to get wrong and are load-bearing:
 *   - VERIFY uses P2 = 0x81 for sign-only mode and P2 = 0x82 for everything else.
 *     INTERNAL AUTHENTICATE needs the 0x82 (extended) mode; verifying with 0x81 leaves the
 *     card refusing to authenticate while reporting a perfectly successful PIN check.
 *   - For EdDSA keys the command data is the RAW message. It is never pre-hashed, unlike
 *     the RSA and ECDSA paths. Hashing first yields a valid signature over the wrong bytes,
 *     which fails verification server-side with no useful error.
 */
object OpenPgpCardAuth {
  private const val CLA: Byte = 0x00
  private const val INS_SELECT: Byte = 0xA4.toByte()
  private const val INS_VERIFY: Byte = 0x20
  private const val INS_INTERNAL_AUTHENTICATE: Byte = 0x88.toByte()
  private const val INS_GET_DATA: Byte = 0xCA.toByte()
  private const val INS_GET_RESPONSE: Byte = 0xC0.toByte()

  private const val P2_VERIFY_USER_EXTENDED: Byte = 0x82.toByte()
  private const val DO_APPLICATION_RELATED_DATA = 0x6E
  private const val TAG_DISCRETIONARY = 0x73
  private const val TAG_ALGORITHM_ATTRIBUTES_AUT = 0xC3

  private const val ALGORITHM_ID_EDDSA = 0x16
  private const val ED25519_PUBLIC_KEY_LEN = 32
  private const val ED25519_SIGNATURE_LEN = 64

  private val OPENPGP_AID = byteArrayOf(0xD2.toByte(), 0x76, 0x00, 0x01, 0x24, 0x01)

  private const val SW_OK = 0x9000

  /** What a connected card can do for us, decided from the card itself, not from its serial. */
  sealed interface Capability {
    /** AUT key is Ed25519 — usable as a gateway device credential right now. */
    data class GatewayCompatible(val publicKeyRaw: ByteArray, val deviceId: String) : Capability

    /** Card present and healthy, but its AUT key algorithm the gateway cannot verify. */
    data class UnsupportedAlgorithm(val algorithmId: Int) : Capability
  }

  /**
   * Select the applet and report what this card can do.
   *
   * Deliberately capability-based rather than serial-based: the roster's card3 is a Feitian
   * ePass whose applet is spec-2.0 rsa2048-locked and physically cannot hold an Ed25519 key,
   * so it can never satisfy the gateway. Asking the card what it holds means an unknown or
   * newly provisioned card is handled correctly without a code change, and a downgraded card
   * is rejected rather than assumed good from a serial we recognise.
   */
  fun probe(transport: CardTransport): Capability {
    select(transport)
    val appData = getData(transport, DO_APPLICATION_RELATED_DATA)
    val discretionary = findTlv(appData, TAG_DISCRETIONARY)
      ?: throw CardIoException("no discretionary data object (0x73) in application data")
    val attributes = findTlv(discretionary, TAG_ALGORITHM_ATTRIBUTES_AUT)
      ?: throw CardIoException("no AUT algorithm attributes (0xC3) on this card")
    if (attributes.isEmpty()) throw CardIoException("empty AUT algorithm attributes")

    val algorithmId = attributes[0].toInt() and 0xFF
    if (algorithmId != ALGORITHM_ID_EDDSA) return Capability.UnsupportedAlgorithm(algorithmId)

    val publicKey = readAuthPublicKey(transport)
    return Capability.GatewayCompatible(publicKey, deviceIdOf(publicKey))
  }

  /**
   * Verify the user PIN in extended mode, then sign [payload] with the AUT key.
   *
   * Returns the raw 64-byte Ed25519 signature the gateway expects. The PIN is used once and
   * not retained; callers must not log it, and must not retry on failure without surfacing
   * the attempt count, because three wrong PINs block the card.
   */
  fun authenticate(transport: CardTransport, pin: CharArray, payload: ByteArray): ByteArray {
    select(transport)
    verifyUserPinExtended(transport, pin)
    // EdDSA: raw message, never pre-hashed. See the class comment.
    val response = send(transport, CLA, INS_INTERNAL_AUTHENTICATE, 0x00, 0x00, payload, expectResponse = true)
    if (response.size != ED25519_SIGNATURE_LEN) {
      throw CardIoException("expected $ED25519_SIGNATURE_LEN signature bytes, got ${response.size}")
    }
    return response
  }

  /** deviceId is sha256 over the raw public key, matching the gateway's own derivation. */
  fun deviceIdOf(publicKeyRaw: ByteArray): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(publicKeyRaw)
    val out = StringBuilder(digest.size * 2)
    for (b in digest) {
      val v = b.toInt() and 0xFF
      out.append(HEX[v ushr 4]).append(HEX[v and 0x0F])
    }
    return out.toString()
  }

  private fun select(transport: CardTransport) {
    send(transport, CLA, INS_SELECT, 0x04, 0x00, OPENPGP_AID, expectResponse = false)
  }

  private fun verifyUserPinExtended(transport: CardTransport, pin: CharArray) {
    val encoded = ByteArray(pin.size)
    for (i in pin.indices) encoded[i] = pin[i].code.toByte()
    try {
      send(transport, CLA, INS_VERIFY, 0x00, P2_VERIFY_USER_EXTENDED, encoded, expectResponse = false)
    } finally {
      encoded.fill(0) // do not leave the PIN sitting in a heap buffer
    }
  }

  /**
   * The AUT public key is read with GENERATE ASYMMETRIC KEY PAIR in "read existing" mode
   * (P1 = 0x81), which returns the public key without touching the private key.
   */
  private fun readAuthPublicKey(transport: CardTransport): ByteArray {
    val crt = byteArrayOf(0xA4.toByte(), 0x00) // control reference template for the AUT key
    val response = send(transport, CLA, 0x47, 0x81.toByte(), 0x00, crt, expectResponse = true)
    val publicKeyTemplate = findTlv(response, 0x7F49)
      ?: throw CardIoException("no public key template (0x7F49) in the card's response")
    val point = findTlv(publicKeyTemplate, 0x86)
      ?: throw CardIoException("no public key point (0x86) for the AUT key")
    if (point.size != ED25519_PUBLIC_KEY_LEN) {
      throw CardIoException("AUT public key is ${point.size} bytes, expected $ED25519_PUBLIC_KEY_LEN")
    }
    return point
  }

  private fun getData(transport: CardTransport, tag: Int): ByteArray =
    send(transport, CLA, INS_GET_DATA, ((tag shr 8) and 0xFF).toByte(), (tag and 0xFF).toByte(), ByteArray(0), expectResponse = true)

  /**
   * Build and send one short APDU, following 61xx continuations.
   *
   * Bounded continuation loop: a card that keeps answering "more data available" would
   * otherwise spin forever, and this runs on a foreground thread with a card the user is
   * physically holding against the phone.
   */
  private fun send(
    transport: CardTransport,
    cla: Byte,
    ins: Byte,
    p1: Byte,
    p2: Byte,
    data: ByteArray,
    expectResponse: Boolean,
  ): ByteArray {
    require(data.size <= MAX_SHORT_APDU_DATA) { "APDU data ${data.size} exceeds short-APDU limit" }
    val header = byteArrayOf(cla, ins, p1, p2)
    val apdu = when {
      data.isEmpty() && expectResponse -> header + byteArrayOf(0x00)
      data.isEmpty() -> header
      expectResponse -> header + byteArrayOf(data.size.toByte()) + data + byteArrayOf(0x00)
      else -> header + byteArrayOf(data.size.toByte()) + data
    }

    var response = transport.transceive(apdu)
    val accumulated = ArrayList<Byte>()
    var continuations = 0
    while (continuations < MAX_CONTINUATIONS) {
      if (response.size < 2) throw CardIoException("truncated APDU response (${response.size} bytes)")
      val sw1 = response[response.size - 2].toInt() and 0xFF
      val sw2 = response[response.size - 1].toInt() and 0xFF
      for (i in 0 until response.size - 2) accumulated.add(response[i])
      val sw = (sw1 shl 8) or sw2
      if (sw == SW_OK) return accumulated.toByteArray()
      if (sw1 != 0x61) throw CardIoException("card returned SW=0x%04X".format(sw))
      continuations += 1
      response = transport.transceive(byteArrayOf(CLA, INS_GET_RESPONSE, 0x00, 0x00, sw2.toByte()))
    }
    throw CardIoException("card exceeded $MAX_CONTINUATIONS GET RESPONSE continuations")
  }

  /**
   * Minimal BER-TLV search for [tag] at the top level of [data].
   *
   * Handles 1- and 2-byte tags and 1- and 2-byte lengths, which covers every object this
   * code reads. It deliberately does NOT recurse: callers descend one container at a time so
   * a malformed nested object cannot cause unbounded work.
   */
  private fun findTlv(data: ByteArray, tag: Int): ByteArray? {
    var offset = 0
    var iterations = 0
    while (offset < data.size && iterations < MAX_TLV_OBJECTS) {
      iterations += 1
      val first = data[offset].toInt() and 0xFF
      var currentTag = first
      offset += 1
      if (first and 0x1F == 0x1F) { // multi-byte tag
        if (offset >= data.size) return null
        currentTag = (first shl 8) or (data[offset].toInt() and 0xFF)
        offset += 1
      }
      if (offset >= data.size) return null
      var length = data[offset].toInt() and 0xFF
      offset += 1
      if (length == 0x81) {
        if (offset >= data.size) return null
        length = data[offset].toInt() and 0xFF
        offset += 1
      } else if (length == 0x82) {
        if (offset + 1 >= data.size) return null
        length = ((data[offset].toInt() and 0xFF) shl 8) or (data[offset + 1].toInt() and 0xFF)
        offset += 2
      }
      if (length < 0 || offset + length > data.size) return null
      if (currentTag == tag) return data.copyOfRange(offset, offset + length)
      offset += length
    }
    return null
  }

  private const val MAX_SHORT_APDU_DATA = 255
  private const val MAX_CONTINUATIONS = 16
  private const val MAX_TLV_OBJECTS = 64
  private val HEX = "0123456789abcdef".toCharArray()
}
