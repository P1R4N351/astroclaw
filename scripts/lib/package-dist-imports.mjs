// Scans packaged dist JavaScript for relative imports and missing closure entries.
import { createRequire } from "node:module";
import path from "node:path";
import { visitModuleSpecifiers } from "./guard-inventory-utils.mjs";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const JS_DIST_FILE_RE = /^dist\/.*\.(?:cjs|js|mjs)$/u;

function normalizePackagePath(value) {
  return value.replace(/\\/gu, "/").replace(/^package\//u, "");
}

function stripSpecifierSuffix(value) {
  return value.replace(/[?#].*$/u, "");
}

function hasJavaScriptFileExtension(value) {
  return /\.(?:cjs|js|mjs)$/u.test(path.posix.basename(stripSpecifierSuffix(value)));
}

function resolveDistImportPath(importerPath, specifier) {
  if (!specifier.startsWith(".")) {
    return null;
  }
  const stripped = stripSpecifierSuffix(specifier);
  if (!stripped) {
    return null;
  }
  return path.posix.normalize(path.posix.join(path.posix.dirname(importerPath), stripped));
}

function collectImportSpecifiers(source, importerPath) {
  const specifiers = [];
  const sourceFile = ts.createSourceFile(
    importerPath,
    source,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.JS,
  );
  visitModuleSpecifiers(
    ts,
    sourceFile,
    ({ kind, specifier }) => {
      if (
        specifier.startsWith(".") &&
        (kind !== "import-meta-url" ||
          (hasJavaScriptFileExtension(specifier) &&
            resolveDistImportPath(importerPath, specifier)?.startsWith("dist/")))
      ) {
        specifiers.push(specifier);
      }
    },
    { includeCommonJs: true, includeImportMetaUrl: true },
  );
  return specifiers;
}

/** Collect missing-file errors for relative imports inside package dist files. */
export function collectPackageDistImportErrors(params) {
  const files = [...new Set(params.files.map(normalizePackagePath))];
  const fileSet = new Set(files);
  const errors = [];
  const imports = params.imports ?? collectPackageDistImports({ files, readText: params.readText });

  for (const { importerPath, importedPath } of imports) {
    if (!fileSet.has(importedPath)) {
      errors.push(`${importerPath} imports missing ${importedPath}`);
    }
  }

  return errors;
}

/** Collect relative dist import edges from package JavaScript files. */
export function collectPackageDistImports(params) {
  const files = [...new Set(params.files.map(normalizePackagePath))];
  const imports = [];

  for (const importerPath of files.toSorted((left, right) => left.localeCompare(right))) {
    if (!JS_DIST_FILE_RE.test(importerPath) || importerPath.includes("/node_modules/")) {
      continue;
    }
    const source = params.readText(importerPath);
    for (const specifier of collectImportSpecifiers(source, importerPath)) {
      const importedPath = resolveDistImportPath(importerPath, specifier);
      if (!importedPath) {
        continue;
      }
      imports.push({ importerPath, importedPath });
    }
  }

  return imports;
}

/**
 * Expand a seed set of dist files to the transitive closure of everything they
 * (recursively) import via relative specifiers. Used to decide which installed
 * dist files are actually reachable from a declared inventory/entry set, so
 * callers can flag files the inventory omits (check-astroclaw-package-tarball.mjs)
 * or avoid pruning files a declared entry still needs (postinstall-bundled-plugins.mjs).
 */
export function expandPackageDistImportClosure(params) {
  const files = [...new Set(params.files.map(normalizePackagePath))];
  const fileSet = new Set(files);
  const imports = params.imports ?? collectPackageDistImports({ files, readText: params.readText });

  const importedPathsByImporter = new Map();
  for (const { importerPath, importedPath } of imports) {
    let importedPaths = importedPathsByImporter.get(importerPath);
    if (!importedPaths) {
      importedPaths = [];
      importedPathsByImporter.set(importerPath, importedPaths);
    }
    importedPaths.push(importedPath);
  }

  const closure = new Set();
  const queue = (params.seedFiles ?? []).map(normalizePackagePath);
  while (queue.length > 0) {
    const current = queue.shift();
    if (closure.has(current)) {
      continue;
    }
    closure.add(current);
    for (const importedPath of importedPathsByImporter.get(current) ?? []) {
      if (fileSet.has(importedPath) && !closure.has(importedPath)) {
        queue.push(importedPath);
      }
    }
  }

  return [...closure];
}
