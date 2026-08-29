// Discord tests cover photo intake menu plugin behavior.
import { describe, expect, it } from "vitest";
import {
  buildPhotoIntakeCallbackData,
  buildPhotoIntakeMenuSpec,
  parsePhotoIntakeCallbackData,
} from "./photo-intake.menu.js";

type MenuParams = Parameters<typeof buildPhotoIntakeMenuSpec>[0];

function menu(overrides: Partial<MenuParams> = {}) {
  return buildPhotoIntakeMenuSpec({
    intakeId: "intake-1",
    fileName: "switch.png",
    ocrAvailable: true,
    ocrWordCount: 3,
    ocrConfidence: 0.6028949,
    visionModelLabel: "Athesus/athesus-vision-reasoning:latest",
    ...overrides,
  });
}

describe("photo intake callback data", () => {
  it("round-trips an action and intake id", () => {
    const raw = buildPhotoIntakeCallbackData({ action: "archive", intakeId: "intake-1" });
    expect(parsePhotoIntakeCallbackData(raw)).toEqual({ action: "archive", intakeId: "intake-1" });
  });

  it("rejects callbacks belonging to another feature", () => {
    expect(parsePhotoIntakeCallbackData("something-else:archive:intake-1")).toBeUndefined();
    expect(parsePhotoIntakeCallbackData(undefined)).toBeUndefined();
  });

  it("rejects an unknown action rather than passing it through", () => {
    expect(parsePhotoIntakeCallbackData("photo-intake:delete-everything:intake-1")).toBeUndefined();
  });

  it("requires an intake id so a press cannot act on an unknown photo", () => {
    expect(() => buildPhotoIntakeCallbackData({ action: "archive", intakeId: "" })).toThrow(
      /requires an intakeId/,
    );
    expect(parsePhotoIntakeCallbackData("photo-intake:archive:")).toBeUndefined();
  });
});

describe("buildPhotoIntakeMenuSpec", () => {
  it("asks what to do and offers exactly the four actions", () => {
    const spec = menu();
    expect(spec.text).toContain("What would you like me to do with");
    const actionBlock = spec.blocks?.find((block) => block.type === "actions");
    expect(actionBlock?.type).toBe("actions");
    if (actionBlock?.type !== "actions") {
      return;
    }
    expect(actionBlock.buttons?.map((button) => button.label)).toEqual([
      "Archive",
      "Register Hardware",
      "Analyze Photo",
      "Extract Text",
    ]);
    expect(
      actionBlock.buttons?.map(
        (button) => parsePhotoIntakeCallbackData(button.callbackData)?.action,
      ),
    ).toEqual(["archive", "register-hardware", "analyze-photo", "extract-text"]);
  });

  it("states that the vision path is unrouted best-effort", () => {
    const spec = menu();
    const text = (spec.blocks ?? [])
      .map((block) => (block.type === "text" ? block.text : ""))
      .join(" ");
    expect(text).toContain("unrouted best-effort");
    expect(text).toContain("Athesus/athesus-vision-reasoning:latest");
  });

  it("reports OCR word count and confidence when OCR ran", () => {
    const text = (menu().blocks ?? [])
      .map((block) => (block.type === "text" ? block.text : ""))
      .join(" ");
    expect(text).toContain("3 word(s)");
    expect(text).toContain("60% mean confidence");
  });

  it("says plainly when OCR was unavailable instead of implying zero text", () => {
    const text = (
      menu({
        ocrAvailable: false,
        ocrWordCount: 0,
        ocrConfidence: undefined,
        ocrUnavailableReason: "tesseract not usable",
      }).blocks ?? []
    )
      .map((block) => (block.type === "text" ? block.text : ""))
      .join(" ");
    expect(text).toContain("unavailable");
    expect(text).toContain("tesseract not usable");
  });

  it("distinguishes no-text-found from OCR-unavailable", () => {
    const text = (menu({ ocrWordCount: 0, ocrConfidence: 0 }).blocks ?? [])
      .map((block) => (block.type === "text" ? block.text : ""))
      .join(" ");
    expect(text).toContain("No text was found");
  });

  it("requires an intake id", () => {
    expect(() => menu({ intakeId: "" })).toThrow(/requires an intakeId/);
  });
});
