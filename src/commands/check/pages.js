/**
 * Pages Validator
 *
 * Validates that every page in docs.json navigation loads successfully.
 *
 * Default mode: HTTP fetch, expects 2xx/3xx status.
 * Local mode (--local): Puppeteer, inspects div.mdx-content for parse errors / empty content.
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync, readdirSync, statSync } from "fs";
import { join, relative, sep } from "path";
import chalk from "chalk";
import { chromium } from "playwright";

const TIMEOUT_MS = 50000;
const PARSING_ERROR_TEXT = "A parsing error occured";

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

// ── Orphan page discovery (--include-orphans) ───────────────────────────────

const ORPHAN_IGNORED_DIRS = new Set(["node_modules", ".git", "snippets", "openapi", ".mintlify"]);

/**
 * Every .mdx/.md file in the repo, nav-listed or not — a page can be broken
 * (or simply orphaned) without ever being linked from docs.json's navigation.
 */
export function collectAllPagePaths(repoRoot) {
  const pages = new Set();

  function walk(dir) {
    const name = dir.split("/").pop();
    if (ORPHAN_IGNORED_DIRS.has(name)) return;
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (entry.endsWith(".mdx") || entry.endsWith(".md")) {
        const rel = relative(repoRoot, fullPath).replace(/\.(mdx|md)$/, "");
        pages.add(rel.split(sep).join("/")); // normalise path separators to "/"
      }
    }
  }

  walk(repoRoot);
  return [...pages].sort();
}

/** Absolute path to a page's source .mdx or .md file, or null if neither exists. */
export function sourceFileForPage(repoRoot, pagePath) {
  const mdx = join(repoRoot, `${pagePath}.mdx`);
  if (existsSync(mdx)) return mdx;
  const md = join(repoRoot, `${pagePath}.md`);
  if (existsSync(md)) return md;
  return null;
}

// ── Content phrase verification (--verify-content) ──────────────────────────

const TYPOGRAPHIC_MAP = {
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "-",
  "…": "...",
  "​": "",
};

export function normalizeText(s) {
  const translated = s.replace(/[‘’“”–—…​]/g, (c) => TYPOGRAPHIC_MAP[c]);
  return translated.replace(/\s+/g, " ").trim().toLowerCase();
}

const FRONTMATTER_STRIP_RE = /^---\n[\s\S]*?\n---\n/;
const FENCE_STRIP_RE = /```[\s\S]*?```/g;
const JSX_COMMENT_STRIP_RE = /\{\/\*[\s\S]*?\*\/\}/g;

/**
 * Pulls a short, distinctive plain-text snippet from a page's source body
 * to confirm it actually rendered, not just that *something* rendered.
 * Returns null if no suitable line is found.
 */
export function extractPhrase(mdText) {
  let body = mdText.replace(FRONTMATTER_STRIP_RE, "");
  body = body.replace(FENCE_STRIP_RE, "");
  body = body.replace(JSX_COMMENT_STRIP_RE, "");

  for (const rawLine of body.split("\n")) {
    let line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#") || line.startsWith("<") || line.startsWith("![")) continue;
    if ([...line].every((c) => "-=*_ ".includes(c))) continue;

    line = line.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
    line = line.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
    line = line.replace(/[`*_>#]/g, "");
    line = normalizeText(line);
    if (line.length < 20) continue;

    const phrase = line.split(" ").slice(0, 10).join(" ").trim();
    if (phrase.length >= 15) return phrase;
  }
  return null;
}

// ── HTTP check ───────────────────────────────────────────────────────────────

async function checkPageHttp(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (docs-validator)" },
    });
    const ok = res.status >= 200 && res.status < 400;
    return { url, ok, status: res.status, error: ok ? null : `HTTP ${res.status}` };
  } catch (err) {
    return { url, ok: false, status: null, error: err.name === "AbortError" ? "Request timed out" : err.message };
  } finally {
    clearTimeout(timer);
  }
}

// ── Local (Puppeteer) check ──────────────────────────────────────────────────

async function checkPageLocal(page, url, phrase = null) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });

    // Poll until div.mdx-content has stable non-empty content, shows the parse
    // error, or content disappears after having been present (React error boundary).
    const handle = await page.waitForFunction(
      (errorText) => {
        const el = document.querySelector("div.mdx-content");
        if (!el) return null;

        const text = el.textContent.trim();

        if (text.includes(errorText)) {
          return { ok: false, error: "Parsing error displayed on page" };
        }

        if (text.length > 0) {
          if (!window.__mdxStable || window.__mdxStable.text !== text) {
            window.__mdxStable = { text, since: Date.now() };
            return null;
          }
          if (Date.now() - window.__mdxStable.since >= 800) {
            return { ok: true, error: null, text };
          }
          return null;
        }

        // Empty — if we previously saw content, React cleared it
        if (window.__mdxStable?.text) {
          return { ok: false, error: "Content is empty after load" };
        }

        return null;
      },
      PARSING_ERROR_TEXT,
      { timeout: TIMEOUT_MS, polling: 100 }
    );

    const result = await handle.jsonValue();

    // Content is present and stable, but does it actually contain the
    // expected page — not just a shell with no article content?
    if (result.ok && phrase) {
      const normalizedContent = normalizeText(result.text || "");
      const normalizedPhrase = normalizeText(phrase);
      if (!normalizedContent.includes(normalizedPhrase)) {
        return { url, ok: false, status: null, error: `expected phrase not found: ${JSON.stringify(phrase)}` };
      }
    }

    return { url, ok: result.ok, status: null, error: result.error };
  } catch (err) {
    const msg = err.message?.includes("Timeout") ? "Timed out waiting for page content" : err.message;
    return { url, ok: false, status: null, error: msg };
  }
}

// ── Concurrency helpers ──────────────────────────────────────────────────────

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

async function runLocalConcurrent(urls, concurrency, browser, onResult, phraseByUrl = null) {
  const poolSize = Math.min(concurrency, urls.length);
  const pages = await Promise.all(Array.from({ length: poolSize }, () => browser.newPage()));

  let index = 0;
  async function worker(page) {
    while (index < urls.length) {
      const url = urls[index++];
      onResult(await checkPageLocal(page, url, phraseByUrl?.get(url) ?? null));
    }
  }

  await Promise.all(pages.map(worker));
  await Promise.all(pages.map((p) => p.close()));
}

// ── Progress / report helpers ────────────────────────────────────────────────

function progressPath(outputPath) {
  return outputPath.replace(/\.json$/, ".progress.json");
}

function loadJson(filePath) {
  if (existsSync(filePath)) {
    try {
      return JSON.parse(readFileSync(filePath, "utf-8"));
    } catch {
      /* ignore */
    }
  }
  return null;
}

function saveJson(filePath, data) {
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function checkPages(options) {
  const {
    baseUrl,
    docs: docsFile = "docs.json",
    output = "pages_report.json",
    concurrency = null,
    batchSize = 100,
    batchPause = 5000,
    local = false,
    includeOrphans = false,
    verifyContent = false,
    verbose = true,
  } = options;

  if (!baseUrl) {
    console.error(chalk.red("\n✗ Missing base URL. Provide it as an argument or set pages.url in config.json"));
    process.exit(1);
  }

  const docsPath = join(process.cwd(), docsFile);
  if (!existsSync(docsPath)) {
    console.error(chalk.red(`\n✗ docs.json not found at: ${docsPath}`));
    process.exit(1);
  }

  const repoRoot = process.cwd();
  const docs = JSON.parse(readFileSync(docsPath, "utf-8"));
  const navPages = new Set(extractPages(docs.navigation || {}));

  let pages;
  if (includeOrphans) {
    const orphanPages = collectAllPagePaths(repoRoot);
    pages = [...new Set([...navPages, ...orphanPages])];
    const orphanCount = pages.length - navPages.size;
    if (orphanCount > 0 && verbose) {
      console.log(chalk.dim(`Including ${orphanCount} orphan page${orphanCount !== 1 ? "s" : ""} not in docs.json nav`));
    }
  } else {
    pages = [...navPages];
  }

  const base = baseUrl.replace(/\/$/, "");
  const allUrls = pages.map((p) => `${base}/${p}`);

  // Only local mode can inspect rendered content, so phrase verification is
  // local-only. Build url -> expected phrase once, up front.
  let phraseByUrl = null;
  if (local && verifyContent) {
    phraseByUrl = new Map();
    for (const p of pages) {
      const src = sourceFileForPage(repoRoot, p);
      if (!src) continue;
      const phrase = extractPhrase(readFileSync(src, "utf-8"));
      if (phrase) phraseByUrl.set(`${base}/${p}`, phrase);
    }
  }

  const outputPath = join(process.cwd(), output);
  const progPath = progressPath(outputPath);

  // Load prior state: passed URLs to skip, failed URLs to retry
  const passedUrls = new Set(loadJson(progPath) ?? []);
  const existingFailures = loadJson(outputPath) ?? [];

  const urlsToCheck = allUrls.filter((u) => !passedUrls.has(u));
  const skipped = allUrls.length - urlsToCheck.length;

  if (skipped > 0 && verbose) {
    console.log(chalk.dim(`\nResuming — skipping ${skipped} already-passed page${skipped !== 1 ? "s" : ""}`));
  }

  const total = allUrls.length;
  const totalToCheck = urlsToCheck.length;
  const effectiveBatchSize = local ? Math.min(batchSize, 50) : batchSize;
  const effectiveConcurrency = concurrency ?? (local ? 3 : 20);
  const totalBatches = Math.ceil(totalToCheck / effectiveBatchSize);

  if (verbose) {
    const mode = local ? chalk.cyan("local/playwright") : chalk.white("http");
    console.log(
      chalk.bold(
        `\nChecking ${totalToCheck} pages — mode: ${mode}, ${totalBatches} batch${totalBatches !== 1 ? "es" : ""} of ${effectiveBatchSize}, concurrency: ${effectiveConcurrency}\n`,
      ),
    );
  }

  const failedMap = new Map(existingFailures.map((f) => [f.url, f]));
  let done = 0;

  let browser = null;
  if (local) {
    browser = await chromium.launch({ headless: true });
  }

  try {
    for (let b = 0; b < totalBatches; b++) {
      const batchUrls = urlsToCheck.slice(b * effectiveBatchSize, (b + 1) * effectiveBatchSize);

      if (verbose && totalBatches > 1) {
        const start = b * effectiveBatchSize + 1;
        const end = Math.min((b + 1) * effectiveBatchSize, totalToCheck);
        console.log(chalk.bold(`\nBatch ${b + 1}/${totalBatches} — pages ${start}–${end}\n`));
      }

      const onResult = ({ url, ok, status, error }) => {
        const i = ++done;
        if (ok) {
          passedUrls.add(url);
          failedMap.delete(url);
          if (verbose) console.log(`[${String(i).padStart(3)}/${totalToCheck}] ${chalk.green("PASS")}  ${url}`);
        } else {
          failedMap.set(url, { url, status, error });
          const detail = error ? `  (${error})` : "";
          if (verbose) console.log(`[${String(i).padStart(3)}/${totalToCheck}] ${chalk.red("FAIL")}  ${url}${detail}`);
        }
      };

      if (local) {
        await runLocalConcurrent(batchUrls, effectiveConcurrency, browser, onResult, phraseByUrl);
      } else {
        const tasks = batchUrls.map((url) => async () => checkPageHttp(url));
        await runConcurrent(tasks, effectiveConcurrency, onResult);
      }

      saveJson(progPath, [...passedUrls]);
      saveJson(outputPath, [...failedMap.values()]);

      if (verbose) {
        console.log(
          chalk.dim(
            `\nBatch ${b + 1} done — ${failedMap.size} failure${failedMap.size !== 1 ? "s" : ""} so far, progress saved`,
          ),
        );
      }

      if (b < totalBatches - 1) {
        if (verbose) console.log(chalk.dim(`Pausing ${batchPause / 1000}s before next batch…`));
        await new Promise((r) => setTimeout(r, batchPause));
      }
    }
  } finally {
    if (browser) await browser.close();
  }

  const failures = [...failedMap.values()];
  const passedCount = passedUrls.size;

  console.log(`\n${"=".repeat(60)}`);
  console.log(
    `Results: ${chalk.green(passedCount + " passed")}, ${chalk.red(failures.length + " failed")} out of ${total} pages`,
  );
  console.log(`Report written to ${output} (${failures.length} failures)`);

  if (failures.length === 0) {
    if (existsSync(progPath)) unlinkSync(progPath);
    console.log(chalk.green("All pages loaded successfully."));
  } else {
    console.log(`\nFailed pages:`);
    for (const { url, error } of failures) {
      const detail = error ? ` — ${error}` : "";
      console.log(`  ${url}${detail}`);
    }
    process.exit(1);
  }
}
