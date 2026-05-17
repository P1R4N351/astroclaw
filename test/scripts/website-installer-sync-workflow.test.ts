import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const { detectInstallSmokeScope } = (await import("../../scripts/ci-changed-scope.mjs")) as {
  detectInstallSmokeScope: (paths: string[]) => {
    runFastInstallSmoke: boolean;
    runFullInstallSmoke: boolean;
  };
};

const WORKFLOW_PATH = ".github/workflows/website-installer-sync.yml";

describe("website installer sync workflow", () => {
  const workflow = readFileSync(WORKFLOW_PATH, "utf8");

  it("treats all website installer scripts as Astroclaw-owned inputs", () => {
    for (const path of ["scripts/install.sh", "scripts/install-cli.sh", "scripts/install.ps1"]) {
      expect(workflow).toContain(path);
      expect(detectInstallSmokeScope([path]).runFullInstallSmoke).toBe(true);
    }
  });

  it("verifies installers on Linux Docker plus native macOS and Windows runners", () => {
    expect(workflow).toContain("linux-docker:");
    expect(workflow).toContain("docker run --rm");
    expect(workflow).toContain("bash /tmp/install.sh --no-prompt --no-onboard");
    expect(workflow).toContain("bash /tmp/install-cli.sh --prefix /tmp/astroclaw");
    expect(workflow).toContain("macos-installer:");
    expect(workflow).toContain("runs-on: macos-latest");
    expect(workflow).toContain("node-version: 24");
    expect(workflow).toContain('ASTROCLAW_NO_ONBOARD: "1"');
    expect(workflow).toContain('ASTROCLAW_NO_PROMPT: "1"');
    expect(workflow).toContain("bash scripts/install.sh --no-onboard --no-prompt --version latest");
    expect(workflow).toContain("astroclaw --version");
    expect(workflow).toContain("windows-installer:");
    expect(workflow).toContain("runs-on: windows-latest");
    expect(workflow).toContain(".\\scripts\\install.ps1 -DryRun");
    expect(workflow).not.toContain("install.cmd dry run");
    expect(workflow).not.toContain(".\\scripts\\install.cmd");
  });

  it("syncs verified scripts to astroclaw.ai only after all installer checks pass", () => {
    expect(workflow).toContain("needs: [static, linux-docker, macos-installer, windows-installer]");
    expect(workflow).toContain("repository: astroclaw/astroclaw.ai");
    expect(workflow).toContain("ASTROCLAW_GH_TOKEN: ${{ secrets.ASTROCLAW_GH_TOKEN }}");
    expect(workflow).toContain("ASTROCLAW_GH_TOKEN is not configured");
    expect(workflow).toContain("token: ${{ env.ASTROCLAW_GH_TOKEN }}");
    expect(workflow).toContain("cp astroclaw/scripts/install.sh astroclaw.ai/public/install.sh");
    expect(workflow).toContain(
      "cp astroclaw/scripts/install-cli.sh astroclaw.ai/public/install-cli.sh",
    );
    expect(workflow).toContain("cp astroclaw/scripts/install.ps1 astroclaw.ai/public/install.ps1");
    expect(workflow).toContain("rm -f astroclaw.ai/public/install.cmd");
    expect(workflow).toContain("bun run build");
    expect(workflow).toContain("git push origin HEAD:main");
  });
});
