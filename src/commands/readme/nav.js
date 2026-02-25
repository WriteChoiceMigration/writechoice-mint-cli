/**
 * wc readme nav — Restructure MDX files to match docs.json navigation hierarchy
 *
 * Reads docs.json, computes the correct path for each page based on its position
 * in the navigation tree, moves files to those paths, updates docs.json references,
 * and writes a redirects.json for every moved file.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from "fs";
import { resolve, join, dirname, basename, relative } from "path";
import chalk from "chalk";

/**
 * Main entry point.
 * @param {Object} options
 * @param {string} options.docs - Path to docs.json (default: "docs.json")
 * @param {string} options.base - Base directory for output paths (default: "docs")
 * @param {number[]} options.skipLevels - 1-based level numbers to skip
 * @param {boolean} options.rename - Rename files using kebab-case of frontmatter title
 * @param {boolean} options.dryRun
 * @param {boolean} options.quiet
 */
export async function navRestructure(options) {
  const verbose = !options.quiet;
  const repoRoot = process.cwd();
  const docsFile = resolve(repoRoot, options.docs || "docs.json");
  const base = options.base || "docs";
  const skipLevels = options.skipLevels || [];
  const rename = options.rename || false;
  const dryRun = options.dryRun || false;

  // Load docs.json
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
    console.log(chalk.cyan("\nAnalyzing navigation structure..."));
    if (dryRun) console.log(chalk.yellow("  [dry-run] No files will be moved\n"));
    if (rename) console.log(chalk.dim("  Renaming files from frontmatter title\n"));
    if (skipLevels.length) console.log(chalk.dim(`  Skipping levels: ${skipLevels.join(", ")}\n`));
  }

  // Collect all page moves
  const moves = []; // { pageStr, newPageStr, oldAbsPath, newAbsPath }
  const missing = []; // pages referenced in docs.json but not on disk

  traverseNav(navigation, (pageStr, parentNames) => {
    const oldAbsPath = resolve(repoRoot, pageStr + ".mdx");
    let newRelPath = computeNewPath(pageStr, parentNames, base, skipLevels);
    let newAbsPath = resolve(repoRoot, newRelPath);

    // Apply rename: replace filename with kebab-case of frontmatter title
    if (rename && existsSync(oldAbsPath)) {
      const content = readFileSync(oldAbsPath, "utf-8");
      const title = extractFrontmatterTitle(content);
      if (title) {
        const titleSlug = slugify(title);
        const dir = dirname(newAbsPath);
        const dirBasename = basename(dir);
        const finalName = titleSlug === dirBasename ? "index" : titleSlug;
        newAbsPath = join(dir, finalName + ".mdx");
        newRelPath = relative(repoRoot, newAbsPath);
      }
    }

    const newPageStr = newRelPath.replace(/\.mdx$/, "");

    // Already in the right place
    if (oldAbsPath === newAbsPath) return;

    if (!existsSync(oldAbsPath)) {
      missing.push(pageStr);
      return;
    }

    moves.push({ pageStr, newPageStr, oldAbsPath, newAbsPath });
  });

  // Report and execute moves
  let moved = 0;
  for (const { pageStr, newPageStr, oldAbsPath, newAbsPath } of moves) {
    if (verbose) {
      console.log(`  ${chalk.dim(pageStr)} → ${chalk.green(newPageStr)}`);
    }
    if (!dryRun) {
      mkdirSync(dirname(newAbsPath), { recursive: true });
      renameSync(oldAbsPath, newAbsPath);
      moved++;
    }
  }

  if (missing.length && verbose) {
    console.log();
    for (const p of missing) {
      console.log(chalk.yellow(`  ⚠ File not found on disk: ${p}.mdx`));
    }
  }

  if (!dryRun && moves.length) {
    // Build old→new map for docs.json and redirects
    const pathMap = new Map(moves.map((m) => [m.pageStr, m.newPageStr]));

    // Update docs.json
    const updatedDocs = replaceNavPaths(docsJson, pathMap);
    writeFileSync(docsFile, JSON.stringify(updatedDocs, null, 2) + "\n", "utf-8");

    // Generate redirects.json
    const redirects = moves.map(({ pageStr, newPageStr }) => ({
      source: "/" + pageStr,
      destination: "/" + newPageStr,
    }));
    const redirectsPath = resolve(repoRoot, "redirects.json");
    writeFileSync(redirectsPath, JSON.stringify(redirects, null, 2) + "\n", "utf-8");

    if (verbose) {
      console.log();
      console.log(chalk.green(`  ✓ ${moved} file${moved !== 1 ? "s" : ""} moved`));
      console.log(chalk.green(`  ✓ docs.json updated`));
      console.log(chalk.green(`  ✓ redirects.json written (${redirects.length} redirect${redirects.length !== 1 ? "s" : ""})`));
    }
  } else if (dryRun) {
    if (verbose) {
      console.log();
      if (moves.length) {
        console.log(chalk.bold(`Would move ${moves.length} file${moves.length !== 1 ? "s" : ""} and write redirects.json`));
      } else {
        console.log(chalk.green("  ✓ All files are already in the correct location"));
      }
    }
  } else if (!moves.length) {
    if (verbose) console.log(chalk.green("\n  ✓ All files are already in the correct location"));
  }
}

// ---------------------------------------------------------------------------
// Navigation traversal
// ---------------------------------------------------------------------------

/**
 * Keys that identify a named container node (contribute a folder to the path).
 * Ordered by precedence — the first matching key is used as the name.
 */
const NAME_KEYS = ["tab", "anchor", "item", "group", "dropdown", "version", "language", "product"];

/**
 * Keys that hold arrays of child navigation nodes.
 */
const COLLECTION_KEYS = ["tabs", "anchors", "groups", "menu", "pages", "items", "versions", "languages", "products", "dropdowns"];

/**
 * Recursively walks a docs.json navigation structure, calling cb(pageStr, parentNames)
 * for every leaf page string. Handles all Mintlify navigation container types:
 * tabs, anchors, dropdowns, groups, menu items, products, versions, languages, etc.
 *
 * @param {any} node - navigation.tabs array, navigation object, or any sub-node
 * @param {Function} cb - (pageStr: string, parentNames: string[]) => void
 */
export function traverseNav(node, cb) {
  visitNode(node, [], cb);
}

function visitNode(node, parents, cb) {
  if (typeof node === "string") {
    // Leaf page — skip openapi-like strings, accept doc paths
    cb(node, parents);
    return;
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      visitNode(child, parents, cb);
    }
    return;
  }

  if (!node || typeof node !== "object") return;

  // Skip openapi descriptor objects (they have "source" + "directory", not pages)
  if (node.source !== undefined && node.directory !== undefined) return;

  // Determine this node's name (if any) — contributes a folder level
  let name = null;
  for (const key of NAME_KEYS) {
    if (typeof node[key] === "string") {
      name = node[key];
      break;
    }
  }
  const newParents = name ? [...parents, name] : parents;

  // Recurse into all collection children
  for (const key of COLLECTION_KEYS) {
    if (Array.isArray(node[key])) {
      for (const child of node[key]) {
        visitNode(child, newParents, cb);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Path computation
// ---------------------------------------------------------------------------

/**
 * Converts a navigation parent name to a URL-safe folder slug.
 * @param {string} name
 * @returns {string}
 */
export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Extracts the title value from MDX frontmatter.
 * Handles quoted (`title: "Foo"`) and unquoted (`title: Foo`) forms.
 * @param {string} content - File content
 * @returns {string|null}
 */
function extractFrontmatterTitle(content) {
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;
  const titleMatch = fmMatch[1].match(/^title:\s*["']?(.+?)["']?\s*$/m);
  return titleMatch ? titleMatch[1].trim() : null;
}

/**
 * Resolves the base directory for a given page path.
 *
 * @param {string} pageStr - e.g. "docs/marshall-sdk" or "reference/overview"
 * @param {string|boolean} baseOption
 *   - true  → use the file's own first path component ("docs", "reference", …)
 *   - false → no base prefix
 *   - string → use as a fixed prefix for all files
 * @returns {string} base directory or ""
 */
function resolveBase(pageStr, baseOption) {
  if (baseOption === true) {
    const parts = pageStr.split("/");
    return parts.length > 1 ? parts[0] : "";
  }
  if (!baseOption) return "";
  return String(baseOption);
}

/**
 * Computes the new relative file path for a page based on its nav hierarchy.
 * @param {string} pageStr - docs.json page reference, e.g. "docs/marshall-sdk"
 * @param {string[]} parentNames - ordered parent names from traversal
 * @param {string|boolean} base - base option (true = keep original, false = none, string = fixed)
 * @param {number[]} skipLevels - 1-based level numbers to omit
 * @returns {string} New relative path with .mdx extension
 */
export function computeNewPath(pageStr, parentNames, base, skipLevels = []) {
  const baseDir = resolveBase(pageStr, base);

  // Build folder list, filtering out skipped levels
  const folders = parentNames
    .filter((_, i) => !skipLevels.includes(i + 1))
    .map(slugify)
    .filter(Boolean);

  const filename = pageStr.split("/").pop(); // "marshall-sdk"
  const filenameSlug = slugify(filename);
  const lastName = folders[folders.length - 1];

  // If the filename slug matches the last folder, it becomes index.mdx
  const finalName = lastName && filenameSlug === lastName ? "index" : filename;

  return baseDir
    ? join(baseDir, ...folders, finalName + ".mdx")
    : join(...folders, finalName + ".mdx");
}

// ---------------------------------------------------------------------------
// docs.json update
// ---------------------------------------------------------------------------

/**
 * Returns a new docs.json object with all leaf page strings replaced using pathMap.
 * @param {Object} docsJson
 * @param {Map<string,string>} pathMap - old page string → new page string
 * @returns {Object}
 */
export function replaceNavPaths(docsJson, pathMap) {
  return JSON.parse(JSON.stringify(docsJson, (key, value) => {
    if (typeof value === "string" && pathMap.has(value)) {
      return pathMap.get(value);
    }
    return value;
  }));
}
