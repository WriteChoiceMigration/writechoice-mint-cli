/**
 * Image Validator
 *
 * Two-phase validation:
 *   Phase 1 — fetches every page in docs.json navigation, extracts img src
 *             URLs from within div.mdx-content, and builds a map of
 *             imageUrl → [pages that reference it].
 *   Phase 2 — validates each unique image URL with a HEAD/GET request and
 *             reports failures alongside which pages reference the broken image.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { load as cheerioLoad } from "cheerio";
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

// ── HTTP helpers ─────────────────────────────────────────────────────────────

async function fetchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (image-validator)" },
    });
    if (!res.ok) return { html: null, error: `HTTP ${res.status} ${res.statusText}` };
    return { html: await res.text(), error: null };
  } catch (err) {
    return { html: null, error: err.name === "AbortError" ? "Request timed out" : err.message };
  } finally {
    clearTimeout(timer);
  }
}

async function checkImageUrl(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // Try HEAD first to avoid downloading image data
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (image-validator)" },
    });
    // Some servers reject HEAD — fall back to GET if needed
    if (res.status === 405) {
      controller.abort();
      const controller2 = new AbortController();
      const timer2 = setTimeout(() => controller2.abort(), TIMEOUT_MS);
      try {
        const res2 = await fetch(url, {
          signal: controller2.signal,
          headers: { "User-Agent": "Mozilla/5.0 (image-validator)" },
        });
        return { url, status: res2.status, error: null };
      } finally {
        clearTimeout(timer2);
      }
    }
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

// ── Image URL extraction ─────────────────────────────────────────────────────

function extractImageUrls(html, pageUrl, baseUrl) {
  const $ = cheerioLoad(html);
  const urls = new Set();

  $("div.mdx-content img").each((_, el) => {
    const src = $(el).attr("src");
    if (!src || src.startsWith("data:")) return;

    if (src.startsWith("http://") || src.startsWith("https://")) {
      urls.add(src);
    } else if (src.startsWith("//")) {
      urls.add("https:" + src);
    } else if (src.startsWith("/")) {
      urls.add(baseUrl.replace(/\/$/, "") + src);
    } else {
      // relative — resolve against page URL
      urls.add(pageUrl.replace(/\/$/, "") + "/" + src);
    }
  });

  return urls;
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

export async function checkImages(options) {
  const {
    baseUrl,
    docs: docsFile = "docs.json",
    output = "images_report.json",
    concurrency = 10,
    verbose = true,
  } = options;

  if (!baseUrl) {
    console.error(
      chalk.red(
        "\n✗ Missing base URL. Provide it as an argument or set imageCheck.url in config.json"
      )
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

  if (verbose)
    console.log(chalk.bold(`\nPhase 1: fetching ${pages.length} pages to collect image URLs...\n`));

  // ── Phase 1: collect image URLs per page ─────────────────────────────────

  // imageUrl → Set of page paths that reference it
  const imageToPages = new Map();
  const pageErrors = [];
  let pageDone = 0;

  const phase1Tasks = pages.map((pagePath) => async () => {
    const pageUrl = `${base}/${pagePath}`;
    const { html, error } = await fetchHtml(pageUrl);
    return { pagePath, pageUrl, html, error };
  });

  await runConcurrent(phase1Tasks, concurrency, ({ pagePath, pageUrl, html, error }) => {
    const i = ++pageDone;
    if (error) {
      pageErrors.push({ pagePath, error });
      if (verbose)
        console.log(
          `  [${String(i).padStart(3)}/${pages.length}] ${chalk.red("PAGE ERR")}  ${pageUrl}  (${error})`
        );
    } else {
      const imgUrls = extractImageUrls(html, pageUrl, base);
      if (verbose)
        console.log(
          `  [${String(i).padStart(3)}/${pages.length}] ${String(imgUrls.size).padStart(3)} image(s)  ${pageUrl}`
        );
      for (const imgUrl of imgUrls) {
        if (!imageToPages.has(imgUrl)) imageToPages.set(imgUrl, new Set());
        imageToPages.get(imgUrl).add(pagePath);
      }
    }
  });

  if (pageErrors.length > 0) {
    console.log(chalk.yellow(`\nWarning: ${pageErrors.length} page(s) could not be fetched:`));
    for (const { pagePath, error } of pageErrors) {
      console.log(`  ${pagePath}: ${error}`);
    }
  }

  const allImages = [...imageToPages.keys()];
  console.log(
    `\nFound ${allImages.length} unique image(s) across ${pages.length} page(s)`
  );

  if (allImages.length === 0) {
    console.log(chalk.green("\nNo images to validate."));
    writeFileSync(join(process.cwd(), output), "[]", "utf-8");
    return;
  }

  // ── Phase 2: validate each unique image URL ──────────────────────────────

  if (verbose) console.log(chalk.bold(`\nPhase 2: validating ${allImages.length} unique image(s)...\n`));

  const passed = [];
  const failed = [];
  let imgDone = 0;

  const phase2Tasks = allImages.map((url) => async () => checkImageUrl(url));

  await runConcurrent(phase2Tasks, concurrency, ({ url, status, error }) => {
    const i = ++imgDone;
    const ok = status !== null && status >= 200 && status < 400;
    if (ok) {
      passed.push(url);
      if (verbose)
        console.log(
          `[${String(i).padStart(4)}/${allImages.length}] ${chalk.green("PASS")}  ${status}  ${url}`
        );
    } else {
      failed.push({ url, status, error });
      const label = status ?? "ERR ";
      const detail = error ? `  (${error})` : "";
      if (verbose)
        console.log(
          `[${String(i).padStart(4)}/${allImages.length}] ${chalk.red("FAIL")}  ${label}  ${url}${detail}`
        );
    }
  });

  console.log(`\n${"=".repeat(60)}`);
  console.log(
    `Results: ${chalk.green(passed.length + " passed")}, ${chalk.red(failed.length + " failed")} out of ${allImages.length} unique images`
  );

  const report = failed.map(({ url, status, error }) => ({
    url,
    status,
    error,
    referencedBy: [...imageToPages.get(url)],
  }));

  const outputPath = join(process.cwd(), output);
  writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`\nReport written to ${output} (${report.length} failed images)`);

  if (failed.length > 0) {
    console.log(`\nFailed images and the pages that reference them:`);
    for (const { url, status, error } of failed) {
      const label = status ?? "ERR";
      const detail = error ? ` - ${error}` : "";
      console.log(`  [${label}] ${url}${detail}`);
      for (const page of imageToPages.get(url)) {
        console.log(`        referenced by: ${page}`);
      }
    }
    process.exit(1);
  } else {
    console.log(chalk.green("All images loaded successfully."));
  }
}
