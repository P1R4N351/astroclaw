import fs from "node:fs";
import path from "node:path";
import { resolveAstroclawPackageRoot } from "../infra/astroclaw-root.js";

export const ASTROCLAW_DOCS_URL = "https://docs.astroclaw.ai";
export const ASTROCLAW_SOURCE_URL = "https://github.com/astroclaw/astroclaw";

type ResolveAstroclawReferencePathParams = {
  workspaceDir?: string;
  argv1?: string;
  cwd?: string;
  moduleUrl?: string;
};

function isUsableDocsDir(docsDir: string): boolean {
  return fs.existsSync(path.join(docsDir, "docs.json"));
}

function isGitCheckout(rootDir: string): boolean {
  return fs.existsSync(path.join(rootDir, ".git"));
}

export async function resolveAstroclawDocsPath(params: {
  workspaceDir?: string;
  argv1?: string;
  cwd?: string;
  moduleUrl?: string;
}): Promise<string | null> {
  const workspaceDir = params.workspaceDir?.trim();
  if (workspaceDir) {
    const workspaceDocs = path.join(workspaceDir, "docs");
    if (isUsableDocsDir(workspaceDocs)) {
      return workspaceDocs;
    }
  }

  const packageRoot = await resolveAstroclawPackageRoot({
    cwd: params.cwd,
    argv1: params.argv1,
    moduleUrl: params.moduleUrl,
  });
  if (!packageRoot) {
    return null;
  }

  const packageDocs = path.join(packageRoot, "docs");
  return isUsableDocsDir(packageDocs) ? packageDocs : null;
}

export async function resolveAstroclawSourcePath(
  params: ResolveAstroclawReferencePathParams,
): Promise<string | null> {
  const packageRoot = await resolveAstroclawPackageRoot({
    cwd: params.cwd,
    argv1: params.argv1,
    moduleUrl: params.moduleUrl,
  });
  if (!packageRoot || !isGitCheckout(packageRoot)) {
    return null;
  }
  return packageRoot;
}

export async function resolveAstroclawReferencePaths(
  params: ResolveAstroclawReferencePathParams,
): Promise<{
  docsPath: string | null;
  sourcePath: string | null;
}> {
  const [docsPath, sourcePath] = await Promise.all([
    resolveAstroclawDocsPath(params),
    resolveAstroclawSourcePath(params),
  ]);
  return { docsPath, sourcePath };
}
