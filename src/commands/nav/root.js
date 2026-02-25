/**
 * wc nav root — Promote matching first pages as root entries in nested groups
 *
 * For each group nested inside another group, checks if the first page's
 * frontmatter title matches the group name. If so, moves that page to a
 * "root" key on the group and removes it from "pages".
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs";
import { resolve, join, basename } from "path";
import chalk from "chalk";

/**
 * @param {Object} options
 * @param {string} options.docs - Path to docs.json (default: "docs.json")
 * @param {boolean} options.dryRun
 * @param {boolean} options.quiet
 */
export async function navRoot(options) {
  const verbose = !options.quiet;
  const repoRoot = process.cwd();
  const docsFile = resolve(repoRoot, options.docs || "docs.json");
  const dryRun = options.dryRun || false;

  if (!existsSync(docsFile)) {
    console.error(chalk.red(`Error: docs.json not found at ${docsFile}`));
    process.exit(1);
  }

  let docsJson;
  try {
    docsJson = JSON.parse(readFileSync(docsFile, "utf-8"));
  } catch (err) {
    console.error(chalk.red(`Error parsing docs.json: ${err.message}`));
    process.exit(1);
  }

  const navigation = docsJson?.navigation;
  if (!navigation) {
    console.error(chalk.red("Error: No navigation key found in docs.json."));
    process.exit(1);
  }

  if (verbose) {
    console.log(chalk.cyan("\nScanning for promotable group root pages..."));
    if (dryRun) console.log(chalk.yellow("  [dry-run] docs.json will not be written\n"));
  }

  // Pre-scan all MDX files so we can find files that aren't at their docs.json path yet
  const filenameMap = buildFilenameMap(repoRoot);

  const promoted = []; // { group, page }
  const updatedNavigation = processNode(navigation, false, repoRoot, filenameMap, promoted);

  if (verbose && promoted.length) {
    for (const { group, page } of promoted) {
      console.log(`  ${chalk.dim(page)} → ${chalk.green(group)} root`);
    }
  }

  if (!dryRun && promoted.length) {
    const updatedDocs = { ...docsJson, navigation: updatedNavigation };
    writeFileSync(docsFile, JSON.stringify(updatedDocs, null, 2) + "\n", "utf-8");
    if (verbose) {
      console.log();
      console.log(chalk.green(`  ✓ ${promoted.length} page${promoted.length !== 1 ? "s" : ""} promoted to group root`));
      console.log(chalk.green("  ✓ docs.json updated"));
    }
  } else if (dryRun) {
    if (verbose) {
      console.log();
      if (promoted.length) {
        console.log(chalk.bold(`Would promote ${promoted.length} page${promoted.length !== 1 ? "s" : ""} to group root`));
      } else {
        console.log(chalk.green("  ✓ No matching group root pages found"));
      }
    }
  } else if (!promoted.length) {
    if (verbose) console.log(chalk.green("\n  ✓ No matching group root pages found"));
  }
}

// ---------------------------------------------------------------------------
// Traversal
// ---------------------------------------------------------------------------

/**
 * Array keys that are navigation containers. Direct children of these arrays
 * are always "level 1" and must never be promoted — reset inGroup to false.
 */
const CONTAINER_KEYS = new Set([
  "tabs", "menu", "anchors", "dropdowns", "versions", "languages", "products",
]);

/**
 * Recursively walks the nav tree.
 *
 * inGroup tracks whether we are already inside a group's pages array.
 * - false → current node is a direct child of a navigation container (level 1) → skip
 * - true  → current node is nested inside a group → eligible for promotion
 *
 * @param {any} node
 * @param {boolean} inGroup
 * @param {string} repoRoot
 * @param {Map<string, string[]>} filenameMap - basename → [absolute paths]
 * @param {Array} promoted - accumulates { group, page } records
 * @returns {any} updated node
 */
function processNode(node, inGroup, repoRoot, filenameMap, promoted) {
  if (typeof node === "string") return node;

  if (Array.isArray(node)) {
    return node.map((child) => processNode(child, inGroup, repoRoot, filenameMap, promoted));
  }

  if (!node || typeof node !== "object") return node;

  // Group object
  if (typeof node.group === "string" && Array.isArray(node.pages)) {
    let pages = node.pages;
    let root = node.root; // preserve existing root if set

    if (inGroup && root === undefined && pages.length > 0 && typeof pages[0] === "string") {
      const firstPage = pages[0];
      const title = readTitle(firstPage, repoRoot, filenameMap);
      if (title && slugify(title) === slugify(node.group)) {
        root = firstPage;
        pages = pages.slice(1);
        promoted.push({ group: node.group, page: firstPage });
      }
    }

    // Recurse into pages — children are now inside a group
    const newPages = pages.map((child) => processNode(child, true, repoRoot, filenameMap, promoted));

    const newNode = { ...node };
    if (root !== undefined) newNode.root = root;
    newNode.pages = newPages;
    return newNode;
  }

  // Non-group objects (tab, menu item, anchor, etc.)
  // Children of CONTAINER_KEYS are always level 1 — force inGroup=false for them.
  const result = { ...node };
  for (const key of Object.keys(node)) {
    if (!Array.isArray(node[key])) continue;
    const childInGroup = CONTAINER_KEYS.has(key) ? false : inGroup;
    result[key] = node[key].map((child) => processNode(child, childInGroup, repoRoot, filenameMap, promoted));
  }
  return result;
}

// ---------------------------------------------------------------------------
// File lookup
// ---------------------------------------------------------------------------

/**
 * Reads a frontmatter title for a docs.json page string.
 * First tries the exact path; if not found, falls back to a basename search
 * using the pre-scanned filenameMap (handles files not yet moved by nav folders).
 *
 * @param {string} pageStr - docs.json page path without extension
 * @param {string} repoRoot
 * @param {Map<string, string[]>} filenameMap
 * @returns {string|null}
 */
function readTitle(pageStr, repoRoot, filenameMap) {
  // 1. Exact path
  const exactPath = resolve(repoRoot, pageStr + ".mdx");
  if (existsSync(exactPath)) {
    return extractFrontmatterTitle(readFileSync(exactPath, "utf-8"));
  }

  // 2. Fallback: find by filename anywhere on disk
  const name = basename(pageStr); // e.g. "marshall-payment-flows"
  const candidates = filenameMap.get(name) || [];
  if (candidates.length === 1) {
    return extractFrontmatterTitle(readFileSync(candidates[0], "utf-8"));
  }

  return null;
}

/**
 * Recursively scans repoRoot for all .mdx files and returns a
 * Map<basename-without-ext, [absolute path, ...]>.
 *
 * @param {string} dir
 * @returns {Map<string, string[]>}
 */
function buildFilenameMap(dir) {
  const map = new Map();
  scanDir(dir, map);
  return map;
}

function scanDir(dir, map) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      scanDir(full, map);
    } else if (entry.endsWith(".mdx")) {
      const key = entry.slice(0, -4); // strip .mdx
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(full);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractFrontmatterTitle(content) {
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;
  const titleMatch = fmMatch[1].match(/^title:\s*["']?(.+?)["']?\s*$/m);
  return titleMatch ? titleMatch[1].trim() : null;
}
