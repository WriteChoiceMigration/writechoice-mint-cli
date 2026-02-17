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
 * Merges config file with CLI options for the codeblocks command
 * CLI options take precedence over config file
 *
 * @param {Object} options - CLI options
 * @param {Object|null} config - Loaded config object
 * @returns {Object} Merged options
 */
export function mergeCodeblocksConfig(options, config) {
  const cbConfig = config?.codeblocks || {};

  // Resolve lines/wrap from config: "add" | true → add, "remove" | false → remove
  const configLines = cbConfig.lines;
  const configWrap = cbConfig.wrap;

  const addLinesFromConfig = configLines === "add" || configLines === true;
  const removeLinesFromConfig = configLines === "remove" || configLines === false;
  const addWrapFromConfig = configWrap === "add" || configWrap === true;
  const removeWrapFromConfig = configWrap === "remove" || configWrap === false;

  const threshold = options.threshold != null
    ? parseInt(options.threshold, 10)
    : (cbConfig.threshold ?? 15);

  // expandable: Commander sets options.expandable=false when --no-expandable is passed
  const expandable = options.expandable !== false
    ? (cbConfig.expandable !== false)
    : false;

  return {
    file: options.file || cbConfig.file || null,
    dir: options.dir || cbConfig.dir || null,
    dryRun: options.dryRun !== undefined ? options.dryRun : (cbConfig["dry-run"] ?? false),
    quiet: options.quiet !== undefined ? options.quiet : (cbConfig.quiet ?? false),
    threshold,
    expandable,
    // CLI flags take precedence over config
    lines: options.lines || addLinesFromConfig,
    removeLines: options.removeLines || removeLinesFromConfig,
    wrap: options.wrap || addWrapFromConfig,
    removeWrap: options.removeWrap || removeWrapFromConfig,
  };
}

/**
 * Merges config file with CLI options for the inlineimages command
 * CLI options take precedence over config file
 *
 * @param {Object} options - CLI options
 * @param {Object|null} config - Loaded config object
 * @returns {Object} Merged options
 */
export function mergeInlineImagesConfig(options, config) {
  const imgConfig = config?.inlineimages || {};

  return {
    file: options.file || imgConfig.file || null,
    dir: options.dir || imgConfig.dir || null,
    dryRun: options.dryRun !== undefined ? options.dryRun : (imgConfig["dry-run"] ?? false),
    quiet: options.quiet !== undefined ? options.quiet : (imgConfig.quiet ?? false),
  };
}

/**
 * Merges config file with CLI options for the images command
 * CLI options take precedence over config file
 *
 * @param {Object} options - CLI options
 * @param {Object|null} config - Loaded config object
 * @returns {Object} Merged options
 */
export function mergeImagesConfig(options, config) {
  const imgConfig = config?.images || {};

  return {
    file: options.file || imgConfig.file || null,
    dir: options.dir || imgConfig.dir || null,
    dryRun: options.dryRun !== undefined ? options.dryRun : (imgConfig["dry-run"] ?? false),
    quiet: options.quiet !== undefined ? options.quiet : (imgConfig.quiet ?? false),
  };
}

/**
 * Merges config file with CLI options for the h1 command
 * CLI options take precedence over config file
 *
 * @param {Object} options - CLI options
 * @param {Object|null} config - Loaded config object
 * @returns {Object} Merged options
 */
export function mergeH1Config(options, config) {
  const h1Config = config?.h1 || {};

  return {
    file: options.file || h1Config.file || null,
    dir: options.dir || h1Config.dir || null,
    dryRun: options.dryRun !== undefined ? options.dryRun : (h1Config["dry-run"] ?? false),
    quiet: options.quiet !== undefined ? options.quiet : (h1Config.quiet ?? false),
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
