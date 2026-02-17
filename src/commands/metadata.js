/**
 * Metadata Command
 *
 * Fetches meta tags from live documentation pages and writes them into
 * the frontmatter of the corresponding MDX source files.
 *
 * URL mapping:
 *   baseUrl + "/" + relative-path-from-scan-dir (without .mdx)
 *
 * Example:
 *   baseUrl   = https://docs.example.com
 *   file      = docs/api/reference.mdx
 *   scan dir  = docs/
 *   → URL     = https://docs.example.com/api/reference
 *
 * Existing frontmatter keys are updated (overwritten).
 * Missing keys are appended at the end of the frontmatter block.
 */

import { existsSync, readdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { join, relative, resolve } from "path";
import chalk from "chalk";

const EXCLUDED_DIRS = ["node_modules", ".git"];

export const DEFAULT_META_TAGS = [
  "og:title",
  "og:description",
  "og:image",
  "og:url",
  "twitter:title",
  "twitter:description",
  "twitter:image",
];

// ─────────────────────────────────────────────────────────────────────────────
// HTML helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses an HTML attribute string into a key→value object.
 * Handles both double and single-quoted values.
 */
function parseHtmlAttributes(attrStr) {
  const attrs = {};
  const re = /(\w[\w-]*)=(?:"([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(attrStr)) !== null) {
    attrs[m[1]] = m[2] !== undefined ? m[2] : m[3];
  }
  return attrs;
}

/**
 * Extracts the requested meta tag values from an HTML string.
 * Looks at property, name, and itemprop attributes.
 * Returns { "og:title": "...", ... }
 */
export function extractMetaTags(html, tags) {
  const results = {};
  const metaRe = /<meta\s+([^>]+?)(?:\s*\/?>)/gi;
  let m;
  while ((m = metaRe.exec(html)) !== null) {
    const attrs = parseHtmlAttributes(m[1]);
    const tagName = attrs.property || attrs.name || attrs.itemprop;
    if (tagName && tags.includes(tagName) && attrs.content && attrs.content.trim()) {
      results[tagName] = attrs.content.trim();
    }
  }
  return results;
}

/**
 * Fetches a URL and returns the extracted meta tags.
 */
async function fetchMetaTags(url, tags) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      return { error: `HTTP ${res.status}`, tags: {} };
    }

    const html = await res.text();
    return { error: null, tags: extractMetaTags(html, tags) };
  } catch (err) {
    return { error: err.message, tags: {} };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Concurrency
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs an array of async task factories with a maximum concurrency.
 */
async function runConcurrent(tasks, concurrency) {
  const results = new Array(tasks.length);
  const queue = tasks.map((task, idx) => ({ task, idx }));

  async function worker() {
    while (queue.length > 0) {
      const { task, idx } = queue.shift();
      results[idx] = await task();
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// URL construction
// ─────────────────────────────────────────────────────────────────────────────

export function fileToUrl(filePath, scanDir, baseUrl) {
  const rel = relative(scanDir, filePath)
    .replace(/\.mdx$/, "")
    .replace(/\\/g, "/");
  return baseUrl.replace(/\/$/, "") + "/" + rel;
}

// ─────────────────────────────────────────────────────────────────────────────
// Frontmatter helpers
// ─────────────────────────────────────────────────────────────────────────────

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function escapeRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Formats a string value for YAML output.
 * Always produces a quoted scalar to avoid YAML interpretation issues.
 */
export function yamlValue(str) {
  if (!str.includes('"')) return `"${str}"`;
  if (!str.includes("'")) return `'${str}'`;
  // Both quotes present — escape double quotes
  return `"${str.replace(/"/g, '\\"')}"`;
}

/**
 * Applies meta data to the MDX file content.
 * Updates existing frontmatter keys, appends missing ones.
 * Returns { newContent, updated: string[], added: string[], skipped: boolean }
 */
export function applyMetaToContent(content, metaData) {
  const fmMatch = FRONTMATTER_RE.exec(content);
  if (!fmMatch) {
    return { newContent: content, updated: [], added: [], skipped: true };
  }

  let fmText = fmMatch[1];
  const fmEnd = fmMatch[0].length;
  const body = content.slice(fmEnd);

  const updated = [];
  const added = [];

  for (const [key, value] of Object.entries(metaData)) {
    // Keys containing colons must be quoted in YAML
    const yamlKey = key.includes(":") ? `"${key}"` : key;
    const newLine = `${yamlKey}: ${yamlValue(value)}`;

    // Match existing key in any of its quoting variants
    const keyEsc = escapeRe(key);
    const existingRe = new RegExp(
      `^(?:${keyEsc}|"${keyEsc}"|'${keyEsc}')\\s*:.*$`,
      "m"
    );

    if (existingRe.test(fmText)) {
      fmText = fmText.replace(existingRe, newLine);
      updated.push(key);
    } else {
      fmText += `\n${newLine}`;
      added.push(key);
    }
  }

  const newContent = `---\n${fmText}\n---\n${body}`;
  return { newContent, updated, added, skipped: false };
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

export async function runMetadata(options) {
  const repoRoot = process.cwd();

  if (!options.quiet) {
    console.log(chalk.bold("\n🏷️  Metadata Fetcher\n"));
  }

  if (!options.baseUrl) {
    console.error(
      chalk.red("✗ No base URL provided. Pass --base-url or set 'source' in config.json.")
    );
    process.exit(1);
  }

  const tags = options.tags || DEFAULT_META_TAGS;
  const concurrency = options.concurrency || 15;
  const scanDir = options.dir ? resolve(repoRoot, options.dir) : repoRoot;

  const files = findMdxFiles(repoRoot, options.dir, options.file);

  if (files.length === 0) {
    console.error(chalk.red("✗ No MDX files found."));
    process.exit(1);
  }

  if (!options.quiet) {
    console.log(`Base URL  : ${options.baseUrl}`);
    console.log(`Tags      : ${tags.join(", ")}`);
    console.log(`Files     : ${files.length} MDX file(s)`);
    console.log(`Concurrency: ${concurrency}\n`);
    if (options.dryRun) {
      console.log(chalk.yellow("Dry run — no files will be written\n"));
    }
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;
  const changed = [];

  const tasks = files.map((filePath) => async () => {
    const url = fileToUrl(filePath, scanDir, options.baseUrl);
    const relPath = relative(repoRoot, filePath);

    const { error, tags: metaData } = await fetchMetaTags(url, tags);

    processed++;

    if (error) {
      if (!options.quiet) {
        console.log(`${chalk.red("✗")} ${chalk.cyan(relPath)} — ${error}`);
      }
      errors++;
      return;
    }

    if (Object.keys(metaData).length === 0) {
      if (options.verbose) {
        console.log(`${chalk.gray("–")} ${chalk.cyan(relPath)} — no meta tags found`);
      }
      skipped++;
      return;
    }

    const content = readFileSync(filePath, "utf-8");
    const { newContent, updated, added, skipped: noFm } = applyMetaToContent(content, metaData);

    if (noFm) {
      if (options.verbose) {
        console.log(`${chalk.gray("–")} ${chalk.cyan(relPath)} — no frontmatter, skipped`);
      }
      skipped++;
      return;
    }

    const totalChanges = updated.length + added.length;
    if (totalChanges > 0) {
      changed.push({ relPath, updated, added });
      if (options.verbose) {
        const parts = [];
        if (updated.length) parts.push(`updated: ${updated.join(", ")}`);
        if (added.length) parts.push(`added: ${added.join(", ")}`);
        console.log(`${chalk.green("✓")} ${chalk.cyan(relPath)} — ${parts.join(" | ")}`);
      }
      if (!options.dryRun) {
        writeFileSync(filePath, newContent, "utf-8");
      }
    } else {
      if (options.verbose) {
        console.log(`${chalk.gray("–")} ${chalk.cyan(relPath)} — already up to date`);
      }
      skipped++;
    }
  });

  await runConcurrent(tasks, concurrency);

  // Summary
  if (!options.quiet) {
    if (changed.length > 0) {
      const verb = options.dryRun ? "Would update" : "Updated";
      console.log(chalk.green(`\n✓ ${verb} ${changed.length} file(s)`));

      if (!options.verbose) {
        for (const { relPath, updated, added } of changed) {
          const parts = [];
          if (updated.length) parts.push(`updated: ${updated.length}`);
          if (added.length) parts.push(`added: ${added.length}`);
          console.log(`  ${chalk.cyan(relPath)} — ${parts.join(" | ")} tag(s)`);
        }
      }
    } else {
      console.log(chalk.yellow("⚠️  No files needed updating."));
    }

    if (errors > 0) {
      console.log(chalk.yellow(`\n⚠️  ${errors} file(s) had fetch errors.`));
    }
  }
}
