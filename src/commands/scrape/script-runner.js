/**
 * Script Runner
 *
 * Loads and executes user-defined hook scripts at two points in the
 * scrape pipeline:
 *
 *   Pre-process  — Cheerio DOM is live; scripts can manipulate HTML before
 *                  Turndown runs. Receives the PlaceholderManager so scripts
 *                  can store arbitrary MDX content that bypasses Turndown.
 *
 *   Post-process — Markdown is final; scripts receive and return a string.
 *
 * Config shape (scrape.scripts in config.json):
 *   "scripts": {
 *     "pre":  "./scripts/pre.js",          // string or array of strings
 *     "post": ["./scripts/a.js", "./scripts/b.js"]
 *   }
 */

import { resolve } from "path";

/**
 * Loads script modules listed in a config value.
 * Accepts a string path or an array of paths.
 * Paths are resolved relative to cwd.
 * @param {string|string[]|null|undefined} scriptPaths
 * @returns {Promise<Function[]>} Array of default-exported functions
 */
async function loadScripts(scriptPaths) {
  if (!scriptPaths) return [];

  const paths = Array.isArray(scriptPaths) ? scriptPaths : [scriptPaths];
  const fns = [];

  for (const raw of paths) {
    const absPath = resolve(process.cwd(), raw);
    let mod;
    try {
      mod = await import(absPath);
    } catch (err) {
      throw new Error(`Script hook failed to load: ${raw}\n  ${err.message}`);
    }

    const fn = mod.default ?? mod;
    if (typeof fn !== "function") {
      throw new Error(`Script hook must export a default function: ${raw}`);
    }
    fns.push(fn);
  }

  return fns;
}

/**
 * Runs all pre-process scripts against the Cheerio document.
 * Each script receives ($, pageUrl, scrapeConfig, { pm }) and may mutate $ directly.
 * Scripts are async-safe — each is awaited before the next runs.
 *
 * @param {Object} $ - Cheerio instance (mutated in place)
 * @param {string} pageUrl
 * @param {Object} scrapeConfig
 * @param {import('./placeholder-manager.js').PlaceholderManager} pm
 * @param {string|string[]} scriptPaths
 */
export async function runPreScripts($, pageUrl, scrapeConfig, pm, scriptPaths) {
  const scripts = await loadScripts(scriptPaths);
  for (const fn of scripts) {
    await fn($, pageUrl, scrapeConfig, { pm });
  }
}

/**
 * Runs all post-process scripts against the markdown string.
 * Each script receives (markdown, pageUrl, scrapeConfig) and must return
 * the (modified) markdown string. If a script returns a non-string, the
 * original value is kept and a warning is printed.
 *
 * @param {string} markdown
 * @param {string} pageUrl
 * @param {Object} scrapeConfig
 * @param {string|string[]} scriptPaths
 * @returns {Promise<string>}
 */
export async function runPostScripts(markdown, pageUrl, scrapeConfig, scriptPaths) {
  const scripts = await loadScripts(scriptPaths);
  let result = markdown;

  for (const fn of scripts) {
    const output = await fn(result, pageUrl, scrapeConfig);
    if (typeof output === "string") {
      result = output;
    } else {
      console.warn(`[script-runner] Post-process script returned non-string — keeping original markdown.`);
    }
  }

  return result;
}
