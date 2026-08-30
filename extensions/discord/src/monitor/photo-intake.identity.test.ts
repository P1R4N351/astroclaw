// Discord tests cover photo intake identity plugin behavior.
import { describe, expect, it } from "vitest";
import {
  buildPhotoIntakeIdempotencyKey,
  derivePhotoIntakeId,
  hashPhotoBytes,
} from "./photo-intake.identity.js";
import type { PhotoIntakeSourceRef } from "./photo-intake.types.js";

function sourceRef(overrides: Partial<PhotoIntakeSourceRef> = {}): PhotoIntakeSourceRef {
  return {
    provider: "discord",
    attachmentId: "111",
    guildId: "222",
    channelId: "333",
    messageId: "444",
    authorId: "555",
    byteSize: 4,
    observedAt: "2026-08-29T00:00:00.000Z",
    ...overrides,
  };
}

describe("hashPhotoBytes", () => {
  it("produces the known sha256 of the bytes", () => {
    // Executed cross-check: `printf 'abc' | sha256sum`.
    expect(hashPhotoBytes(new TextEncoder().encode("abc"))).toEqual({
      algo: "sha256",
      value: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    });
  });

  it("rejects non-byte input", () => {
    expect(() => hashPhotoBytes("abc" as unknown as Uint8Array)).toThrow(TypeError);
  });
});

describe("buildPhotoIntakeIdempotencyKey", () => {
  it("normalizes a missing guild id to the empty string for direct messages", () => {
    const key = buildPhotoIntakeIdempotencyKey({
      sourceRef: sourceRef({ guildId: undefined }),
      contentHash: { algo: "sha256", value: "deadbeef" },
    });
    expect(key.guildId).toBe("");
    expect(key.contentSha256).toBe("deadbeef");
  });

  it("refuses to build a key without the identifying coordinates", () => {
    expect(() =>
      buildPhotoIntakeIdempotencyKey({
        sourceRef: sourceRef({ messageId: "" }),
        contentHash: { algo: "sha256", value: "deadbeef" },
      }),
    ).toThrow(/idempotency key requires/);
  });
});

describe("derivePhotoIntakeId", () => {
  it("is stable for the same coordinates and content", () => {
    const build = () =>
      derivePhotoIntakeId(
        buildPhotoIntakeIdempotencyKey({
          sourceRef: sourceRef(),
          contentHash: { algo: "sha256", value: "cafe" },
        }),
      );
    expect(build()).toBe(build());
  });

  it("changes when the content changes but the coordinates do not", () => {
    const first = derivePhotoIntakeId(
      buildPhotoIntakeIdempotencyKey({
        sourceRef: sourceRef(),
        contentHash: { algo: "sha256", value: "cafe" },
      }),
    );
    const second = derivePhotoIntakeId(
      buildPhotoIntakeIdempotencyKey({
        sourceRef: sourceRef(),
        contentHash: { algo: "sha256", value: "f00d" },
      }),
    );
    expect(first).not.toBe(second);
  });

  it("does not collide when a field boundary shifts between adjacent fields", () => {
    // Without a separator that cannot occur in the values, ("1","23") and
    // ("12","3") would hash identically. This pins that they do not.
    const shiftedLeft = derivePhotoIntakeId({
      attachmentId: "1",
      guildId: "23",
      channelId: "c",
      messageId: "m",
      contentSha256: "h",
    });
    const shiftedRight = derivePhotoIntakeId({
      attachmentId: "12",
      guildId: "3",
      channelId: "c",
      messageId: "m",
      contentSha256: "h",
    });
    expect(shiftedLeft).not.toBe(shiftedRight);
  });
});
