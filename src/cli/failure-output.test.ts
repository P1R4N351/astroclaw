import { describe, expect, it } from "vitest";
import { formatCliFailureLines } from "./failure-output.js";

describe("formatCliFailureLines", () => {
  it("shows a concise reason and recovery commands by default", () => {
    const lines = formatCliFailureLines({
      title: "Could not start the CLI.",
      error: new Error("config file is invalid"),
      argv: ["node", "astroclaw", "status"],
      env: {},
    });

    expect(lines).toEqual([
      "[astroclaw] Could not start the CLI.",
      "[astroclaw] Reason: config file is invalid",
      "[astroclaw] Debug: set ASTROCLAW_DEBUG=1 to include the stack trace.",
      "[astroclaw] Try: astroclaw doctor",
      "[astroclaw] Help: astroclaw --help",
    ]);
  });

  it("prints stack details when debug output is requested", () => {
    const lines = formatCliFailureLines({
      title: "The CLI command failed.",
      error: new Error("boom"),
      env: { ASTROCLAW_DEBUG: "1" },
    });

    expect(lines.slice(0, 4)).toEqual([
      "[astroclaw] The CLI command failed.",
      "[astroclaw] Reason: boom",
      "[astroclaw] Stack:",
      "[astroclaw] Error: boom",
    ]);
    expect(lines.join("\n")).toContain("Error: boom");
  });
});
