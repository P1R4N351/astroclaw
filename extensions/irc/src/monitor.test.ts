import { describe, expect, it } from "vitest";
import { resolveIrcInboundTarget } from "./monitor.js";

describe("irc monitor inbound target", () => {
  it("keeps channel target for group messages", () => {
    expect(
      resolveIrcInboundTarget({
        target: "#astroclaw",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: true,
      target: "#astroclaw",
      rawTarget: "#astroclaw",
    });
  });

  it("maps DM target to sender nick and preserves raw target", () => {
    expect(
      resolveIrcInboundTarget({
        target: "astroclaw-bot",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: false,
      target: "alice",
      rawTarget: "astroclaw-bot",
    });
  });

  it("falls back to raw target when sender nick is empty", () => {
    expect(
      resolveIrcInboundTarget({
        target: "astroclaw-bot",
        senderNick: " ",
      }),
    ).toEqual({
      isGroup: false,
      target: "astroclaw-bot",
      rawTarget: "astroclaw-bot",
    });
  });
});
