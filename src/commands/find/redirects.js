/**
 * wcc find redirects — Probe broken links for HTTP redirects
 *
 * Reads a Mintlify broken-links report file, extracts unique paths
 * (lines containing ⎿), then probes the live site with redirect-following
 * disabled. Any 3xx response is recorded as a redirect.
 *
 * Output: JSON array of { source, destination } objects, ready to use as
 * redirects.json or feed into `wcc fix redirects`.
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import chalk from "chalk";

const UA = "Mozilla/5.0";
const RETRY_STATUSES = new Set([429]);
const REDIRECT_STATUSES = new Set([301, 302, 307, 308]);
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

// ---------------------------------------------------------------------------
// Parse broken-links report
// ---------------------------------------------------------------------------

/**
 * Extract unique paths from a Mintlify broken-links report.
 * Lines containing ⎿ have the broken URL after the last ⎿.
 * Fragment identifiers are stripped.
 */
export function parseBrokenLinksReport(text) {
  const paths = new Set();
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line.includes("⎿")) continue;
    const path = line.split("⎿").at(-1).trim();
    if (path.startsWith("/")) paths.add(path.split("#")[0]);
  }
  return [...paths].sort();
}

// ---------------------------------------------------------------------------
// HTTP probe
// ---------------------------------------------------------------------------

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function probeRedirect(base, path, verbose) {
  const url = base.replace(/\/$/, "") + path;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        redirect: "manual",
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(10000),
      });
    } catch (e) {
      if (verbose) console.log(chalk.red(`  ERROR ${path}: ${e.message}`));
      return null;
    }

    if (RETRY_STATUSES.has(res.status)) {
      if (verbose) console.log(chalk.yellow(`  [${res.status}] rate limited, waiting... ${path}`));
      await sleep(RETRY_DELAY_MS);
      continue;
    }

    const loc = res.headers.get("location") ?? "";
    if (REDIRECT_STATUSES.has(res.status) && loc) {
      const dest = loc.replace(base.replace(/\/$/, ""), "").split("#")[0];
      if (verbose) console.log(`  [${chalk.green(res.status)}] ${chalk.dim(path)} → ${chalk.cyan(dest)}`);
      return dest;
    }

    if (verbose) console.log(`  [${chalk.dim(res.status)}] ${path}`);
    return null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * @param {Object} options
 * @param {string} options.base       - Base URL of the site
 * @param {string} options.input      - Broken links report file (default: br.txt)
 * @param {string} options.output     - Output JSON file (default: br_redirects.json)
 * @param {number} options.delay      - Ms to wait between requests (default: 500)
 * @param {boolean} options.quiet
 */
export async function findRedirects(options) {
  const verbose = !options.quiet;
  const inputPath = resolve(process.cwd(), options.input);
  const outputPath = resolve(process.cwd(), options.output);
  const delayMs = options.delay ?? 500;

  let text;
  try {
    text = readFileSync(inputPath, "utf-8");
  } catch {
    console.error(chalk.red(`Error: could not read input file: ${inputPath}`));
    process.exit(1);
  }

  const paths = parseBrokenLinksReport(text);

  if (!paths.length) {
    console.error(chalk.yellow("No broken-link paths found in the report (expected lines with ⎿)."));
    process.exit(1);
  }

  if (verbose) {
    console.log(chalk.cyan(`\nProbing ${paths.length} path${paths.length !== 1 ? "s" : ""} against ${options.base} ...\n`));
  }

  const results = [];
  for (const path of paths) {
    const dest = await probeRedirect(options.base, path, verbose);
    if (dest) results.push({ source: path, destination: dest });
    await sleep(delayMs);
  }

  writeFileSync(outputPath, JSON.stringify(results, null, 2) + "\n", "utf-8");

  if (verbose) {
    console.log(chalk.green(`\n  ✓ ${results.length} redirect${results.length !== 1 ? "s" : ""} written to ${options.output}`));
  }
}
