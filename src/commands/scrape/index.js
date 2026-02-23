/**
 * wc scrape — Scrape documentation URLs and convert to MDX files
 *
 * Entry point for the scrape command. Loads URLs, fetches HTML,
 * converts to MDX via the pipeline, and writes output files.
 */

import { readFileSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { dirname, join, resolve } from "path";
import chalk from "chalk";
import { fetchPage } from "./scraper.js";
import { convertPage } from "./converter.js";
import { urlToFilePath } from "./url-utils.js";

/**
 * Main scrape command entry point.
 * @param {Object} options - Merged CLI + config options
 * @param {string[]} options.urls - Array of URLs to scrape
 * @param {string} [options.urlsFile] - Path to a JSON file with an array of URLs
 * @param {string} [options.output] - Output directory (default: "output")
 * @param {boolean} [options.playwright] - Use Playwright for JS-rendered pages
 * @param {number} [options.concurrency] - Parallel scraping limit (default: 3)
 * @param {boolean} [options.dryRun] - Preview without writing files
 * @param {boolean} [options.quiet] - Suppress output
 * @param {Object} [options.scrapeConfig] - Full scrape config section
 */
export async function scrape(options) {
  const verbose = !options.quiet;

  // Resolve URLs
  const urls = loadUrls(options);
  if (!urls.length) {
    console.error(chalk.red("Error: No URLs found. Add URLs to urls.json, set scrape.urls_file in config.json, or pass URLs as arguments."));
    process.exit(1);
  }

  const outputDir = options.output || options.scrapeConfig?.output || "output";
  const concurrency = options.concurrency || options.scrapeConfig?.concurrency || 3;
  const usePlaywright = options.playwright || options.scrapeConfig?.playwright || false;
  const playwrightConfig = options.scrapeConfig?.playwright_config || {};
  const dryRun = options.dryRun || false;

  if (verbose) {
    console.log(chalk.cyan(`\nScraping ${urls.length} URL${urls.length !== 1 ? "s" : ""}...`));
    if (dryRun) console.log(chalk.yellow("  [dry-run] No files will be written"));
    if (usePlaywright) console.log(chalk.yellow("  Using Playwright for JS rendering"));
    console.log();
  }

  const results = { success: 0, failed: 0, imageFailures: [] };

  // Process URLs with concurrency batching
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    await Promise.all(
      batch.map((url) => scrapeOne(url, { outputDir, usePlaywright, playwrightConfig, dryRun, verbose, options }, results))
    );
  }

  // Summary
  if (verbose) {
    console.log();
    console.log(chalk.bold("Done."));
    if (results.success) console.log(chalk.green(`  ✓ ${results.success} page${results.success !== 1 ? "s" : ""} converted`));
    if (results.failed) console.log(chalk.red(`  ✗ ${results.failed} failed`));
  }

  // Write image failure report
  if (results.imageFailures.length) {
    const reportPath = resolve(join(outputDir, "image_download.json"));
    if (!dryRun) {
      mkdirSync(dirname(reportPath), { recursive: true });
      writeFileSync(reportPath, JSON.stringify(results.imageFailures, null, 2));
    }
    if (verbose) {
      console.log(chalk.yellow(`  ⚠ ${results.imageFailures.length} image download failure${results.imageFailures.length !== 1 ? "s" : ""} written to ${reportPath}`));
    }
  }
}

/**
 * Scrapes a single URL and writes the MDX file.
 */
async function scrapeOne(url, { outputDir, usePlaywright, playwrightConfig, dryRun, verbose, options }, results) {
  const outPath = urlToFilePath(url, outputDir);

  try {
    if (verbose) process.stdout.write(`  Fetching ${chalk.dim(url)}...`);

    const html = await fetchPage(url, usePlaywright, playwrightConfig);

    if (verbose) process.stdout.write(" converting...");

    const scrapeConfig = {
      ...(options.scrapeConfig || {}),
      output: outputDir,
      dryRun,
    };

    const { mdx, imageFailures } = await convertPage(html, url, scrapeConfig);

    if (!dryRun) {
      const absPath = resolve(outPath);
      mkdirSync(dirname(absPath), { recursive: true });
      writeFileSync(absPath, mdx, "utf-8");
    }

    if (imageFailures.length) {
      results.imageFailures.push(...imageFailures.map((f) => ({ ...f, page: url })));
    }

    results.success++;
    if (verbose) {
      console.log(chalk.green(` ✓ → ${outPath}`));
    }
  } catch (err) {
    results.failed++;
    if (verbose) {
      console.log(chalk.red(` ✗ ${err.message}`));
    }
  }
}

/**
 * Loads URLs from CLI args and/or a urls file.
 * The urls file defaults to "urls.json" (or scrape.urls_file from config).
 * If the file path is the default and doesn't exist, it is silently skipped.
 * If the file was explicitly passed via --urls-file and doesn't exist, it errors.
 * @param {Object} options
 * @returns {string[]}
 */
function loadUrls(options) {
  const urls = Array.isArray(options.urls) ? [...options.urls] : [];
  const explicitFile = options["urls-file"];
  const urlsFilePath = explicitFile || options.urlsFile;

  if (urlsFilePath) {
    const filePath = resolve(urlsFilePath);
    if (!existsSync(filePath)) {
      if (explicitFile) {
        console.error(chalk.red(`Error: URLs file not found: ${urlsFilePath}`));
        process.exit(1);
      }
      // Default file not found — skip silently
    } else {
      try {
        const fileUrls = JSON.parse(readFileSync(filePath, "utf-8"));
        if (!Array.isArray(fileUrls)) {
          console.error(chalk.red("Error: URLs file must be a JSON array of strings."));
          process.exit(1);
        }
        urls.push(...fileUrls);
      } catch (err) {
        console.error(chalk.red(`Error reading URLs file: ${err.message}`));
        process.exit(1);
      }
    }
  }

  // Deduplicate
  return [...new Set(urls)];
}
