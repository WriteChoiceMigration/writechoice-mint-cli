/**
 * Config File Generator
 *
 * Generates a config.json template file with all available options.
 */

import { writeFileSync, existsSync } from "fs";
import { join } from "path";
import chalk from "chalk";

/**
 * Generates a config.json template file
 * @param {Object} options - CLI options
 */
export async function generateConfig(options) {
  const configPath = join(process.cwd(), "config.json");

  // Check if config.json already exists
  if (existsSync(configPath) && !options.force) {
    console.error(chalk.red("\n✗ Error: config.json already exists in the current directory."));
    console.log(chalk.yellow("\nUse --force to overwrite the existing file:"));
    console.log(chalk.gray("  writechoice config --force"));
    process.exit(1);
  }

  // Create the config template
  const configTemplate = {
    "$schema": "https://json-schema.org/draft-07/schema#",
    "description": "Configuration file for WriteChoice Mint CLI",

    "source": "https://docs.example.com",
    "target": "http://localhost:3000",

    "links": {
      "file": null,
      "dir": null,
      "output": "links_report",
      "dry-run": false,
      "quiet": false,
      "concurrency": 25,
      "headless": true
    },

    "parse": {
      "file": null,
      "dir": null,
      "quiet": false
    }
  };

  try {
    writeFileSync(configPath, JSON.stringify(configTemplate, null, 2), "utf-8");

    if (!options.quiet) {
      console.log(chalk.green("\n✓ Successfully created config.json\n"));
      console.log(chalk.bold("Next steps:\n"));
      console.log("1. Edit config.json and update the placeholder values:");
      console.log(chalk.cyan("   - source:") + " Your production documentation URL");
      console.log(chalk.cyan("   - target:") + " Your validation environment URL (e.g., localhost:3000)");
      console.log("\n2. Run validation commands without arguments:");
      console.log(chalk.gray("   writechoice check links"));
      console.log(chalk.gray("   writechoice check parse"));
      console.log("\n3. For more details, see:");
      console.log(chalk.gray("   docs/config-file.md"));
    }
  } catch (error) {
    console.error(chalk.red(`\n✗ Error creating config.json: ${error.message}`));
    process.exit(1);
  }
}
