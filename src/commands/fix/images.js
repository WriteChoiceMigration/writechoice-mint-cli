/**
 * Fix Images Tool
 *
 * Wraps standalone images in MDX files with <Frame> components.
 * Handles both Markdown images (![alt](url)) and HTML <img> tags.
 *
 * Skips images that are already inside:
 * - <Frame> blocks
 * - Fenced code blocks
 * - Markdown tables
 * - HTML tables
 */

import { existsSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { dirname, join, relative, resolve } from "path";
import chalk from "chalk";

const EXCLUDED_DIRS = ["node_modules", ".git"];

// ─────────────────────────────────────────────────────────────────────────────
// Protection patterns (tokenized so images inside them are never touched)
// ─────────────────────────────────────────────────────────────────────────────

// Existing <Frame>...</Frame> blocks (case-insensitive, with optional attributes)
const FRAME_RE = /<Frame(?:\s[^>]*)?>[\s\S]*?<\/Frame>/gi;

// HTML tables
const HTML_TABLE_RE = /<table(?:\s[^>]*)?>[\s\S]*?<\/table>/gi;

// Markdown tables: one or more consecutive lines starting with |
const MD_TABLE_RE = /^(?:\|[^\n]*\n)+(?:\|[^\n]*)?/gm;

// Fenced code blocks (backtick or tilde, 3+)
const FENCE_RE = /^[ \t]*(`{3,}|~{3,})[ \t]*[^\n]*\n[\s\S]*?\n[ \t]*\1[ \t]*$/gm;

// ─────────────────────────────────────────────────────────────────────────────
// Image patterns (applied after protection)
// ─────────────────────────────────────────────────────────────────────────────

// Standalone Markdown image on its own line: ![alt](url)
const MD_IMAGE_RE = /^([ \t]*)(!\[[^\]\n]*\]\([^\)\n]+\))[ \t]*$/gm;

// Standalone HTML <img> tag on its own line
const HTML_IMG_RE = /^([ \t]*)(<img\b[^>\n]*\/?>)[ \t]*$/gm;

// ─────────────────────────────────────────────────────────────────────────────
// Tokenizer helpers
// ─────────────────────────────────────────────────────────────────────────────

function tokenize(pattern, text, tag) {
  const stash = [];
  const result = text.replace(pattern, (match) => {
    const idx = stash.length;
    stash.push(match);
    return `\x00${tag}${idx}\x00`;
  });
  return { text: result, stash };
}

function detokenize(text, tag, stash) {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`\x00${escapedTag}(\\d+)\x00`, "g"), (_, idx) => {
    return stash[parseInt(idx, 10)];
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Core processing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Processes MDX content and wraps standalone images in <Frame> components.
 * Returns { newContent, count }.
 */
export function processContent(content) {
  let text = content;

  // 1. Protect existing <Frame> blocks
  const frameResult = tokenize(FRAME_RE, text, "FRAME");
  text = frameResult.text;

  // 2. Protect HTML tables
  const htmlTableResult = tokenize(HTML_TABLE_RE, text, "HTMLTABLE");
  text = htmlTableResult.text;

  // 3. Protect Markdown tables
  const mdTableResult = tokenize(MD_TABLE_RE, text, "MDTABLE");
  text = mdTableResult.text;

  // 4. Protect fenced code blocks
  const fenceResult = tokenize(FENCE_RE, text, "FENCE");
  text = fenceResult.text;

  // 5. Wrap standalone images
  let count = 0;

  text = text.replace(MD_IMAGE_RE, (match, indent, image) => {
    count++;
    return `${indent}<Frame>\n${indent}${image}\n${indent}</Frame>`;
  });

  text = text.replace(HTML_IMG_RE, (match, indent, tag) => {
    count++;
    return `${indent}<Frame>\n${indent}${tag}\n${indent}</Frame>`;
  });

  // 6. Restore all protected regions (reverse order)
  text = detokenize(text, "FENCE", fenceResult.stash);
  text = detokenize(text, "MDTABLE", mdTableResult.stash);
  text = detokenize(text, "HTMLTABLE", htmlTableResult.stash);
  text = detokenize(text, "FRAME", frameResult.stash);

  return { newContent: text, count };
}

// ─────────────────────────────────────────────────────────────────────────────
// Image src extraction (for --download)
// ─────────────────────────────────────────────────────────────────────────────

// Extract all image src values from MDX content (markdown + HTML img)
export function extractImageSrcs(content) {
  const srcs = [];

  // Markdown images: ![alt](src) — capture the URL part
  const mdRe = /!\[[^\]]*\]\(([^)\s"']+)/g;
  let m;
  while ((m = mdRe.exec(content)) !== null) {
    srcs.push(m[1]);
  }

  // HTML img tags: <img src="..." /> or <img src='...' />
  const htmlRe = /<img\b[^>]*\bsrc=["']([^"']+)["']/gi;
  while ((m = htmlRe.exec(content)) !== null) {
    srcs.push(m[1]);
  }

  return srcs;
}

/**
 * Downloads missing local images from the source URL.
 * Only attempts images with local absolute paths (starting with /).
 * Returns { downloaded, failed } arrays and optionally writes image_download.json.
 */
async function downloadMissingImages(files, repoRoot, downloadUrl, options) {
  const base = downloadUrl.replace(/\/$/, "");

  // Collect unique local srcs across all files
  const srcSet = new Set();
  for (const filePath of files) {
    const content = readFileSync(filePath, "utf-8");
    for (const src of extractImageSrcs(content)) {
      // Only handle root-relative paths like /images/foo.png
      if (src.startsWith("/") && !src.startsWith("//")) {
        srcSet.add(src);
      }
    }
  }

  if (srcSet.size === 0) {
    return { downloaded: [], failed: [] };
  }

  const downloaded = [];
  const failed = [];

  for (const src of srcSet) {
    const localPath = join(repoRoot, src);

    if (existsSync(localPath)) continue; // already present

    const url = base + src;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        failed.push({ src, url, reason: `HTTP ${response.status}` });
        continue;
      }

      if (!options.dryRun) {
        mkdirSync(dirname(localPath), { recursive: true });
        const buffer = await response.arrayBuffer();
        writeFileSync(localPath, Buffer.from(buffer));
      }

      downloaded.push({ src, url });

      if (options.verbose) {
        console.log(`  ${chalk.green("↓")} ${src}`);
      }
    } catch (err) {
      failed.push({ src, url, reason: err.message });
    }
  }

  return { downloaded, failed };
}

// ─────────────────────────────────────────────────────────────────────────────
// File discovery
// ─────────────────────────────────────────────────────────────────────────────

function findMdxFiles(repoRoot, directory = null, file = null) {
  if (file) {
    const fullPath = resolve(repoRoot, file);
    return existsSync(fullPath) ? [fullPath] : [];
  }

  const searchDirs = directory ? [resolve(repoRoot, directory)] : [repoRoot];
  const mdxFiles = [];

  function walkDirectory(dir) {
    const dirName = dir.split("/").pop();
    if (EXCLUDED_DIRS.includes(dirName)) return;

    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walkDirectory(fullPath);
        } else if (stat.isFile() && entry.endsWith(".mdx")) {
          mdxFiles.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}: ${error.message}`);
    }
  }

  for (const dir of searchDirs) {
    if (existsSync(dir)) walkDirectory(dir);
  }

  return mdxFiles.sort();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export async function fixImages(options) {
  const repoRoot = process.cwd();

  if (!options.quiet) {
    console.log(chalk.bold("\n🖼️  Image Frame Fixer\n"));
  }

  const files = findMdxFiles(repoRoot, options.dir, options.file);

  if (files.length === 0) {
    console.error(chalk.red("✗ No MDX files found."));
    process.exit(1);
  }

  if (!options.quiet) {
    console.log(`Found ${files.length} MDX file(s) to process\n`);
    if (options.dryRun) {
      console.log(chalk.yellow("Dry run — no files will be written\n"));
    }
  }

  const results = {};
  let totalImages = 0;

  for (const filePath of files) {
    const content = readFileSync(filePath, "utf-8");
    const { newContent, count } = processContent(content);

    if (count > 0) {
      const relPath = relative(repoRoot, filePath);
      results[relPath] = count;
      totalImages += count;

      if (options.verbose) {
        console.log(`${chalk.cyan(relPath)}: wrapped ${count} image(s)`);
      }

      if (!options.dryRun) {
        writeFileSync(filePath, newContent, "utf-8");
      }
    }
  }

  // Summary — wrapping
  if (!options.quiet) {
    const fileCount = Object.keys(results).length;

    if (fileCount > 0) {
      const verb = options.dryRun ? "Would wrap" : "Wrapped";
      console.log(chalk.green(`\n✓ ${verb} ${totalImages} image(s) in ${fileCount} file(s)`));

      if (!options.verbose) {
        for (const [filePath, count] of Object.entries(results)) {
          console.log(`  ${chalk.cyan(filePath)}: ${count} image(s)`);
        }
      }
    } else {
      console.log(chalk.yellow("⚠️  No unwrapped images found."));
    }
  }

  // ── Download pass ──────────────────────────────────────────────────────────
  if (!options.download) return;

  if (!options.downloadUrl) {
    console.error(chalk.red(
      '\n✗ --download requires a source URL.\n' +
      '  Pass it after the flag: wc fix images --download https://docs.example.com\n' +
      '  Or set "source" in config.json'
    ));
    process.exit(1);
  }

  if (!options.quiet) {
    console.log(chalk.bold("\n⬇️  Downloading missing images\n"));
    if (options.dryRun) {
      console.log(chalk.yellow("Dry run — images will not be saved\n"));
    }
  }

  const { downloaded, failed } = await downloadMissingImages(files, repoRoot, options.downloadUrl, options);

  if (!options.quiet) {
    if (downloaded.length > 0) {
      const verb = options.dryRun ? "Would download" : "Downloaded";
      console.log(chalk.green(`\n✓ ${verb} ${downloaded.length} image(s)`));
      if (!options.verbose) {
        for (const { src } of downloaded) {
          console.log(`  ${src}`);
        }
      }
    }

    if (failed.length > 0) {
      console.log(chalk.red(`\n✗ Failed to download ${failed.length} image(s)`));
      for (const { src, reason } of failed) {
        console.log(`  ${chalk.cyan(src)}: ${reason}`);
      }
    }

    if (downloaded.length === 0 && failed.length === 0) {
      console.log(chalk.yellow("⚠️  No missing local images found."));
    }
  }

  // Write report when there are failures
  if (failed.length > 0 && !options.dryRun) {
    const reportPath = join(repoRoot, "image_download.json");
    writeFileSync(reportPath, JSON.stringify({ downloaded, failed }, null, 2), "utf-8");
    if (!options.quiet) {
      console.log(`\nReport written to ${chalk.cyan("image_download.json")}`);
    }
  }
}
