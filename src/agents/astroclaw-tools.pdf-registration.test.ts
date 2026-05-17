import { describe, expect, it } from "vitest";
import { collectPresentAstroclawTools } from "./astroclaw-tools.registration.js";
import { createPdfTool } from "./tools/pdf-tool.js";

describe("createAstroclawTools PDF registration", () => {
  it("includes the pdf tool when the pdf factory returns a tool", () => {
    const pdfTool = createPdfTool({
      agentDir: "/tmp/astroclaw-agent-main",
      config: {
        agents: {
          defaults: {
            pdfModel: { primary: "openai/gpt-5.4-mini" },
          },
        },
      },
    });

    expect(pdfTool?.name).toBe("pdf");
    expect(collectPresentAstroclawTools([pdfTool]).map((tool) => tool.name)).toEqual(["pdf"]);
  });
});
