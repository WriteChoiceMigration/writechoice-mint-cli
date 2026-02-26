/**
 * wc docusaurus nav <file> — Convert a Docusaurus sidebars.js to Mintlify navigation
 *
 * Reads a Docusaurus sidebars.js (CommonJS), converts the sidebar tree to
 * Mintlify docs.json navigation format, and writes JSON to stdout or a file.
 *
 * Output structure:
 *   - Single sidebar  → { anchors: [{ anchor, pages }] }
 *   - Multiple sidebars → { tabs: [{ tab, pages }] }
 */

import { createRequire } from "module";
import { resolve, extname } from "path";
import { writeFileSync, existsSync, readFileSync } from "fs";
import chalk from "chalk";

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * @param {string} file  - Path to sidebars.js (or sidebars.ts)
 * @param {Object} options
 * @param {string} [options.prefix]  - Path prefix to prepend to every page ID (e.g. "docs")
 * @param {string} [options.output]  - Write result to this file instead of stdout
 * @param {boolean} options.quiet
 */
export async function docusaurusNav(file, options = {}) {
  const verbose = !options.quiet;
  const absFile = resolve(process.cwd(), file);

  if (!existsSync(absFile)) {
    console.error(chalk.red(`Error: File not found: ${absFile}`));
    process.exit(1);
  }

  // Load the sidebars module (CommonJS)
  let sidebars;
  try {
    const req = createRequire(absFile);
    sidebars = req(absFile);
  } catch (e) {
    // Fallback: try to extract the exports by parsing the file as text
    try {
      sidebars = evalSidebarsFile(absFile);
    } catch {
      console.error(chalk.red(`Error loading ${file}: ${e.message}`));
      process.exit(1);
    }
  }

  if (!sidebars || typeof sidebars !== "object") {
    console.error(chalk.red(`Error: ${file} did not export an object`));
    process.exit(1);
  }

  const prefix = options.prefix ? options.prefix.replace(/\/+$/, "") : "";
  const keys = Object.keys(sidebars);

  if (keys.length === 0) {
    console.error(chalk.red(`Error: No sidebar keys found in ${file}`));
    process.exit(1);
  }

  const navigation = buildNavigation(sidebars, keys, prefix);
  const json = JSON.stringify(navigation, null, 2);
  const outFile = options.output || "nav.json";
  const outPath = resolve(process.cwd(), outFile);

  writeFileSync(outPath, json, "utf-8");

  if (verbose) {
    const pageCount = countPages(navigation);
    console.log(chalk.green(`✓ Navigation written to ${outFile}`) +
      chalk.dim(` (${pageCount} pages, ${keys.length} sidebar${keys.length !== 1 ? "s" : ""})`));
  }
}

// ---------------------------------------------------------------------------
// Navigation builder
// ---------------------------------------------------------------------------

function buildNavigation(sidebars, keys, prefix) {
  if (keys.length === 1) {
    const pages = convertItems(sidebars[keys[0]], prefix);
    return {
      anchors: [
        {
          anchor: labelFromKey(keys[0]),
          pages,
        },
      ],
    };
  }

  // Multiple sidebars → tabs
  const tabs = keys.map((key) => ({
    tab: labelFromKey(key),
    pages: convertItems(sidebars[key], prefix),
  }));
  return { tabs };
}

function convertItems(items, prefix) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => convertItem(item, prefix)).filter(Boolean);
}

function convertItem(item, prefix) {
  if (typeof item === "string") {
    return prefix ? `${prefix}/${item}` : item;
  }

  if (!item || typeof item !== "object") return null;

  switch (item.type) {
    case "category":
      return {
        group: item.label,
        pages: convertItems(item.items || [], prefix),
      };

    case "doc":
      // { type: 'doc', id: 'foo/bar', label: 'Foo' }
      if (item.id) return prefix ? `${prefix}/${item.id}` : item.id;
      return null;

    case "link":
    case "html":
      // External links and raw HTML separators — skip
      return null;

    case "ref":
      // Cross-sidebar reference — treat like a doc
      if (item.id) return prefix ? `${prefix}/${item.id}` : item.id;
      return null;

    default:
      // Unknown type or no type — skip
      return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert camelCase / snake_case key to Title Case label */
function labelFromKey(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

function countPages(nav) {
  let n = 0;
  function walk(arr) {
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      if (typeof item === "string") { n++; }
      else if (item?.pages) walk(item.pages);
      else if (item?.groups) walk(item.groups);
    }
  }
  // nav may be { tabs } or { anchors }
  const top = nav.tabs || nav.anchors || [];
  for (const entry of top) walk(entry.pages || []);
  return n;
}

// ---------------------------------------------------------------------------
// Fallback: evaluate sidebars.js as a script when require() fails
// (e.g. TypeScript or ESM-style files)
// ---------------------------------------------------------------------------

function evalSidebarsFile(absFile) {
  const src = readFileSync(absFile, "utf-8");
  // Strip TypeScript type annotations in simple cases: `: SidebarsConfig`
  const stripped = src
    .replace(/:\s*SidebarsConfig\b/g, "")
    .replace(/^export\s+default\s+/, "module.exports = ");

  // eslint-disable-next-line no-new-func
  const fn = new Function("module", "exports", "require", "__filename", "__dirname", stripped);
  const mod = { exports: {} };
  fn(mod, mod.exports, () => ({}), absFile, resolve(absFile, ".."));
  return mod.exports;
}
