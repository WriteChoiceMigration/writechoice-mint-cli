/**
 * Code Block Fix Tool
 *
 * Fixes code block flags in MDX documentation files:
 * - expandable: adds when line count > threshold, removes when < threshold
 * - lines:      adds to all code blocks (--lines) or removes from all (--remove-lines)
 * - wrap:       adds to all code blocks (--wrap) or removes from all (--remove-wrap)
 */

import { existsSync, readdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { join, relative, resolve } from "path";
import chalk from "chalk";

const DEFAULT_THRESHOLD = 15;
const EXCLUDED_DIRS = ["node_modules", ".git"];

/**
 * Finds MDX files to process
 */
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

/**
 * Splits content into lines preserving original line endings.
 */
function splitLines(content) {
  const lines = [];
  let pos = 0;
  while (pos < content.length) {
    const nlPos = content.indexOf("\n", pos);
    if (nlPos === -1) {
      lines.push(content.slice(pos));
      break;
    }
    lines.push(content.slice(pos, nlPos + 1));
    pos = nlPos + 1;
  }
  return lines;
}

/**
 * Processes the token list for a single code block's info string.
 * Returns { newTokens, changes }.
 */
export function processInfoTokens(tokens, lineCount, lineNum, options) {
  const changes = [];
  let newTokens = [...tokens];

  const threshold = options.threshold ?? DEFAULT_THRESHOLD;

  // expandable: threshold-based (unless disabled via --no-expandable)
  if (options.expandable !== false) {
    const hasExpandable = newTokens.includes("expandable");
    if (hasExpandable && lineCount < threshold) {
      newTokens = newTokens.filter((t) => t !== "expandable");
      changes.push(`line ${lineNum}: removed 'expandable' (${lineCount} lines < ${threshold})`);
    } else if (!hasExpandable && lineCount > threshold) {
      newTokens.push("expandable");
      changes.push(`line ${lineNum}: added 'expandable' (${lineCount} lines > ${threshold})`);
    }
  }

  // lines: add or remove
  const hasLines = newTokens.includes("lines");
  if (options.lines && !hasLines) {
    newTokens.push("lines");
    changes.push(`line ${lineNum}: added 'lines'`);
  } else if (options.removeLines && hasLines) {
    newTokens = newTokens.filter((t) => t !== "lines");
    changes.push(`line ${lineNum}: removed 'lines'`);
  }

  // wrap: add or remove
  const hasWrap = newTokens.includes("wrap");
  if (options.wrap && !hasWrap) {
    newTokens.push("wrap");
    changes.push(`line ${lineNum}: added 'wrap'`);
  } else if (options.removeWrap && hasWrap) {
    newTokens = newTokens.filter((t) => t !== "wrap");
    changes.push(`line ${lineNum}: removed 'wrap'`);
  }

  return { newTokens, changes };
}

/**
 * Scans MDX content for fenced code blocks and applies flag fixes.
 * Returns { newContent, changes }.
 */
export function processContent(content, options) {
  const lines = splitLines(content);
  const result = [];
  const changes = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    // Strip trailing newline for matching, preserving it for output
    const stripped = line.replace(/\r?\n$/, "");

    // Detect a fenced code block opener: optional indent + 3+ backticks + info string
    const openMatch = stripped.match(/^([ \t]*)(`{3,})(.*)$/);

    if (openMatch) {
      const indent = openMatch[1];
      const fence = openMatch[2];
      const info = openMatch[3];
      const fenceLen = fence.length;

      // Find the matching closing fence
      let j = i + 1;
      while (j < lines.length) {
        const closeStripped = lines[j].replace(/\r?\n$/, "");
        const closeMatch = closeStripped.match(/^[ \t]*(`{3,})[ \t]*$/);
        if (closeMatch && closeMatch[1].length >= fenceLen) {
          break;
        }
        j++;
      }

      const bodyLines = lines.slice(i + 1, j);
      const lineCount = bodyLines.length;

      // Parse info string tokens
      const infoStripped = info.trim();
      const tokens = infoStripped ? infoStripped.split(/\s+/) : [];

      const { newTokens, changes: blockChanges } = processInfoTokens(tokens, lineCount, i + 1, options);
      changes.push(...blockChanges);

      // Reconstruct the opening fence line with original line ending
      const lineEnding = line.slice(stripped.length);
      const newInfo = newTokens.join(" ");
      result.push(`${indent}${fence}${newInfo}${lineEnding}`);
      result.push(...bodyLines);

      if (j < lines.length) {
        result.push(lines[j]); // closing fence
        i = j + 1;
      } else {
        // Unterminated block — leave as-is
        i = j;
      }
    } else {
      result.push(line);
      i++;
    }
  }

  return { newContent: result.join(""), changes };
}

/**
 * Main exported function for the fix codeblocks command.
 */
export async function fixCodeblocks(options) {
  const repoRoot = process.cwd();

  if (!options.quiet) {
    console.log(chalk.bold("\n🔧 Code Block Fixer\n"));
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
  let totalChanges = 0;

  for (const filePath of files) {
    const content = readFileSync(filePath, "utf-8");
    const { newContent, changes } = processContent(content, options);

    if (changes.length > 0) {
      const relPath = relative(repoRoot, filePath);
      results[relPath] = changes;
      totalChanges += changes.length;

      if (options.verbose) {
        console.log(`${chalk.cyan(relPath)}: ${changes.length} change(s)`);
        for (const change of changes) {
          console.log(`  ${change}`);
        }
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
      const verb = options.dryRun ? "Would make" : "Made";
      console.log(chalk.green(`\n✓ ${verb} ${totalChanges} change(s) in ${fileCount} file(s)`));

      if (!options.verbose) {
        for (const [filePath, changes] of Object.entries(results)) {
          console.log(`  ${chalk.cyan(filePath)}: ${changes.length} change(s)`);
        }
      }
    } else {
      console.log(chalk.yellow("⚠️  No changes needed."));
    }
  }
}
