/**
 * KaTeX Error Checker
 *
 * Finds pages with KaTeX render errors by checking for .katex-error elements in the HTML.
 * - check katex <baseUrl>: crawls all pages from docs.json navigation
 * - check katex --file <report.json>: re-checks only pages listed in a previous error report
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import chalk from "chalk";

const TIMEOUT_MS = 15000;
const KATEX_ERROR_RE =
  /<span[^>]+class="[^"]*katex-error[^"]*"[^>]*title="([^"]*)"[^>]*>([^<]*)<\/span>/gi;

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

// ── HTTP fetch with timeout ──────────────────────────────────────────────────

async function fetchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (katex-validator)" },
    });
    if (!res.ok) {
      return { html: null, error: `HTTP ${res.status}: ${res.statusText}` };
    }
    const html = await res.text();
    return { html, error: null };
  } catch (err) {
    return { html: null, error: err.name === "AbortError" ? "Request timed out" : err.message };
  } finally {
    clearTimeout(timer);
  }
}

function findKatexErrors(html) {
  const errors = [];
  let match;
  KATEX_ERROR_RE.lastIndex = 0;
  while ((match = KATEX_ERROR_RE.exec(html)) !== null) {
    errors.push({ title: match[1], content: match[2].trim() });
  }
  return errors;
}

// ── Concurrency limiter ──────────────────────────────────────────────────────

async function runConcurrent(tasks, concurrency, onResult) {
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      const task = tasks[index++];
      const result = await task();
      onResult(result);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, worker);
  await Promise.all(workers);
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function checkKatex(options) {
  const {
    baseUrl,
    file: reportFile,
    docs: docsFile = "docs.json",
    output = "katex_errors.json",
    concurrency = 50,
    verbose = true,
  } = options;

  let urls;
  let mode;

  if (reportFile) {
    // Re-check mode: read URLs from a previous report
    mode = "recheck";
    if (!existsSync(reportFile)) {
      console.error(chalk.red(`\n✗ Report file not found: ${reportFile}`));
      process.exit(1);
    }
    const data = JSON.parse(readFileSync(reportFile, "utf-8"));
    urls = [...new Set(data.map((e) => e.url))];
    if (verbose) console.log(chalk.bold(`\nRe-checking ${urls.length} pages from ${reportFile}\n`));
  } else {
    // Full scan mode: read docs.json and build URLs from navigation
    mode = "scan";
    if (!baseUrl) {
      console.error(
        chalk.red("\n✗ Missing base URL. Provide it as an argument or set katex.url in config.json")
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
    urls = pages.map((p) => `${base}/${p}`);
    if (verbose) console.log(chalk.bold(`\nFound ${urls.length} pages to check\n`));
  }

  const clean = [];
  const withErrors = [];
  const fetchFailures = [];
  let done = 0;
  const total = urls.length;

  const tasks = urls.map((url) => async () => {
    const { html, error } = await fetchHtml(url);
    const i = ++done;
    if (error) {
      fetchFailures.push({ url, error });
      if (verbose)
        console.log(`[${String(i).padStart(3)}/${total}] ${chalk.red("ERR  ")} ${url}  (${error})`);
    } else {
      const errors = findKatexErrors(html);
      if (errors.length > 0) {
        withErrors.push({ url, errors });
        if (verbose) {
          console.log(
            `[${String(i).padStart(3)}/${total}] ${chalk.red("FAIL ")} ${url}  (${errors.length} katex error(s))`
          );
          for (const { title, content } of errors) {
            console.log(`           title=${JSON.stringify(title)}  content=${JSON.stringify(content)}`);
          }
        }
      } else {
        clean.push(url);
        if (verbose)
          console.log(`[${String(i).padStart(3)}/${total}] ${chalk.green("OK   ")} ${url}`);
      }
    }
  });

  await runConcurrent(tasks, concurrency, () => {});

  // Summary
  console.log(`\n${"=".repeat(60)}`);
  const label = mode === "recheck" ? "still with errors" : "with KaTeX errors";
  console.log(
    `Results: ${clean.length} clean, ${chalk.red(withErrors.length + " " + label)}, ` +
      `${fetchFailures.length} fetch failures  (out of ${total} pages)`
  );

  // Write report
  const report = withErrors.map(({ url, errors }) => ({
    url,
    katex_errors: errors.map(({ title, content }) => ({ title, content })),
  }));

  const outputPath = join(process.cwd(), output);
  writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf-8");

  const verb = mode === "recheck" ? "Updated" : "Report written to";
  console.log(`\n${verb} ${output} (${report.length} pages with errors)`);

  if (withErrors.length > 0) {
    console.log(`\nPages with KaTeX errors:`);
    for (const { url, errors } of withErrors) {
      console.log(`  ${url}  (${errors.length} error(s))`);
    }
    process.exit(1);
  } else {
    console.log(chalk.green("No KaTeX errors found."));
  }
}
