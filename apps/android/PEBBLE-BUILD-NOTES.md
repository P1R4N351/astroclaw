# Pebble Iris — Android client build notes

The Astroclaw Android app is now a second client of the Pebble Iris protocol v1, alongside the
Pebble watchapp. Server: `pebble-iris` (Node-RED on CT908), fronted by `tailscale serve` on
trueblue at `https://trueblue.tail8d99b6.ts.net:18879`.

Protocol reference: `pebble-iris/README.md` and `pebble-iris/flows-lib/protocol.js`. The server
owns every decision; this client renders and reports, and nothing else.

## What landed

| Layer | File |
|---|---|
| Parser (pure) | `app/src/main/java/ai/astroclaw/app/pebble/PebbleProtocol.kt` |
| Failure model + classifier + wording (pure) | `.../pebble/PebbleFailure.kt` |
| Request ids (pure) | `.../pebble/PebbleRequestIds.kt` |
| HTTP client | `.../pebble/PebbleClient.kt` |
| Navigation state machine (pure) | `.../pebble/PebbleController.kt` |
| Sideload integrity + cache policy (pure) | `.../pebble/PebbleSideloadVerifier.kt` |
| Sideload download / FileProvider hand-off | `.../pebble/PebbleSideloadManager.kt` |
| Screen | `app/src/main/java/ai/astroclaw/app/ui/PebbleTabScreen.kt` |
| Settings card | `app/src/main/java/ai/astroclaw/app/ui/PebbleSettingsCard.kt` |

Navigation follows the `VoiceTabScreen` precedent: a `HomeTab` entry in `PostOnboardingTabs.kt`.
Settings follow the existing mechanism: base URL in the plain prefs, token in the
`EncryptedSharedPreferences` file, both exposed as `StateFlow` on `MainViewModel`.

## Deliberate decisions

- **Confirmations are never synthesised.** `PebbleController.confirm()` re-posts the `action` and
  `rid` that the server put in the confirm screen. A `confirm` screen that arrives without a `rid`
  is rejected by the parser as unsupported rather than being rendered with a fabricated one.
- **Nothing is ever replayed.** There is no retry anywhere in this code, and
  `OkHttpClient.retryOnConnectionFailure(false)` disables OkHttp's own. The actions behind this
  surface are physical events.
- **An unrecognised transport error is classified as a timeout, not as unreachable.**
  "Unreachable" asserts the side effect did not happen; asserting that without knowing invites a
  second press on a real light. This matches the server's own outcome classification.
- **A failed or unparseable response clears the screen.** The user never looks at a screen that may
  no longer describe the server's state.
- **The token is never echoed back into the settings field.** The card reports only whether one is
  stored. To change it you type a new one.
- **No logging in the Pebble package at all.** No `android.util.Log`, and
  `PebbleFailureClassifier` deliberately discards exception messages (OkHttp embeds the target host
  in connect failures) — callers get the exception's simple class name instead. The token travels
  in a header, never a URL. `GatewayDiagnostics` was not touched and collects nothing from here.
- **Backup exclusions are redundant-but-explicit.** `android:allowBackup="false"` plus the existing
  `<exclude domain="root" path="."/>` already cover everything; a named
  `<exclude domain="sharedpref" path="astroclaw.node.secure.xml"/>` was added to both
  `backup_rules.xml` and `data_extraction_rules.xml` so that relaxing the blanket rule later cannot
  silently start backing up credentials.
- **Sideload cache key is the digest.** Files are `cacheDir/pebble/pebble-iris-<sha256>.pbw`. After
  a successful verified download every other bundle is deleted; on screen open, our own files older
  than 7 days are swept best-effort.
- **Bytes are verified before they touch the disk.** The download is read into a bounded buffer
  (8 MiB ceiling), digested, and compared against BOTH `X-Pbw-Sha256` and the `pbw.sha256` from
  `/pebble/health`. A mismatch writes nothing and reports an integrity failure.
- **`<queries>` addition is narrow**: one `VIEW` + `application/octet-stream` intent.

## NOT VERIFIED — no Android SDK and no JVM on the authoring host

`java`, `javac`, `kotlinc` and the Android SDK are all absent from the host this was written on
(`which java` → not found). **Nothing here has been compiled and no test has been executed.** The
build and the test run must happen on CT923. Specifically unverified:

1. **Everything compiles.** No `kotlinc` was available. Kotlin `allWarningsAsErrors=true` is set
   repo-wide, so any unused import, deprecation, or shadowed name is a build failure, not a
   warning. Import ordering was checked mechanically against the repo's ASCII/case-sensitive
   layout by script, not by ktlint itself.
2. **`Response.body` is non-null.** OkHttp 5 made `Response.body` a non-null `ResponseBody`, and
   this code uses `response.body.string()` / `response.body.byteStream()` accordingly. If the
   pinned 5.3.2 API still exposes it as nullable, those two call sites need `?.`. Writing `?.`
   against a non-null receiver would itself fail the build under `allWarningsAsErrors`, so this
   had to be picked one way without a compiler.
3. **All unit tests.** `PebbleProtocolTest`, `PebbleFailureClassifierTest`,
   `PebbleSideloadVerifierTest`, `PebbleControllerTest`. Run with
   `./gradlew :app:testPlayDebugUnitTest`. The SHA-256 golden vectors in
   `PebbleSideloadVerifierTest` were produced independently on the authoring host
   (`python3 hashlib` cross-checked with `sha256sum`), NOT by the class under test.
4. **Fault-injection validation of the new tests** (does each test actually fail when the property
   it asserts is broken?). This is the instrument-validation step and it has NOT been run — a test
   that passes with the defect present is worse than no test. Do this on CT923 before trusting a
   green run: at minimum, break `PebbleController.confirm()` to mint a fresh rid and confirm
   `confirmReusesThePromptsOwnRid` fails.
5. **Android lint**, including `AutoboxingStateCreation` (an error here). No numeric Compose state
   is created in the new code, but this was not machine-checked.
6. **`FileProvider` hand-off end to end**: the `content://` URI, the read grant, whether the Pebble
   app by Core Devices actually claims `application/octet-stream`, and whether
   `Intent.createChooser` throws or shows an empty chooser when nothing does. The
   `ActivityNotFoundException` path is coded for both.
7. **`/pebble/pbw` does not exist server-side yet.** As of this writing, `pebble-iris` has no `pbw`
   route and `/pebble/health` publishes no `pbw` block — `grep -rn pbw` over the pebble-iris repo
   returns nothing. The client is written to the contract given in the remit and DEGRADES CLEANLY:
   with no `pbw` block in health, the sideload panel is simply not shown. The endpoint contract
   (`X-Pbw-Version`, `X-Pbw-Sha256`, quoted `ETag`) therefore remains unconfirmed against a running
   server.
8. **`EncryptedSharedPreferences` read on first Pebble-tab open.** Hydration is wrapped in
   `Dispatchers.IO`, but the StrictMode thread policy (debug builds) was not observed in practice.
9. **Six tabs in the bottom bar.** The tab row weights each entry equally; the added `Pebble` tab
   makes six. Not checked on a narrow device.

## Server-side follow-ups

- Add the `/pebble/pbw` route and the `pbw` block in `/pebble/health`, or drop the sideload panel.
- `ETag` is read and carried but not yet used for conditional requests; a future `If-None-Match`
  would avoid re-downloading an unchanged bundle.
