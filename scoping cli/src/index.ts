import { Command } from "commander";
import { CrawlerEngine } from "./crawler/CrawlerEngine.js";
import type { CliOptions } from "./types.js";

const program = new Command();

program
  .name("doc-scraper-cli")
  .description("Scope documentation sites for migration to Mintlify")
  .version("0.1.0");

program
  .command("scope")
  .description("Analyze documentation site(s) and generate a scoping report")
  .argument("<urls...>", "One or more documentation site URLs to analyze")
  .option("-c, --concurrency <number>", "Max concurrent pages to analyze", "3")
  .option("-m, --max-pages <number>", "Max pages to analyze per site", "2000")
  .option("-o, --output <path>", "Output file path (prints to stdout if omitted)")
  .option("-f, --format <format>", "Output format: json or text", "text")
  .option("--content-selector <selector>", "CSS selector for main content area")
  .option("--scope-prefix <prefix>", "URL prefix to limit crawl scope")
  .option("--auth <credentials>", "HTTP auth credentials (user:pass)")
  .option("--no-headless", "Run browser in visible (headed) mode")
  .option("-v, --verbose", "Enable verbose logging", false)
  .option("-q, --quiet", "Quiet mode - minimal output", false)
  .action(async (urls: string[], opts) => {
    const options: CliOptions = {
      urls,
      concurrency: parseInt(opts.concurrency, 10),
      maxPages: parseInt(opts.maxPages, 10),
      output: opts.output,
      format: opts.format as "json" | "text",
      contentSelector: opts.contentSelector,
      scopePrefix: opts.scopePrefix,
      auth: opts.auth,
      headless: opts.headless !== false,
      verbose: opts.verbose ?? false,
      quiet: opts.quiet ?? false,
    };

    const engine = new CrawlerEngine(options);
    await engine.run(urls);
  });

program.parse();
