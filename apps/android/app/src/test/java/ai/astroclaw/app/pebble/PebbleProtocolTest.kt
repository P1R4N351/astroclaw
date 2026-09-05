package ai.astroclaw.app.pebble

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PebbleProtocolTest {
  @Test
  fun parsesMenuScreen() {
    val parsed =
      ok(
        """
        {"v":1,"commit":"abc1234","screen":{"type":"menu","title":"PIRANESI",
         "items":[{"id":"status.open","label":"Status","sub":"household"},
                  {"id":"workshop.open","label":"Workshop"}]}}
        """.trimIndent(),
      )
    val menu = parsed.screen as PebbleScreen.Menu
    assertEquals("PIRANESI", menu.title)
    assertEquals(2, menu.items.size)
    assertEquals(PebbleMenuItem("status.open", "Status", "household"), menu.items[0])
    assertNull(menu.items[1].sub)
    assertEquals("abc1234", parsed.commit)
    assertFalse(parsed.newerProtocol)
  }

  @Test
  fun parsesCardScreen() {
    val screen = ok("""{"v":1,"commit":"c","screen":{"type":"card","title":"STATUS","body":"All clear"}}""").screen
    val card = screen as PebbleScreen.Card
    assertEquals("STATUS", card.title)
    assertEquals("All clear", card.body)
    assertFalse(card.vibe)
  }

  @Test
  fun parsesConfirmScreen() {
    val screen =
      ok(
        """
        {"v":1,"commit":"c","screen":{"type":"confirm","title":"LIGHT","body":"Toggle?",
         "action":"workshop.light","rid":"7f3d9a10-0000-4000-8000-000000000001"}}
        """.trimIndent(),
      ).screen
    val confirm = screen as PebbleScreen.Confirm
    assertEquals("workshop.light", confirm.action)
    assertEquals("7f3d9a10-0000-4000-8000-000000000001", confirm.rid)
  }

  @Test
  fun parsesResultScreenWithVibe() {
    val screen =
      ok("""{"v":1,"commit":"c","screen":{"type":"result","title":"SENT","body":"OK: queued","vibe":true}}""").screen
    val result = screen as PebbleScreen.Result
    assertEquals("OK: queued", result.body)
    assertTrue(result.vibe)
  }

  @Test
  fun unknownScreenTypeIsUnsupported() {
    val parsed = PebbleProtocol.parseEnvelope("""{"v":1,"commit":"c","screen":{"type":"graph","title":"x"}}""")
    val unsupported = parsed as PebbleParse.Unsupported
    assertTrue(unsupported.reason.contains("graph"))
  }

  @Test
  fun unknownFieldsAreTolerated() {
    val parsed =
      ok(
        """
        {"v":1,"commit":"c","ttl":30,"screen":{"type":"menu","title":"T","backlight":true,
         "items":[{"id":"a","label":"A","icon":"bulb"}]}}
        """.trimIndent(),
      )
    val menu = parsed.screen as PebbleScreen.Menu
    assertEquals(1, menu.items.size)
    assertEquals("a", menu.items[0].id)
  }

  @Test
  fun newerVersionWithKnownScreenRendersAndFlagsUpgrade() {
    val parsed = ok("""{"v":2,"commit":"c","screen":{"type":"card","title":"T","body":"B"}}""")
    assertTrue(parsed.newerProtocol)
    assertTrue(parsed.screen is PebbleScreen.Card)
  }

  @Test
  fun newerVersionWithUnknownScreenIsUnsupported() {
    val parsed = PebbleProtocol.parseEnvelope("""{"v":2,"commit":"c","screen":{"type":"timeline","title":"T"}}""")
    assertTrue(parsed is PebbleParse.Unsupported)
  }

  @Test
  fun missingOrMalformedVersionIsUnsupported() {
    assertTrue(PebbleProtocol.parseEnvelope("""{"commit":"c","screen":{"type":"card"}}""") is PebbleParse.Unsupported)
    assertTrue(PebbleProtocol.parseEnvelope("""{"v":"1","screen":{"type":"card"}}""") is PebbleParse.Unsupported)
    assertTrue(PebbleProtocol.parseEnvelope("""{"v":0,"screen":{"type":"card"}}""") is PebbleParse.Unsupported)
  }

  @Test
  fun malformedEnvelopeIsUnsupported() {
    assertTrue(PebbleProtocol.parseEnvelope("not json") is PebbleParse.Unsupported)
    assertTrue(PebbleProtocol.parseEnvelope("[]") is PebbleParse.Unsupported)
    assertTrue(PebbleProtocol.parseEnvelope("""{"v":1,"commit":"c"}""") is PebbleParse.Unsupported)
    assertTrue(PebbleProtocol.parseEnvelope("""{"v":1,"screen":{"title":"no type"}}""") is PebbleParse.Unsupported)
  }

  @Test
  fun confirmWithoutRidIsUnsupported() {
    // A confirm the client cannot re-post is worse than no confirm: it invites a fabricated rid.
    val parsed =
      PebbleProtocol.parseEnvelope(
        """{"v":1,"commit":"c","screen":{"type":"confirm","title":"T","body":"B","action":"a"}}""",
      )
    assertTrue(parsed is PebbleParse.Unsupported)
  }

  @Test
  fun menuItemWithoutIdIsUnsupported() {
    val parsed =
      PebbleProtocol.parseEnvelope(
        """{"v":1,"commit":"c","screen":{"type":"menu","title":"T","items":[{"label":"A"}]}}""",
      )
    assertTrue(parsed is PebbleParse.Unsupported)
  }

  @Test
  fun healthParsesWithAndWithoutPbw() {
    val bare = PebbleProtocol.parseHealth("""{"ok":true,"v":1,"commit":"abc","uptime_s":42}""")
    assertNotNull(bare)
    assertEquals(42L, bare!!.uptimeSeconds)
    assertNull(bare.pbw)

    val sha = "a".repeat(64)
    val withPbw =
      PebbleProtocol.parseHealth(
        """{"ok":true,"v":1,"commit":"abc","uptime_s":1,"pbw":{"version":"0.1.0","sha256":"$sha"}}""",
      )
    assertEquals(PebblePbwInfo("0.1.0", sha), withPbw?.pbw)
  }

  @Test
  fun malformedPbwBlockIsTreatedAsAbsent() {
    // Fail closed on the sideload offer rather than offering an unverifiable download.
    val health =
      PebbleProtocol.parseHealth(
        """{"ok":true,"v":1,"commit":"abc","uptime_s":1,"pbw":{"version":"0.1.0","sha256":"nothex"}}""",
      )
    assertNotNull(health)
    assertNull(health!!.pbw)
  }

  @Test
  fun malformedHealthIsNull() {
    assertNull(PebbleProtocol.parseHealth("nope"))
    assertNull(PebbleProtocol.parseHealth("""{"v":1}"""))
  }

  private fun ok(raw: String): PebbleEnvelope {
    val parsed = PebbleProtocol.parseEnvelope(raw)
    assertTrue("expected a parsed envelope, got $parsed", parsed is PebbleParse.Ok)
    return (parsed as PebbleParse.Ok).envelope
  }
}
