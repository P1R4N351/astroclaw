// Discord tests cover photo intake OCR plugin behavior.
import { describe, expect, it, vi } from "vitest";
import {
  PHOTO_INTAKE_OCR_CONFIDENCE_THRESHOLD,
  parseTesseractTsv,
  runPhotoIntakeOcr,
  type OcrCommandRunner,
} from "./photo-intake.ocr.js";

const TSV_HEADER =
  "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext";

/**
 * Verbatim rows from a real `tesseract <fixture> stdout tsv` run on this host
 * (tesseract 5.5.0, 2026-08-29). Structural rows carry conf -1; only level-5
 * word rows carry a real confidence.
 */
const REAL_TSV = [
  TSV_HEADER,
  "1\t1\t0\t0\t0\t0\t0\t0\t600\t220\t-1\t",
  "2\t1\t1\t0\t0\t0\t20\t32\t104\t8\t-1\t",
  "3\t1\t1\t1\t0\t0\t20\t32\t104\t8\t-1\t",
  "4\t1\t1\t1\t1\t0\t20\t32\t104\t8\t-1\t",
  "5\t1\t1\t1\t1\t1\t20\t32\t28\t8\t65.420654\tACME",
  "5\t1\t1\t1\t1\t2\t51\t32\t47\t8\t41.518227\tNetSwiteh",
  "5\t1\t1\t1\t1\t3\t102\t32\t22\t8\t73.929604\t2400",
].join("\n");

function runnerFor(outputs: Record<string, string>): OcrCommandRunner {
  return vi.fn(async (_binary: string, args: string[]) => {
    const key = args.includes("--version") ? "version" : "ocr";
    const stdout = outputs[key];
    if (stdout === undefined) {
      throw new Error(`unexpected invocation: ${args.join(" ")}`);
    }
    return { stdout };
  });
}

describe("parseTesseractTsv", () => {
  it("averages only word-level rows and ignores structural rows", () => {
    const parsed = parseTesseractTsv(REAL_TSV);
    expect(parsed.text).toBe("ACME NetSwiteh 2400");
    expect(parsed.wordCount).toBe(3);
    // (65.420654 + 41.518227 + 73.929604) / 3 / 100, computed independently.
    expect(parsed.confidence).toBeCloseTo(0.6028949, 6);
  });

  it("reports a zero denominator rather than dividing by zero", () => {
    const parsed = parseTesseractTsv(TSV_HEADER);
    expect(parsed).toEqual({ text: "", confidence: 0, wordCount: 0 });
  });

  it("skips rows whose confidence is the -1 sentinel even at word level", () => {
    const tsv = [TSV_HEADER, "5\t1\t1\t1\t1\t1\t0\t0\t1\t1\t-1\tghost"].join("\n");
    expect(parseTesseractTsv(tsv).wordCount).toBe(0);
  });
});

describe("runPhotoIntakeOcr", () => {
  it("reports unavailable when the binary cannot be probed, without throwing", async () => {
    const runner: OcrCommandRunner = vi.fn(async () => {
      throw new Error("ENOENT");
    });
    const outcome = await runPhotoIntakeOcr({ imagePath: "/tmp/x.png", runCommand: runner });
    expect(outcome.status).toBe("unavailable");
  });

  it("escalates to vision when mean confidence is below the threshold", async () => {
    const outcome = await runPhotoIntakeOcr({
      imagePath: "/tmp/x.png",
      runCommand: runnerFor({ version: "tesseract 5.5.0", ocr: REAL_TSV }),
    });
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") {
      return;
    }
    expect(outcome.confidence).toBeLessThan(PHOTO_INTAKE_OCR_CONFIDENCE_THRESHOLD);
    expect(outcome.shouldEscalateToVision).toBe(true);
    expect(outcome.engineVersion).toBe("tesseract 5.5.0");
  });

  it("does not escalate when confidence clears the threshold", async () => {
    const confident = [
      TSV_HEADER,
      "5\t1\t1\t1\t1\t1\t0\t0\t1\t1\t96.5\tACME",
      "5\t1\t1\t1\t1\t2\t0\t0\t1\t1\t94.5\tNetSwitch",
    ].join("\n");
    const outcome = await runPhotoIntakeOcr({
      imagePath: "/tmp/x.png",
      runCommand: runnerFor({ version: "tesseract 5.5.0", ocr: confident }),
    });
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") {
      return;
    }
    expect(outcome.confidence).toBeCloseTo(0.955, 6);
    expect(outcome.shouldEscalateToVision).toBe(false);
  });

  it("escalates when OCR succeeds but finds no words at all", async () => {
    const outcome = await runPhotoIntakeOcr({
      imagePath: "/tmp/x.png",
      runCommand: runnerFor({ version: "tesseract 5.5.0", ocr: TSV_HEADER }),
    });
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") {
      return;
    }
    expect(outcome.wordCount).toBe(0);
    expect(outcome.shouldEscalateToVision).toBe(true);
  });

  it("reports a failed run distinctly from an unavailable binary", async () => {
    const runner: OcrCommandRunner = vi.fn(async (_binary: string, args: string[]) => {
      if (args.includes("--version")) {
        return { stdout: "tesseract 5.5.0" };
      }
      throw new Error("segfault");
    });
    const outcome = await runPhotoIntakeOcr({ imagePath: "/tmp/x.png", runCommand: runner });
    expect(outcome.status).toBe("failed");
  });
});
