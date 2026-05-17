import { describe, expect, it } from "vitest";
import { shortenText } from "./text-format.js";

describe("shortenText", () => {
  it("returns original text when it fits", () => {
    expect(shortenText("astroclaw", 16)).toBe("astroclaw");
  });

  it("truncates and appends ellipsis when over limit", () => {
    expect(shortenText("astroclaw-status-output", 10)).toBe("astroclaw-…");
  });

  it("counts multi-byte characters correctly", () => {
    expect(shortenText("hello🙂world", 7)).toBe("hello🙂…");
  });
});
