import { beforeEach, describe, expect, it, vi } from "vitest";
import { withCdpSocket } from "./cdp.helpers.js";
import { captureScreenshot } from "./cdp.js";
import type { ResolvedBrowserProfile } from "./config.js";
import { shouldUsePlaywrightForScreenshot } from "./profile-capabilities.js";

type CdpParams = Record<string, unknown>;
type SentMessage = { method: string; params?: CdpParams };
type MockViewport = { w: number; h: number; dpr: number; sw?: number; sh?: number };
type MockNaturalViewport = Pick<MockViewport, "w" | "h" | "dpr">;
type MockState = {
  emulationCleared: boolean;
  emulatedTab: boolean;
  viewport: MockViewport;
  naturalViewport: MockNaturalViewport;
};
type MockSend = (method: string, params?: CdpParams) => Promise<unknown>;

const p10Limits = vi.hoisted(() =>
  Object.freeze({
    maxSentMessages: 32,
    expectedFullPageSetCalls: 2,
    expectedNoReapplySetCalls: 1,
    expectedNoEmulationCalls: 0,
  }),
);

const sentMessages = vi.hoisted((): SentMessage[] => []);

// Tracks whether emulation has been cleared so post-clear Runtime.evaluate
// can return different values for the "emulated tab" vs "non-emulated tab" tests.
const mockState = vi.hoisted(
  (): MockState => ({
    emulationCleared: false,
    emulatedTab: true,
    viewport: { w: 800, h: 600, dpr: 2, sw: 800, sh: 600 },
    naturalViewport: { w: 1920, h: 1080, dpr: 1 },
  }),
);

vi.mock("./cdp.helpers.js", () => ({
  withCdpSocket: vi.fn(
    async (
      _wsUrl: string,
      fn: (send: MockSend) => Promise<unknown>,
      _opts?: { commandTimeoutMs?: number },
    ) => {
      const send: MockSend = (method, params) => {
        if (method.length === 0) {
          return Promise.reject(new Error("expected non-empty CDP method"));
        }
        if (sentMessages.length >= p10Limits.maxSentMessages) {
          return Promise.reject(new Error("too many mocked CDP messages"));
        }

        const nextLength = sentMessages.push({ method, params });
        if (nextLength <= 0 || nextLength > p10Limits.maxSentMessages) {
          return Promise.reject(new Error("mocked CDP message recording failed"));
        }

        switch (method) {
          case "Page.captureScreenshot":
            return Promise.resolve({ data: "AAAA" });
          case "Page.getLayoutMetrics":
            return Promise.resolve({
              cssContentSize: { width: 1200, height: 3000 },
              contentSize: { width: 1200, height: 3000 },
            });
          case "Emulation.clearDeviceMetricsOverride":
            mockState.emulationCleared = true;
            return Promise.resolve({});
          case "Emulation.setDeviceMetricsOverride":
            mockState.emulationCleared = false;
            return Promise.resolve({});
          case "Runtime.evaluate":
            if (mockState.emulationCleared && mockState.emulatedTab) {
              return Promise.resolve({
                result: {
                  value: mockState.naturalViewport,
                },
              });
            }
            return Promise.resolve({
              result: {
                value: mockState.viewport,
              },
            });
          default:
            return Promise.resolve({});
        }
      };

      return fn(send);
    },
  ),
  appendCdpPath: vi.fn(),
  fetchJson: vi.fn(),
  isLoopbackHost: vi.fn(),
  isWebSocketUrl: vi.fn(),
}));

vi.mock("./navigation-guard.js", () => ({
  assertBrowserNavigationAllowed: vi.fn(),
  withBrowserNavigationPolicy: vi.fn(() => ({})),
}));

const localProfile: ResolvedBrowserProfile = {
  name: "astroclaw",
  cdpUrl: "http://127.0.0.1:18800",
  cdpPort: 18800,
  cdpHost: "127.0.0.1",
  cdpIsLoopback: true,
  color: "#FF4500",
  driver: "astroclaw",
  headless: false,
  attachOnly: false,
};

beforeEach(() => {
  sentMessages.length = 0;
  mockState.emulationCleared = false;
  mockState.emulatedTab = true;
  mockState.viewport = { w: 800, h: 600, dpr: 2, sw: 800, sh: 600 };
  mockState.naturalViewport = { w: 1920, h: 1080, dpr: 1 };

  if (sentMessages.length !== 0) {
    throw new Error("mocked CDP messages were not reset");
  }
  if (!mockState.emulatedTab) {
    throw new Error("mocked tab emulation state was not reset");
  }
});

function assertCdpMethod(method: string): void {
  if (method.length === 0) {
    throw new Error("expected non-empty CDP method");
  }
  if (!method.includes(".")) {
    throw new Error("expected CDP method to include a domain");
  }
}

function assertSentMessageCapacity(): void {
  if (!Number.isInteger(sentMessages.length)) {
    throw new Error("mocked CDP message length must be integral");
  }
  if (sentMessages.length > p10Limits.maxSentMessages) {
    throw new Error("mocked CDP message limit exceeded");
  }
}

function requireSentMessage(method: string): SentMessage {
  assertCdpMethod(method);
  assertSentMessageCapacity();

  for (let index = 0; index < p10Limits.maxSentMessages; index += 1) {
    if (index >= sentMessages.length) {
      break;
    }

    const message = sentMessages[index];
    if (message === undefined) {
      throw new Error("mocked CDP message slot missing");
    }
    if (message.method === method) {
      return message;
    }
  }

  throw new Error(`expected ${method} CDP message`);
}

function countSentMessages(method: string): number {
  assertCdpMethod(method);
  assertSentMessageCapacity();

  let count = 0;
  for (let index = 0; index < p10Limits.maxSentMessages; index += 1) {
    if (index >= sentMessages.length) {
      break;
    }

    const message = sentMessages[index];
    if (message === undefined) {
      throw new Error("mocked CDP message slot missing");
    }
    if (message.method === method) {
      count += 1;
    }
  }

  return count;
}

function requireNthSentMessage(method: string, occurrence: number): SentMessage {
  assertCdpMethod(method);
  if (!Number.isInteger(occurrence)) {
    throw new Error("expected integral CDP message occurrence");
  }
  if (occurrence < 0 || occurrence >= p10Limits.maxSentMessages) {
    throw new Error("expected bounded CDP message occurrence");
  }

  let seen = 0;
  for (let index = 0; index < p10Limits.maxSentMessages; index += 1) {
    if (index >= sentMessages.length) {
      break;
    }

    const message = sentMessages[index];
    if (message === undefined) {
      throw new Error("mocked CDP message slot missing");
    }
    if (message.method === method) {
      if (seen === occurrence) {
        return message;
      }
      seen += 1;
    }
  }

  throw new Error(`expected CDP message occurrence ${occurrence}`);
}

describe("CDP screenshot params", () => {
  it("viewport screenshot omits fromSurface and captureBeyondViewport", async () => {
    await captureScreenshot({ wsUrl: "ws://localhost:9222/devtools/page/X", format: "png" });

    const call = requireSentMessage("Page.captureScreenshot");
    expect(call.params?.format).toBe("png");
    expect(call.params).not.toHaveProperty("fromSurface");
    expect(call.params).not.toHaveProperty("captureBeyondViewport");
    expect(call.params).not.toHaveProperty("clip");

    const emulationCallCount = countSentMessages("Emulation.setDeviceMetricsOverride");
    expect(emulationCallCount).toBe(p10Limits.expectedNoEmulationCalls);
  });

  it("uses the requested timeout as the raw CDP command timeout", async () => {
    await captureScreenshot({
      wsUrl: "ws://localhost:9222/devtools/page/X",
      format: "png",
      timeoutMs: 12_345,
    });

    const mockedSocket = vi.mocked(withCdpSocket);
    const callCount = mockedSocket.mock.calls.length;
    expect(callCount).toBeGreaterThan(0);

    const lastCall = mockedSocket.mock.calls[callCount - 1];
    if (lastCall === undefined || lastCall.length < 3) {
      throw new Error("expected mocked CDP socket call");
    }

    const [wsUrl, sendCallback, options] = lastCall;
    expect(wsUrl).toBe("ws://localhost:9222/devtools/page/X");
    expect(typeof sendCallback).toBe("function");
    expect(options).toEqual({ commandTimeoutMs: 12_345 });
  });

  it("fullPage on emulated tab: clears, detects drift, re-applies saved emulation", async () => {
    mockState.emulatedTab = true;

    await captureScreenshot({
      wsUrl: "ws://localhost:9222/devtools/page/X",
      format: "png",
      fullPage: true,
    });

    const setCallCount = countSentMessages("Emulation.setDeviceMetricsOverride");
    expect(setCallCount).toBe(p10Limits.expectedFullPageSetCalls);
    const firstSetCall = requireNthSentMessage("Emulation.setDeviceMetricsOverride", 0);
    const secondSetCall = requireNthSentMessage("Emulation.setDeviceMetricsOverride", 1);

    // Expand: uses saved DPR, mobile defaults to false
    expect(firstSetCall.params?.width).toBe(1200);
    expect(firstSetCall.params?.height).toBe(3000);
    expect(firstSetCall.params?.deviceScaleFactor).toBe(2);
    expect(firstSetCall.params?.mobile).toBe(false);

    // Clear is called first in the finally block
    requireSentMessage("Emulation.clearDeviceMetricsOverride");
    const captureCall = requireSentMessage("Page.captureScreenshot");
    expect(captureCall.params?.captureBeyondViewport).toBe(true);

    // Viewport drifted after clear → re-apply saved dimensions
    expect(secondSetCall.params?.width).toBe(800);
    expect(secondSetCall.params?.height).toBe(600);
    expect(secondSetCall.params?.deviceScaleFactor).toBe(2);
    expect(secondSetCall.params?.mobile).toBe(false);
    expect(secondSetCall.params?.screenWidth).toBe(800);
    expect(secondSetCall.params?.screenHeight).toBe(600);
  });

  it("fullPage on non-emulated tab: clears and does NOT re-apply emulation", async () => {
    mockState.emulatedTab = false;
    mockState.viewport = { w: 1920, h: 1080, dpr: 1, sw: 1920, sh: 1080 };
    mockState.naturalViewport = { w: 1920, h: 1080, dpr: 1 };

    await captureScreenshot({
      wsUrl: "ws://localhost:9222/devtools/page/X",
      format: "png",
      fullPage: true,
    });

    const setCallCount = countSentMessages("Emulation.setDeviceMetricsOverride");
    // Only the expand call — no re-apply after clear
    expect(setCallCount).toBe(p10Limits.expectedNoReapplySetCalls);

    requireSentMessage("Emulation.clearDeviceMetricsOverride");
  });

  it("fullPage viewport dimensions never shrink below current innerWidth/Height", async () => {
    await captureScreenshot({ wsUrl: "ws://localhost:9222/devtools/page/X", fullPage: true });

    const expandCall = requireSentMessage("Emulation.setDeviceMetricsOverride");
    expect(Number(expandCall.params?.width)).toBeGreaterThanOrEqual(800);
    expect(Number(expandCall.params?.height)).toBeGreaterThanOrEqual(600);
  });
});

describe("shouldUsePlaywrightForScreenshot routing", () => {
  it("returns false for a normal viewport screenshot with wsUrl", () => {
    expect(shouldUsePlaywrightForScreenshot({ profile: localProfile, wsUrl: "ws://x" })).toBe(
      false,
    );
  });

  it("returns true when wsUrl is missing", () => {
    expect(shouldUsePlaywrightForScreenshot({ profile: localProfile })).toBe(true);
  });

  it("returns true when ref is specified", () => {
    expect(
      shouldUsePlaywrightForScreenshot({ profile: localProfile, wsUrl: "ws://x", ref: "btn-1" }),
    ).toBe(true);
  });

  it("returns true when element is specified", () => {
    expect(
      shouldUsePlaywrightForScreenshot({
        profile: localProfile,
        wsUrl: "ws://x",
        element: "#submit",
      }),
    ).toBe(true);
  });
});
