import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/types.js";
import { createModelVisibilityPolicyWithFallbacks } from "./model-selection-shared.js";

const loggerMocks = vi.hoisted(() => ({ warn: vi.fn() }));

vi.mock("../logging/subsystem.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../logging/subsystem.js")>();
  return {
    ...actual,
    createSubsystemLogger: () => ({ warn: loggerMocks.warn }),
  };
});

beforeEach(() => loggerMocks.warn.mockClear());

describe("allowed model selection substitutions", () => {
  it("warns once when a disallowed request falls back to the first allowed model", () => {
    const cfg: OpenClawConfig = {
      agents: {
        defaults: {
          modelPolicy: { allow: ["fixture/approved"] },
        },
      },
    };
    const policy = createModelVisibilityPolicyWithFallbacks({
      cfg,
      catalog: [{ provider: "fixture", id: "approved", name: "Approved" }],
      defaultProvider: "fixture",
      defaultModel: "fixture/default",
      fallbackModels: [],
      allowManifestNormalization: false,
      allowPluginNormalization: false,
      manifestPlugins: [],
    });

    expect(policy.resolveSelection({ provider: "fixture", model: "misspelled" })).toEqual({
      provider: "fixture",
      model: "approved",
    });
    expect(policy.resolveSelection({ provider: "fixture", model: "misspelled" })).toEqual({
      provider: "fixture",
      model: "approved",
    });
    expect(loggerMocks.warn).toHaveBeenCalledTimes(1);
    expect(loggerMocks.warn).toHaveBeenCalledWith(
      'Model "fixture/misspelled" is not in the allowed model list. Falling back to "fixture/approved". Check the allowed-model config for a typo.',
    );
  });
});
