/**
 * Fix H1 Tool
 *
 * Removes duplicate H1 headings that match the frontmatter title field.
 *
 * If the first non-empty line after frontmatter is an H1 exactly equal
 * to the frontmatter `title`, that line (and the immediately following
 * blank line, if any) is removed.
 *
 * This mirrors the behaviour of remove_double_titles.py.
 */

import { existsSync, readdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { join, relative, resolve } from "path";
import chalk from "chalk";

const EXCLUDED_DIRS = ["node_modules", ".git"];

// ─────────────────────────────────────────────────────────────────────────────
// Frontmatter helpers
// ─────────────────────────────────────────────────────────────────────────────

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
const TITLE_LINE_RE = /^\s*title\s*:\s*["']?(.*?)["']?\s*$/im;
const H1_RE = /^\s*#\s+(.*?)\s*$/;

/**
 * Returns the frontmatter title value, or null if not found.
 */
function extractFrontmatterTitle(content) {
  const fmMatch = FRONTMATTER_RE.exec(content);
  if (!fmMatch) return null;
  const fmText = fmMatch[0];
  const titleMatch = TITLE_LINE_RE.exec(fmText);
  return titleMatch ? titleMatch[1].trim() : null;
}

/**
 * Removes the duplicate H1 from `content` if present.
 * Returns { newContent, changed }.
 */
function removeDuplicateH1(content, fmTitle) {
  const fmMatch = FRONTMATTER_RE.exec(content);
  if (!fmMatch) return { newContent: content, changed: false };

  const fmEnd = fmMatch[0].length;
  const afterFm = content.slice(fmEnd);

  const lines = afterFm.split("\n");

  // Find the first non-empty, non-import line after frontmatter
  let targetIdx = null;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === "") continue;
    if (/^import\s/.test(trimmed)) continue; // skip import statements

    const h1Match = H1_RE.exec(lines[i]);
    if (h1Match && h1Match[1].trim() === fmTitle) {
      targetIdx = i;
    }
    // Either it matched or it didn't — stop after first content line
    break;
  }

  if (targetIdx === null) return { newContent: content, changed: false };

  // Remove the H1 line
  const newLines = [...lines.slice(0, targetIdx), ...lines.slice(targetIdx + 1)];

  // Remove the immediately following blank line (now at targetIdx)
  if (newLines[targetIdx] !== undefined && newLines[targetIdx].trim() === "") {
    newLines.splice(targetIdx, 1);
  }

  const newContent = content.slice(0, fmEnd) + newLines.join("\n");
  return { newContent, changed: true };
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

  function walkDirectory(dir) {
    const dirName = dir.split("/").pop();
    if (EXCLUDED_DIRS.includes(dirName)) return;

    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walkDirectory(fullPath);
        } else if (stat.isFile() && entry.endsWith(".mdx")) {
          mdxFiles.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}: ${error.message}`);
    }
  }

  for (const dir of searchDirs) {
    if (existsSync(dir)) walkDirectory(dir);
  }

  return mdxFiles.sort();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export async function fixH1(options) {
  const repoRoot = process.cwd();

  if (!options.quiet) {
    console.log(chalk.bold("\n# H1 Duplicate Title Fixer\n"));
  }

  const files = findMdxFiles(repoRoot, options.dir, options.file);

  if (files.length === 0) {
    console.error(chalk.red("✗ No MDX files found."));
    process.exit(1);
  }

  if (!options.quiet) {
    console.log(`Found ${files.length} MDX file(s) to process\n`);
    if (options.dryRun) {
      console.log(chalk.yellow("Dry run — no files will be written\n"));
    }
  }

  const changed = [];

  for (const filePath of files) {
    const content = readFileSync(filePath, "utf-8");
    const fmTitle = extractFrontmatterTitle(content);
    if (!fmTitle) continue;

    const { newContent, changed: didChange } = removeDuplicateH1(content, fmTitle);

    if (didChange) {
      const relPath = relative(repoRoot, filePath);
      changed.push(relPath);

      if (options.verbose) {
        console.log(`${chalk.cyan(relPath)}: removed duplicate H1`);
      }

      if (!options.dryRun) {
        writeFileSync(filePath, newContent, "utf-8");
      }
    }
  }

  if (!options.quiet) {
    if (changed.length > 0) {
      const verb = options.dryRun ? "Would remove" : "Removed";
      console.log(chalk.green(`\n✓ ${verb} duplicate H1 in ${changed.length} file(s)`));

      if (!options.verbose) {
        for (const relPath of changed) {
          console.log(`  ${chalk.cyan(relPath)}`);
        }
      }
    } else {
      console.log(chalk.yellow("⚠️  No duplicate H1 headings found."));
    }
  }
}
