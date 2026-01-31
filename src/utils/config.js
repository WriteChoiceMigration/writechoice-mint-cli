/**
 * Configuration File Loader
 *
 * Loads optional config.json from the project root and merges with CLI arguments.
 * CLI arguments take precedence over config file values.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Loads config.json from the current working directory if it exists
 * @returns {Object|null} Configuration object or null if not found
 */
export function loadConfig() {
  const configPath = join(process.cwd(), "config.json");

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const configContent = readFileSync(configPath, "utf-8");
    const config = JSON.parse(configContent);
    return config;
  } catch (error) {
    console.error(`Error reading config.json: ${error.message}`);
    return null;
  }
}

/**
 * Merges config file with CLI options for the links command
 * CLI options take precedence over config file
 *
 * @param {string|undefined} baseUrl - Base URL from CLI
 * @param {string|undefined} validationBaseUrl - Validation base URL from CLI
 * @param {Object} options - CLI options
 * @param {Object|null} config - Loaded config object
 * @returns {Object} Merged configuration with baseUrl, validationBaseUrl, and options
 */
export function mergeLinksConfig(baseUrl, validationBaseUrl, options, config) {
  if (!config) {
    return { baseUrl, validationBaseUrl, options };
  }

  // Get base URLs from config if not provided via CLI
  const finalBaseUrl = baseUrl || config.source;
  const finalValidationBaseUrl = validationBaseUrl || config.target;

  // Get links-specific config
  const linksConfig = config.links || {};

  // Merge options: CLI > links config > global config > defaults
  const mergedOptions = {
    ...options,
    // Only use config values if CLI option wasn't provided
    file: options.file || linksConfig.file,
    dir: options.dir || linksConfig.dir,
    output: options.output || linksConfig.output,
    dryRun: options.dryRun !== undefined ? options.dryRun : linksConfig["dry-run"],
    quiet: options.quiet !== undefined ? options.quiet : linksConfig.quiet,
    concurrency: options.concurrency || linksConfig.concurrency,
    headless: options.headless !== undefined ? options.headless :
              (linksConfig.headless !== undefined ? linksConfig.headless : true),
  };

  return {
    baseUrl: finalBaseUrl,
    validationBaseUrl: finalValidationBaseUrl,
    options: mergedOptions,
  };
}

/**
 * Merges config file with CLI options for the parse command
 * CLI options take precedence over config file
 *
 * @param {Object} options - CLI options
 * @param {Object|null} config - Loaded config object
 * @returns {Object} Merged options
 */
export function mergeParseConfig(options, config) {
  if (!config) {
    return options;
  }

  // Get parse-specific config
  const parseConfig = config.parse || {};

  // Merge options: CLI > parse config > global config > defaults
  return {
    ...options,
    file: options.file || parseConfig.file,
    dir: options.dir || parseConfig.dir,
    quiet: options.quiet !== undefined ? options.quiet : parseConfig.quiet,
  };
}

/**
 * Validates that required fields are present
 * @param {string|undefined} baseUrl - Base URL
 * @param {string} commandName - Name of the command for error messages
 * @throws {Error} If required fields are missing
 */
export function validateRequiredConfig(baseUrl, commandName) {
  if (!baseUrl) {
    throw new Error(
      `Missing required configuration: baseUrl must be provided either via CLI argument or in config.json (as "source")\n\n` +
      `Usage:\n` +
      `  CLI:        ${commandName} <baseUrl>\n` +
      `  config.json: { "source": "https://docs.example.com" }`
    );
  }
}
