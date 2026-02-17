/**
 * MDX Parse Fix Tool
 *
 * Fixes common MDX parsing errors in documentation files:
 * 1. Void HTML tags not self-closed (<br> → <br />)
 * 2. Stray < / > in text (escape to &lt; / &gt;)
 *
 * Skips content inside code fences and inline code.
 */

import { existsSync, readdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { join, relative, resolve } from "path";
import chalk from "chalk";

// Void HTML elements that must be self-closing in JSX/MDX
const VOID_ELEMENTS = [
  "area", "base", "br", "col", "embed", "hr", "img",
  "input", "link", "meta", "source", "track", "wbr",
];

const VOID_PATTERN = new RegExp(
  `<(${VOID_ELEMENTS.join("|")})(\\s[^>]*?)?\\s*(?<!\\/)>`,
  "gi"
);

const EXCLUDED_DIRS = ["snippets", "node_modules", ".git"];

/**
 * Finds MDX files to process
 */
function findMdxFiles(repoRoot, directory = null, file = null) {
  if (file) {
    const fullPath = resolve(repoRoot, file);
    return existsSync(fullPath) ? [fullPath] : [];
  }

  const searchDirs = directory
    ? [resolve(repoRoot, directory)]
    : [repoRoot];

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

/**
 * Gets file list from a parse report (only files with errors)
 */
function getFilesFromReport(reportPath, repoRoot) {
  if (!existsSync(reportPath)) return null;

  try {
    const report = JSON.parse(readFileSync(reportPath, "utf-8"));
    const errorFiles = (report.errors || []).map((e) =>
      resolve(repoRoot, e.filePath)
    );
    return errorFiles;
  } catch (error) {
    console.error(`Error reading report: ${error.message}`);
    return null;
  }
}

/**
 * Splits file content into protected (code) and unprotected (text) segments.
 * Returns an array of { text, protected } objects.
 */
export function segmentContent(content) {
  const segments = [];
  let pos = 0;
  const len = content.length;

  // State tracking for fenced code blocks
  let inFence = false;
  let fenceMarker = "";

  const lines = content.split("\n");
  let lineStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineEnd = lineStart + line.length;
    const trimmed = line.trimStart();

    // Check for fenced code block boundaries
    if (!inFence) {
      const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
      if (fenceMatch) {
        // Push any text before this fence line
        if (lineStart > pos) {
          segments.push({ text: content.slice(pos, lineStart), protected: false });
        }
        inFence = true;
        fenceMarker = fenceMatch[1][0].repeat(fenceMatch[1].length);
        // This line is protected
        segments.push({ text: content.slice(lineStart, lineEnd), protected: true });
        pos = lineEnd;
        lineStart = lineEnd + 1; // +1 for newline
        continue;
      }
    } else {
      // Check for closing fence
      const closeMatch = trimmed.match(/^(`{3,}|~{3,})\s*$/);
      if (closeMatch && closeMatch[1][0] === fenceMarker[0] && closeMatch[1].length >= fenceMarker.length) {
        // Include this line as protected, then exit fence
        segments.push({ text: content.slice(pos, lineEnd), protected: true });
        pos = lineEnd;
        inFence = false;
        fenceMarker = "";
        lineStart = lineEnd + 1;
        continue;
      }
      // Still inside fence, continue
      lineStart = lineEnd + 1;
      continue;
    }

    lineStart = lineEnd + 1;
  }

  // Push remaining content
  if (pos < content.length) {
    segments.push({ text: content.slice(pos), protected: inFence });
  }

  return segments;
}

/**
 * Fixes void HTML tags in a text segment (not inside inline code).
 * Returns { text, count }.
 */
export function fixVoidTags(text) {
  let count = 0;

  // Process the text but protect inline code spans
  const parts = [];
  let lastIndex = 0;

  // Match inline code: `...`
  const inlineCodeRegex = /`[^`]+`/g;
  let match;

  while ((match = inlineCodeRegex.exec(text)) !== null) {
    // Process text before this inline code
    const before = text.slice(lastIndex, match.index);
    const { text: fixed, count: c } = replaceVoidTags(before);
    parts.push(fixed);
    count += c;

    // Keep inline code unchanged
    parts.push(match[0]);
    lastIndex = match.index + match[0].length;
  }

  // Process remaining text after last inline code
  const remaining = text.slice(lastIndex);
  const { text: fixed, count: c } = replaceVoidTags(remaining);
  parts.push(fixed);
  count += c;

  return { text: parts.join(""), count };
}

/**
 * Replaces non-self-closed void tags in a string
 */
function replaceVoidTags(text) {
  let count = 0;
  const result = text.replace(VOID_PATTERN, (match, tag, attrs) => {
    // Already self-closing check (belt and suspenders)
    if (match.trimEnd().endsWith("/>")) return match;
    count++;
    const attrStr = attrs ? attrs.trimEnd() : "";
    return `<${tag}${attrStr} />`;
  });
  return { text: result, count };
}

/**
 * Fixes stray < and > in a text segment (not inside inline code or tags).
 * Returns { text, count }.
 */
export function fixStrayAngleBrackets(text) {
  let count = 0;

  // Process the text but protect inline code spans and valid tags
  const parts = [];
  let lastIndex = 0;

  // Match inline code or valid HTML/JSX tags (opening, closing, self-closing, comments)
  const protectedRegex = /`[^`]+`|<\/[a-zA-Z][a-zA-Z0-9]*\s*>|<[a-zA-Z][a-zA-Z0-9]*(?:\s[^>]*)?\s*\/?>|<!--[\s\S]*?-->|<![^>]*>/g;
  let match;

  while ((match = protectedRegex.exec(text)) !== null) {
    // Process text before this protected span
    const before = text.slice(lastIndex, match.index);
    const { text: fixed, count: c } = escapeStrayBrackets(before);
    parts.push(fixed);
    count += c;

    // Keep protected span unchanged
    parts.push(match[0]);
    lastIndex = match.index + match[0].length;
  }

  // Process remaining text
  const remaining = text.slice(lastIndex);
  const { text: fixed, count: c } = escapeStrayBrackets(remaining);
  parts.push(fixed);
  count += c;

  return { text: parts.join(""), count };
}

/**
 * Escapes stray < and > in plain text (no tags or code present)
 */
function escapeStrayBrackets(text) {
  let count = 0;

  // Also protect MDX expressions {}, JSX attribute patterns, and frontmatter
  // Escape < that is NOT the start of a valid tag
  let result = text.replace(/</g, (match, offset) => {
    const after = text.slice(offset + 1);
    // Valid tag starts: letter, /, !
    if (/^[a-zA-Z\/!]/.test(after)) return match;
    count++;
    return "&lt;";
  });

  // Escape > that is NOT part of a blockquote or tag end
  // Only escape > that appears to be in running text (preceded by space/word char)
  const srcText = result;
  let countGt = 0;
  result = result.replace(/>/g, (match, offset) => {
    // Keep > at start of line (blockquote syntax)
    const lineStart = srcText.lastIndexOf("\n", offset - 1) + 1;
    const beforeOnLine = srcText.slice(lineStart, offset).trimStart();
    if (beforeOnLine === "" || /^>+$/.test(beforeOnLine)) return match;

    // Keep > that looks like it closes a tag (preceded by tag-like content)
    // This shouldn't happen since valid tags are protected above, but be safe
    const before = srcText.slice(Math.max(0, offset - 1), offset);
    if (/[a-zA-Z0-9"'\/\-]/.test(before)) {
      // Could be end of tag — but tags should already be protected.
      // In plain text, this is likely stray (e.g., "a > b")
      // Only escape if it looks like a comparison/text context
      const surroundBefore = srcText.slice(Math.max(0, offset - 2), offset);
      const afterChar = srcText[offset + 1] || "";
      if (/\s/.test(surroundBefore[0]) && /[\s\w]/.test(afterChar)) {
        countGt++;
        return "&gt;";
      }
      return match;
    }

    countGt++;
    return "&gt;";
  });

  return { text: result, count: count + countGt };
}

/**
 * Applies all fixes to a single file
 * Returns { voidTagFixes, strayBracketFixes }
 */
function fixFile(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const segments = segmentContent(content);

  let totalVoidFixes = 0;
  let totalBracketFixes = 0;

  const fixedSegments = segments.map((seg) => {
    if (seg.protected) return seg.text;

    // Apply void tag fixes first
    const { text: afterVoid, count: voidCount } = fixVoidTags(seg.text);
    totalVoidFixes += voidCount;

    // Then apply stray bracket fixes
    const { text: afterBrackets, count: bracketCount } = fixStrayAngleBrackets(afterVoid);
    totalBracketFixes += bracketCount;

    return afterBrackets;
  });

  const fixedContent = fixedSegments.join("");

  if (fixedContent !== content) {
    writeFileSync(filePath, fixedContent, "utf-8");
  }

  return { voidTagFixes: totalVoidFixes, strayBracketFixes: totalBracketFixes };
}

/**
 * Main CLI function for fixing parse errors
 */
export async function fixParse(options) {
  const repoRoot = process.cwd();

  if (!options.quiet) {
    console.log(chalk.bold("\n\uD83D\uDD27 MDX Parse Fixer\n"));
  }

  // Determine which files to fix
  let files;

  if (options.file || options.dir) {
    // Direct file/dir mode — no report needed
    files = findMdxFiles(repoRoot, options.dir, options.file);

    if (files.length === 0) {
      console.error("No MDX files found.");
      process.exit(1);
    }

    if (!options.quiet) {
      console.log(`Found ${files.length} MDX file(s) to process\n`);
    }
  } else {
    // Report mode
    const reportPath = options.report || "mdx_errors_report.json";

    if (!existsSync(reportPath)) {
      console.error(chalk.red(`\n\u2717 Error: Report file not found: ${reportPath}`));

      if (reportPath.endsWith(".md")) {
        const jsonPath = reportPath.replace(/\.md$/, ".json");
        console.error(chalk.yellow(`\n\u26A0\uFE0F  The fix command requires a JSON report file.`));
        console.error(chalk.yellow(`Try using: ${chalk.cyan(jsonPath)}`));
      } else {
        console.error(chalk.yellow(`\n\u26A0\uFE0F  Make sure to run the validation command first:`));
        console.error(chalk.gray(`  writechoice check parse`));
      }

      process.exit(1);
    }

    if (!reportPath.endsWith(".json")) {
      console.error(chalk.red(`\n\u2717 Error: The fix command requires a JSON report file.`));
      console.error(chalk.yellow(`\nProvided file: ${reportPath}`));

      if (reportPath.endsWith(".md")) {
        const jsonPath = reportPath.replace(/\.md$/, ".json");
        console.error(chalk.yellow(`\nThe markdown (.md) report is for human readability only.`));
        console.error(chalk.yellow(`Please use the JSON report instead: ${chalk.cyan(jsonPath)}`));
      }

      process.exit(1);
    }

    if (!options.quiet) {
      console.log(`Reading report: ${chalk.cyan(reportPath)}`);
    }

    files = getFilesFromReport(reportPath, repoRoot);

    if (!files || files.length === 0) {
      if (!options.quiet) {
        console.log(chalk.yellow("\n\u26A0\uFE0F  No files with errors found in report."));
      }
      return;
    }

    if (!options.quiet) {
      console.log(`Found ${files.length} file(s) with errors\n`);
    }
  }

  // Apply fixes
  const results = {};
  let totalVoid = 0;
  let totalBracket = 0;

  for (const filePath of files) {
    if (!existsSync(filePath)) {
      if (options.verbose) {
        console.log(`Warning: File not found: ${filePath}`);
      }
      continue;
    }

    const { voidTagFixes, strayBracketFixes } = fixFile(filePath);
    const totalFixes = voidTagFixes + strayBracketFixes;

    if (totalFixes > 0) {
      const relPath = relative(repoRoot, filePath);
      results[relPath] = { voidTagFixes, strayBracketFixes };
      totalVoid += voidTagFixes;
      totalBracket += strayBracketFixes;

      if (options.verbose) {
        console.log(`Fixed ${chalk.cyan(relPath)}: ${voidTagFixes} void tag(s), ${strayBracketFixes} stray bracket(s)`);
      }
    }
  }

  // Summary
  if (!options.quiet) {
    const fileCount = Object.keys(results).length;
    const totalFixes = totalVoid + totalBracket;

    if (fileCount > 0) {
      console.log(chalk.green(`\n\u2713 Fixed ${totalFixes} issue(s) in ${fileCount} file(s):\n`));

      for (const [filePath, counts] of Object.entries(results)) {
        const details = [];
        if (counts.voidTagFixes > 0) details.push(`${counts.voidTagFixes} void tag(s)`);
        if (counts.strayBracketFixes > 0) details.push(`${counts.strayBracketFixes} stray bracket(s)`);
        console.log(`  ${chalk.cyan(filePath)}: ${details.join(", ")}`);
      }

      console.log(chalk.yellow("\n\u26A0\uFE0F  Run validation again to verify the fixes:"));
      console.log(chalk.gray("  writechoice check parse"));
    } else {
      console.log(chalk.yellow("\n\u26A0\uFE0F  No fixable issues found."));
    }
  }
}
