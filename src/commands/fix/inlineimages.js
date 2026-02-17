/**
 * Fix Inline Images Tool
 *
 * Converts images that appear inline within text lines to <InlineImage> components.
 * Handles both Markdown images (![alt](url)) and HTML <img> tags.
 *
 * - Inline image (has other text on the line)  → <InlineImage src="url" />
 * - Standalone image (alone on its line)        → left unchanged (use fix images)
 *
 * Also adds the required import at the top of the file (after frontmatter):
 *   import { InlineImage } from "/snippets/InlineImage.jsx";
 *
 * Skips images inside:
 * - Fenced code blocks
 * - Inline code spans
 * - Markdown tables
 * - HTML tables
 * - <Frame> blocks
 */

import { existsSync, readdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { join, relative, resolve } from "path";
import chalk from "chalk";

const EXCLUDED_DIRS = ["node_modules", ".git"];

const IMPORT_LINE = 'import { InlineImage } from "/snippets/InlineImage.jsx";';

// ─────────────────────────────────────────────────────────────────────────────
// Protection patterns (multi-line regions tokenized before line processing)
// ─────────────────────────────────────────────────────────────────────────────

const FRAME_RE = /<Frame(?:\s[^>]*)?>[\s\S]*?<\/Frame>/gi;
const HTML_TABLE_RE = /<table(?:\s[^>]*)?>[\s\S]*?<\/table>/gi;
const MD_TABLE_RE = /^(?:\|[^\n]*\n)+(?:\|[^\n]*)?/gm;
const FENCE_RE = /^[ \t]*(`{3,}|~{3,})[ \t]*[^\n]*\n[\s\S]*?\n[ \t]*\1[ \t]*$/gm;

// ─────────────────────────────────────────────────────────────────────────────
// Tokenizer helpers
// ─────────────────────────────────────────────────────────────────────────────

function tokenize(pattern, text, tag) {
  const stash = [];
  const result = text.replace(pattern, (match) => {
    const idx = stash.length;
    stash.push(match);
    return `\x00${tag}${idx}\x00`;
  });
  return { text: result, stash };
}

function detokenize(text, tag, stash) {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`\x00${escapedTag}(\\d+)\x00`, "g"), (_, idx) => {
    return stash[parseInt(idx, 10)];
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Import injection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the index immediately after the frontmatter closing ---, or -1 if none.
 */
function findFrontmatterEnd(content) {
  if (!content.startsWith("---")) return -1;
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (!match) return -1;
  return match[0].length;
}

/**
 * Ensures the InlineImage import is present in the file.
 * Inserts after frontmatter (if any) with an empty line below.
 */
export function ensureImport(content) {
  if (content.includes(IMPORT_LINE)) return content;

  const fmEnd = findFrontmatterEnd(content);

  if (fmEnd === -1) {
    // No frontmatter — insert at top
    return IMPORT_LINE + "\n\n" + content;
  }

  const before = content.slice(0, fmEnd);
  const after = content.slice(fmEnd).replace(/^\n+/, ""); // normalise blank lines
  return before + "\n" + IMPORT_LINE + "\n\n" + after;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-line processing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Processes a single line: replaces inline images (those sharing the line with text).
 * Protects inline code spans so images inside backticks are not touched.
 * Returns { line, count }.
 */
function processLine(line) {
  // Quick check — skip lines with no image syntax at all
  if (!line.includes("![") && !/<img\b/i.test(line)) {
    return { line, count: 0 };
  }

  // Protect inline code spans within this line
  const inlineCodeResult = tokenize(/`[^`\n]+`/g, line, "ICODE");
  let text = inlineCodeResult.text;

  const hasMdImage = /!\[[^\]\n]*\]\([^\)\n]+\)/.test(text);
  const hasHtmlImg = /<img\b[^>\n]*\/?>/i.test(text);

  if (!hasMdImage && !hasHtmlImg) {
    return { line, count: 0 };
  }

  // Strip all images to check whether there's other text content on the line
  const withoutImages = text
    .replace(/!\[[^\]\n]*\]\([^\)\n]+\)/g, "")
    .replace(/<img\b[^>\n]*\/?>/gi, "")
    .trim();

  if (withoutImages === "") {
    // Line contains only images (standalone) — leave for fix images command
    return { line, count: 0 };
  }

  // ── Replace inline markdown images ──────────────────────────────────────────
  // Negative lookbehind (?<!\[) prevents matching linked images [![alt](url)](link)
  let count = 0;
  text = text.replace(/(?<!\[)!\[([^\]\n]*)\]\(([^\)\n]+)\)/g, (match, alt, src) => {
    count++;
    const altProp = alt.trim() ? ` alt="${alt.trim()}"` : "";
    return `<InlineImage src="${src}"${altProp} />`;
  });

  // ── Replace inline HTML <img> tags ──────────────────────────────────────────
  // Rename <img ...> / <img ... /> to <InlineImage ... />, preserving all attributes
  text = text.replace(/<img\b([^>]*?)(\s*\/?)>/gi, (match, attrs) => {
    if (!attrs.includes("src")) return match; // no src — leave as-is
    count++;
    const cleanAttrs = attrs.trimEnd().replace(/\/$/, "").trimEnd();
    return `<InlineImage${cleanAttrs} />`;
  });

  // Restore inline code spans
  text = detokenize(text, "ICODE", inlineCodeResult.stash);

  return { line: text, count };
}

// ─────────────────────────────────────────────────────────────────────────────
// Core processing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Processes MDX content: replaces inline images and injects the import.
 * Returns { newContent, count }.
 */
export function processContent(content) {
  let text = content;

  // 1. Protect multi-line regions
  const frameResult = tokenize(FRAME_RE, text, "FRAME");
  text = frameResult.text;

  const htmlTableResult = tokenize(HTML_TABLE_RE, text, "HTMLTABLE");
  text = htmlTableResult.text;

  const mdTableResult = tokenize(MD_TABLE_RE, text, "MDTABLE");
  text = mdTableResult.text;

  const fenceResult = tokenize(FENCE_RE, text, "FENCE");
  text = fenceResult.text;

  // 2. Process line by line
  let totalCount = 0;
  const lines = text.split("\n");
  const processedLines = lines.map((line) => {
    const { line: newLine, count } = processLine(line);
    totalCount += count;
    return newLine;
  });
  text = processedLines.join("\n");

  // 3. Restore protected regions
  text = detokenize(text, "FENCE", fenceResult.stash);
  text = detokenize(text, "MDTABLE", mdTableResult.stash);
  text = detokenize(text, "HTMLTABLE", htmlTableResult.stash);
  text = detokenize(text, "FRAME", frameResult.stash);

  // 4. Add import if any replacements were made
  if (totalCount > 0) {
    text = ensureImport(text);
  }

  return { newContent: text, count: totalCount };
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

export async function fixInlineImages(options) {
  const repoRoot = process.cwd();

  if (!options.quiet) {
    console.log(chalk.bold("\n🖼️  Inline Image Fixer\n"));
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

  const results = {};
  let totalImages = 0;

  for (const filePath of files) {
    const content = readFileSync(filePath, "utf-8");
    const { newContent, count } = processContent(content);

    if (count > 0) {
      const relPath = relative(repoRoot, filePath);
      results[relPath] = count;
      totalImages += count;

      if (options.verbose) {
        console.log(`${chalk.cyan(relPath)}: converted ${count} inline image(s)`);
      }

      if (!options.dryRun) {
        writeFileSync(filePath, newContent, "utf-8");
      }
    }
  }

  // Summary
  if (!options.quiet) {
    const fileCount = Object.keys(results).length;

    if (fileCount > 0) {
      const verb = options.dryRun ? "Would convert" : "Converted";
      console.log(chalk.green(`\n✓ ${verb} ${totalImages} inline image(s) in ${fileCount} file(s)`));

      if (!options.verbose) {
        for (const [filePath, count] of Object.entries(results)) {
          console.log(`  ${chalk.cyan(filePath)}: ${count} inline image(s)`);
        }
      }
    } else {
      console.log(chalk.yellow("⚠️  No inline images found."));
    }
  }
}
