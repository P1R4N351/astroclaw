// Discord tests cover photo intake staging plugin behavior.
import { describe, expect, it, vi } from "vitest";
import {
  PHOTO_INTAKE_STAGING_MAX_BYTES,
  PHOTO_INTAKE_STAGING_RELATIVE_PATH,
  encodePhotoIntakeStagingLine,
  parsePhotoIntakeStagingJournal,
  stagePhotoIntakeRecord,
  type PhotoIntakeStagingSink,
} from "./photo-intake.staging.js";
import type { PhotoIntakeStagingRecord } from "./photo-intake.types.js";

function record(overrides: Partial<PhotoIntakeStagingRecord> = {}): PhotoIntakeStagingRecord {
  return {
    schemaVersion: 1,
    pendingCatalogueIntegration: true,
    intakeId: "abc123",
    idempotencyKey: {
      attachmentId: "111",
      guildId: "222",
      channelId: "333",
      messageId: "444",
      contentSha256: "cafe",
    },
    sourceRef: {
      provider: "discord",
      attachmentId: "111",
      guildId: "222",
      channelId: "333",
      messageId: "444",
      authorId: "555",
      byteSize: 10,
      observedAt: "2026-08-29T00:00:00.000Z",
    },
    contentHash: { algo: "sha256", value: "cafe" },
    requestedAction: "archive",
    stagedAt: "2026-08-29T00:00:01.000Z",
    derived: [],
    ...overrides,
  };
}

describe("encodePhotoIntakeStagingLine", () => {
  it("emits exactly one newline-terminated line", () => {
    const line = encodePhotoIntakeStagingLine(record());
    expect(line.endsWith("\n")).toBe(true);
    expect(line.trimEnd().includes("\n")).toBe(false);
  });

  it("keeps embedded newlines from splitting a record across lines", () => {
    const line = encodePhotoIntakeStagingLine(
      record({
        derived: [
          {
            kind: "ocr-text",
            value: "line one\nline two",
            provenance: {
              engine: "tesseract",
              model: "tesseract 5.5.0",
              producedAt: "2026-08-29T00:00:00.000Z",
            },
          },
        ],
      }),
    );
    expect(line.split("\n").filter(Boolean)).toHaveLength(1);
    const parsed = JSON.parse(line) as PhotoIntakeStagingRecord;
    expect(parsed.derived[0]?.value).toBe("line one\nline two");
  });

  it("refuses a record that is not marked pending catalogue integration", () => {
    expect(() =>
      encodePhotoIntakeStagingLine(
        record({ pendingCatalogueIntegration: false as unknown as true }),
      ),
    ).toThrow(/pendingCatalogueIntegration/);
  });

  it("refuses an action that is not stageable", () => {
    expect(() =>
      encodePhotoIntakeStagingLine(
        record({ requestedAction: "analyze-photo" as unknown as "archive" }),
      ),
    ).toThrow(/unstageable action/);
  });
});

describe("stagePhotoIntakeRecord", () => {
  it("appends to the bounded staging journal path", async () => {
    const sink = vi.fn<PhotoIntakeStagingSink>(async () => {});
    const result = await stagePhotoIntakeRecord({ record: record(), sink });
    expect(result.relativePath).toBe(PHOTO_INTAKE_STAGING_RELATIVE_PATH);
    expect(sink).toHaveBeenCalledTimes(1);
    const call = sink.mock.calls[0]?.[0];
    expect(call?.relativePath).toBe(PHOTO_INTAKE_STAGING_RELATIVE_PATH);
    expect(call?.maxFileBytes).toBe(PHOTO_INTAKE_STAGING_MAX_BYTES);
    expect(call?.line.endsWith("\n")).toBe(true);
  });

  it("propagates a sink failure instead of silently dropping the record", async () => {
    const sink: PhotoIntakeStagingSink = async () => {
      throw new Error("disk full");
    };
    await expect(stagePhotoIntakeRecord({ record: record(), sink })).rejects.toThrow("disk full");
  });
});

describe("parsePhotoIntakeStagingJournal", () => {
  it("round-trips staged records", () => {
    const journal =
      encodePhotoIntakeStagingLine(record({ intakeId: "one" })) +
      encodePhotoIntakeStagingLine(record({ intakeId: "two" }));
    const parsed = parsePhotoIntakeStagingJournal(journal);
    expect(parsed.records.map((entry) => entry.intakeId)).toEqual(["one", "two"]);
    expect(parsed.malformedLineNumbers).toEqual([]);
  });

  it("isolates a malformed line rather than failing the whole drain", () => {
    const journal = ["{not json", encodePhotoIntakeStagingLine(record()).trimEnd()].join("\n");
    const parsed = parsePhotoIntakeStagingJournal(journal);
    expect(parsed.records).toHaveLength(1);
    expect(parsed.malformedLineNumbers).toEqual([1]);
  });
});
