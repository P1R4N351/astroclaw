// Discord tests cover photo intake plugin behavior.
import { describe, expect, it, vi } from "vitest";
import {
  isPhotoIntakeCandidate,
  prepareDiscordPhotoIntake,
  type PhotoIntakeContext,
  type PhotoIntakeContextStore,
} from "./photo-intake.js";
import { parsePhotoIntakeCallbackData } from "./photo-intake.menu.js";
import type { OcrCommandRunner } from "./photo-intake.ocr.js";

const TSV_HEADER =
  "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext";

const OCR_TSV = [
  TSV_HEADER,
  "5\t1\t1\t1\t1\t1\t0\t0\t1\t1\t65.420654\tACME",
  "5\t1\t1\t1\t1\t2\t0\t0\t1\t1\t41.518227\tNetSwiteh",
].join("\n");

function okRunner(tsv = OCR_TSV): OcrCommandRunner {
  return async (_binary, args) =>
    args.includes("--version") ? { stdout: "tesseract 5.5.0" } : { stdout: tsv };
}

function memoryStore(): PhotoIntakeContextStore & { saved: PhotoIntakeContext[] } {
  const saved: PhotoIntakeContext[] = [];
  return {
    saved,
    save: async (context) => {
      saved.push(context);
    },
    load: async (intakeId) => saved.find((entry) => entry.intakeId === intakeId),
  };
}

const MESSAGE = {
  guildId: "222",
  channelId: "333",
  messageId: "444",
  authorId: "555",
};

function attachment(overrides: Record<string, unknown> = {}) {
  return {
    attachmentId: "111",
    fileName: "switch.png",
    contentType: "image/png",
    byteSize: 3,
    localPath: "/tmp/switch.png",
    ...overrides,
  };
}

describe("isPhotoIntakeCandidate", () => {
  it("accepts image content types", () => {
    expect(isPhotoIntakeCandidate(attachment())).toBe(true);
    expect(isPhotoIntakeCandidate(attachment({ contentType: "IMAGE/JPEG" }))).toBe(true);
  });

  it("falls back to the file extension when the content type is unhelpful", () => {
    expect(
      isPhotoIntakeCandidate(
        attachment({ contentType: "application/octet-stream", fileName: "rack.HEIC" }),
      ),
    ).toBe(true);
  });

  it("rejects non-images", () => {
    expect(
      isPhotoIntakeCandidate(
        attachment({ contentType: "application/pdf", fileName: "manual.pdf" }),
      ),
    ).toBe(false);
  });
});

describe("prepareDiscordPhotoIntake", () => {
  const bytes = new TextEncoder().encode("abc");

  it("captures full Discord provenance and the content hash", async () => {
    const store = memoryStore();
    const prepared = await prepareDiscordPhotoIntake({
      attachment: attachment(),
      message: MESSAGE,
      bytes,
      store,
      observedAt: "2026-08-29T00:00:00.000Z",
      runOcrCommand: okRunner(),
    });

    expect(prepared.context.sourceRef).toEqual({
      provider: "discord",
      attachmentId: "111",
      guildId: "222",
      channelId: "333",
      messageId: "444",
      authorId: "555",
      fileName: "switch.png",
      contentType: "image/png",
      byteSize: 3,
      observedAt: "2026-08-29T00:00:00.000Z",
    });
    // sha256("abc"), cross-checked with `printf 'abc' | sha256sum`.
    expect(prepared.context.contentHash.value).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("runs OCR eagerly and stores it as a derived artifact", async () => {
    const store = memoryStore();
    const prepared = await prepareDiscordPhotoIntake({
      attachment: attachment(),
      message: MESSAGE,
      bytes,
      store,
      runOcrCommand: okRunner(),
    });
    expect(prepared.ocr.status).toBe("ok");
    expect(prepared.context.derived).toHaveLength(1);
    expect(prepared.context.derived[0]?.kind).toBe("ocr-text");
    expect(prepared.context.derived[0]?.value).toBe("ACME NetSwiteh");
    expect(prepared.context.derived[0]?.provenance.engine).toBe("tesseract");
  });

  it("does NOT call vision during preparation", async () => {
    // The eager/lazy split is the point: preparing an intake must never pay the
    // ~112s vision cost. Preparation has no vision seam at all, and this pins
    // that no network call can occur by asserting fetch is untouched.
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const store = memoryStore();
    await prepareDiscordPhotoIntake({
      attachment: attachment(),
      message: MESSAGE,
      bytes,
      store,
      runOcrCommand: okRunner(),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("persists the context so a later button press can resolve it", async () => {
    const store = memoryStore();
    const prepared = await prepareDiscordPhotoIntake({
      attachment: attachment(),
      message: MESSAGE,
      bytes,
      store,
      runOcrCommand: okRunner(),
    });
    expect(store.saved).toHaveLength(1);
    await expect(store.load(prepared.context.intakeId)).resolves.toMatchObject({
      intakeId: prepared.context.intakeId,
    });
  });

  it("binds every menu button to this intake id", async () => {
    const store = memoryStore();
    const prepared = await prepareDiscordPhotoIntake({
      attachment: attachment(),
      message: MESSAGE,
      bytes,
      store,
      runOcrCommand: okRunner(),
    });
    const actions = prepared.menu.blocks?.find((block) => block.type === "actions");
    if (actions?.type !== "actions") {
      throw new Error("expected an actions block");
    }
    for (const button of actions.buttons ?? []) {
      expect(parsePhotoIntakeCallbackData(button.callbackData)?.intakeId).toBe(
        prepared.context.intakeId,
      );
    }
  });

  it("still produces a menu when OCR is unavailable", async () => {
    const store = memoryStore();
    const prepared = await prepareDiscordPhotoIntake({
      attachment: attachment(),
      message: MESSAGE,
      bytes,
      store,
      runOcrCommand: async () => {
        throw new Error("ENOENT");
      },
    });
    expect(prepared.ocr.status).toBe("unavailable");
    expect(prepared.context.derived).toHaveLength(0);
    expect(prepared.menu.blocks?.length).toBeGreaterThan(0);
  });

  it("reports OCR as unavailable when the attachment was never saved locally", async () => {
    const store = memoryStore();
    const prepared = await prepareDiscordPhotoIntake({
      attachment: attachment({ localPath: undefined }),
      message: MESSAGE,
      bytes,
      store,
      runOcrCommand: okRunner(),
    });
    expect(prepared.ocr.status).toBe("unavailable");
  });

  it("gives the same intake id for the same photo and a different one for different bytes", async () => {
    const store = memoryStore();
    const run = async (payload: string) =>
      (
        await prepareDiscordPhotoIntake({
          attachment: attachment(),
          message: MESSAGE,
          bytes: new TextEncoder().encode(payload),
          store,
          runOcrCommand: okRunner(),
        })
      ).context.intakeId;
    expect(await run("abc")).toBe(await run("abc"));
    expect(await run("abc")).not.toBe(await run("xyz"));
  });
});
