package ai.astroclaw.app.ui

import ai.astroclaw.app.MainViewModel
import ai.astroclaw.app.pebble.PebbleClient
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Pebble Iris endpoint + token settings.
 *
 * The stored token is NEVER echoed back into the text field. The card reports only whether one is
 * set; to change it you type a new one. A secret that is rendered into a widget can be revealed by
 * a keyboard suggestion, an accessibility read-out, or a screenshot, and none of that is worth the
 * convenience of seeing a token you already gave the app.
 */
@Composable
internal fun PebbleSettingsCard(viewModel: MainViewModel) {
  val baseUrl by viewModel.pebbleBaseUrl.collectAsState()
  val token by viewModel.pebbleToken.collectAsState()

  LaunchedEffect(Unit) {
    withContext(Dispatchers.IO) { viewModel.loadPebbleToken() }
  }

  var baseUrlDraft by remember(baseUrl) { mutableStateOf(baseUrl) }
  var tokenDraft by remember { mutableStateOf("") }
  val baseUrlDirty = baseUrlDraft.trim() != baseUrl

  Column(modifier = Modifier.settingsRowModifier()) {
    OutlinedTextField(
      value = baseUrlDraft,
      onValueChange = { baseUrlDraft = it },
      label = { Text("Base URL", style = mobileCaption1, color = mobileTextSecondary) },
      modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp),
      textStyle = mobileBody.copy(color = mobileText),
      singleLine = true,
      colors = settingsTextFieldColors(),
    )
    PebbleSettingsActionRow(
      helper = "Default: ${PebbleClient.DEFAULT_BASE_URL}",
      primaryLabel = "Save URL",
      primaryEnabled = baseUrlDirty,
      onPrimary = { viewModel.setPebbleBaseUrl(baseUrlDraft) },
      secondaryLabel = "Reset",
      secondaryEnabled = baseUrl != PebbleClient.DEFAULT_BASE_URL,
      onSecondary = {
        viewModel.setPebbleBaseUrl(PebbleClient.DEFAULT_BASE_URL)
        baseUrlDraft = PebbleClient.DEFAULT_BASE_URL
      },
    )
    HorizontalDivider(color = mobileBorder)
    OutlinedTextField(
      value = tokenDraft,
      onValueChange = { tokenDraft = it },
      label = { Text("Access token", style = mobileCaption1, color = mobileTextSecondary) },
      modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp),
      textStyle = mobileBody.copy(color = mobileText),
      singleLine = true,
      visualTransformation = PasswordVisualTransformation(),
      colors = settingsTextFieldColors(),
    )
    PebbleSettingsActionRow(
      helper =
        if (token.isEmpty()) {
          "No token stored. The Pebble tab stays idle until one is saved."
        } else {
          "A token is stored, encrypted, and excluded from backup."
        },
      primaryLabel = "Save token",
      primaryEnabled = tokenDraft.isNotBlank(),
      onPrimary = {
        viewModel.setPebbleToken(tokenDraft)
        tokenDraft = ""
      },
      secondaryLabel = "Clear",
      secondaryEnabled = token.isNotEmpty(),
      onSecondary = {
        viewModel.setPebbleToken("")
        tokenDraft = ""
      },
    )
  }
}

@Composable
private fun PebbleSettingsActionRow(
  helper: String,
  primaryLabel: String,
  primaryEnabled: Boolean,
  onPrimary: () -> Unit,
  secondaryLabel: String,
  secondaryEnabled: Boolean,
  onSecondary: () -> Unit,
) {
  Column(
    modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp),
    verticalArrangement = Arrangement.spacedBy(8.dp),
  ) {
    Text(helper, style = mobileCaption1, color = mobileTextTertiary)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      Button(
        onClick = onPrimary,
        enabled = primaryEnabled,
        colors = settingsPrimaryButtonColors(),
        shape = RoundedCornerShape(14.dp),
      ) {
        Text(primaryLabel, style = mobileCallout.copy(fontWeight = FontWeight.Bold))
      }
      OutlinedButton(
        onClick = onSecondary,
        enabled = secondaryEnabled,
        shape = RoundedCornerShape(14.dp),
      ) {
        Text(secondaryLabel, style = mobileCallout)
      }
    }
  }
}
