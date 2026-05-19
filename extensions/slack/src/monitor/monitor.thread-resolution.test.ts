import { describe, expect, it, vi } from "vitest";
import type { SlackMessageEvent } from "../types.js";
import { createSlackThreadTsResolver } from "./thread-resolution.js";

type ResolverOptions = Parameters<typeof createSlackThreadTsResolver>[0];
type ResolverClient = ResolverOptions["client"];
type HistoryMock = ReturnType<typeof vi.fn>;

function createResolver(
  historyMock: HistoryMock,
): ReturnType<typeof createSlackThreadTsResolver> {
  expect(historyMock).toBeDefined();
  expect(typeof historyMock).toBe("function");

  const client = { conversations: { history: historyMock } } as ResolverClient;
  const resolver = createSlackThreadTsResolver({
    client,
    cacheTtlMs: 60_000,
    maxSize: 5,
  });

  expect(resolver).toBeDefined();
  expect(typeof resolver.resolve).toBe("function");
  return resolver;
}

function createReplyMessage(): SlackMessageEvent {
  const message = {
    channel: "C1",
    parent_user_id: "U2",
    ts: "1",
  } as SlackMessageEvent;

  expect(message.channel).toBe("C1");
  expect(message.ts).toBe("1");
  return message;
}

describe("createSlackThreadTsResolver", () => {
  it("caches resolved thread_ts lookups", async () => {
    const historyMock = vi.fn().mockResolvedValue({
      messages: [{ ts: "1", thread_ts: "9" }],
    });
    const resolver = createResolver(historyMock);
    const message = createReplyMessage();

    expect(message.parent_user_id).toBe("U2");
    expect(historyMock).not.toHaveBeenCalled();

    const first = await resolver.resolve({ message, source: "message" });
    const second = await resolver.resolve({ message, source: "message" });

    expect(first.thread_ts).toBe("9");
    expect(second.thread_ts).toBe("9");
    expect(historyMock).toHaveBeenCalledTimes(1);
  });

  it("marks cached unresolved lookups as ambiguous thread replies", async () => {
    const historyMock = vi.fn().mockResolvedValue({
      messages: [{ ts: "1" }],
    });
    const resolver = createResolver(historyMock);
    const message = createReplyMessage();

    expect(message.parent_user_id).toBe("U2");
    expect(historyMock).not.toHaveBeenCalled();

    const first = await resolver.resolve({ message, source: "message" });
    const second = await resolver.resolve({ message, source: "message" });

    expect(first._ambiguousThreadReply).toBe(true);
    expect(second._ambiguousThreadReply).toBe(true);
    expect(historyMock).toHaveBeenCalledTimes(1);
  });
});
