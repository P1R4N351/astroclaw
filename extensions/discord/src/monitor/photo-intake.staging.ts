// Discord plugin module implements photo intake staging behavior.
//
// A STAGING QUEUE, not a catalogue. The evidence-bound catalogue this feeds
// (P-BACKLOG [8ea9f7c]) has not landed a write API yet, so nothing here may
// pretend to be that catalogue or become a second parallel photo-evidence
// store. Every record is written with `pendingCatalogueIntegration: true` in
// the exact shape the `multimodality` room ruling specified, so that draining
// it later is a read-and-upsert.
//
// Format is one JSON object per line, mirroring the repo's existing JSONL
// journals (`src/crestodian/audit.ts`, `extensions/memory-wiki/src/log.ts`).
// JSONL rather than the SQLite plugin-state store because the eventual
// consumer is an out-of-process catalogue, and a shared SQLite file is a poor
// integration seam for it.
import type { PhotoIntakeStagingRecord } from "./photo-intake.types.js";

/** Relative to the resolved state dir. */
export const PHOTO_INTAKE_STAGING_RELATIVE_PATH = "photo-intake/pending-catalogue.jsonl";

/**
 * Bound on the journal so an attachment flood cannot fill the disk. Enforced by
 * the append port; exceeding it fails loudly rather than silently truncating.
 */
export const PHOTO_INTAKE_STAGING_MAX_BYTES = 64 * 1024 * 1024;

/** Upper bound on lines parsed in one drain pass, so reads stay bounded too. */
const MAX_JOURNAL_LINES = 100_000;

/**
 * Append port. Injected so unit tests never touch the filesystem and so the
 * SDK-backed implementation stays in a `*.runtime.ts` lazy boundary.
 */
export type PhotoIntakeStagingSink = (params: {
  relativePath: string;
  line: string;
  maxFileBytes: number;
}) => Promise<void>;

function assertStagingRecord(record: PhotoIntakeStagingRecord): void {
  if (record.pendingCatalogueIntegration !== true) {
    throw new Error("photo-intake: staging records must be marked pendingCatalogueIntegration");
  }
  if (!record.intakeId) {
    throw new Error("photo-intake: staging record requires an intakeId");
  }
  if (!record.contentHash?.value) {
    throw new Error("photo-intake: staging record requires a content hash");
  }
  if (record.requestedAction !== "archive" && record.requestedAction !== "register-hardware") {
    throw new Error(`photo-intake: unstageable action ${record.requestedAction}`);
  }
}

/**
 * Serializes one record to a single JSONL line.
 *
 * A newline inside the payload would split one record into two unparseable
 * lines, so the encoded form is asserted to be single-line. `JSON.stringify`
 * escapes newlines inside strings, which makes this an assertion rather than a
 * transformation -- if it ever fires, something upstream is very wrong.
 */
export function encodePhotoIntakeStagingLine(record: PhotoIntakeStagingRecord): string {
  assertStagingRecord(record);
  const encoded = JSON.stringify(record);
  if (encoded.includes("\n") || encoded.includes("\r")) {
    throw new Error("photo-intake: encoded staging record must be single-line");
  }
  return `${encoded}\n`;
}

/** Appends one record to the staging journal. */
export async function stagePhotoIntakeRecord(params: {
  record: PhotoIntakeStagingRecord;
  sink: PhotoIntakeStagingSink;
}): Promise<{ relativePath: string }> {
  const line = encodePhotoIntakeStagingLine(params.record);
  await params.sink({
    relativePath: PHOTO_INTAKE_STAGING_RELATIVE_PATH,
    line,
    maxFileBytes: PHOTO_INTAKE_STAGING_MAX_BYTES,
  });
  return { relativePath: PHOTO_INTAKE_STAGING_RELATIVE_PATH };
}

/**
 * Parses a staging journal back into records, for the eventual drain into the
 * catalogue. Malformed lines are reported rather than thrown on, so one bad
 * line cannot make the whole queue unreadable.
 */
export function parsePhotoIntakeStagingJournal(contents: string): {
  records: PhotoIntakeStagingRecord[];
  malformedLineNumbers: number[];
} {
  const records: PhotoIntakeStagingRecord[] = [];
  const malformedLineNumbers: number[] = [];
  const lines = contents.split(/\r?\n/);
  const lineLimit = Math.min(lines.length, MAX_JOURNAL_LINES);
  for (let index = 0; index < lineLimit; index += 1) {
    const line = lines[index]?.trim();
    if (!line) {
      continue;
    }
    try {
      const parsed = JSON.parse(line) as PhotoIntakeStagingRecord;
      assertStagingRecord(parsed);
      records.push(parsed);
    } catch {
      malformedLineNumbers.push(index + 1);
    }
  }
  return { records, malformedLineNumbers };
}
