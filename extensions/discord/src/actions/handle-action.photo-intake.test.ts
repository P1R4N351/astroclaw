// Discord tests cover handle action.photo intake plugin behavior.
import { describe, expect, it, vi } from "vitest";
import type { PhotoIntakeContext } from "../monitor/photo-intake.js";
import { parsePhotoIntakeStagingJournal } from "../monitor/photo-intake.staging.js";
import type { PhotoIntakeDerived } from "../monitor/photo-intake.types.js";
import {
  isDiscordPhotoIntakeAction,
  tryHandleDiscordMessageActionPhotoIntake,
  type PhotoIntakeActionDeps,
} from "./handle-action.photo-intake.js";

const OCR_DERIVED: PhotoIntakeDerived = {
  kind: "ocr-text",
  value: "ACME NetSwiteh 2400 Serial: SN4471820933",
  provenance: {
    engine: "tesseract",
    model: "tesseract 5.5.0",
    producedAt: "2026-08-29T00:00:00.000Z",
    confidence: 0.6028949,
  },
};

function context(overrides: Partial<PhotoIntakeContext> = {}): PhotoIntakeContext {
  return {
    intakeId: "intake-1",
    sourceRef: {
      provider: "discord",
      attachmentId: "111",
      guildId: "222",
      channelId: "333",
      messageId: "444",
      authorId: "555",
      byteSize: 3,
      observedAt: "2026-08-29T00:00:00.000Z",
    },
    contentHash: { algo: "sha256", value: "cafe" },
    localPath: "/tmp/switch.png",
    derived: [],
    ...overrides,
  };
}

function deps(overrides: Partial<PhotoIntakeActionDeps> = {}) {
  const staged: string[] = [];
  const contexts = new Map<string, PhotoIntakeContext>();
  const base: PhotoIntakeActionDeps = {
    store: {
      save: async (value) => {
        contexts.set(value.intakeId, value);
      },
      load: async (intakeId) => contexts.get(intakeId),
    },
    stagingSink: async ({ line }) => {
      staged.push(line);
    },
    analyzeVision: async () => ({
      status: "ok",
      text: "manufacturer: ACME\nmodel: NS-2400-X\nserial: SN4471820933",
      provenance: {
        engine: "ollama-vision",
        model: "Athesus/athesus-vision-reasoning:latest",
        producedAt: "2026-08-29T00:00:00.000Z",
        unrouted: true,
      },
    }),
    readImage: async () => new TextEncoder().encode("abc"),
    now: () => new Date("2026-08-29T00:00:01.000Z"),
    ...overrides,
  };
  return { deps: base, staged, contexts };
}

async function seed(harness: ReturnType<typeof deps>, value = context()) {
  await harness.deps.store.save(value);
  return value;
}

describe("isDiscordPhotoIntakeAction", () => {
  it("claims only the four photo-intake actions", () => {
    expect(isDiscordPhotoIntakeAction("photo-intake-archive")).toBe(true);
    expect(isDiscordPhotoIntakeAction("photo-intake-extract-text")).toBe(true);
    expect(isDiscordPhotoIntakeAction("send")).toBe(false);
  });
});

describe("tryHandleDiscordMessageActionPhotoIntake", () => {
  it("returns undefined for actions it does not own so the chain continues", async () => {
    const harness = deps();
    await expect(
      tryHandleDiscordMessageActionPhotoIntake({
        action: "send",
        params: {},
        deps: harness.deps,
      }),
    ).resolves.toBeUndefined();
  });

  it("reports a missing intake instead of acting on an unknown photo", async () => {
    const harness = deps();
    const result = await tryHandleDiscordMessageActionPhotoIntake({
      action: "photo-intake-archive",
      params: { intakeId: "nope" },
      deps: harness.deps,
    });
    expect(result?.ok).toBe(false);
    expect(harness.staged).toHaveLength(0);
  });

  it("extract-text surfaces the cached OCR with its confidence", async () => {
    const harness = deps();
    await seed(harness, context({ derived: [OCR_DERIVED] }));
    const result = await tryHandleDiscordMessageActionPhotoIntake({
      action: "photo-intake-extract-text",
      params: { intakeId: "intake-1" },
      deps: harness.deps,
    });
    expect(result?.ok).toBe(true);
    expect(String(result?.output)).toContain("SN4471820933");
    expect(String(result?.output)).toContain("60% mean confidence");
  });

  it("extract-text says plainly when there is no OCR rather than inventing text", async () => {
    const harness = deps();
    await seed(harness);
    const result = await tryHandleDiscordMessageActionPhotoIntake({
      action: "photo-intake-extract-text",
      params: { intakeId: "intake-1" },
      deps: harness.deps,
    });
    expect(result?.ok).toBe(false);
    expect(String(result?.output)).toContain("No text was extracted");
  });

  it("analyze runs vision lazily and labels the result unrouted", async () => {
    const harness = deps();
    await seed(harness);
    const result = await tryHandleDiscordMessageActionPhotoIntake({
      action: "photo-intake-analyze",
      params: { intakeId: "intake-1" },
      deps: harness.deps,
    });
    expect(result?.ok).toBe(true);
    expect(String(result?.output)).toContain("unrouted best-effort");
    expect(String(result?.output)).toContain("Athesus/athesus-vision-reasoning:latest");
  });

  it("analyze degrades clearly when the vision model is unreachable", async () => {
    const harness = deps({
      analyzeVision: async () => ({ status: "unavailable", reason: "ECONNREFUSED" }),
    });
    await seed(harness);
    const result = await tryHandleDiscordMessageActionPhotoIntake({
      action: "photo-intake-analyze",
      params: { intakeId: "intake-1" },
      deps: harness.deps,
    });
    expect(result?.ok).toBe(false);
    expect(String(result?.output)).toContain("ECONNREFUSED");
    expect(String(result?.output)).toContain("No analysis was produced");
  });

  it("analyze reuses a cached vision artifact instead of paying for it twice", async () => {
    const analyzeVision = vi.fn(async () => ({
      status: "ok" as const,
      text: "a switch",
      provenance: {
        engine: "ollama-vision" as const,
        model: "Athesus/athesus-vision-reasoning:latest",
        producedAt: "2026-08-29T00:00:00.000Z",
        unrouted: true,
      },
    }));
    const harness = deps({ analyzeVision });
    await seed(harness);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await tryHandleDiscordMessageActionPhotoIntake({
        action: "photo-intake-analyze",
        params: { intakeId: "intake-1" },
        deps: harness.deps,
      });
    }
    expect(analyzeVision).toHaveBeenCalledTimes(1);
  });

  it("archive stages a pending-catalogue record and says it is not catalogued", async () => {
    const harness = deps();
    await seed(harness, context({ derived: [OCR_DERIVED] }));
    const result = await tryHandleDiscordMessageActionPhotoIntake({
      action: "photo-intake-archive",
      params: { intakeId: "intake-1" },
      deps: harness.deps,
    });
    expect(result?.ok).toBe(true);
    expect(String(result?.output)).toContain("not yet catalogued");

    const parsed = parsePhotoIntakeStagingJournal(harness.staged.join(""));
    expect(parsed.malformedLineNumbers).toEqual([]);
    expect(parsed.records).toHaveLength(1);
    const record = parsed.records[0];
    expect(record?.pendingCatalogueIntegration).toBe(true);
    expect(record?.requestedAction).toBe("archive");
    // One source item -> one identity -> many derived records.
    expect(record?.intakeId).toBe("intake-1");
    expect(record?.contentHash.value).toBe("cafe");
    expect(record?.derived).toHaveLength(1);
  });

  it("archive carries the full idempotency key required by the room ruling", async () => {
    const harness = deps();
    await seed(harness);
    await tryHandleDiscordMessageActionPhotoIntake({
      action: "photo-intake-archive",
      params: { intakeId: "intake-1" },
      deps: harness.deps,
    });
    const record = parsePhotoIntakeStagingJournal(harness.staged.join("")).records[0];
    expect(record?.idempotencyKey).toEqual({
      attachmentId: "111",
      guildId: "222",
      channelId: "333",
      messageId: "444",
      contentSha256: "cafe",
    });
  });

  it("archive does not run vision", async () => {
    const analyzeVision = vi.fn();
    const harness = deps({
      analyzeVision: analyzeVision as unknown as PhotoIntakeActionDeps["analyzeVision"],
    });
    await seed(harness, context({ derived: [OCR_DERIVED] }));
    await tryHandleDiscordMessageActionPhotoIntake({
      action: "photo-intake-archive",
      params: { intakeId: "intake-1" },
      deps: harness.deps,
    });
    expect(analyzeVision).not.toHaveBeenCalled();
  });

  it("register-hardware escalates to vision when OCR confidence is low", async () => {
    const analyzeVision = vi.fn(async () => ({
      status: "ok" as const,
      text: "manufacturer: ACME\nmodel: NS-2400-X",
      provenance: {
        engine: "ollama-vision" as const,
        model: "Athesus/athesus-vision-reasoning:latest",
        producedAt: "2026-08-29T00:00:00.000Z",
        unrouted: true,
      },
    }));
    const harness = deps({ analyzeVision });
    // 0.60 mean confidence, the real measured value for the label fixture.
    await seed(harness, context({ derived: [OCR_DERIVED] }));
    const result = await tryHandleDiscordMessageActionPhotoIntake({
      action: "photo-intake-register-hardware",
      params: { intakeId: "intake-1" },
      deps: harness.deps,
    });
    expect(analyzeVision).toHaveBeenCalledTimes(1);
    expect(result?.ok).toBe(true);

    const record = parsePhotoIntakeStagingJournal(harness.staged.join("")).records[0];
    expect(record?.requestedAction).toBe("register-hardware");
    expect(record?.hardwareFields?.manufacturer?.value).toBe("ACME");
    expect(record?.hardwareFields?.manufacturer?.needsHumanConfirmation).toBe(true);
  });

  it("register-hardware skips vision when OCR is already confident", async () => {
    const analyzeVision = vi.fn();
    const harness = deps({
      analyzeVision: analyzeVision as unknown as PhotoIntakeActionDeps["analyzeVision"],
    });
    await seed(
      harness,
      context({
        derived: [
          {
            ...OCR_DERIVED,
            value: "Manufacturer: ACME",
            provenance: { ...OCR_DERIVED.provenance, confidence: 0.955 },
          },
        ],
      }),
    );
    await tryHandleDiscordMessageActionPhotoIntake({
      action: "photo-intake-register-hardware",
      params: { intakeId: "intake-1" },
      deps: harness.deps,
    });
    expect(analyzeVision).not.toHaveBeenCalled();
    const record = parsePhotoIntakeStagingJournal(harness.staged.join("")).records[0];
    expect(record?.hardwareFields?.manufacturer?.needsHumanConfirmation).toBe(false);
  });

  it("register-hardware still stages when nothing could be read", async () => {
    const harness = deps({
      analyzeVision: async () => ({ status: "unavailable", reason: "offline" }),
    });
    await seed(harness);
    const result = await tryHandleDiscordMessageActionPhotoIntake({
      action: "photo-intake-register-hardware",
      params: { intakeId: "intake-1" },
      deps: harness.deps,
    });
    expect(result?.ok).toBe(true);
    expect(String(result?.output)).toContain("need manual entry");
    const record = parsePhotoIntakeStagingJournal(harness.staged.join("")).records[0];
    expect(record?.hardwareFields).toBeUndefined();
  });
});
