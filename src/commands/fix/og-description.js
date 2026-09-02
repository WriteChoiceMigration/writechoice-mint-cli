/**
 * Fix OG Description Tool
 *
 * Renames the frontmatter `description` key to `og:description`, keeping
 * its original position in the frontmatter block. If `og:description`
 * already exists too, the pre-existing one is dropped and `description`'s
 * value wins (a warning is logged for that case).
 *
 * Frontmatter is parsed line-by-line rather than with a full YAML parser
 * (matching this repo's existing frontmatter-handling convention) — a
 * top-level key is a line starting at column 0 with `key:` or `key: value`;
 * any following indented/continuation lines belong to that same entry, so
 * multi-line values (block scalars, nested lists) move with their key.
 */

import { existsSync, readdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { join, relative, resolve } from "path";
import chalk from "chalk";

const EXCLUDED_DIRS = ["node_modules", ".git"];

// ─────────────────────────────────────────────────────────────────────────────
// Frontmatter helpers
// ─────────────────────────────────────────────────────────────────────────────

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
// A top-level key line starts at column 0; the key itself may contain a
// colon (e.g. "og:description") as long as the actual separator colon is
// followed by whitespace or end-of-line.
const FM_KEY_LINE_RE = /^(\S[^\n]*?):(?:\s|$)/;

function parseFrontmatterEntries(fmBody) {
  const lines = fmBody.split("\n");
  const entries = [];
  for (const line of lines) {
    const m = FM_KEY_LINE_RE.exec(line);
    if (m) {
      entries.push({ key: m[1], lines: [line] });
    } else if (entries.length) {
      entries[entries.length - 1].lines.push(line);
    } else {
      entries.push({ key: null, lines: [line] });
    }
  }
  return entries;
}

/**
 * Renames a `description` frontmatter key to `og:description`.
 * Returns { content, changed, overwroteExisting }.
 */
export function renameDescriptionToOgDescription(content) {
  const fmMatch = FRONTMATTER_RE.exec(content);
  if (!fmMatch) return { content, changed: false, overwroteExisting: false };

  const entries = parseFrontmatterEntries(fmMatch[1]);
  const descEntry = entries.find((e) => e.key === "description");
  if (!descEntry) return { content, changed: false, overwroteExisting: false };

  const ogEntry = entries.find((e) => e.key === "og:description");
  const overwroteExisting = Boolean(ogEntry);
  const finalEntries = overwroteExisting ? entries.filter((e) => e !== ogEntry) : entries;

  descEntry.lines[0] = descEntry.lines[0].replace(/^description:/, "og:description:");

  const newFmBody = finalEntries.map((e) => e.lines.join("\n")).join("\n");
  const newBlock = fmMatch[0].replace(fmMatch[1], newFmBody);
  const newContent = content.slice(0, fmMatch.index) + newBlock + content.slice(fmMatch.index + fmMatch[0].length);

  return { content: newContent, changed: true, overwroteExisting };
}

// ─────────────────────────────────────────────────────────────────────────────
// File discovery
// ─────────────────────────────────────────────────────────────────────────────

function findMdxFiles(repoRoot, directory = null, file = null) {
  if (file) {
    const fullPath = resolve(repoRoot, file);
    return existsSync(fullPath) ? [fullPath] : [];
  }

  const searchDirs = directory ? [resolve(repoRoot, directory)] : [repoRoot];
  const mdxFiles = [];

  function walk(dir) {
    const name = dir.split("/").pop();
    if (EXCLUDED_DIRS.includes(name)) return;
    try {
      for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) walk(fullPath);
        else if (entry.endsWith(".mdx")) mdxFiles.push(fullPath);
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

export async function fixOgDescription(options) {
  const repoRoot = process.cwd();

  if (!options.quiet) {
    console.log(chalk.bold("\n# description → og:description\n"));
  }

  const files = findMdxFiles(repoRoot, options.dir, options.file);

  if (files.length === 0) {
    console.error(chalk.red("✗ No MDX files found."));
    process.exit(1);
  }

  if (!options.quiet) {
    console.log(`Found ${files.length} MDX file(s) to process\n`);
    if (options.dryRun) console.log(chalk.yellow("Dry run — no files will be written\n"));
  }

  const changed = [];

  for (const filePath of files) {
    const content = readFileSync(filePath, "utf-8");
    const { content: newContent, changed: didChange, overwroteExisting } = renameDescriptionToOgDescription(content);

    if (didChange) {
      const relPath = relative(repoRoot, filePath);
      changed.push(relPath);

      if (overwroteExisting) {
        console.warn(chalk.yellow(`  ! ${relPath} already has og:description — overwriting with description's value`));
      }

      if (options.verbose) {
        console.log(`${chalk.cyan(relPath)}: renamed description → og:description`);
      }

      if (!options.dryRun) {
        writeFileSync(filePath, newContent, "utf-8");
      }
    }
  }

  if (!options.quiet) {
    if (changed.length > 0) {
      const verb = options.dryRun ? "Would rename" : "Renamed";
      console.log(chalk.green(`\n✓ ${verb} description → og:description in ${changed.length} file(s)`));
      if (!options.verbose) {
        for (const relPath of changed) {
          console.log(`  ${chalk.cyan(relPath)}`);
        }
      }
    } else {
      console.log(chalk.yellow("⚠️  No frontmatter description field found."));
    }
  }
}
