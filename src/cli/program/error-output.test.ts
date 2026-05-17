import { describe, expect, it } from "vitest";
import { formatCliParseErrorOutput } from "./error-output.js";

describe("formatCliParseErrorOutput", () => {
  it("explains unknown commands with root help and plugin hints", () => {
    const output = formatCliParseErrorOutput("error: unknown command 'wat'\n", {
      argv: ["node", "astroclaw", "wat"],
    });

    expect(output).toBe(
      'Astroclaw does not know the command "wat".\nTry: astroclaw --help\nPlugin command? astroclaw plugins list\nDocs: https://docs.astroclaw.ai/cli\n',
    );
  });

  it("points unknown options at the active command help", () => {
    const output = formatCliParseErrorOutput("error: unknown option '--wat'\n", {
      argv: ["node", "astroclaw", "channels", "status", "--wat"],
    });

    expect(output).toBe(
      'Astroclaw does not recognize option "--wat".\nTry: astroclaw channels status --help\n',
    );
  });

  it("points missing required arguments at command help", () => {
    const output = formatCliParseErrorOutput("error: missing required argument 'name'\n", {
      argv: ["node", "astroclaw", "plugins", "install"],
    });

    expect(output).toBe(
      'Missing required argument "name".\nTry: astroclaw plugins install --help\n',
    );
  });
});
