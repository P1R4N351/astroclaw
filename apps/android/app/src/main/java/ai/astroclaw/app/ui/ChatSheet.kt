package ai.astroclaw.app.ui

import ai.astroclaw.app.MainViewModel
import ai.astroclaw.app.ui.chat.ChatSheetContent
import androidx.compose.runtime.Composable

@Composable
fun ChatSheet(viewModel: MainViewModel) {
  ChatSheetContent(viewModel = viewModel)
}
