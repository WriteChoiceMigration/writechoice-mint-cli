/**
 * Fix Dollar Signs Tool
 *
 * Escapes a bare `$` immediately before a digit in prose (e.g. `$60` ->
 * `\$60`), which some downstream renderers otherwise treat as the start of
 * KaTeX/LaTeX math. Fenced code blocks (``` or ~~~) and inline `code spans`
 * are left untouched, since a `$` there is code/shell syntax, not a price.
 *
 * LaTeX-awareness: a `$...$` (or `$$...$$`) span whose content contains a
 * LaTeX marker (`\`, `^`, `_`, `{`, or `}`) is treated as real math and left
 * untouched even if it starts with a digit (e.g. `$5 \times 10^{3}$`). This
 * is a heuristic, not a LaTeX parser — matching this repo's convention of
 * pure string transforms without full AST parsing — so it can be fooled by
 * unusual input, but correctly avoids the common false-negative trap of
 * treating every `$...$` pair as protected (e.g. "$60 or $70" contains no
 * LaTeX markers between its two `$`, so both amounts still get escaped).
 */

import { existsSync, readdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { join, relative, resolve } from "path";
import chalk from "chalk";

const EXCLUDED_DIRS = ["node_modules", ".git"];

// ─────────────────────────────────────────────────────────────────────────────
// Escaping logic
// ─────────────────────────────────────────────────────────────────────────────

const FENCE_RE = /^\s*(`{3,}|~{3,})/;
const INLINE_CODE_RE = /(`+)(?:(?!\1).)*?\1/g;
const LATEX_SPAN_RE = /\$([^$\n]*[\\^_{}][^$\n]*)\$/g;
const DOLLAR_RE = /(?<!\\)\$(?=\d)/g;

function escapeBareDollars(text) {
  let count = 0;
  const result = text.replace(DOLLAR_RE, () => {
    count++;
    return "\\$";
  });
  return { text: result, count };
}

// Escapes bare `$digit` outside of any `$...$`/`$$...$$` LaTeX-looking span.
function escapeOutsideLatex(text) {
  let count = 0;
  const parts = [];
  let lastIndex = 0;
  LATEX_SPAN_RE.lastIndex = 0;
  let m;
  while ((m = LATEX_SPAN_RE.exec(text)) !== null) {
    const before = text.slice(lastIndex, m.index);
    const { text: fixed, count: c } = escapeBareDollars(before);
    parts.push(fixed, m[0]);
    count += c;
    lastIndex = m.index + m[0].length;
  }
  const { text: fixed, count: c } = escapeBareDollars(text.slice(lastIndex));
  parts.push(fixed);
  count += c;
  return { text: parts.join(""), count };
}

// Escapes bare `$digit` in a line, skipping inline `code spans`.
function escapeLine(line) {
  let count = 0;
  const parts = [];
  let lastIndex = 0;
  INLINE_CODE_RE.lastIndex = 0;
  let m;
  while ((m = INLINE_CODE_RE.exec(line)) !== null) {
    const before = line.slice(lastIndex, m.index);
    const { text: fixed, count: c } = escapeOutsideLatex(before);
    parts.push(fixed, m[0]);
    count += c;
    lastIndex = m.index + m[0].length;
  }
  const { text: fixed, count: c } = escapeOutsideLatex(line.slice(lastIndex));
  parts.push(fixed);
  count += c;
  return { line: parts.join(""), count };
}

/**
 * Escapes bare `$digit` occurrences in `content`, skipping fenced code
 * blocks, inline code spans, and LaTeX-looking `$...$` spans.
 * Returns { content, count }.
 */
export function escapeDollarSigns(content) {
  const lines = content.split("\n");
  const out = [];
  let inFence = false;
  let fenceChar = null;
  let count = 0;

  for (const line of lines) {
    const fenceMatch = FENCE_RE.exec(line);
    if (fenceMatch) {
      const char = fenceMatch[1][0];
      if (!inFence) {
        inFence = true;
        fenceChar = char;
      } else if (char === fenceChar) {
        inFence = false;
        fenceChar = null;
      }
      out.push(line);
      continue;
    }

    if (inFence) {
      out.push(line);
      continue;
    }

    const { line: newLine, count: c } = escapeLine(line);
    count += c;
    out.push(newLine);
  }

  return { content: out.join("\n"), count };
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

export async function fixDollarSigns(options) {
  const repoRoot = process.cwd();

  if (!options.quiet) {
    console.log(chalk.bold("\n# Escape Dollar Signs\n"));
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
    if (!content.includes("$")) continue;

    const { content: newContent, count } = escapeDollarSigns(content);

    if (count > 0) {
      const relPath = relative(repoRoot, filePath);
      changed.push({ relPath, count });

      if (options.verbose) {
        console.log(`${chalk.cyan(relPath)}: escaped ${count} $ sign(s)`);
      }

      if (!options.dryRun) {
        writeFileSync(filePath, newContent, "utf-8");
      }
    }
  }

  if (!options.quiet) {
    if (changed.length > 0) {
      const verb = options.dryRun ? "Would escape" : "Escaped";
      const totalCount = changed.reduce((s, f) => s + f.count, 0);
      console.log(chalk.green(`\n✓ ${verb} ${totalCount} $ sign(s) across ${changed.length} file(s)`));
      if (!options.verbose) {
        for (const { relPath, count } of changed) {
          console.log(`  ${chalk.cyan(relPath)} (${count})`);
        }
      }
    } else {
      console.log(chalk.yellow("⚠️  No bare $ before a digit found."));
    }
  }
}
