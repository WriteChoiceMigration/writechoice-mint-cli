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
