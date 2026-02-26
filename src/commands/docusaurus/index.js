/**
 * wc docusaurus <folder> — Convert Docusaurus docs to Mintlify MDX format
 *
 * Reads .md / .mdx files from a Docusaurus docs folder, applies all known
 * conversions, and writes the results to a `mintlify/` output directory.
 */

import {
  readFileSync, writeFileSync, mkdirSync, existsSync,
  readdirSync, statSync, copyFileSync,
} from "fs";
import { resolve, join, dirname, extname, relative } from "path";
import chalk from "chalk";

// ---------------------------------------------------------------------------
// Admonition type → Mintlify component name
// ---------------------------------------------------------------------------
const ADMONITION_MAP = {
  note:    "Note",
  tip:     "Tip",
  info:    "Info",
  warning: "Warning",
  caution: "Warning",   // Docusaurus "caution" = yellow warning
  danger:  "Danger",
  success: "Check",
};

// Docusaurus frontmatter keys to rename → Mintlify equivalents
const RENAME_FRONTMATTER = { sidebar_label: "sidebarTitle" };

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * @param {string} folder - Path to Docusaurus project or docs folder
 * @param {Object} options
 * @param {string} [options.output] - Output directory (default: ./mintlify)
 * @param {boolean} options.dryRun
 * @param {boolean} options.quiet
 */
export async function convertDocusaurus(folder, options = {}) {
  const verbose = !options.quiet;
  const repoRoot = process.cwd();
  const inputRoot = resolve(repoRoot, folder);

  if (!existsSync(inputRoot)) {
    console.error(chalk.red(`Error: Folder not found: ${inputRoot}`));
    process.exit(1);
  }

  // If the given folder is a Docusaurus project root (has docs/ inside), use docs/
  const docsSubdir = join(inputRoot, "docs");
  const sourceDir = existsSync(docsSubdir) && statSync(docsSubdir).isDirectory()
    ? docsSubdir
    : inputRoot;

  // Static folder is always at the project root (inputRoot), not inside docs/
  const staticSrcDir = join(inputRoot, "static");
  const hasStatic = existsSync(staticSrcDir) && statSync(staticSrcDir).isDirectory();

  const outputDir = resolve(repoRoot, options.output || "mintlify");
  const dryRun = options.dryRun || false;

  if (verbose) {
    console.log(chalk.cyan("\nConverting Docusaurus docs to Mintlify format..."));
    console.log(chalk.dim(`  Source: ${sourceDir}`));
    if (hasStatic) console.log(chalk.dim(`  Static: ${staticSrcDir}`));
    console.log(chalk.dim(`  Output: ${outputDir}`));
    if (dryRun) console.log(chalk.yellow("  [dry-run] No files will be written\n"));
    console.log();
  }

  const stats = { converted: 0, copied: 0, skipped: 0 };
  walkDir(sourceDir, sourceDir, outputDir, dryRun, verbose, stats, hasStatic ? staticSrcDir : null);

  // Copy static folder to output/static
  if (hasStatic) {
    const staticDestDir = join(outputDir, "static");
    if (!dryRun) {
      copyDirRecursive(staticSrcDir, staticDestDir);
    }
    if (verbose) console.log(`  ${chalk.dim("static/")} → ${chalk.green("static/")}`);
  }

  if (verbose) {
    console.log();
    if (!dryRun) {
      if (stats.converted) console.log(chalk.green(`  ✓ ${stats.converted} file${stats.converted !== 1 ? "s" : ""} converted`));
      if (stats.copied)    console.log(chalk.green(`  ✓ ${stats.copied} file${stats.copied !== 1 ? "s" : ""} copied`));
      if (hasStatic)       console.log(chalk.green(`  ✓ static/ folder copied`));
    } else {
      console.log(chalk.bold(`Would convert ${stats.converted} file${stats.converted !== 1 ? "s" : ""}, copy ${stats.copied}`));
    }
  }
}

// ---------------------------------------------------------------------------
// Directory walker
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set(["node_modules", ".git", ".docusaurus", "build", "dist", ".cache"]);
const MD_EXTS   = new Set([".md", ".mdx"]);

function walkDir(dir, sourceRoot, outputRoot, dryRun, verbose, stats, staticRoot) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const srcPath = join(dir, entry);
    const relPath = relative(sourceRoot, srcPath);
    let outPath   = join(outputRoot, relPath);

    let stat;
    try { stat = statSync(srcPath); } catch { continue; }

    if (stat.isDirectory()) {
      if (!dryRun) mkdirSync(outPath, { recursive: true });
      walkDir(srcPath, sourceRoot, outputRoot, dryRun, verbose, stats, staticRoot);
      continue;
    }

    const ext = extname(entry).toLowerCase();

    if (MD_EXTS.has(ext)) {
      // Rename .md → .mdx in output
      outPath = outPath.replace(/\.md$/, ".mdx");
      const content = readFileSync(srcPath, "utf-8");
      const converted = convertFile(content, srcPath, sourceRoot, staticRoot);

      if (verbose) console.log(`  ${chalk.dim(relPath)} → ${chalk.green(relative(outputRoot, outPath))}`);

      if (!dryRun) {
        mkdirSync(dirname(outPath), { recursive: true });
        writeFileSync(outPath, converted, "utf-8");
      }
      stats.converted++;
    } else {
      // Copy non-MD files as-is (images, etc.)
      if (!dryRun) {
        mkdirSync(dirname(outPath), { recursive: true });
        copyFileSync(srcPath, outPath);
      }
      stats.copied++;
    }
  }
}

function copyDirRecursive(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

// ---------------------------------------------------------------------------
// File converter pipeline
// ---------------------------------------------------------------------------

function convertFile(content, filePath, sourceRoot, staticRoot) {
  content = convertFrontmatter(content);
  content = removeThemeImports(content);
  content = convertAdmonitions(content);
  content = convertTabs(content);
  content = convertAccordions(content);
  content = convertCodeBlockPlaceholders(content);
  content = convertDocLinks(content);
  content = convertImages(content, filePath, sourceRoot, staticRoot);
  return content;
}

// ---------------------------------------------------------------------------
// 1. Frontmatter — keep all keys, rename Docusaurus-specific keys to Mintlify equivalents
// ---------------------------------------------------------------------------

function convertFrontmatter(content) {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return content;

  let rawFm = fmMatch[1];

  // Rename keys in-place (preserves multi-line YAML values)
  for (const [from, to] of Object.entries(RENAME_FRONTMATTER)) {
    const re = new RegExp(`^${from}:`, "m");
    if (re.test(rawFm)) {
      if (new RegExp(`^${to}:`, "m").test(rawFm)) {
        // Target key already exists — remove the Docusaurus duplicate
        rawFm = rawFm.replace(new RegExp(`^${from}:.*\\n?`, "m"), "");
      } else {
        rawFm = rawFm.replace(re, `${to}:`);
      }
    }
  }

  return `---\n${rawFm}\n---` + content.slice(fmMatch[0].length);
}

// ---------------------------------------------------------------------------
// 2. Remove Docusaurus theme imports
// ---------------------------------------------------------------------------

function removeThemeImports(content) {
  // Remove import lines that reference @theme/* or @docusaurus/*
  return content.replace(/^import\s+\S+\s+from\s+['"]@(?:theme|docusaurus)\/[^'"]+['"]\s*;?\s*\n/gm, "");
}

// ---------------------------------------------------------------------------
// 3. Admonitions  :::note … :::  →  <Note>…</Note>
// ---------------------------------------------------------------------------

function convertAdmonitions(content) {
  const lines = content.split("\n");
  const out   = [];
  let inCode  = false;
  let inAdmon = false;
  let component = null;

  for (const line of lines) {
    // Track fenced code blocks so we don't convert ::: inside them
    if (/^```/.test(line)) inCode = !inCode;

    if (!inCode) {
      // Opening: :::type  or  :::type[Title]
      const openMatch = !inAdmon && line.match(/^:::([\w]+)(?:\[(.+?)\])?\s*$/);
      if (openMatch) {
        const type  = openMatch[1].toLowerCase();
        const title = openMatch[2];
        component   = ADMONITION_MAP[type] || "Note";
        inAdmon     = true;
        out.push(`<${component}>`);
        if (title) out.push(`**${title}**\n`);
        continue;
      }

      // Closing: :::
      if (inAdmon && /^:::\s*$/.test(line)) {
        out.push(`</${component}>`);
        inAdmon   = false;
        component = null;
        continue;
      }
    }

    out.push(line);
  }

  return out.join("\n");
}

// ---------------------------------------------------------------------------
// 4. Tabs  <Tabs groupId>/<TabItem value label>  →  <Tabs>/<Tab title>
// ---------------------------------------------------------------------------

function convertTabs(content) {
  // <Tabs ...> → <Tabs>  (strip all attributes)
  content = content.replace(/<Tabs\b[^>]*>/g, "<Tabs>");

  // <TabItem value="x" label="Label" ...> → <Tab title="Label">
  content = content.replace(
    /<TabItem\b[^>]*\blabel=["']([^"']+)["'][^>]*>/g,
    (_, label) => `<Tab title="${label}">`
  );
  // Also handle label before value ordering
  content = content.replace(
    /<TabItem\b[^>]*>/g,
    (match) => {
      // Fallback: try to extract value as title if label wasn't matched above
      const valueMatch = match.match(/\bvalue=["']([^"']+)["']/);
      return valueMatch ? `<Tab title="${valueMatch[1]}">` : "<Tab>";
    }
  );

  content = content.replace(/<\/TabItem>/g, "</Tab>");

  return content;
}

// ---------------------------------------------------------------------------
// 5. Accordions  <details>/<summary>TEXT</summary>  →  <Accordion title="TEXT">
// ---------------------------------------------------------------------------

function convertAccordions(content) {
  // Pattern: <details> then <summary>TEXT</summary> on one or two lines
  content = content.replace(
    /<details>\s*\n\s*<summary>([\s\S]*?)<\/summary>/g,
    (_, rawTitle) => `<Accordion title="${rawTitle.trim().replace(/"/g, "&quot;")}">`
  );

  content = content.replace(/<\/details>/g, "</Accordion>");

  return content;
}

// ---------------------------------------------------------------------------
// 6. {@codeBlock} / {@doc} placeholders  →  MDX comment
// ---------------------------------------------------------------------------

function convertCodeBlockPlaceholders(content) {
  // \{@codeBlock\: Foo.bar\}  or  {@codeBlock: Foo.bar}
  content = content.replace(
    /\\?\{@codeBlock\\?:\s*([^}\\]+?)\\?\}/g,
    (_, ref) => `{/* TODO: codeBlock: ${ref.trim()} */}`
  );

  // {@doc: "Label|link://..."}
  content = content.replace(
    /\\?\{@doc\\?:\s*"([^|"]+)\|([^"]+)"\\?\}/g,
    (_, label, link) => `[${label}](${link})`
  );

  return content;
}

// ---------------------------------------------------------------------------
// 7. .md / .mdx extensions in internal links  →  strip extension
//    (Mintlify routes use paths without extensions)
// ---------------------------------------------------------------------------

function convertDocLinks(content) {
  // [text](./path/to/file.mdx) → [text](./path/to/file)
  // [text](./path/to/file.md#anchor) → [text](./path/to/file#anchor)
  content = content.replace(
    /(\]\([^)#"']+)\.mdx?(#[^)]*)?(\))/g,
    (_, before, anchor, close) => before + (anchor || "") + close
  );

  // href="./path.mdx" → href="./path"
  // href="./path.md#anchor" → href="./path#anchor"
  content = content.replace(
    /(href=["'][^"'#]+)\.mdx?(#[^"']*)?(['"])/g,
    (_, before, anchor, quote) => before + (anchor || "") + quote
  );

  return content;
}

// ---------------------------------------------------------------------------
// 8. Images — convert paths to /static/... and wrap in <Frame>
// ---------------------------------------------------------------------------

const IMG_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif", ".ico"]);

function convertImages(content, filePath, sourceRoot, staticRoot) {
  const fileDir = dirname(filePath);
  const lines = content.split("\n");
  const out = [];
  let inCode = false;

  for (const line of lines) {
    if (/^```/.test(line)) inCode = !inCode;

    if (!inCode) {
      // Process markdown images: ![alt](src) — skip if already wrapped in <Frame>
      const processedLine = line.replace(
        /(<Frame>)?!\[([^\]]*)\]\(([^)]+)\)(<\/Frame>)?/g,
        (match, frameOpen, alt, src, frameClose) => {
          if (frameOpen) return match; // already wrapped
          const convertedSrc = convertImageSrc(src, fileDir, sourceRoot, staticRoot);
          return `<Frame>![${alt}](${convertedSrc})</Frame>`;
        }
      );
      out.push(processedLine);
    } else {
      out.push(line);
    }
  }

  return out.join("\n");
}

/**
 * Resolve an image src to the correct Mintlify path.
 * - Absolute Docusaurus paths (/img/foo.png) → /static/img/foo.png
 * - Relative paths resolved against fileDir:
 *     • If found in sourceRoot (docs folder) — leave as-is
 *     • If found in staticRoot (static folder) — convert to /static/...
 *     • Otherwise — strip leading ../ segments and prepend /static/ as best guess
 */
function convertImageSrc(src, fileDir, sourceRoot, staticRoot) {
  // Skip external URLs, data URIs, and anchors
  if (/^https?:\/\/|^data:|^\/\//.test(src)) return src;

  // Already converted
  if (src.startsWith("/static/")) return src;

  // Absolute path — Docusaurus serves static/ at root
  if (src.startsWith("/")) {
    return "/static" + src;
  }

  // Relative path: strip anchor for path resolution
  const anchorIdx = src.indexOf("#");
  const pathOnly = anchorIdx >= 0 ? src.slice(0, anchorIdx) : src;
  const anchor   = anchorIdx >= 0 ? src.slice(anchorIdx) : "";

  // Check if it's an image extension at all; leave doc links alone
  const ext = extname(pathOnly).toLowerCase();
  if (ext && !IMG_EXTS.has(ext)) return src;

  const resolvedAbs = resolve(fileDir, pathOnly);

  // If the file exists inside the docs source, keep the relative reference
  const relToSource = relative(sourceRoot, resolvedAbs);
  if (!relToSource.startsWith("..") && existsSync(resolvedAbs)) {
    return src;
  }

  // Check if it exists in the static folder by stripping leading traversal
  if (staticRoot) {
    const stripped = pathOnly.replace(/^(\.\.\/)+/, "").replace(/^\.\//, "");
    const staticCandidate = join(staticRoot, stripped);
    if (existsSync(staticCandidate)) {
      return "/static/" + stripped.replace(/\\/g, "/") + anchor;
    }
  }

  // Best-effort fallback: strip ../ traversal and assume static
  const stripped = pathOnly.replace(/^(\.\.\/)+/, "").replace(/^\.\//, "");
  if (stripped) {
    return "/static/" + stripped + anchor;
  }

  return src;
}
