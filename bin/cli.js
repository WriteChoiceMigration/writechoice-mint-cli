#!/usr/bin/env node

import { Command } from "commander";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packageJson = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

const program = new Command();

program
  .name("writechoice")
  .description(
    "@writechoice/mint-cli@" + packageJson.version + "\n\nCLI tool for Mintlify documentation validation and utilities",
  )
  .version(packageJson.version, "-v, --version", "Output the current version");

// Validate command
const check = program.command("check").description("Validation commands for documentation");

// Validate links subcommand
check
  .command("links [baseUrl] [validationBaseUrl]")
  .description("Validate internal links and anchors in MDX documentation files")
  .option("-f, --file <path>", "Validate links in a single MDX file")
  .option("-d, --dir <path>", "Validate links in a specific directory")
  .option("-o, --output <path>", "Output path for report (without extension)", "links_report")
  .option("--dry-run", "Extract and show links without validating")
  .option("--quiet", "Suppress terminal output (only generate report)")
  .option("-c, --concurrency <number>", "Number of concurrent browser tabs", "25")
  .option("--headless", "Run browser in headless mode (default)", true)
  .option("--no-headless", "Show browser window (for debugging)")
  .action(async (baseUrl, validationBaseUrl, options) => {
    const { loadConfig, mergeLinksConfig, validateRequiredConfig } = await import("../src/utils/config.js");
    const { validateLinks } = await import("../src/commands/validate/links.js");

    // Load config.json if it exists
    const config = loadConfig();

    // Merge CLI args with config file (CLI takes precedence)
    const merged = mergeLinksConfig(baseUrl, validationBaseUrl, options, config);

    // Validate that baseUrl is provided (either via CLI or config)
    try {
      validateRequiredConfig(merged.baseUrl, "writechoice check links");
    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }

    // Set defaults
    merged.options.verbose = !merged.options.quiet;
    merged.options.validationBaseUrl = merged.validationBaseUrl || "http://localhost:3000";

    await validateLinks(merged.baseUrl, merged.options);
  });

// Validate MDX parsing subcommand
check
  .command("parse")
  .description("Validate MDX files for parsing errors")
  .option("-f, --file <path>", "Validate a single MDX file")
  .option("-d, --dir <path>", "Validate MDX files in a specific directory")
  .option("--quiet", "Suppress terminal output (only generate report)")
  .action(async (options) => {
    const { loadConfig, mergeParseConfig } = await import("../src/utils/config.js");
    const { validateMdxFiles } = await import("../src/commands/validate/mdx.js");

    // Load config.json if it exists
    const config = loadConfig();

    // Merge CLI args with config file (CLI takes precedence)
    const mergedOptions = mergeParseConfig(options, config);

    mergedOptions.verbose = !mergedOptions.quiet;
    await validateMdxFiles(mergedOptions);
  });

// Fix command
const fix = program.command("fix").description("Fix issues found in validation reports");

// Fix links subcommand
fix
  .command("links")
  .description("Fix broken anchor links from validation report")
  .option("-r, --report <path>", "Path to validation report", "links_report.json")
  .option("--quiet", "Suppress terminal output")
  .action(async (options) => {
    const { fixLinks } = await import("../src/commands/fix/links.js");
    options.verbose = !options.quiet;
    await fixLinks(options);
  });

// Fix parse subcommand
fix
  .command("parse")
  .description("Fix common MDX parsing errors (void tags, stray angle brackets)")
  .option("-r, --report <path>", "Path to parse validation report", "mdx_errors_report.json")
  .option("-f, --file <path>", "Fix a single MDX file directly")
  .option("-d, --dir <path>", "Fix MDX files in a specific directory")
  .option("--quiet", "Suppress terminal output")
  .action(async (options) => {
    const { fixParse } = await import("../src/commands/fix/parse.js");
    options.verbose = !options.quiet;
    await fixParse(options);
  });

// Fix codeblocks subcommand
fix
  .command("codeblocks")
  .description("Fix code block flags (expandable, lines, wrap) in MDX files")
  .option("-f, --file <path>", "Fix a single MDX file directly")
  .option("-d, --dir <path>", "Fix MDX files in a specific directory")
  .option("-t, --threshold <number>", "Line count threshold for expandable (default: 15)")
  .option("--no-expandable", "Skip expandable threshold processing")
  .option("--lines", "Add 'lines' to all code blocks that lack it")
  .option("--remove-lines", "Remove 'lines' from all code blocks that have it")
  .option("--wrap", "Add 'wrap' to all code blocks that lack it")
  .option("--remove-wrap", "Remove 'wrap' from all code blocks that have it")
  .option("--dry-run", "Preview changes without writing files")
  .option("--quiet", "Suppress terminal output")
  .action(async (options) => {
    const { loadConfig, mergeCodeblocksConfig } = await import("../src/utils/config.js");
    const { fixCodeblocks } = await import("../src/commands/fix/codeblocks.js");

    const config = loadConfig();
    const mergedOptions = mergeCodeblocksConfig(options, config);
    mergedOptions.verbose = !mergedOptions.quiet;
    await fixCodeblocks(mergedOptions);
  });

// Fix inlineimages subcommand
fix
  .command("inlineimages")
  .description("Convert inline images to <InlineImage> components in MDX files")
  .option("-f, --file <path>", "Fix a single MDX file directly")
  .option("-d, --dir <path>", "Fix MDX files in a specific directory")
  .option("--dry-run", "Preview changes without writing files")
  .option("--quiet", "Suppress terminal output")
  .action(async (options) => {
    const { loadConfig, mergeInlineImagesConfig } = await import("../src/utils/config.js");
    const { fixInlineImages } = await import("../src/commands/fix/inlineimages.js");

    const config = loadConfig();
    const mergedOptions = mergeInlineImagesConfig(options, config);
    mergedOptions.verbose = !mergedOptions.quiet;
    await fixInlineImages(mergedOptions);
  });

// Fix h1 subcommand
fix
  .command("h1")
  .description("Remove duplicate H1 headings that match the frontmatter title in MDX files")
  .option("-f, --file <path>", "Fix a single MDX file directly")
  .option("-d, --dir <path>", "Fix MDX files in a specific directory")
  .option("--dry-run", "Preview changes without writing files")
  .option("--quiet", "Suppress terminal output")
  .action(async (options) => {
    const { loadConfig, mergeH1Config } = await import("../src/utils/config.js");
    const { fixH1 } = await import("../src/commands/fix/h1.js");

    const config = loadConfig();
    const mergedOptions = mergeH1Config(options, config);
    mergedOptions.verbose = !mergedOptions.quiet;
    await fixH1(mergedOptions);
  });

// Fix imports subcommand
fix
  .command("imports")
  .description("Check component imports in MDX files and add missing ones from snippets/")
  .option("-f, --file <path>", "Check a single MDX file")
  .option("-d, --dir <path>", "Check MDX files in a specific directory")
  .option("--snippets <path>", "Path to snippets folder (default: snippets)")
  .option("--dry-run", "Preview changes without writing files")
  .option("--quiet", "Suppress terminal output")
  .action(async (options) => {
    const { loadConfig, mergeImportsConfig } = await import("../src/utils/config.js");
    const { fixImports } = await import("../src/commands/fix/imports.js");

    const config = loadConfig();
    const mergedOptions = mergeImportsConfig(options, config);
    mergedOptions.verbose = !mergedOptions.quiet;
    await fixImports(mergedOptions);
  });

// Fix images subcommand
fix
  .command("images")
  .description("Wrap standalone images in <Frame> components in MDX files")
  .option("-f, --file <path>", "Fix a single MDX file directly")
  .option("-d, --dir <path>", "Fix MDX files in a specific directory")
  .option("--download [url]", "Download missing local images; uses source from config or provide a URL")
  .option("--dry-run", "Preview changes without writing files")
  .option("--quiet", "Suppress terminal output")
  .action(async (options) => {
    const { loadConfig, mergeImagesConfig } = await import("../src/utils/config.js");
    const { fixImages } = await import("../src/commands/fix/images.js");

    const config = loadConfig();
    const mergedOptions = mergeImagesConfig(options, config);
    mergedOptions.verbose = !mergedOptions.quiet;
    await fixImages(mergedOptions);
  });

// Scrape command
program
  .command("scrape [urls...]")
  .description("Scrape documentation URLs and convert each page to MDX files")
  .option("--urls-file <file>", "JSON file with an array of URLs to scrape")
  .option("-o, --output <dir>", "Output directory for MDX files (default: output)")
  .option("--playwright", "Use Playwright for JavaScript-rendered pages")
  .option("-c, --concurrency <number>", "Number of parallel requests (default: 3)")
  .option("--dry-run", "Preview output without writing files")
  .option("--quiet", "Suppress terminal output")
  .action(async (urls, options) => {
    const { loadConfig, mergeScrapingConfig } = await import("../src/utils/config.js");
    const { scrape } = await import("../src/commands/scrape/index.js");

    const config = loadConfig();
    const mergedOptions = mergeScrapingConfig({ ...options, urls }, config);
    mergedOptions.verbose = !mergedOptions.quiet;
    await scrape(mergedOptions);
  });

// Nav command group
const nav = program.command("nav").description("Navigation structure commands");

nav
  .command("folders")
  .description("Restructure MDX files to match docs.json navigation hierarchy")
  .option("--docs <file>", "Path to docs.json (default: docs.json)")
  .option("--base [dir]", "Keep each file's original base folder (no value), use a fixed prefix (e.g. docs), or omit for config default")
  .option("--skip-level <n>", "Skip a navigation level by number (repeatable, 1-based)", (v, acc) => [...acc, parseInt(v, 10)], [])
  .option("--rename", "Rename each file using a kebab-case slug of its frontmatter title")
  .option("--dry-run", "Preview moves without writing files")
  .option("--quiet", "Suppress terminal output")
  .action(async (options) => {
    const { loadConfig, mergeNavConfig } = await import("../src/utils/config.js");
    const { navRestructure } = await import("../src/commands/readme/nav.js");

    const config = loadConfig();
    const mergedOptions = mergeNavConfig(options, config);
    mergedOptions.verbose = !mergedOptions.quiet;
    await navRestructure(mergedOptions);
  });

// Metadata command
program
  .command("metadata [baseUrl]")
  .description("Fetch meta tags from live pages and write them into MDX frontmatter")
  .option("-f, --file <path>", "Process a single MDX file")
  .option("-d, --dir <path>", "Process MDX files in a specific directory")
  .option("-c, --concurrency <number>", "Number of parallel HTTP requests", "15")
  .option("--dry-run", "Preview changes without writing files")
  .option("--quiet", "Suppress terminal output")
  .action(async (baseUrl, options) => {
    const { loadConfig, mergeMetadataConfig } = await import("../src/utils/config.js");
    const { runMetadata } = await import("../src/commands/metadata.js");

    const config = loadConfig();
    const mergedOptions = mergeMetadataConfig({ ...options, baseUrl }, config);
    mergedOptions.verbose = !mergedOptions.quiet;
    await runMetadata(mergedOptions);
  });

// Scope command
program
  .command("scope <urls...>")
  .description("Analyze documentation site(s) and generate a scoping report for migration")
  .option("-c, --concurrency <number>", "Max concurrent pages to analyze", "3")
  .option("-m, --max-pages <number>", "Max pages to analyze per site", "2000")
  .option("-o, --output <path>", "Output file path (prints to stdout if omitted)")
  .option("-f, --format <format>", "Output format: json or text", "text")
  .option("--content-selector <selector>", "CSS selector for main content area")
  .option("--scope-prefix <prefix>", "URL prefix to limit crawl scope")
  .option("--auth <credentials>", "HTTP auth credentials (user:pass)")
  .option("--no-headless", "Run browser in visible (headed) mode")
  .option("-V, --verbose", "Enable verbose logging", false)
  .option("--quiet", "Quiet mode - minimal output", false)
  .action(async (urls, options) => {
    const { runScope } = await import("../src/commands/scope/index.js");

    const scopeOptions = {
      concurrency: parseInt(options.concurrency, 10),
      maxPages: parseInt(options.maxPages, 10),
      output: options.output,
      format: options.format,
      contentSelector: options.contentSelector,
      scopePrefix: options.scopePrefix,
      auth: options.auth,
      headless: options.headless !== false,
      verbose: options.verbose ?? false,
      quiet: options.quiet ?? false,
    };

    scopeOptions.verbose = scopeOptions.verbose || !scopeOptions.quiet;

    await runScope(urls, scopeOptions);
  });

// Config command
program
  .command("config")
  .description("Generate a config.json template file")
  .option("--force", "Overwrite existing config.json file")
  .option("--quiet", "Suppress terminal output")
  .action(async (options) => {
    const { generateConfig } = await import("../src/commands/config.js");
    await generateConfig(options);
  });

// Update command
program
  .command("update")
  .description("Update @writechoice/mint-cli to the latest version")
  .action(async () => {
    console.log("Checking for updates...");

    try {
      // Get latest version from npm
      const latestVersion = execSync(`npm view ${packageJson.name} version`, { encoding: "utf-8" }).trim();

      const currentVersion = packageJson.version;

      if (latestVersion === currentVersion) {
        console.log(`✓ You're already on the latest version (${currentVersion})`);
        return;
      }

      console.log(`\nUpdate available: ${currentVersion} → ${latestVersion}`);
      console.log(`\nUpdating ${packageJson.name}...`);

      // Update the package
      execSync(`npm install -g ${packageJson.name}@latest`, {
        stdio: "inherit",
      });

      console.log(`\n✓ Successfully updated to version ${latestVersion}`);
    } catch (error) {
      console.error("Error checking for updates:", error.message);
      console.log("\nYou can manually update with:");
      console.log(`  npm install -g ${packageJson.name}@latest`);
      process.exit(1);
    }
  });

// Check for updates on every command (non-blocking)
async function checkForUpdates() {
  try {
    const latestVersion = execSync(`npm view ${packageJson.name} version 2>/dev/null`, {
      encoding: "utf-8",
      timeout: 2000,
    }).trim();

    const currentVersion = packageJson.version;

    if (latestVersion && latestVersion !== currentVersion) {
      console.log(`\n┌─────────────────────────────────────────────────┐`);
      console.log(`│  Update available: ${currentVersion} → ${latestVersion.padEnd(24)} │`);
      console.log(`│  Run: writechoice update                       │`);
      console.log(`└─────────────────────────────────────────────────┘\n`);
    }
  } catch (error) {
    // Silently fail - don't interrupt the user
  }
}

// Run update check in background (don't block execution)
checkForUpdates();

program.parse();
