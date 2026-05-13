/**
 * Fix Tabs → CodeGroup
 *
 * Converts <Tabs> groups where every <Tab> contains exactly one fenced code
 * block into a <CodeGroup>, moving the tab title onto the code block fence.
 *
 * A <Tabs> block is only converted when ALL of the following hold:
 *   - Every child is a <Tab title="...">...</Tab>
 *   - Each tab body contains exactly one fenced code block and nothing else
 *   - There is no extra content between tabs
 *
 * Any <Tabs> block that does not meet all conditions is left untouched.
 */

import { existsSync, readdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { join, relative, resolve } from "path";
import chalk from "chalk";

const EXCLUDED_DIRS = ["node_modules", ".git"];

// ─────────────────────────────────────────────────────────────────────────────
// Conversion logic
// ─────────────────────────────────────────────────────────────────────────────

const TABS_RE = /<Tabs>\n([\s\S]*?)\n<\/Tabs>/g;
const TAB_RE = /<Tab title="([^"]+)">\n([\s\S]*?)\n<\/Tab>/g;
const CODEBLOCK_RE = /^```(\S*)\n([\s\S]*?)\n```$/;

function isOnlyCodeblock(body) {
  return CODEBLOCK_RE.test(body.trim());
}

function convertTabsBlock(inner) {
  const tabs = [];
  let m;
  TAB_RE.lastIndex = 0;
  while ((m = TAB_RE.exec(inner)) !== null) {
    tabs.push({ title: m[1], body: m[2] });
  }

  if (tabs.length === 0) return null;

  // Ensure inner contains nothing outside the <Tab> elements
  let reconstructed = "";
  for (const { title, body } of tabs) {
    reconstructed += `<Tab title="${title}">\n${body}\n</Tab>`;
  }
  if (reconstructed.replace(/\s+/g, "") !== inner.replace(/\s+/g, "")) return null;

  // Every tab must contain exactly one code block
  for (const { body } of tabs) {
    if (!isOnlyCodeblock(body.trim())) return null;
  }

  const lines = ["<CodeGroup>"];
  for (const { title, body } of tabs) {
    const cbMatch = CODEBLOCK_RE.exec(body.trim());
    const lang = cbMatch[1];
    const content = cbMatch[2];
    lines.push(`\`\`\`${lang} ${title}`);
    lines.push(content);
    lines.push("```");
  }
  lines.push("</CodeGroup>");
  return lines.join("\n");
}

/**
 * Converts eligible <Tabs> blocks in `content` to <CodeGroup>.
 * Returns { newContent, count } where count is the number of blocks converted.
 */
export function convertTabsToCodeGroup(content) {
  let count = 0;
  const newContent = content.replace(TABS_RE, (match, inner) => {
    const result = convertTabsBlock(inner);
    if (result === null) return match;
    count++;
    return result;
  });
  return { newContent, count };
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

export async function fixTabs(options) {
  const repoRoot = process.cwd();

  if (!options.quiet) {
    console.log(chalk.bold("\n# Tabs → CodeGroup Converter\n"));
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
    const { newContent, count } = convertTabsToCodeGroup(content);

    if (count > 0) {
      const relPath = relative(repoRoot, filePath);
      changed.push({ relPath, count });

      if (options.verbose) {
        console.log(`${chalk.cyan(relPath)}: converted ${count} block(s)`);
      }

      if (!options.dryRun) {
        writeFileSync(filePath, newContent, "utf-8");
      }
    }
  }

  if (!options.quiet) {
    if (changed.length > 0) {
      const verb = options.dryRun ? "Would convert" : "Converted";
      const totalBlocks = changed.reduce((s, f) => s + f.count, 0);
      console.log(
        chalk.green(`\n✓ ${verb} ${totalBlocks} block(s) in ${changed.length} file(s)`)
      );
      if (!options.verbose) {
        for (const { relPath, count } of changed) {
          console.log(`  ${chalk.cyan(relPath)} (${count})`);
        }
      }
    } else {
      console.log(chalk.yellow("⚠️  No convertible <Tabs> blocks found."));
    }
  }
}
