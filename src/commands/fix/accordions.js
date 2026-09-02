/**
 * Fix Accordions → AccordionGroup
 *
 * Wraps runs of 2+ consecutive sibling <Accordion> blocks in a shared
 * <AccordionGroup>, as Mintlify expects.
 *
 * Pure string transform (no full MDX/AST parsing) — a non-greedy
 * <Accordion ...> ... </Accordion> scan is sufficient since Accordion usage
 * is typically regular and non-nested.
 *
 * "Sibling" means: same leading indentation on the opening tag's line, and
 * nothing but blank lines between one Accordion's closing tag and the next
 * Accordion's opening tag. Lone Accordions (no adjacent sibling) are left
 * untouched, as are Accordions already inside an <AccordionGroup>.
 */

import { existsSync, readdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { join, relative, resolve } from "path";
import chalk from "chalk";

const EXCLUDED_DIRS = ["node_modules", ".git"];

// ─────────────────────────────────────────────────────────────────────────────
// Conversion logic
// ─────────────────────────────────────────────────────────────────────────────

const ACCORDION_RE = /<Accordion\b[\s\S]*?<\/Accordion>/g;

function findAccordionBlocks(content) {
  const blocks = [];
  let m;
  ACCORDION_RE.lastIndex = 0;
  while ((m = ACCORDION_RE.exec(content)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    const lineStart = content.lastIndexOf("\n", start - 1) + 1;
    const indent = content.slice(lineStart, start);
    // Bail if the opening tag isn't the first thing on its line (indent
    // must be pure whitespace) — anything else is too irregular to touch.
    if (!/^\s*$/.test(indent)) continue;
    blocks.push({ start: lineStart, end, openStart: start, indent });
  }
  return blocks;
}

// A run is already wrapped if the nearest non-blank content before its first
// block is an <AccordionGroup> opening tag — skip it so re-running is a no-op.
function isAlreadyGrouped(content, group) {
  const before = content.slice(0, group.items[0].start).replace(/\s+$/, "");
  return before.endsWith("<AccordionGroup>");
}

function groupSiblings(blocks, content) {
  const groups = [];
  let current = null;
  for (const block of blocks) {
    if (
      current &&
      block.indent === current.indent &&
      content.slice(current.last.end, block.openStart).trim() === ""
    ) {
      current.items.push(block);
      current.last = block;
    } else {
      current = { indent: block.indent, items: [block], last: block };
      groups.push(current);
    }
  }
  return groups.filter((g) => g.items.length >= 2 && !isAlreadyGrouped(content, g));
}

/**
 * Wraps eligible runs of sibling <Accordion> blocks in <AccordionGroup>.
 * Returns { newContent, count } where count is the number of groups added.
 */
export function wrapAccordionGroups(content) {
  const blocks = findAccordionBlocks(content);
  const groups = groupSiblings(blocks, content);
  if (groups.length === 0) return { newContent: content, count: 0 };

  // Apply from the end of the file backwards so earlier offsets stay valid.
  let out = content;
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    const first = g.items[0];
    const last = g.items[g.items.length - 1];
    const openTag = `${g.indent}<AccordionGroup>\n`;
    const closeTag = `\n${g.indent}</AccordionGroup>`;
    out = out.slice(0, last.end) + closeTag + out.slice(last.end);
    out = out.slice(0, first.start) + openTag + out.slice(first.start);
  }

  return { newContent: out, count: groups.length };
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

export async function fixAccordions(options) {
  const repoRoot = process.cwd();

  if (!options.quiet) {
    console.log(chalk.bold("\n# Accordion → AccordionGroup Wrapper\n"));
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
    if (!content.includes("<Accordion")) continue;

    const { newContent, count } = wrapAccordionGroups(content);

    if (count > 0) {
      const relPath = relative(repoRoot, filePath);
      changed.push({ relPath, count });

      if (options.verbose) {
        console.log(`${chalk.cyan(relPath)}: added ${count} group(s)`);
      }

      if (!options.dryRun) {
        writeFileSync(filePath, newContent, "utf-8");
      }
    }
  }

  if (!options.quiet) {
    if (changed.length > 0) {
      const verb = options.dryRun ? "Would add" : "Added";
      const totalGroups = changed.reduce((s, f) => s + f.count, 0);
      console.log(chalk.green(`\n✓ ${verb} ${totalGroups} AccordionGroup wrapper(s) in ${changed.length} file(s)`));
      if (!options.verbose) {
        for (const { relPath, count } of changed) {
          console.log(`  ${chalk.cyan(relPath)} (${count})`);
        }
      }
    } else {
      console.log(chalk.yellow("⚠️  No ungrouped sibling Accordions found."));
    }
  }
}
