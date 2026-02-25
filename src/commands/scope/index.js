/**
 * Scope command - Analyze documentation site(s) and generate a scoping report.
 *
 * Usage: writechoice scope <urls...> [options]
 */

import { CrawlerEngine } from "./crawler/CrawlerEngine.js";

/**
 * Run the scoping analysis on one or more documentation sites.
 * @param {string[]} urls - Documentation site URLs to analyze
 * @param {object} options - CLI options
 */
export async function runScope(urls, options) {
  const engineOptions = {
    urls,
    concurrency: options.concurrency ?? 3,
    maxPages: options.maxPages ?? 2000,
    output: options.output,
    format: options.format ?? "text",
    contentSelector: options.contentSelector,
    scopePrefix: options.scopePrefix,
    auth: options.auth,
    headless: options.headless !== false,
    verbose: options.verbose ?? false,
    quiet: options.quiet ?? false,
  };

  const engine = new CrawlerEngine(engineOptions);
  await engine.run(urls);
}
