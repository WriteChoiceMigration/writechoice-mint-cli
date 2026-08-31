/**
 * wcc fix void-tags — Self-close HTML void tags in MDX files
 *
 * Raw HTML (e.g. <img src="...">, <br>) is often left unclosed by hand-written
 * docs or converted from other formats (readme.com, Docusaurus, ...). MDX
 * compiles as JSX, which requires void elements to be self-closing, so a page
 * with an unclosed void tag fails to build. This walks .mdx files and closes
 * them in place: <img src="..."> -> <img src="..." />.
 *
 * Reuses the code-fence/inline-code-aware void tag fixer from `wcc fix parse`
 * so example code blocks showing raw HTML aren't corrupted. `wcc readme
 * convert` also calls selfCloseVoidTags() directly on every file it writes.
 */

import { existsSync, readdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { join, relative, resolve } from "path";
import chalk from "chalk";
import { segmentContent, fixVoidTags as fixVoidTagsInSegment } from "./parse.js";

const EXCLUDED_DIRS = ["node_modules", ".git"];

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
// Pure content fixer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Self-closes void HTML tags outside of code fences and inline code.
 * Returns { content, count }.
 */
export function selfCloseVoidTags(content) {
  const segments = segmentContent(content);
  let count = 0;

  const fixed = segments.map((seg) => {
    if (seg.protected) return seg.text;
    const { text, count: c } = fixVoidTagsInSegment(seg.text);
    count += c;
    return text;
  });

  return { content: fixed.join(""), count };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export async function fixVoidTags(options) {
  const repoRoot = process.cwd();

  if (!options.quiet) {
    console.log(chalk.bold("\n# Self-Close Void Tags\n"));
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

  let totalFixed = 0;
  const changed = [];

  for (const filePath of files) {
    const content = readFileSync(filePath, "utf-8");
    const { content: newContent, count } = selfCloseVoidTags(content);

    if (count > 0) {
      const relPath = relative(repoRoot, filePath);
      changed.push({ relPath, count });
      totalFixed += count;

      if (options.verbose) {
        console.log(`${chalk.cyan(relPath)}: closed ${count} tag(s)`);
      }

      if (!options.dryRun) {
        writeFileSync(filePath, newContent, "utf-8");
      }
    }
  }

  if (!options.quiet) {
    if (changed.length > 0) {
      const verb = options.dryRun ? "Would close" : "Closed";
      console.log(chalk.green(`\n✓ ${verb} ${totalFixed} tag(s) across ${changed.length} file(s)`));

      if (!options.verbose) {
        for (const { relPath, count } of changed) {
          console.log(`  ${chalk.cyan(relPath)} (${count})`);
        }
      }
    } else {
      console.log(chalk.yellow("⚠️  No unclosed void tags found."));
    }
  }
}
