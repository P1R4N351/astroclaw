// Control UI controller manages the ask-sat corporeality question queue.
//
// Piranesi posts physical/corporeal questions only Sat can answer (a package
// arrival, a hardware fix, a real-world yes/no/choice). These flow through the
// gateway's askSat.* proxy methods so the operator can answer from the UI.
import type { GatewayBrowserClient } from "../gateway.ts";

export type AskSatAnswerKind = "ack" | "yesno" | "choice" | "text";

export type AskSatQuestion = {
  id: string;
  kind: AskSatAnswerKind;
  title: string;
  body?: string;
  options?: string[];
  allow_free_text?: boolean;
  gate?: string;
  priority?: string;
  asker?: string;
  created?: number;
  answer?: { value?: string; text?: string; answered_at?: number };
};

export type AskSatState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  askSatLoading: boolean;
  askSatError: string | null;
  askSatPending: AskSatQuestion[];
  askSatAnswered: AskSatQuestion[];
};

function asQuestions(value: unknown): AskSatQuestion[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (entry): entry is AskSatQuestion =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as { id?: unknown }).id === "string",
  );
}

export async function loadAskSatQuestions(state: AskSatState, opts?: { quiet?: boolean }) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.askSatLoading) {
    return;
  }
  state.askSatLoading = true;
  if (!opts?.quiet) {
    state.askSatError = null;
  }
  try {
    const res = await state.client.request<{ pending?: unknown; answered?: unknown }>(
      "askSat.questions",
      {},
    );
    state.askSatPending = asQuestions(res.pending);
    state.askSatAnswered = asQuestions(res.answered);
  } catch (err) {
    if (!opts?.quiet) {
      state.askSatError = String(err);
    }
  } finally {
    state.askSatLoading = false;
  }
}

export async function submitAskSatAnswer(
  state: AskSatState,
  answer: { id: string; value: string; text?: string },
) {
  if (!state.client || !state.connected) {
    return;
  }
  state.askSatError = null;
  try {
    await state.client.request("askSat.answer", {
      id: answer.id,
      value: answer.value,
      text: answer.text ?? "",
    });
    // Refresh so the answered question leaves the pending list.
    await loadAskSatQuestions(state, { quiet: true });
  } catch (err) {
    state.askSatError = String(err);
  }
}
