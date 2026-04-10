/**
 * Pages Validator
 *
 * Validates that every page in docs.json navigation loads successfully (HTTP 2xx/3xx).
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import chalk from "chalk";

const TIMEOUT_MS = 15000;

// ── Navigation extraction ────────────────────────────────────────────────────

function extractPages(node) {
  const pages = [];
  if (typeof node === "string") {
    pages.push(node);
  } else if (Array.isArray(node)) {
    for (const item of node) pages.push(...extractPages(item));
  } else if (node && typeof node === "object") {
    for (const key of ["pages", "tabs", "groups", "anchors", "dropdowns", "versions"]) {
      if (key in node) pages.push(...extractPages(node[key]));
    }
  }
  return pages;
}

// ── HTTP fetch ───────────────────────────────────────────────────────────────

async function checkPage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (docs-validator)" },
    });
    return { url, status: res.status, error: null };
  } catch (err) {
    return {
      url,
      status: null,
      error: err.name === "AbortError" ? "Request timed out" : err.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ── Concurrency limiter ──────────────────────────────────────────────────────

async function runConcurrent(tasks, concurrency, onResult) {
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      const task = tasks[index++];
      onResult(await task());
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function checkPages(options) {
  const {
    baseUrl,
    docs: docsFile = "docs.json",
    output = "pages_report.json",
    concurrency = 50,
    verbose = true,
  } = options;

  if (!baseUrl) {
    console.error(
      chalk.red("\n✗ Missing base URL. Provide it as an argument or set pages.url in config.json")
    );
    process.exit(1);
  }

  const docsPath = join(process.cwd(), docsFile);
  if (!existsSync(docsPath)) {
    console.error(chalk.red(`\n✗ docs.json not found at: ${docsPath}`));
    process.exit(1);
  }

  const docs = JSON.parse(readFileSync(docsPath, "utf-8"));
  const pages = [...new Set(extractPages(docs.navigation || {}))];
  const base = baseUrl.replace(/\/$/, "");
  const urls = pages.map((p) => `${base}/${p}`);

  if (verbose) console.log(chalk.bold(`\nFound ${urls.length} pages to validate\n`));

  const passed = [];
  const failed = [];
  let done = 0;
  const total = urls.length;

  const tasks = urls.map((url) => async () => checkPage(url));

  await runConcurrent(tasks, concurrency, ({ url, status, error }) => {
    const i = ++done;
    const ok = status !== null && status >= 200 && status < 400;
    if (ok) {
      passed.push({ url, status });
      if (verbose)
        console.log(`[${String(i).padStart(3)}/${total}] ${chalk.green("PASS")}  ${status}  ${url}`);
    } else {
      failed.push({ url, status, error });
      const label = status ?? "ERR ";
      const detail = error ? `  (${error})` : "";
      if (verbose)
        console.log(
          `[${String(i).padStart(3)}/${total}] ${chalk.red("FAIL")}  ${label}  ${url}${detail}`
        );
    }
  });

  console.log(`\n${"=".repeat(60)}`);
  console.log(
    `Results: ${chalk.green(passed.length + " passed")}, ${chalk.red(failed.length + " failed")} out of ${total} pages`
  );

  const report = failed.map(({ url, status, error }) => ({ url, status, error }));
  const outputPath = join(process.cwd(), output);
  writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`\nReport written to ${output} (${report.length} failures)`);

  if (failed.length > 0) {
    console.log(`\nFailed pages:`);
    for (const { url, status, error } of failed) {
      const label = status ?? "ERR";
      const detail = error ? ` - ${error}` : "";
      console.log(`  [${label}] ${url}${detail}`);
    }
    process.exit(1);
  } else {
    console.log(chalk.green("All pages loaded successfully."));
  }
}
