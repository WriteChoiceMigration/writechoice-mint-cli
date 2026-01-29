#!/usr/bin/env node

import { Command } from "commander";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packageJson = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

const program = new Command();

program
  .name("writechoice")
  .description("CLI tool for Mintlify documentation validation and utilities")
  .version(packageJson.version);

// Validate command
const check = program.command("check").description("Validation commands for documentation");

// Validate links subcommand
check
  .command("links <baseUrl>")
  .description("Validate internal links and anchors in MDX documentation files")
  .option("-f, --file <path>", "Validate links in a single MDX file")
  .option("-d, --dir <path>", "Validate links in a specific directory")
  .option("-o, --output <path>", "Output path for JSON report", "links_report.json")
  .option("--dry-run", "Extract and show links without validating")
  .option("-v, --verbose", "Print detailed progress information")
  .option("--quiet", "Suppress stdout output (only generate report)")
  .option("-c, --concurrency <number>", "Number of concurrent browser tabs", "25")
  .option("--headless", "Run browser in headless mode (default)", true)
  .option("--no-headless", "Show browser window (for debugging)")
  .option("--fix", "Automatically fix anchor links in MDX files")
  .option("--fix-from-report [path]", "Fix anchor links from report file (default: links_report.json)")
  .action(async (baseUrl, options) => {
    const { validateLinks } = await import("../src/commands/validate/links.js");
    await validateLinks(baseUrl, options);
  });

program.parse();
