/**
 * Fix Imports Command
 *
 * Scans MDX files for JSX component usage.
 * - Ignores Mintlify built-in components (no import needed)
 * - For custom components: validates existing import paths
 * - Adds missing imports when a matching file is found in the snippets/ folder
 * - Reports components with invalid import paths or no snippet file found
 */

import { existsSync, readdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { basename, dirname, extname, join, relative, resolve } from "path";
import chalk from "chalk";

const EXCLUDED_DIRS = ["node_modules", ".git"];

// Mintlify built-in components — no import required
export const MINTLIFY_COMPONENTS = new Set([
  "Note",
  "Warning",
  "Info",
  "Tip",
  "Danger",
  "Callout",
  "Card",
  "CardGroup",
  "CardBody",
  "Tabs",
  "Tab",
  "Steps",
  "Step",
  "Accordion",
  "AccordionGroup",
  "Frame",
  "Tooltip",
  "Check",
  "CodeGroup",
  "CodeBlock",
  "Icon",
  "Update",
  "ResponseField",
  "Expandable",
  "ParamField",
  "RequestExample",
  "ResponseExample",
  "Columns",
  "Badge",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (exported for tests)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract PascalCase JSX component names used in MDX content.
 * Skips fenced code blocks, inline code, and comments.
 */
export function extractComponentNames(content) {
  // Strip fenced code blocks
  let text = content.replace(/^[ \t]*(`{3,}|~{3,})[ \t]*[^\n]*\n[\s\S]*?\n[ \t]*\1[ \t]*$/gm, "");
  // Strip inline code
  text = text.replace(/`[^`\n]+`/g, "");
  // Strip JSX and HTML comments
  text = text.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/<!--[\s\S]*?-->/g, "");

  const components = new Set();
  const re = /<\/?([A-Z][a-zA-Z0-9]*)\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    components.add(m[1]);
  }
  return components;
}

/**
 * Extract import statements from MDX content.
 * Returns Map<localName, { path: string, raw: string }>.
 */
export function extractImports(content) {
  const imports = new Map();
  const re = /^(import\s+([\s\S]+?)\s+from\s+['"]([^'"]+)['"])/gm;
  let m;
  while ((m = re.exec(content)) !== null) {
    const raw = m[1];
    const importClause = m[2].trim();
    const path = m[3];

    // Named imports: { A, B as C }
    const namedMatch = importClause.match(/\{([^}]+)\}/);
    if (namedMatch) {
      for (const part of namedMatch[1].split(",")) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const localName = trimmed
          .split(/\s+as\s+/)
          .pop()
          .trim();
        if (localName) imports.set(localName, { path, raw });
      }
    }

    // Default import (part before comma or brace)
    const defaultPart = importClause.split(/[,{]/)[0].trim();
    if (defaultPart && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(defaultPart)) {
      imports.set(defaultPart, { path, raw });
    }
  }
  return imports;
}

/**
 * Resolve an import path to an absolute filesystem path.
 * Returns: absolute path string | null (not found) | "PACKAGE" (npm package).
 */
export function resolveImportPath(importPath, fileDir, repoRoot) {
  const extensions = [".mdx", ".jsx", ".tsx", ".js", ".ts"];

  if (importPath.startsWith(".")) {
    const base = resolve(fileDir, importPath);
    if (existsSync(base)) return base;
    for (const ext of extensions) {
      if (existsSync(base + ext)) return base + ext;
    }
    return null;
  }

  if (importPath.startsWith("/")) {
    const base = join(repoRoot, importPath);
    if (existsSync(base)) return base;
    for (const ext of extensions) {
      if (existsSync(base + ext)) return base + ext;
    }
    return null;
  }

  return "PACKAGE"; // npm package — not our concern
}

/**
 * Find a snippet file for a component name in the snippets directory.
 * Tries PascalCase, kebab-case, and lowercase variants recursively.
 * Returns absolute path or null.
 */
export function findSnippetFile(componentName, snippetsDir) {
  if (!existsSync(snippetsDir)) return null;

  const kebab = componentName.replace(/([A-Z])/g, (c, l, i) => (i > 0 ? "-" : "") + l.toLowerCase());
  const variants = new Set([componentName, kebab, componentName.toLowerCase()]);
  const extensions = new Set([".mdx", ".jsx", ".tsx", ".js", ".ts"]);

  function walk(dir) {
    try {
      for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          if (!EXCLUDED_DIRS.includes(entry)) {
            const found = walk(fullPath);
            if (found) return found;
          }
        } else {
          const nameNoExt = basename(entry, extname(entry));
          if (variants.has(nameNoExt) && extensions.has(extname(entry))) {
            return fullPath;
          }
        }
      }
    } catch {}
    return null;
  }

  return walk(snippetsDir);
}

/**
 * Build an import line for a snippet file.
 * MDX files → default import. JS/TS files → named import.
 */
export function buildImportLine(componentName, snippetAbsPath, repoRoot) {
  const ext = extname(snippetAbsPath);
  const relFromRoot = "/" + relative(repoRoot, snippetAbsPath).replace(/\\/g, "/");
  return ext === ".mdx"
    ? `import ${componentName} from "${relFromRoot}";`
    : `import { ${componentName} } from "${relFromRoot}";`;
}

/**
 * Insert import lines into content after frontmatter and after any existing imports.
 * Accepts an array so all missing imports are inserted in one pass.
 */
export function insertImportLines(content, importLines) {
  if (importLines.length === 0) return content;

  const fmMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  const startPos = fmMatch ? fmMatch[0].length : 0;
  const afterFm = content.slice(startPos);
  const lines = afterFm.split("\n");

  // Find the last line of the existing import block
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s/.test(lines[i])) {
      lastImportIdx = i;
    } else if (lastImportIdx >= 0 && lines[i].trim() !== "") {
      break;
    }
  }

  if (lastImportIdx >= 0) {
    // Append after existing import block
    lines.splice(lastImportIdx + 1, 0, ...importLines);
  } else if (fmMatch) {
    // No existing imports — insert with a blank line between frontmatter and imports
    lines.splice(0, 0, "", ...importLines);
  } else {
    // No frontmatter — insert at very top
    lines.splice(0, 0, ...importLines);
  }

  return content.slice(0, startPos) + lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// File discovery
// ─────────────────────────────────────────────────────────────────────────────

function findMdxFiles(repoRoot, directory, file, snippetsDir) {
  if (file) {
    const fullPath = resolve(repoRoot, file);
    return existsSync(fullPath) ? [fullPath] : [];
  }

  const searchDirs = directory ? [resolve(repoRoot, directory)] : [repoRoot];
  const mdxFiles = [];

  function walk(dir) {
    if (dir === snippetsDir) return; // skip the snippets folder itself
    const dirName = basename(dir);
    if (EXCLUDED_DIRS.includes(dirName)) return;

    try {
      for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (entry.endsWith(".mdx")) {
          mdxFiles.push(fullPath);
        }
      }
    } catch (err) {
      console.error(`Error reading directory ${dir}: ${err.message}`);
    }
  }

  for (const dir of searchDirs) {
    if (existsSync(dir)) walk(dir);
  }
  return mdxFiles.sort();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export async function fixImports(options) {
  const repoRoot = process.cwd();
  const snippetsDir = resolve(repoRoot, options.snippets || "snippets");

  if (!options.quiet) {
    console.log(chalk.bold("\n🧩  Component Import Checker\n"));
  }

  const files = findMdxFiles(repoRoot, options.dir, options.file, snippetsDir);

  if (files.length === 0) {
    console.error(chalk.red("✗ No MDX files found."));
    process.exit(1);
  }

  if (!options.quiet) {
    console.log(`Found ${files.length} MDX file(s) to check\n`);
    if (options.dryRun) {
      console.log(chalk.yellow("Dry run — no files will be written\n"));
    }
  }

  let totalAdded = 0;
  let totalInvalid = 0;
  let totalNotFound = 0;

  for (const filePath of files) {
    const relPath = relative(repoRoot, filePath);
    const fileDir = dirname(filePath);
    const content = readFileSync(filePath, "utf-8");

    const components = extractComponentNames(content);
    const imports = extractImports(content);

    const customComponents = [...components].filter((c) => !MINTLIFY_COMPONENTS.has(c)).sort();

    if (customComponents.length === 0) continue;

    const issues = [];
    const importLinesToAdd = [];

    for (const component of customComponents) {
      const imp = imports.get(component);

      if (imp) {
        const resolved = resolveImportPath(imp.path, fileDir, repoRoot);
        if (resolved === "PACKAGE") continue;
        if (resolved === null) {
          issues.push({ component, type: "invalid", importPath: imp.path });
          totalInvalid++;
        }
        // else: valid local import — OK
      } else {
        const snippetFile = findSnippetFile(component, snippetsDir);
        if (snippetFile) {
          const importLine = buildImportLine(component, snippetFile, repoRoot);
          issues.push({ component, type: "missing", importLine, snippetRel: relative(repoRoot, snippetFile) });
          importLinesToAdd.push(importLine);
          totalAdded++;
        } else {
          issues.push({ component, type: "notfound" });
          totalNotFound++;
        }
      }
    }

    if (issues.length === 0) continue;

    if (!options.quiet) {
      console.log(chalk.cyan(relPath));
      for (const issue of issues) {
        if (issue.type === "invalid") {
          console.log(
            `  ${chalk.red("✗")} ${chalk.bold(issue.component)} — import path not found: ${issue.importPath}`,
          );
        } else if (issue.type === "missing") {
          const verb = options.dryRun ? "would add" : "added";
          console.log(`  ${chalk.green("+")} ${chalk.bold(issue.component)} — ${verb} import from ${issue.snippetRel}`);
        } else {
          const snippetsName = relative(repoRoot, snippetsDir) || "snippets";
          console.log(`  ${chalk.yellow("⚠")} ${chalk.bold(issue.component)} — no snippet found in ${snippetsName}/`);
        }
      }
      console.log();
    }

    if (importLinesToAdd.length > 0 && !options.dryRun) {
      const updated = insertImportLines(content, importLinesToAdd);
      writeFileSync(filePath, updated, "utf-8");
    }
  }

  // Summary
  if (!options.quiet) {
    if (totalAdded === 0 && totalInvalid === 0 && totalNotFound === 0) {
      console.log(chalk.green("✓ All component imports are valid."));
    } else {
      if (totalAdded > 0) {
        const verb = options.dryRun ? "Would add" : "Added";
        console.log(chalk.green(`✓ ${verb} ${totalAdded} missing import(s)`));
      }
      if (totalInvalid > 0) {
        console.log(chalk.red(`✗ ${totalInvalid} import(s) point to non-existent files`));
      }
      if (totalNotFound > 0) {
        console.log(
          chalk.yellow(
            `⚠  ${totalNotFound} component(s) have no snippet file in ${relative(repoRoot, snippetsDir) || "snippets"}/`,
          ),
        );
      }
    }
  }

  if (totalInvalid > 0 || totalNotFound > 0) {
    process.exit(1);
  }
}
