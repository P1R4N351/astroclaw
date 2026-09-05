package ai.astroclaw.app.ui

import ai.astroclaw.app.MainViewModel
import ai.astroclaw.app.pebble.PebbleClient
import ai.astroclaw.app.pebble.PebbleConfig
import ai.astroclaw.app.pebble.PebbleController
import ai.astroclaw.app.pebble.PebbleFailure
import ai.astroclaw.app.pebble.PebbleFailureText
import ai.astroclaw.app.pebble.PebbleFailureTone
import ai.astroclaw.app.pebble.PebbleHealth
import ai.astroclaw.app.pebble.PebbleInstallResult
import ai.astroclaw.app.pebble.PebbleMenuItem
import ai.astroclaw.app.pebble.PebblePbwInfo
import ai.astroclaw.app.pebble.PebbleScreen
import ai.astroclaw.app.pebble.PebbleSideloadManager
import ai.astroclaw.app.pebble.PebbleSideloadState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * The Pebble Iris surface: a STRICT renderer for a server-driven protocol.
 *
 * This screen decides nothing about the household. It draws the screen the server sent, reports
 * which row was pressed, and refuses — visibly — to render anything it does not recognise. Every
 * network call is issued from a coroutine scope tied to this composition, so navigating away
 * cancels whatever is in flight rather than letting it land on a dead screen.
 */
@Composable
fun PebbleTabScreen(
  viewModel: MainViewModel,
  onOpenSettings: () -> Unit,
) {
  val context = LocalContext.current
  val scope = rememberCoroutineScope()
  val baseUrl by viewModel.pebbleBaseUrl.collectAsState()
  val token by viewModel.pebbleToken.collectAsState()

  LaunchedEffect(Unit) {
    // The token lives in EncryptedSharedPreferences; hydrate it off the main thread.
    withContext(Dispatchers.IO) { viewModel.loadPebbleToken() }
  }

  val config = remember(baseUrl, token) { PebbleConfig(baseUrl = baseUrl, token = token) }
  val api = remember(config) { PebbleClient(config) }
  val controller = remember(api) { PebbleController(api = api, configured = config.isConfigured) }
  val sideload = remember(api) { PebbleSideloadManager(context, api) }
  val state by controller.state.collectAsState()
  val sideloadState by sideload.state.collectAsState()
  var installMessage by remember(api) { mutableStateOf<String?>(null) }

  LaunchedEffect(controller) {
    sideload.sweepExpired(System.currentTimeMillis())
    controller.open()
  }

  Column(
    modifier =
      Modifier
        .fillMaxSize()
        .background(mobileBackgroundGradient)
        .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom))
        .padding(horizontal = 20.dp, vertical = 14.dp),
    verticalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    PebbleHeader(commit = state.commit, health = state.health, busy = state.busy)

    if (!config.isConfigured) {
      PebbleSetupHint(onOpenSettings = onOpenSettings)
    } else {
      if (state.upgradeAvailable) {
        PebbleNotice(
          title = "Newer protocol",
          body = "The server speaks a newer Pebble Iris protocol than this app. Update Astroclaw.",
          accent = mobileWarning,
          soft = mobileWarningSoft,
        )
      }
      state.failure?.let { failure ->
        PebbleFailurePanel(
          failure = failure,
          enabled = !state.busy,
          onOpenSettings = onOpenSettings,
          onHome = { scope.launch { controller.loadRoot() } },
        )
      }
      Box(modifier = Modifier.fillMaxWidth().weight(1f)) {
        PebbleScreenBody(
          screen = state.screen,
          loaded = state.loaded,
          enabled = !state.busy,
          onSelect = { id -> scope.launch { controller.activate(id) } },
          onConfirm = { scope.launch { controller.confirm() } },
          onCancel = { controller.cancelConfirm() },
        )
      }
      state.health?.pbw?.let { pbw ->
        PebbleSideloadPanel(
          pbw = pbw,
          sideloadState = sideloadState,
          message = installMessage,
          onDownload = { scope.launch { sideload.download(pbw) } },
          onInstall = { installMessage = describeInstall(sideload.install(context)) },
        )
      }
      PebbleFooter(
        enabled = !state.busy,
        onHome = { scope.launch { controller.loadRoot() } },
        onRefreshHealth = { scope.launch { controller.refreshHealth() } },
      )
    }
  }
}

/** Null message means the hand-off launched cleanly and there is nothing to say. */
private fun describeInstall(result: PebbleInstallResult): String? =
  when (result) {
    is PebbleInstallResult.Launched -> null
    is PebbleInstallResult.NoHandler -> result.guidance
    is PebbleInstallResult.NotReady -> "Download the watchapp before installing it."
  }

@Composable
private fun PebbleHeader(
  commit: String,
  health: PebbleHealth?,
  busy: Boolean,
) {
  Row(
    modifier = Modifier.fillMaxWidth(),
    horizontalArrangement = Arrangement.SpaceBetween,
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
      Text("Pebble Iris", style = mobileTitle2, color = mobileText)
      Text(
        if (commit.isEmpty()) "Watch surface" else "commit $commit",
        style = mobileCaption1.copy(fontFamily = FontFamily.Monospace),
        color = mobileTextTertiary,
      )
    }
    Row(
      horizontalArrangement = Arrangement.spacedBy(8.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      if (busy) {
        CircularProgressIndicator(modifier = Modifier.size(18.dp), color = mobileAccent)
      }
      PebbleChip(
        text = if (health?.ok == true) "Server up" else "Server unknown",
        accent = if (health?.ok == true) mobileSuccess else mobileTextSecondary,
        soft = if (health?.ok == true) mobileSuccessSoft else mobileSurface,
      )
    }
  }
}

@Composable
private fun PebbleChip(
  text: String,
  accent: Color,
  soft: Color,
) {
  Surface(shape = RoundedCornerShape(999.dp), color = soft, border = BorderStroke(1.dp, accent.copy(alpha = 0.35f))) {
    Text(
      text,
      modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
      style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold),
      color = accent,
      maxLines = 1,
    )
  }
}

@Composable
private fun PebbleSetupHint(onOpenSettings: () -> Unit) {
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(16.dp),
    color = mobileCardSurface,
    border = BorderStroke(1.dp, mobileBorderStrong),
  ) {
    Column(
      modifier = Modifier.padding(horizontal = 14.dp, vertical = 14.dp),
      verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      Text("Set up Pebble Iris", style = mobileHeadline, color = mobileText)
      Text(
        "Add the Pebble Iris base URL and access token in Settings. Nothing is sent until both " +
          "are present.",
        style = mobileCallout,
        color = mobileTextSecondary,
      )
      Button(
        onClick = onOpenSettings,
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(containerColor = mobileAccent, contentColor = Color.White),
      ) {
        Text("Open settings", style = mobileCallout.copy(fontWeight = FontWeight.Bold))
      }
    }
  }
}

@Composable
private fun PebbleNotice(
  title: String,
  body: String,
  accent: Color,
  soft: Color,
) {
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(14.dp),
    color = soft,
    border = BorderStroke(1.dp, accent.copy(alpha = 0.35f)),
  ) {
    Column(
      modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
      verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
      Text(title, style = mobileCallout.copy(fontWeight = FontWeight.Bold), color = accent)
      Text(body, style = mobileCaption1, color = mobileTextSecondary)
    }
  }
}

/**
 * The five failure classes are drawn with their own headline and their own tone. An "Open settings"
 * shortcut appears only for the one failure a settings change can actually fix.
 */
@Composable
private fun PebbleFailurePanel(
  failure: PebbleFailure,
  enabled: Boolean,
  onOpenSettings: () -> Unit,
  onHome: () -> Unit,
) {
  val danger = PebbleFailureText.tone(failure) == PebbleFailureTone.Danger
  val accent = if (danger) mobileDanger else mobileWarning
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(14.dp),
    color = if (danger) mobileDangerSoft else mobileWarningSoft,
    border = BorderStroke(1.dp, accent.copy(alpha = 0.4f)),
  ) {
    Column(
      modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
      verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
      Text(
        PebbleFailureText.title(failure),
        style = mobileCallout.copy(fontWeight = FontWeight.Bold),
        color = accent,
      )
      Text(PebbleFailureText.detail(failure), style = mobileCaption1, color = mobileTextSecondary)
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = onHome, enabled = enabled, shape = RoundedCornerShape(12.dp)) {
          Text("Back to menu", style = mobileCaption1)
        }
        if (failure is PebbleFailure.TokenRejected) {
          OutlinedButton(onClick = onOpenSettings, shape = RoundedCornerShape(12.dp)) {
            Text("Settings", style = mobileCaption1)
          }
        }
      }
    }
  }
}

@Composable
private fun PebbleScreenBody(
  screen: PebbleScreen?,
  loaded: Boolean,
  enabled: Boolean,
  onSelect: (String) -> Unit,
  onConfirm: () -> Unit,
  onCancel: () -> Unit,
) {
  when (screen) {
    null ->
      PebblePlaceholder(
        text = if (loaded) "Nothing to show. Use Home to reload the menu." else "Loading…",
      )
    is PebbleScreen.Menu -> PebbleMenuList(title = screen.title, items = screen.items, enabled = enabled, onSelect = onSelect)
    is PebbleScreen.Card -> PebbleTextPanel(title = screen.title, body = screen.body, accent = mobileAccent)
    is PebbleScreen.Result -> PebbleTextPanel(title = screen.title, body = screen.body, accent = mobileSuccess)
    is PebbleScreen.Confirm ->
      PebbleConfirmPanel(
        title = screen.title,
        body = screen.body,
        enabled = enabled,
        onConfirm = onConfirm,
        onCancel = onCancel,
      )
  }
}

@Composable
private fun PebblePlaceholder(text: String) {
  Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
    Text(text, style = mobileCallout, color = mobileTextTertiary)
  }
}

@Composable
private fun PebbleMenuList(
  title: String,
  items: List<PebbleMenuItem>,
  enabled: Boolean,
  onSelect: (String) -> Unit,
) {
  Column(
    modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
    verticalArrangement = Arrangement.spacedBy(8.dp),
  ) {
    if (title.isNotEmpty()) {
      Text(
        title.uppercase(),
        style = mobileCaption1.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.sp),
        color = mobileAccent,
      )
    }
    Surface(
      modifier = Modifier.fillMaxWidth(),
      shape = RoundedCornerShape(16.dp),
      color = mobileCardSurface,
      border = BorderStroke(1.dp, mobileBorderStrong),
    ) {
      Column(modifier = Modifier.fillMaxWidth()) {
        items.forEachIndexed { index, item ->
          if (index > 0) HorizontalDivider(color = mobileBorder)
          PebbleMenuRow(item = item, enabled = enabled, onSelect = onSelect)
        }
      }
    }
  }
}

@Composable
private fun PebbleMenuRow(
  item: PebbleMenuItem,
  enabled: Boolean,
  onSelect: (String) -> Unit,
) {
  Surface(
    onClick = { onSelect(item.id) },
    enabled = enabled,
    modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp),
    color = Color.Transparent,
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
      verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
      Text(item.label, style = mobileHeadline, color = if (enabled) mobileText else mobileTextTertiary)
      item.sub?.takeIf { it.isNotBlank() }?.let { sub ->
        Text(sub, style = mobileCaption1, color = mobileTextSecondary)
      }
    }
  }
}

@Composable
private fun PebbleTextPanel(
  title: String,
  body: String,
  accent: Color,
) {
  Column(
    modifier = Modifier.fillMaxSize(),
    verticalArrangement = Arrangement.spacedBy(8.dp),
  ) {
    if (title.isNotEmpty()) {
      Text(
        title.uppercase(),
        style = mobileCaption1.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.sp),
        color = accent,
      )
    }
    Surface(
      modifier = Modifier.fillMaxWidth().weight(1f),
      shape = RoundedCornerShape(16.dp),
      color = mobileCardSurface,
      border = BorderStroke(1.dp, mobileBorderStrong),
    ) {
      // The server's text is rendered VERBATIM. Result bodies are the household's own words about
      // what happened; paraphrasing or truncating them here would be editing the outcome.
      Text(
        body,
        modifier =
          Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 14.dp, vertical = 12.dp),
        style = mobileBody,
        color = mobileText,
      )
    }
  }
}

/**
 * Explicit Confirm / Cancel. Confirm re-posts the server's own action and rid; Cancel sends
 * nothing at all. There is no third path and no automatic one.
 */
@Composable
private fun PebbleConfirmPanel(
  title: String,
  body: String,
  enabled: Boolean,
  onConfirm: () -> Unit,
  onCancel: () -> Unit,
) {
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(16.dp),
    color = mobileCardSurface,
    border = BorderStroke(1.dp, mobileWarning.copy(alpha = 0.5f)),
  ) {
    Column(
      modifier = Modifier.padding(horizontal = 14.dp, vertical = 14.dp),
      verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      Text(title.ifEmpty { "Confirm" }, style = mobileHeadline, color = mobileText)
      Text(body, style = mobileCallout, color = mobileTextSecondary)
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Button(
          onClick = onConfirm,
          enabled = enabled,
          shape = RoundedCornerShape(14.dp),
          colors = ButtonDefaults.buttonColors(containerColor = mobileWarning, contentColor = Color.White),
        ) {
          Text("Confirm", style = mobileCallout.copy(fontWeight = FontWeight.Bold))
        }
        OutlinedButton(onClick = onCancel, enabled = enabled, shape = RoundedCornerShape(14.dp)) {
          Text("Cancel", style = mobileCallout)
        }
      }
    }
  }
}

@Composable
private fun PebbleSideloadPanel(
  pbw: PebblePbwInfo,
  sideloadState: PebbleSideloadState,
  message: String?,
  onDownload: () -> Unit,
  onInstall: () -> Unit,
) {
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(14.dp),
    color = mobileSurface,
    border = BorderStroke(1.dp, mobileBorder),
  ) {
    Column(
      modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
      verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
      Text("Watchapp ${pbw.version}", style = mobileCallout.copy(fontWeight = FontWeight.SemiBold), color = mobileText)
      Text(pebbleSideloadStatus(sideloadState, pbw), style = mobileCaption1, color = mobileTextSecondary)
      message?.let { Text(it, style = mobileCaption1, color = mobileWarning) }
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(
          onClick = onDownload,
          enabled = sideloadState !is PebbleSideloadState.Working,
          shape = RoundedCornerShape(12.dp),
        ) {
          Text("Download", style = mobileCaption1)
        }
        Button(
          onClick = onInstall,
          enabled = sideloadState is PebbleSideloadState.Ready,
          shape = RoundedCornerShape(12.dp),
          colors = ButtonDefaults.buttonColors(containerColor = mobileAccent, contentColor = Color.White),
        ) {
          Text("Install on Pebble", style = mobileCaption1.copy(fontWeight = FontWeight.Bold))
        }
      }
    }
  }
}

private fun pebbleSideloadStatus(
  state: PebbleSideloadState,
  pbw: PebblePbwInfo,
): String =
  when (state) {
    is PebbleSideloadState.Idle -> "Published checksum ${pbw.sha256.take(12)}…"
    is PebbleSideloadState.Working -> "Downloading and verifying…"
    is PebbleSideloadState.Ready -> "Verified ${state.sha256.take(12)}… ready to install."
    is PebbleSideloadState.Failed -> PebbleFailureText.detail(state.failure)
  }

@Composable
private fun PebbleFooter(
  enabled: Boolean,
  onHome: () -> Unit,
  onRefreshHealth: () -> Unit,
) {
  Row(
    modifier = Modifier.fillMaxWidth(),
    horizontalArrangement = Arrangement.spacedBy(10.dp),
  ) {
    Button(
      onClick = onHome,
      enabled = enabled,
      modifier = Modifier.weight(1f),
      shape = RoundedCornerShape(14.dp),
      colors = ButtonDefaults.buttonColors(containerColor = mobileAccent, contentColor = Color.White),
    ) {
      Text("Home", style = mobileCallout.copy(fontWeight = FontWeight.Bold))
    }
    OutlinedButton(
      onClick = onRefreshHealth,
      enabled = enabled,
      modifier = Modifier.weight(1f),
      shape = RoundedCornerShape(14.dp),
    ) {
      Text("Check server", style = mobileCallout)
    }
  }
}
