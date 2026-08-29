// Discord tests cover photo intake hardware-field plugin behavior.
import { describe, expect, it } from "vitest";
import { buildPhotoIntakeHardwareFields } from "./photo-intake.hardware.js";
import type { PhotoIntakeDerived } from "./photo-intake.types.js";

function ocr(value: string, confidence: number): PhotoIntakeDerived {
  return {
    kind: "ocr-text",
    value,
    provenance: {
      engine: "tesseract",
      model: "tesseract 5.5.0",
      producedAt: "2026-08-29T00:00:00.000Z",
      confidence,
    },
  };
}

function vision(value: string): PhotoIntakeDerived {
  return {
    kind: "vision-analysis",
    value,
    provenance: {
      engine: "ollama-vision",
      model: "Athesus/athesus-vision-reasoning:latest",
      producedAt: "2026-08-29T00:00:00.000Z",
      unrouted: true,
    },
  };
}

const VISION_FIELDS = [
  "manufacturer: ACME",
  "model: NS-2400-X",
  "serial: SN4471820933",
  "condition: used, minor scuffs",
].join("\n");

describe("buildPhotoIntakeHardwareFields", () => {
  it("returns undefined when nothing could be read, rather than an empty shell", () => {
    expect(buildPhotoIntakeHardwareFields([])).toBeUndefined();
    expect(buildPhotoIntakeHardwareFields([vision("a photo of a cat")])).toBeUndefined();
  });

  it("prefills all four fields from labeled vision output", () => {
    const fields = buildPhotoIntakeHardwareFields([vision(VISION_FIELDS)]);
    expect(fields?.manufacturer?.value).toBe("ACME");
    expect(fields?.model?.value).toBe("NS-2400-X");
    expect(fields?.serial?.value).toBe("SN4471820933");
    expect(fields?.condition?.value).toBe("used, minor scuffs");
  });

  it("always flags vision-sourced fields for human confirmation", () => {
    const fields = buildPhotoIntakeHardwareFields([vision(VISION_FIELDS)]);
    for (const field of [fields?.manufacturer, fields?.model, fields?.serial]) {
      expect(field?.needsHumanConfirmation).toBe(true);
      expect(field?.source).toBe("vision-analysis");
    }
  });

  it("flags low-confidence OCR fields for confirmation", () => {
    // 0.60 is the real mean confidence measured on the label fixture.
    const fields = buildPhotoIntakeHardwareFields([ocr("Serial: SN4471820933", 0.6028949)]);
    expect(fields?.serial?.value).toBe("SN4471820933");
    expect(fields?.serial?.needsHumanConfirmation).toBe(true);
  });

  it("accepts high-confidence OCR fields without flagging them", () => {
    const fields = buildPhotoIntakeHardwareFields([ocr("Serial: SN4471820933", 0.955)]);
    expect(fields?.serial?.needsHumanConfirmation).toBe(false);
    expect(fields?.serial?.source).toBe("ocr-text");
  });

  it("prefers OCR and lets vision fill only the gaps", () => {
    const fields = buildPhotoIntakeHardwareFields([
      vision("manufacturer: WRONG\nmodel: NS-2400-X"),
      ocr("Manufacturer: ACME", 0.955),
    ]);
    expect(fields?.manufacturer?.value).toBe("ACME");
    expect(fields?.manufacturer?.source).toBe("ocr-text");
    expect(fields?.model?.value).toBe("NS-2400-X");
    expect(fields?.model?.source).toBe("vision-analysis");
  });

  it("drops 'unknown' placeholders instead of registering them as values", () => {
    const fields = buildPhotoIntakeHardwareFields([
      vision("manufacturer: ACME\nmodel: unknown\nserial: n/a"),
    ]);
    expect(fields?.manufacturer?.value).toBe("ACME");
    expect(fields?.model).toBeUndefined();
    expect(fields?.serial).toBeUndefined();
  });

  it("reads the common serial-number label variants", () => {
    expect(buildPhotoIntakeHardwareFields([vision("S/N: ABC123")])?.serial?.value).toBe("ABC123");
    expect(buildPhotoIntakeHardwareFields([vision("Serial Number: ABC123")])?.serial?.value).toBe(
      "ABC123",
    );
  });
});
