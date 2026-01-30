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
  .description("CLI tool for Mintlify documentation validation and utilities")
  .version(packageJson.version, "-v, --version", "Output the current version");

// Validate command
const check = program.command("check").description("Validation commands for documentation");

// Validate links subcommand
check
  .command("links <baseUrl> [validationBaseUrl]")
  .description("Validate internal links and anchors in MDX documentation files")
  .option("-f, --file <path>", "Validate links in a single MDX file")
  .option("-d, --dir <path>", "Validate links in a specific directory")
  .option("-o, --output <path>", "Output path for JSON report", "links_report.json")
  .option("--dry-run", "Extract and show links without validating")
  .option("--quiet", "Suppress terminal output (only generate report)")
  .option("-c, --concurrency <number>", "Number of concurrent browser tabs", "25")
  .option("--headless", "Run browser in headless mode (default)", true)
  .option("--no-headless", "Show browser window (for debugging)")
  .option("--fix", "Automatically fix anchor links in MDX files")
  .option("--fix-from-report [path]", "Fix anchor links from report file (default: links_report.json)")
  .action(async (baseUrl, validationBaseUrl, options) => {
    const { validateLinks } = await import("../src/commands/validate/links.js");
    // Verbose is now default (true unless --quiet is specified)
    options.verbose = !options.quiet;
    // Set validation base URL to localhost:3000 if not provided
    options.validationBaseUrl = validationBaseUrl || "http://localhost:3000";
    await validateLinks(baseUrl, options);
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
