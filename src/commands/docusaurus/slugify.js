/**
 * wc docusaurus slugify <folder>
 *
 * For every converted MDX file in <folder>, reads the frontmatter `slug` (or
 * `id` as fallback) and renames / moves the file so its path matches the slug.
 *
 * Example:
 *   File:    mintlify/cloud/features/01_cloud_tiers.mdx
 *   slug:    /cloud/manage/cloud-tiers
 *   Result:  mintlify/cloud/manage/cloud-tiers.mdx
 *
 * Also updates any matching page paths inside a docs.json navigation file.
 */

import {
  readFileSync, writeFileSync, existsSync, mkdirSync,
  renameSync, readdirSync, statSync,
} from "fs";
import { resolve, join, relative, dirname, extname } from "path";
import chalk from "chalk";

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * @param {string} folder   - The converted output folder (e.g. ./mintlify)
 * @param {Object} options
 * @param {string}  [options.docs]   - Path to docs.json (default: ./docs.json)
 * @param {boolean} options.dryRun
 * @param {boolean} options.quiet
 */
export async function slugifyDocusaurus(folder, options = {}) {
  const verbose = !options.quiet;
  const repoRoot = process.cwd();
  const folderAbs = resolve(repoRoot, folder);

  if (!existsSync(folderAbs)) {
    console.error(chalk.red(`Error: Folder not found: ${folderAbs}`));
    process.exit(1);
  }

  const docsJsonPath = resolve(repoRoot, options.docs || "docs.json");
  const hasDocs = existsSync(docsJsonPath);

  if (verbose) {
    console.log(chalk.cyan("\nSlugifying converted docs...\n"));
    console.log(chalk.dim(`  Folder: ${folderAbs}`));
    if (hasDocs) console.log(chalk.dim(`  docs.json: ${docsJsonPath}`));
    else console.log(chalk.dim("  docs.json: not found, skipping"));
    if (options.dryRun) console.log(chalk.yellow("  [dry-run] No files will be written\n"));
    console.log();
  }

  // Collect all MDX files
  const files = [];
  walkMdx(folderAbs, files);

  // Build rename plan: { srcAbs, destAbs, oldRel, newRel }
  const renames = [];

  for (const srcAbs of files) {
    const content = readFileSync(srcAbs, "utf-8");
    const slugOrId = extractSlugOrId(content);
    if (!slugOrId) continue;

    // Slug → relative path (strip leading slash, ensure no extension yet)
    const slugRel = slugOrId.replace(/^\//, "").replace(/\.mdx?$/, "");
    const destAbs = join(folderAbs, slugRel + ".mdx");

    // Normalise for comparison (handle .md → .mdx rename from convert step)
    const srcNorm = srcAbs.replace(/\.md$/, ".mdx");
    if (srcNorm === destAbs) continue; // already in right place

    const oldRel = relative(folderAbs, srcAbs).replace(/\.mdx?$/, "").replace(/\\/g, "/");
    const newRel = slugRel;

    renames.push({ srcAbs, destAbs, oldRel, newRel });
  }

  if (renames.length === 0) {
    if (verbose) console.log(chalk.yellow("  No files need renaming."));
    return;
  }

  // Apply renames
  for (const { srcAbs, destAbs, oldRel, newRel } of renames) {
    const srcDisplay = relative(repoRoot, srcAbs);
    const destDisplay = relative(repoRoot, destAbs);

    if (verbose) {
      console.log(`  ${chalk.dim(srcDisplay)} → ${chalk.green(destDisplay)}`);
    }

    if (!options.dryRun) {
      if (existsSync(destAbs) && destAbs !== srcAbs) {
        console.warn(chalk.yellow(`  Warning: target already exists, skipping: ${destDisplay}`));
        continue;
      }
      mkdirSync(dirname(destAbs), { recursive: true });
      renameSync(srcAbs, destAbs);
    }
  }

  // Update docs.json
  if (hasDocs && !options.dryRun) {
    let docsJson;
    try {
      docsJson = JSON.parse(readFileSync(docsJsonPath, "utf-8"));
    } catch (e) {
      console.error(chalk.red(`Error parsing docs.json: ${e.message}`));
      return;
    }

    let changed = false;
    for (const { oldRel, newRel } of renames) {
      const before = JSON.stringify(docsJson);
      docsJson = replacePagePath(docsJson, oldRel, newRel);
      if (JSON.stringify(docsJson) !== before) changed = true;
    }

    if (changed) {
      writeFileSync(docsJsonPath, JSON.stringify(docsJson, null, 2) + "\n", "utf-8");
      if (verbose) console.log(chalk.green(`\n  ✓ docs.json updated`));
    } else if (verbose) {
      console.log(chalk.dim("\n  docs.json: no matching paths found"));
    }
  }

  if (verbose) {
    const verb = options.dryRun ? "Would rename" : "Renamed";
    console.log(chalk.green(`\n  ✓ ${verb} ${renames.length} file${renames.length !== 1 ? "s" : ""}`));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MD_EXTS = new Set([".md", ".mdx"]);
const SKIP_DIRS = new Set(["node_modules", ".git", ".docusaurus", "build", "dist", ".cache"]);

function walkMdx(dir, out) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const fullPath = join(dir, entry);
    let stat;
    try { stat = statSync(fullPath); } catch { continue; }
    if (stat.isDirectory()) {
      walkMdx(fullPath, out);
    } else if (MD_EXTS.has(extname(entry).toLowerCase())) {
      out.push(fullPath);
    }
  }
}

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

function extractSlugOrId(content) {
  const fmMatch = FM_RE.exec(content);
  if (!fmMatch) return null;
  const fmBody = fmMatch[1];

  // slug takes priority over id
  const slugMatch = fmBody.match(/^slug\s*:\s*(.+?)\s*$/im);
  if (slugMatch) return slugMatch[1].replace(/^["']|["']$/g, "").trim();

  const idMatch = fmBody.match(/^id\s*:\s*(.+?)\s*$/im);
  if (idMatch) return idMatch[1].replace(/^["']|["']$/g, "").trim();

  return null;
}

/**
 * Recursively walks a JSON node, replacing any string equal to `oldPath`
 * with `newPath`. Works for the full docs.json navigation structure regardless
 * of nesting depth or key names.
 */
function replacePagePath(node, oldPath, newPath) {
  if (typeof node === "string") {
    return node === oldPath ? newPath : node;
  }
  if (Array.isArray(node)) {
    return node.map((item) => replacePagePath(item, oldPath, newPath));
  }
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = replacePagePath(v, oldPath, newPath);
    }
    return out;
  }
  return node;
}
