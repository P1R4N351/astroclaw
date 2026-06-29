// Control UI view renders the ask-sat corporeality question queue.
//
// Mirrors the phone-first ask-sat answer page: each pending question renders an
// answer widget by kind (ack / yesno / choice / text), and answering posts back
// through the gateway askSat.answer proxy. Scope guardrail is Piranesi's, not
// the UI's: this surface only ever shows questions Piranesi has already posted.
import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import type { AskSatQuestion } from "../controllers/ask-sat.ts";

export type AskSatProps = {
  loading: boolean;
  error: string | null;
  pending: AskSatQuestion[];
  answered: AskSatQuestion[];
  onRefresh: () => void;
  onAnswer: (id: string, value: string, text: string) => void;
};

/** Read the optional free-text note co-located with an answer widget. */
function readNote(root: HTMLElement | null): string {
  const input = root?.querySelector<HTMLInputElement>("input.ask-sat-note");
  return input?.value.trim() ?? "";
}

function answerWidget(q: AskSatQuestion, onAnswer: AskSatProps["onAnswer"]) {
  const note = (event: Event): string => {
    const widget = (event.currentTarget as HTMLElement).closest<HTMLElement>(".ask-sat-widget");
    return readNote(widget);
  };
  const noteField = q.allow_free_text
    ? html`<input
        class="ask-sat-note"
        type="text"
        placeholder=${t("askSat.notePlaceholder")}
        maxlength="500"
        style="margin-bottom: 10px;"
      />`
    : nothing;

  if (q.kind === "ack") {
    const label = q.gate ? t("askSat.ackGate") : t("askSat.ackDone");
    return html`<div class="ask-sat-widget">
      <div class="row" style="gap: 8px; flex-wrap: wrap;">
        <button class="btn primary" @click=${(e: Event) => onAnswer(q.id, "done", note(e))}>
          ${label}
        </button>
      </div>
    </div>`;
  }

  if (q.kind === "yesno") {
    return html`<div class="ask-sat-widget">
      ${noteField}
      <div class="row" style="gap: 8px; flex-wrap: wrap;">
        <button class="btn primary" @click=${(e: Event) => onAnswer(q.id, "yes", note(e))}>
          ${t("common.yes")}
        </button>
        <button class="btn" @click=${(e: Event) => onAnswer(q.id, "no", note(e))}>
          ${t("common.no")}
        </button>
      </div>
    </div>`;
  }

  if (q.kind === "choice") {
    const options = Array.isArray(q.options) ? q.options : [];
    return html`<div class="ask-sat-widget">
      ${noteField}
      <div class="row" style="flex-direction: column; gap: 8px; align-items: stretch;">
        ${options.map(
          (opt) =>
            html`<button
              class="btn"
              style="text-align: left;"
              @click=${(e: Event) => onAnswer(q.id, opt, note(e))}
            >
              ${opt}
            </button>`,
        )}
      </div>
    </div>`;
  }

  // text
  return html`<div class="ask-sat-widget">
    <textarea
      class="ask-sat-text"
      rows="3"
      placeholder=${t("askSat.textPlaceholder")}
      maxlength="2000"
      style="width: 100%;"
    ></textarea>
    <div class="row" style="margin-top: 8px;">
      <button
        class="btn primary"
        @click=${(e: Event) => {
          const widget = (e.currentTarget as HTMLElement).closest<HTMLElement>(".ask-sat-widget");
          const ta = widget?.querySelector<HTMLTextAreaElement>("textarea.ask-sat-text");
          const value = ta?.value.trim() ?? "";
          if (value) {
            onAnswer(q.id, value, value);
          }
        }}
      >
        ${t("common.submit")}
      </button>
    </div>
  </div>`;
}

function renderPendingQuestion(q: AskSatQuestion, onAnswer: AskSatProps["onAnswer"]) {
  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${q.title}</div>
        ${q.body ? html`<div class="list-sub">${q.body}</div>` : nothing}
        <div class="chip-row" style="margin-top: 6px;">
          <span class="chip">${q.kind}</span>
          ${q.gate ? html`<span class="chip chip-warn">gate:${q.gate}</span>` : nothing}
          ${q.priority ? html`<span class="chip">${q.priority}</span>` : nothing}
          ${q.asker ? html`<span class="chip">${q.asker}</span>` : nothing}
        </div>
        <div style="margin-top: 12px;">${answerWidget(q, onAnswer)}</div>
      </div>
    </div>
  `;
}

function renderAnsweredQuestion(q: AskSatQuestion) {
  const value = q.answer?.value ?? "";
  const noteText = q.answer?.text && q.answer.text !== value ? ` — ${q.answer.text}` : "";
  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${q.title}</div>
        <div class="list-sub">→ ${value}${noteText}</div>
      </div>
    </div>
  `;
}

export function renderAskSat(props: AskSatProps) {
  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">${t("tabs.askSat")}</div>
          <div class="card-sub">${t("subtitles.askSat")}</div>
        </div>
        <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
          ${props.loading ? t("common.loading") : t("common.refresh")}
        </button>
      </div>
      ${props.error
        ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>`
        : nothing}
      <div class="list" style="margin-top: 16px;">
        ${props.pending.length === 0
          ? html`<div class="muted">${t("askSat.empty")}</div>`
          : props.pending.map((q) => renderPendingQuestion(q, props.onAnswer))}
      </div>
    </section>
    ${props.answered.length > 0
      ? html`
          <section class="card">
            <div class="card-title">${t("askSat.recentlySettled")}</div>
            <div class="list" style="margin-top: 16px;">
              ${props.answered.map((q) => renderAnsweredQuestion(q))}
            </div>
          </section>
        `
      : nothing}
  `;
}
