/* @vitest-environment jsdom */

import { render } from "lit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AskSatQuestion } from "../controllers/ask-sat.ts";
import { renderAskSat, type AskSatProps } from "./ask-sat.ts";

function createProps(overrides: Partial<AskSatProps> = {}): AskSatProps {
  return {
    loading: false,
    error: null,
    pending: [],
    answered: [],
    onRefresh: vi.fn(),
    onAnswer: vi.fn(),
    ...overrides,
  };
}

function question(overrides: Partial<AskSatQuestion> = {}): AskSatQuestion {
  return {
    id: "q1",
    kind: "ack",
    title: "Did the package arrive?",
    ...overrides,
  };
}

function mount(props: AskSatProps): HTMLElement {
  const host = document.createElement("div");
  render(renderAskSat(props), host);
  document.body.appendChild(host);
  return host;
}

describe("renderAskSat", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("shows the quiet empty state when nothing is pending", () => {
    const host = mount(createProps());
    expect(host.textContent).toContain("The Halls are quiet");
  });

  it("surfaces an error callout", () => {
    const host = mount(createProps({ error: "boom" }));
    expect(host.querySelector(".callout.danger")?.textContent).toContain("boom");
  });

  it("answers an ack question with value 'done'", () => {
    const onAnswer = vi.fn();
    const host = mount(createProps({ pending: [question({ kind: "ack" })], onAnswer }));
    host.querySelector<HTMLButtonElement>(".ask-sat-widget button")?.click();
    expect(onAnswer).toHaveBeenCalledWith("q1", "done", "");
  });

  it("answers a yesno question with yes/no values", () => {
    const onAnswer = vi.fn();
    const host = mount(
      createProps({ pending: [question({ kind: "yesno" })], onAnswer }),
    );
    const buttons = host.querySelectorAll<HTMLButtonElement>(".ask-sat-widget button");
    buttons[0]?.click();
    buttons[1]?.click();
    expect(onAnswer).toHaveBeenNthCalledWith(1, "q1", "yes", "");
    expect(onAnswer).toHaveBeenNthCalledWith(2, "q1", "no", "");
  });

  it("forwards the free-text note alongside a yesno answer", () => {
    const onAnswer = vi.fn();
    const host = mount(
      createProps({
        pending: [question({ kind: "yesno", allow_free_text: true })],
        onAnswer,
      }),
    );
    const note = host.querySelector<HTMLInputElement>("input.ask-sat-note");
    note!.value = "left on porch";
    host.querySelector<HTMLButtonElement>(".ask-sat-widget button")?.click();
    expect(onAnswer).toHaveBeenCalledWith("q1", "yes", "left on porch");
  });

  it("answers a choice question with the chosen option", () => {
    const onAnswer = vi.fn();
    const host = mount(
      createProps({
        pending: [question({ kind: "choice", options: ["Red", "Blue"] })],
        onAnswer,
      }),
    );
    const buttons = host.querySelectorAll<HTMLButtonElement>(".ask-sat-widget button");
    buttons[1]?.click();
    expect(onAnswer).toHaveBeenCalledWith("q1", "Blue", "");
  });

  it("answers a text question with the typed value", () => {
    const onAnswer = vi.fn();
    const host = mount(createProps({ pending: [question({ kind: "text" })], onAnswer }));
    const ta = host.querySelector<HTMLTextAreaElement>("textarea.ask-sat-text");
    ta!.value = "  it is on the shelf  ";
    host.querySelector<HTMLButtonElement>(".ask-sat-widget button")?.click();
    expect(onAnswer).toHaveBeenCalledWith("q1", "it is on the shelf", "it is on the shelf");
  });

  it("does not answer a text question when the field is empty", () => {
    const onAnswer = vi.fn();
    const host = mount(createProps({ pending: [question({ kind: "text" })], onAnswer }));
    host.querySelector<HTMLButtonElement>(".ask-sat-widget button")?.click();
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("renders recently settled answers", () => {
    const host = mount(
      createProps({
        answered: [question({ id: "q2", title: "Fixed?", answer: { value: "yes" } })],
      }),
    );
    expect(host.textContent).toContain("Fixed?");
    expect(host.textContent).toContain("yes");
  });
});
