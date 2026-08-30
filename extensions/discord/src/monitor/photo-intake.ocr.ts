// Discord plugin module implements photo intake OCR behavior.
//
// Local-first text extraction. Mirrors the onboarder-vision skill contract:
// OCR is attempted first, and only escalates to a model call when confidence
// is low or OCR is unavailable. The threshold matches that skill's documented
// "fallback to VLM consult if confidence < 0.8".
//
// Measured on this host (2026-08-29, tesseract 5.5.0, 600x220 label fixture):
// OCR takes 0.24s locally; the branch-0 vision call took 111.7s end-to-end over
// the tailnet. That is why OCR runs eagerly on attach and vision only on
// explicit request. See photo-intake.ts for the full framing of that number.
import { execFile } from "node:child_process";

/** Confidence at or above this is trusted; below escalates to vision. */
export const PHOTO_INTAKE_OCR_CONFIDENCE_THRESHOLD = 0.8;

/** Hard ceiling on tesseract wall time; a wedged binary must not hold the turn. */
export const PHOTO_INTAKE_OCR_TIMEOUT_MS = 20_000;

/** Upper bound on TSV rows parsed, so a hostile image cannot force unbounded work. */
const MAX_OCR_TSV_ROWS = 20_000;

/** Column index of `conf` and `text` in tesseract's TSV output (0-based). */
const TSV_LEVEL_COLUMN = 0;
const TSV_CONF_COLUMN = 10;
const TSV_TEXT_COLUMN = 11;
/** Tesseract marks word-level rows with level 5. */
const TSV_WORD_LEVEL = "5";

export type PhotoIntakeOcrOutcome =
  | {
      status: "ok";
      text: string;
      /** Mean word confidence, 0..1. */
      confidence: number;
      /** Number of words the mean was computed over -- the denominator. */
      wordCount: number;
      engineVersion: string;
      /** True when confidence is below threshold and vision should be offered. */
      shouldEscalateToVision: boolean;
    }
  | { status: "unavailable"; reason: string }
  | { status: "failed"; reason: string };

/** Injectable process runner so tests never shell out. */
export type OcrCommandRunner = (
  binary: string,
  args: string[],
  timeoutMs: number,
) => Promise<{ stdout: string }>;

export const defaultOcrCommandRunner: OcrCommandRunner = (binary, args, timeoutMs) =>
  new Promise((resolve, reject) => {
    execFile(binary, args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ stdout });
    });
  });

function parseTesseractVersion(stdout: string): string {
  const firstLine = stdout.split(/\r?\n/, 1)[0]?.trim() ?? "";
  return firstLine || "tesseract (unknown version)";
}

/**
 * Parses tesseract TSV into text plus mean word confidence.
 *
 * Only level-5 (word) rows carry a real confidence; structural rows report -1
 * and must be excluded or they drag the mean toward nonsense.
 */
export function parseTesseractTsv(tsv: string): {
  text: string;
  confidence: number;
  wordCount: number;
} {
  const lines = tsv.split(/\r?\n/);
  const rowLimit = Math.min(lines.length, MAX_OCR_TSV_ROWS);
  const words: string[] = [];
  let confidenceSum = 0;
  for (let index = 1; index < rowLimit; index += 1) {
    const columns = lines[index]?.split("\t");
    if (!columns || columns.length <= TSV_TEXT_COLUMN) {
      continue;
    }
    if (columns[TSV_LEVEL_COLUMN] !== TSV_WORD_LEVEL) {
      continue;
    }
    const confidence = Number.parseFloat(columns[TSV_CONF_COLUMN] ?? "");
    const text = columns[TSV_TEXT_COLUMN] ?? "";
    if (!Number.isFinite(confidence) || confidence < 0 || !text.trim()) {
      continue;
    }
    words.push(text);
    confidenceSum += confidence;
  }
  if (words.length === 0) {
    return { text: "", confidence: 0, wordCount: 0 };
  }
  // Tesseract reports 0..100; the rest of this module speaks 0..1.
  return {
    text: words.join(" "),
    confidence: confidenceSum / words.length / 100,
    wordCount: words.length,
  };
}

/**
 * Runs OCR over an image already saved to disk. Never throws: an absent or
 * failing tesseract degrades to a reported status so the caller can say so
 * plainly instead of fabricating text.
 */
export async function runPhotoIntakeOcr(params: {
  imagePath: string;
  runCommand?: OcrCommandRunner;
  binary?: string;
  timeoutMs?: number;
}): Promise<PhotoIntakeOcrOutcome> {
  if (!params.imagePath) {
    throw new Error("photo-intake: imagePath is required for OCR");
  }
  const run = params.runCommand ?? defaultOcrCommandRunner;
  const binary = params.binary ?? "tesseract";
  const timeoutMs = params.timeoutMs ?? PHOTO_INTAKE_OCR_TIMEOUT_MS;

  let engineVersion: string;
  try {
    const probe = await run(binary, ["--version"], timeoutMs);
    engineVersion = parseTesseractVersion(probe.stdout);
  } catch (err) {
    return { status: "unavailable", reason: `tesseract not usable: ${String(err)}` };
  }

  try {
    const result = await run(binary, [params.imagePath, "stdout", "tsv"], timeoutMs);
    const parsed = parseTesseractTsv(result.stdout);
    return {
      status: "ok",
      text: parsed.text,
      confidence: parsed.confidence,
      wordCount: parsed.wordCount,
      engineVersion,
      shouldEscalateToVision:
        parsed.wordCount === 0 || parsed.confidence < PHOTO_INTAKE_OCR_CONFIDENCE_THRESHOLD,
    };
  } catch (err) {
    return { status: "failed", reason: `tesseract run failed: ${String(err)}` };
  }
}
