/**
 * wc nav redirects — Apply docs.json redirects to MDX files
 *
 * Reads the redirects array from docs.json and replaces stale source paths
 * with their destination paths in all MDX files (markdown links and href attributes).
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs";
import { resolve, join, relative } from "path";
import chalk from "chalk";

/**
 * @param {Object} options
 * @param {string} options.docs - Path to docs.json (default: "docs.json")
 * @param {string} [options.dir] - Directory to scan for MDX files (default: cwd)
 * @param {boolean} options.dryRun
 * @param {boolean} options.quiet
 */
export async function navRedirects(options) {
  const verbose = !options.quiet;
  const repoRoot = process.cwd();
  const docsFile = resolve(repoRoot, options.docs || "docs.json");
  const scanDir = options.dir ? resolve(repoRoot, options.dir) : repoRoot;
  const dryRun = options.dryRun || false;

  if (!existsSync(docsFile)) {
    console.error(chalk.red(`Error: docs.json not found at ${docsFile}`));
    process.exit(1);
  }

  let docsJson;
  try {
    docsJson = JSON.parse(readFileSync(docsFile, "utf-8"));
  } catch (err) {
    console.error(chalk.red(`Error parsing docs.json: ${err.message}`));
    process.exit(1);
  }

  const redirects = docsJson?.redirects;
  if (!redirects?.length) {
    if (verbose) console.log(chalk.yellow("\nNo redirects found in docs.json."));
    return;
  }

  if (verbose) {
    console.log(chalk.cyan(`\nApplying ${redirects.length} redirect${redirects.length !== 1 ? "s" : ""} to MDX files...`));
    if (dryRun) console.log(chalk.yellow("  [dry-run] No files will be written\n"));
  }

  // Pre-compile one regex per redirect
  const compiled = redirects.map(({ source, destination }) => ({
    source,
    destination,
    // Match the source path in:
    //   markdown links: ](source) or ](source#anchor)
    //   href attrs:     href="source"  href='source'  href="source#anchor"
    // Lookahead ensures we don't consume the closing char and don't match partial paths.
    re: new RegExp(`(["'(])${escapeRegex(source)}(?=[)"'#\\s])`, "g"),
  }));

  const mdxFiles = collectMdxFiles(scanDir);

  let filesChanged = 0;
  let totalReplacements = 0;

  for (const filePath of mdxFiles) {
    const original = readFileSync(filePath, "utf-8");
    let updated = original;
    let fileReplacements = 0;

    for (const { destination, re } of compiled) {
      re.lastIndex = 0;
      updated = updated.replace(re, (_, before) => {
        fileReplacements++;
        return before + destination;
      });
    }

    if (fileReplacements > 0) {
      filesChanged++;
      totalReplacements += fileReplacements;

      if (verbose) {
        const rel = relative(repoRoot, filePath);
        console.log(
          `  ${chalk.dim(rel)} — ${chalk.green(String(fileReplacements))} replacement${fileReplacements !== 1 ? "s" : ""}`
        );
      }

      if (!dryRun) {
        writeFileSync(filePath, updated, "utf-8");
      }
    }
  }

  if (verbose) {
    console.log();
    if (filesChanged) {
      if (dryRun) {
        console.log(
          chalk.bold(
            `Would update ${filesChanged} file${filesChanged !== 1 ? "s" : ""} (${totalReplacements} replacement${totalReplacements !== 1 ? "s" : ""})`
          )
        );
      } else {
        console.log(
          chalk.green(
            `  ✓ Updated ${filesChanged} file${filesChanged !== 1 ? "s" : ""} (${totalReplacements} replacement${totalReplacements !== 1 ? "s" : ""})`
          )
        );
      }
    } else {
      console.log(chalk.green("  ✓ No stale redirect sources found in MDX files"));
    }
  }
}

// ---------------------------------------------------------------------------
// File scanning
// ---------------------------------------------------------------------------

function collectMdxFiles(dir) {
  const files = [];
  scanDir(dir, files);
  return files;
}

function scanDir(dir, files) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      scanDir(full, files);
    } else if (entry.endsWith(".mdx")) {
      files.push(full);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
