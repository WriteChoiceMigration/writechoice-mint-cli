/**
 * MDX Link Validation Tool
 *
 * Validates internal links and anchors in MDX documentation files by testing them
 * against the live website. Uses Playwright for browser automation to handle
 * JavaScript-rendered Mintlify pages.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, relative, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import chalk from "chalk";
import {
  cleanHeadingText,
  toKebabCase,
  isExternalUrl,
  isAnchorOnly,
  normalizeUrl,
  findLineNumber,
  removeCodeBlocksAndFrontmatter,
  resolvePath as resolvePathUtil,
} from "../../utils/helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const DEFAULT_BASE_URL = "https://docs.nebius.com";
const EXCLUDED_DIRS = ["snippets"];
const MDX_DIRS = ["."];
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_CONCURRENCY = 25;

// Link extraction patterns
const LINK_PATTERNS = {
  markdown: /\[([^\]]+?)\]\(([^)]+?)\)/g,
  markdownImage: /!\[([^\]]*?)\]\(([^)]+?)\)/g,
  htmlAnchor: /<a\s+href=["'](.*?)["'][^>]*?>(.*?)<\/a>/gs,
  htmlImage: /<img[^>]+src=["'](.*?)["'][^>]*?>/gi,
  jsxCard: /<Card[^>]+?href=["'](.*?)["'][^>]*?(?:title=["'](.*?)["'])?[^>]*?>/g,
  jsxButton: /<Button[^>]+?href=["'](.*?)["'][^>]*?>(.*?)<\/Button>/gs,
};

// Data Structures
class LinkLocation {
  constructor(filePath, lineNumber, linkText, rawHref, linkType) {
    this.filePath = filePath;
    this.lineNumber = lineNumber;
    this.linkText = linkText;
    this.rawHref = rawHref;
    this.linkType = linkType;
  }
}

class Link {
  constructor(source, targetUrl, basePath, anchor, expectedSlug) {
    this.source = source;
    this.targetUrl = targetUrl;
    this.basePath = basePath;
    this.anchor = anchor;
    this.expectedSlug = expectedSlug;
  }
}

class ValidationResult {
  constructor(
    source,
    targetUrl,
    basePath,
    anchor,
    expectedSlug,
    status,
    actualUrl = null,
    actualHeading = null,
    actualHeadingKebab = null,
    errorMessage = null,
    validationTimeMs = 0,
  ) {
    this.source = source;
    this.targetUrl = targetUrl;
    this.basePath = basePath;
    this.anchor = anchor;
    this.expectedSlug = expectedSlug;
    this.status = status;
    this.actualUrl = actualUrl;
    this.actualHeading = actualHeading;
    this.actualHeadingKebab = actualHeadingKebab;
    this.errorMessage = errorMessage;
    this.validationTimeMs = validationTimeMs;
  }
}

// Utility Functions

function urlToFilePath(url, baseUrl, repoRoot) {
  let path;
  if (url.startsWith(baseUrl)) {
    path = url.slice(baseUrl.length);
  } else {
    try {
      const parsed = new URL(url);
      path = parsed.pathname;
    } catch {
      return null;
    }
  }

  path = path.replace(/^\/+/, "");

  if (!path || path === "/") {
    const indexPath = join(repoRoot, "index.mdx");
    return existsSync(indexPath) ? indexPath : null;
  }

  const mdxPath = join(repoRoot, `${path}.mdx`);
  if (existsSync(mdxPath)) {
    return mdxPath;
  }

  const indexPath = join(repoRoot, path, "index.mdx");
  if (existsSync(indexPath)) {
    return indexPath;
  }

  return mdxPath;
}

function resolvePath(mdxFilePath, href, baseUrl, repoRoot) {
  if (isExternalUrl(href)) {
    return null;
  }

  let path, anchor;
  if (href.includes("#")) {
    [path, anchor] = href.split("#", 2);
  } else {
    path = href;
    anchor = "";
  }

  if (!path && anchor) {
    const relPath = relative(repoRoot, mdxFilePath);
    const urlPath = relPath.replace(/\.mdx$/, "");
    const fullUrl = normalizeUrl(`${baseUrl}/${urlPath}`);
    return `${fullUrl}#${anchor}`;
  }

  let fullUrl;

  if (path.startsWith("/")) {
    fullUrl = normalizeUrl(baseUrl + path);
  } else {
    const mdxDir = dirname(mdxFilePath);

    if (path.startsWith("./")) {
      path = path.slice(2);
    }

    const resolved = resolve(mdxDir, path);

    const relToRoot = relative(repoRoot, resolved);
    if (relToRoot.startsWith("..")) {
      return null;
    }

    const urlPath = relToRoot.replace(/\.mdx$/, "");
    fullUrl = normalizeUrl(`${baseUrl}/${urlPath}`);
  }

  if (anchor) {
    fullUrl += "#" + anchor;
  }

  return fullUrl;
}

// Link Extraction Functions

function extractMdxHeadings(filePath) {
  try {
    const content = readFileSync(filePath, "utf-8");
    const { cleanedContent } = removeCodeBlocksAndFrontmatter(content);

    const headingPattern = /^#{1,6}\s+(.+)$/gm;
    const headings = [];

    let match;
    while ((match = headingPattern.exec(cleanedContent)) !== null) {
      let headingText = match[1].trim();
      // Remove any trailing {#custom-id} syntax if present
      headingText = headingText.replace(/\s*\{#[^}]+\}\s*$/, "");
      headings.push(headingText);
    }

    return headings;
  } catch {
    return [];
  }
}

function extractLinksFromFile(filePath, baseUrl, repoRoot, verbose = false) {
  if (verbose) {
    console.log(`  Extracting links from ${relative(repoRoot, filePath)}`);
  }

  let content;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch (error) {
    console.error(`Error reading ${filePath}: ${error.message}`);
    return [];
  }

  const { cleanedContent } = removeCodeBlocksAndFrontmatter(content);
  const links = [];

  // Collect all image positions to skip them
  const imagePositions = new Set();

  // Find all markdown images ![alt](url)
  const markdownImages = [...cleanedContent.matchAll(LINK_PATTERNS.markdownImage)];
  for (const match of markdownImages) {
    imagePositions.add(match.index);
  }

  // Find all HTML images <img src="url">
  const htmlImages = [...cleanedContent.matchAll(LINK_PATTERNS.htmlImage)];
  for (const match of htmlImages) {
    imagePositions.add(match.index);
  }

  // Extract markdown links [text](url) - skip images
  const markdownMatches = [...cleanedContent.matchAll(LINK_PATTERNS.markdown)];
  for (const match of markdownMatches) {
    // Check if this is actually an image by looking at the character before '['
    const charBefore = match.index > 0 ? cleanedContent[match.index - 1] : "";
    if (charBefore === "!") {
      // This is a markdown image ![alt](url), skip it
      continue;
    }

    const linkText = match[1];
    const href = match[2];

    if (isExternalUrl(href)) continue;

    const targetUrl = resolvePath(filePath, href, baseUrl, repoRoot);
    if (targetUrl) {
      const location = new LinkLocation(
        relative(repoRoot, filePath),
        findLineNumber(content, match.index),
        linkText.trim(),
        href,
        "markdown",
      );

      const [basePath, anchor = ""] = targetUrl.split("#");
      const expectedSlug = new URL(targetUrl).pathname;

      links.push(new Link(location, targetUrl, basePath, anchor || null, expectedSlug));
    }
  }

  // Extract HTML anchor links <a href="url">text</a>
  const htmlMatches = [...cleanedContent.matchAll(LINK_PATTERNS.htmlAnchor)];
  for (const match of htmlMatches) {
    const href = match[1];
    const linkText = match[2];

    if (isExternalUrl(href)) continue;

    const targetUrl = resolvePath(filePath, href, baseUrl, repoRoot);
    if (targetUrl) {
      const location = new LinkLocation(
        relative(repoRoot, filePath),
        findLineNumber(content, match.index),
        linkText.trim(),
        href,
        "html",
      );

      const [basePath, anchor = ""] = targetUrl.split("#");
      const expectedSlug = new URL(targetUrl).pathname;

      links.push(new Link(location, targetUrl, basePath, anchor || null, expectedSlug));
    }
  }

  // Extract JSX Card links <Card href="url" title="text">
  const cardMatches = [...cleanedContent.matchAll(LINK_PATTERNS.jsxCard)];
  for (const match of cardMatches) {
    const href = match[1];
    const linkText = match[2] || href;

    if (isExternalUrl(href)) continue;

    const targetUrl = resolvePath(filePath, href, baseUrl, repoRoot);
    if (targetUrl) {
      const location = new LinkLocation(
        relative(repoRoot, filePath),
        findLineNumber(content, match.index),
        linkText.trim(),
        href,
        "jsx",
      );

      const [basePath, anchor = ""] = targetUrl.split("#");
      const expectedSlug = new URL(targetUrl).pathname;

      links.push(new Link(location, targetUrl, basePath, anchor || null, expectedSlug));
    }
  }

  // Extract JSX Button links <Button href="url">text</Button>
  const buttonMatches = [...cleanedContent.matchAll(LINK_PATTERNS.jsxButton)];
  for (const match of buttonMatches) {
    const href = match[1];
    const linkText = match[2];

    if (isExternalUrl(href)) continue;

    const targetUrl = resolvePath(filePath, href, baseUrl, repoRoot);
    if (targetUrl) {
      const location = new LinkLocation(
        relative(repoRoot, filePath),
        findLineNumber(content, match.index),
        linkText.trim(),
        href,
        "jsx",
      );

      const [basePath, anchor = ""] = targetUrl.split("#");
      const expectedSlug = new URL(targetUrl).pathname;

      links.push(new Link(location, targetUrl, basePath, anchor || null, expectedSlug));
    }
  }

  return links;
}

function findMdxFiles(repoRoot, directory = null, file = null) {
  if (file) {
    const fullPath = resolve(repoRoot, file);
    return existsSync(fullPath) ? [fullPath] : [];
  }

  const searchDirs = directory ? [resolve(repoRoot, directory)] : MDX_DIRS.map((d) => join(repoRoot, d));

  const files = [];

  function walkDir(dir) {
    if (!existsSync(dir)) return;

    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        if (!EXCLUDED_DIRS.some((excluded) => fullPath.includes(excluded))) {
          walkDir(fullPath);
        }
      } else if (entry.endsWith(".mdx")) {
        files.push(fullPath);
      }
    }
  }

  for (const searchDir of searchDirs) {
    walkDir(searchDir);
  }

  return files.sort();
}

// Playwright Validation Functions

async function validateAnchor(page, link, baseUrl, repoRoot, verbose = false, progress = "") {
  const startTime = Date.now();

  try {
    if (verbose) {
      console.log(`${progress}    Validating anchor: ${link.anchor}`);
    }

    // OPTIMIZATION: Check if anchor exists in local MDX file first
    const mdxFilePath = urlToFilePath(link.basePath, baseUrl, repoRoot);
    if (mdxFilePath && existsSync(mdxFilePath)) {
      const mdxHeadings = extractMdxHeadings(mdxFilePath);
      const mdxHeadingsKebab = mdxHeadings.map((h) => toKebabCase(h));

      if (mdxHeadingsKebab.includes(link.anchor)) {
        const heading = mdxHeadings.find((h) => toKebabCase(h) === link.anchor);
        if (verbose) {
          console.log(`                   ✓ Anchor validated locally in MDX file`);
        }
        return new ValidationResult(
          link.source,
          link.targetUrl,
          link.basePath,
          link.anchor,
          link.expectedSlug,
          "success",
          link.basePath,
          heading,
          link.anchor,
          null,
          Date.now() - startTime,
        );
      } else if (verbose) {
        console.log(`                   Anchor not found in local MDX, checking online...`);
      }
    }

    // Navigate to base page
    await page.goto(link.basePath, { waitUntil: "networkidle", timeout: DEFAULT_TIMEOUT });

    // Try to find heading by anchor
    let heading = await page.$(`#${link.anchor}`);

    if (!heading) {
      heading = await page.$(`[id="${link.anchor}"]`);
    }

    if (!heading) {
      return new ValidationResult(
        link.source,
        link.targetUrl,
        link.basePath,
        link.anchor,
        link.expectedSlug,
        "failure",
        null,
        null,
        null,
        `Anchor #${link.anchor} not found on page`,
        Date.now() - startTime,
      );
    }

    // Get heading text and clean it
    const actualText = await heading.innerText();
    const actualTextClean = cleanHeadingText(actualText);
    const actualKebab = toKebabCase(actualTextClean);

    // Extract headings from the TARGET MDX file to verify
    const mdxFilePath2 = urlToFilePath(link.basePath, baseUrl, repoRoot);
    const mdxHeadings = mdxFilePath2 ? extractMdxHeadings(mdxFilePath2) : [];
    const mdxHeadingsKebab = mdxHeadings.map((h) => toKebabCase(h));

    const matchesMdx = mdxHeadingsKebab.includes(actualKebab);

    if (actualKebab === link.anchor) {
      if (matchesMdx) {
        return new ValidationResult(
          link.source,
          link.targetUrl,
          link.basePath,
          link.anchor,
          link.expectedSlug,
          "success",
          link.basePath,
          actualTextClean,
          actualKebab,
          null,
          Date.now() - startTime,
        );
      } else {
        return new ValidationResult(
          link.source,
          link.targetUrl,
          link.basePath,
          link.anchor,
          link.expectedSlug,
          "failure",
          null,
          actualTextClean,
          actualKebab,
          `Anchor "#${link.anchor}" matches page heading "${actualTextClean}" but this heading is not found in the MDX file`,
          Date.now() - startTime,
        );
      }
    } else {
      if (matchesMdx) {
        return new ValidationResult(
          link.source,
          link.targetUrl,
          link.basePath,
          link.anchor,
          link.expectedSlug,
          "failure",
          null,
          actualTextClean,
          actualKebab,
          `Expected anchor "#${link.anchor}" but page heading "${actualTextClean}" should use "#${actualKebab}"`,
          Date.now() - startTime,
        );
      } else {
        return new ValidationResult(
          link.source,
          link.targetUrl,
          link.basePath,
          link.anchor,
          link.expectedSlug,
          "failure",
          null,
          actualTextClean,
          actualKebab,
          `Expected anchor "#${link.anchor}" but found heading "${actualTextClean}" (#${actualKebab}) which is not in the MDX file`,
          Date.now() - startTime,
        );
      }
    }
  } catch (error) {
    return new ValidationResult(
      link.source,
      link.targetUrl,
      link.basePath,
      link.anchor,
      link.expectedSlug,
      "error",
      null,
      null,
      null,
      `Error validating anchor: ${error.message}`,
      Date.now() - startTime,
    );
  }
}

async function validateNormalLink(page, link, baseUrl, repoRoot, verbose = false, progress = "") {
  const startTime = Date.now();

  try {
    if (verbose) {
      console.log(`${progress}    Validating link: ${link.targetUrl}`);
    }

    // OPTIMIZATION: Check if target MDX file exists locally first
    const mdxFilePath = urlToFilePath(link.targetUrl, baseUrl, repoRoot);
    if (mdxFilePath && existsSync(mdxFilePath)) {
      if (verbose) {
        console.log(`                   ✓ Link validated locally (file exists)`);
      }
      return new ValidationResult(
        link.source,
        link.targetUrl,
        link.basePath,
        link.anchor,
        link.expectedSlug,
        "success",
        link.targetUrl,
        null,
        null,
        null,
        Date.now() - startTime,
      );
    } else if (verbose) {
      console.log(`                   File not found locally, checking online...`);
    }

    // Navigate to the target URL
    const response = await page.goto(link.targetUrl, { waitUntil: "networkidle", timeout: DEFAULT_TIMEOUT });

    if (!response) {
      return new ValidationResult(
        link.source,
        link.targetUrl,
        link.basePath,
        link.anchor,
        link.expectedSlug,
        "error",
        null,
        null,
        null,
        "No response received",
        Date.now() - startTime,
      );
    }

    const actualUrl = page.url();

    if (response.status() >= 400) {
      return new ValidationResult(
        link.source,
        link.targetUrl,
        link.basePath,
        link.anchor,
        link.expectedSlug,
        "failure",
        actualUrl,
        null,
        null,
        `HTTP ${response.status()}: ${response.statusText()}`,
        Date.now() - startTime,
      );
    }

    return new ValidationResult(
      link.source,
      link.targetUrl,
      link.basePath,
      link.anchor,
      link.expectedSlug,
      "success",
      actualUrl,
      null,
      null,
      null,
      Date.now() - startTime,
    );
  } catch (error) {
    return new ValidationResult(
      link.source,
      link.targetUrl,
      link.basePath,
      link.anchor,
      link.expectedSlug,
      "error",
      null,
      null,
      null,
      `Error validating link: ${error.message}`,
      Date.now() - startTime,
    );
  }
}

async function validateLink(page, link, baseUrl, repoRoot, verbose = false, progress = "") {
  if (link.anchor) {
    return await validateAnchor(page, link, baseUrl, repoRoot, verbose, progress);
  } else {
    return await validateNormalLink(page, link, baseUrl, repoRoot, verbose, progress);
  }
}

async function validateLinksAsync(links, baseUrl, repoRoot, concurrency, headless, verbose) {
  const results = [];

  let browser;
  try {
    browser = await chromium.launch({ headless });
  } catch (error) {
    if (
      error.message.includes("Executable doesn't exist") ||
      error.message.includes("Browser was not installed") ||
      error.message.includes("browserType.launch")
    ) {
      console.error(chalk.red("\n✗ Playwright browsers are not installed!"));
      console.error(chalk.yellow("\nTo install Playwright browsers, run:"));
      console.error(chalk.cyan("  npx playwright install chromium\n"));
      console.error("Or install all browsers with:");
      console.error(chalk.cyan("  npx playwright install\n"));
      process.exit(1);
    }
    throw error;
  }

  const activePromises = [];
  let counter = 0;

  async function validateWithSemaphore(link) {
    counter++;
    const current = counter;
    const progress = verbose ? `[${current}/${links.length}] ` : "";

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      const result = await validateLink(page, link, baseUrl, repoRoot, verbose, progress);
      return result;
    } finally {
      await context.close();
    }
  }

  if (verbose) {
    console.log(`\nValidating ${links.length} links with concurrency=${concurrency}...\n`);
  }

  // Process links with concurrency control
  for (let i = 0; i < links.length; i += concurrency) {
    const batch = links.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((link) => validateWithSemaphore(link)));
    results.push(...batchResults);
  }

  await browser.close();

  return results;
}

// Fix Links in MDX Files

function fixLinksFromReport(reportPath, repoRoot, verbose = false) {
  if (!existsSync(reportPath)) {
    console.error(`Error: Report file not found: ${reportPath}`);
    return {};
  }

  let reportData;
  try {
    reportData = JSON.parse(readFileSync(reportPath, "utf-8"));
  } catch (error) {
    console.error(`Error reading report file: ${error.message}`);
    return {};
  }

  const resultsByFile = reportData.results_by_file || {};

  if (Object.keys(resultsByFile).length === 0) {
    if (verbose) {
      console.log("No failures found in report.");
    }
    return {};
  }

  const fixesApplied = {};

  for (const [filePath, failures] of Object.entries(resultsByFile)) {
    const fullPath = join(repoRoot, filePath);

    if (!existsSync(fullPath)) {
      if (verbose) {
        console.log(`Warning: File not found: ${filePath}`);
      }
      continue;
    }

    const fixableFailures = failures.filter((f) => f.status === "failure" && f.actual_heading_kebab && f.anchor);

    if (fixableFailures.length === 0) continue;

    try {
      const content = readFileSync(fullPath, "utf-8");
      let lines = content.split("\n");
      let modified = false;
      let fixesCount = 0;

      fixableFailures.sort((a, b) => b.source.line_number - a.source.line_number);

      for (const failure of fixableFailures) {
        const lineNum = failure.source.line_number - 1;

        if (lineNum >= lines.length) {
          if (verbose) {
            console.log(`Warning: Line ${failure.source.line_number} not found in ${filePath}`);
          }
          continue;
        }

        let line = lines[lineNum];
        const oldHref = failure.source.raw_href;
        const newAnchor = failure.actual_heading_kebab;
        const linkType = failure.source.link_type;

        const pathPart = oldHref.includes("#") ? oldHref.split("#")[0] : oldHref;
        const newHref = pathPart ? `${pathPart}#${newAnchor}` : `#${newAnchor}`;

        if (oldHref === newHref) {
          if (verbose) {
            console.log(`Skipping ${filePath}:${failure.source.line_number} (no change needed)`);
          }
          continue;
        }

        let replaced = false;

        if (linkType === "markdown") {
          const oldPattern = `(${oldHref})`;
          const newPattern = `(${newHref})`;
          if (line.includes(oldPattern)) {
            line = line.replace(oldPattern, newPattern);
            replaced = true;
          }
        } else if (linkType === "html" || linkType === "jsx") {
          for (const quote of ['"', "'"]) {
            const oldPattern = `href=${quote}${oldHref}${quote}`;
            const newPattern = `href=${quote}${newHref}${quote}`;
            if (line.includes(oldPattern)) {
              line = line.replace(oldPattern, newPattern);
              replaced = true;
              break;
            }
          }
        }

        if (replaced) {
          lines[lineNum] = line;
          modified = true;
          fixesCount++;

          if (verbose) {
            console.log(`Fixed ${filePath}:${failure.source.line_number}`);
            console.log(`  Old: ${oldHref}`);
            console.log(`  New: ${newHref}`);
          }
        } else if (verbose) {
          console.log(`Warning: Could not find href '${oldHref}' on line ${failure.source.line_number} in ${filePath}`);
        }
      }

      if (modified) {
        const newContent = lines.join("\n");
        writeFileSync(fullPath, newContent, "utf-8");
        fixesApplied[filePath] = fixesCount;

        if (verbose) {
          console.log(`Saved ${fixesCount} fix(es) to ${filePath}`);
        }
      }
    } catch (error) {
      if (verbose) {
        console.log(`Error fixing ${filePath}: ${error.message}`);
      }
    }
  }

  return fixesApplied;
}

function fixLinks(results, repoRoot, verbose = false) {
  const failuresByFile = {};

  for (const result of results) {
    if (result.status !== "failure" || !result.actualHeadingKebab || !result.anchor) {
      continue;
    }

    const filePath = result.source.filePath;
    if (!failuresByFile[filePath]) {
      failuresByFile[filePath] = [];
    }

    failuresByFile[filePath].push(result);
  }

  const fixesApplied = {};

  for (const [filePath, failures] of Object.entries(failuresByFile)) {
    const fullPath = join(repoRoot, filePath);

    if (!existsSync(fullPath)) {
      if (verbose) {
        console.log(`Warning: File not found: ${filePath}`);
      }
      continue;
    }

    try {
      const content = readFileSync(fullPath, "utf-8");
      let lines = content.split("\n");
      let modified = false;
      let fixesCount = 0;

      failures.sort((a, b) => b.source.lineNumber - a.source.lineNumber);

      for (const failure of failures) {
        const lineNum = failure.source.lineNumber - 1;

        if (lineNum >= lines.length) {
          if (verbose) {
            console.log(`Warning: Line ${failure.source.lineNumber} not found in ${filePath}`);
          }
          continue;
        }

        let line = lines[lineNum];
        const oldHref = failure.source.rawHref;
        const linkType = failure.source.linkType;

        const pathPart = oldHref.includes("#") ? oldHref.split("#")[0] : oldHref;
        const newHref = pathPart ? `${pathPart}#${failure.actualHeadingKebab}` : `#${failure.actualHeadingKebab}`;

        if (oldHref === newHref) {
          if (verbose) {
            console.log(`Skipping ${filePath}:${failure.source.lineNumber} (no change needed)`);
          }
          continue;
        }

        let replaced = false;

        if (linkType === "markdown") {
          const oldPattern = `(${oldHref})`;
          const newPattern = `(${newHref})`;
          if (line.includes(oldPattern)) {
            line = line.replace(oldPattern, newPattern);
            replaced = true;
          }
        } else if (linkType === "html" || linkType === "jsx") {
          for (const quote of ['"', "'"]) {
            const oldPattern = `href=${quote}${oldHref}${quote}`;
            const newPattern = `href=${quote}${newHref}${quote}`;
            if (line.includes(oldPattern)) {
              line = line.replace(oldPattern, newPattern);
              replaced = true;
              break;
            }
          }
        }

        if (replaced) {
          lines[lineNum] = line;
          modified = true;
          fixesCount++;

          if (verbose) {
            console.log(`Fixed ${filePath}:${failure.source.lineNumber}`);
            console.log(`  Old: ${oldHref}`);
            console.log(`  New: ${newHref}`);
          }
        } else if (verbose) {
          console.log(`Warning: Could not find href '${oldHref}' on line ${failure.source.lineNumber} in ${filePath}`);
        }
      }

      if (modified) {
        const newContent = lines.join("\n");
        writeFileSync(fullPath, newContent, "utf-8");
        fixesApplied[filePath] = fixesCount;

        if (verbose) {
          console.log(`Saved ${fixesCount} fix(es) to ${filePath}`);
        }
      }
    } catch (error) {
      if (verbose) {
        console.log(`Error fixing ${filePath}: ${error.message}`);
      }
    }
  }

  return fixesApplied;
}

// Report Generation

function generateReport(results, config, outputPath) {
  const total = results.length;
  const success = results.filter((r) => r.status === "success").length;
  const failure = results.filter((r) => r.status === "failure").length;
  const error = results.filter((r) => r.status === "error").length;

  const summaryByFile = {};
  for (const result of results) {
    const filePath = result.source.filePath;
    if (!summaryByFile[filePath]) {
      summaryByFile[filePath] = { total: 0, success: 0, failure: 0, error: 0 };
    }

    summaryByFile[filePath].total++;
    summaryByFile[filePath][result.status]++;
  }

  const resultsByFile = {};
  for (const result of results) {
    if (result.status === "success") continue;

    const filePath = result.source.filePath;
    if (!resultsByFile[filePath]) {
      resultsByFile[filePath] = [];
    }

    resultsByFile[filePath].push(result);
  }

  const report = {
    timestamp: new Date().toISOString(),
    configuration: config,
    summary: {
      total_links: total,
      success,
      failure,
      error,
    },
    summary_by_file: summaryByFile,
    results_by_file: resultsByFile,
  };

  writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf-8");

  return report;
}

// Main CLI Function

export async function validateLinks(baseUrl, options) {
  const repoRoot = process.cwd();

  // Handle --fix-from-report mode
  if (options.fixFromReport !== undefined) {
    // If flag is passed with a path, use that path; otherwise use default
    const reportPath =
      typeof options.fixFromReport === "string" && options.fixFromReport ? options.fixFromReport : "links_report.json";

    if (!options.quiet) {
      console.log(`Applying fixes from report: ${reportPath}`);
    }

    const fixesApplied = fixLinksFromReport(reportPath, repoRoot, options.verbose && !options.quiet);

    if (!options.quiet) {
      if (Object.keys(fixesApplied).length > 0) {
        const totalFixes = Object.values(fixesApplied).reduce((a, b) => a + b, 0);
        console.log(`\nFixed ${totalFixes} link(s) in ${Object.keys(fixesApplied).length} file(s):`);
        for (const [filePath, count] of Object.entries(fixesApplied)) {
          console.log(`  ${filePath}: ${count} fix(es)`);
        }
        console.log("\nRun validation again to verify the fixes.");
      } else {
        console.log("\nNo fixable issues found in report.");
      }
    }

    return;
  }

  // Normalize base URL - add https:// if not present
  let normalizedBaseUrl = baseUrl;
  if (!normalizedBaseUrl.startsWith("http://") && !normalizedBaseUrl.startsWith("https://")) {
    normalizedBaseUrl = "https://" + normalizedBaseUrl;
  }
  // Remove trailing slash
  normalizedBaseUrl = normalizedBaseUrl.replace(/\/+$/, "");

  if (options.verbose && !options.quiet) {
    console.log("Finding MDX files...");
  }

  const mdxFiles = findMdxFiles(repoRoot, options.dir, options.file);

  if (mdxFiles.length === 0) {
    console.error("No MDX files found.");
    process.exit(1);
  }

  if (options.verbose && !options.quiet) {
    console.log(`Found ${mdxFiles.length} MDX files\n`);
  }

  if (options.verbose && !options.quiet) {
    console.log("Extracting links...");
  }

  const allLinks = [];
  for (const mdxFile of mdxFiles) {
    const links = extractLinksFromFile(mdxFile, normalizedBaseUrl, repoRoot, options.verbose && !options.quiet);
    allLinks.push(...links);
  }

  if (allLinks.length === 0) {
    console.log("No internal links found.");
    return;
  }

  if (!options.quiet) {
    console.log(`\nFound ${allLinks.length} internal links`);
  }

  if (options.dryRun) {
    console.log("\nExtracted links:");
    allLinks.forEach((link, i) => {
      console.log(`\n${i + 1}. ${link.source.filePath}:${link.source.lineNumber}`);
      console.log(`   Text: ${link.source.linkText}`);
      console.log(`   Raw: ${link.source.rawHref}`);
      console.log(`   URL: ${link.targetUrl}`);
      if (link.anchor) {
        console.log(`   Anchor: #${link.anchor}`);
      }
    });
    return;
  }

  const startTime = Date.now();

  if (!options.quiet) {
    console.log("\nValidating links...");
  }

  const results = await validateLinksAsync(
    allLinks,
    normalizedBaseUrl,
    repoRoot,
    parseInt(options.concurrency) || DEFAULT_CONCURRENCY,
    options.headless !== false,
    options.verbose && !options.quiet,
  );

  const executionTime = (Date.now() - startTime) / 1000;

  if (options.fix) {
    if (!options.quiet) {
      console.log("\nApplying fixes...");
    }

    const fixesApplied = fixLinks(results, repoRoot, options.verbose && !options.quiet);

    if (!options.quiet) {
      if (Object.keys(fixesApplied).length > 0) {
        const totalFixes = Object.values(fixesApplied).reduce((a, b) => a + b, 0);
        console.log(`\nFixed ${totalFixes} link(s) in ${Object.keys(fixesApplied).length} file(s):`);
        for (const [filePath, count] of Object.entries(fixesApplied)) {
          console.log(`  ${filePath}: ${count} fix(es)`);
        }
        console.log("\nRun validation again to verify the fixes.");
      } else {
        console.log("\nNo fixable issues found.");
      }
    }
  }

  const config = {
    base_url: normalizedBaseUrl,
    scanned_directories: options.dir || options.file ? [options.dir || options.file] : MDX_DIRS,
    excluded_directories: EXCLUDED_DIRS,
    concurrency: parseInt(options.concurrency) || DEFAULT_CONCURRENCY,
    execution_time_seconds: Math.round(executionTime * 100) / 100,
  };

  const report = generateReport(results, config, options.output || "links_report.json");

  if (!options.quiet) {
    console.log(`\n${"=".repeat(60)}`);
    console.log("VALIDATION SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total links:    ${report.summary.total_links}`);
    console.log(`Success:        ${chalk.green(report.summary.success + " ✓")}`);
    console.log(`Failure:        ${chalk.red(report.summary.failure + " ✗")}`);
    console.log(`Error:          ${chalk.yellow(report.summary.error + " ⚠")}`);
    console.log(`Execution time: ${executionTime.toFixed(2)}s`);
    console.log(`\nReport saved to: ${options.output || "links_report.json"}`);

    if (report.summary.failure > 0 || report.summary.error > 0) {
      console.log(`\n${"=".repeat(60)}`);
      console.log("ISSUES FOUND");
      console.log("=".repeat(60));
      let shown = 0;

      for (const [filePath, fileResults] of Object.entries(report.results_by_file)) {
        for (const result of fileResults) {
          if (shown < 10) {
            console.log(`\n${result.source.filePath}:${result.source.lineNumber}`);
            console.log(`  Link: ${result.source.linkText}`);
            console.log(`  URL: ${result.targetUrl}`);
            console.log(`  Error: ${result.errorMessage}`);
            shown++;
          } else {
            break;
          }
        }
        if (shown >= 10) break;
      }

      if (shown < report.summary.failure + report.summary.error) {
        const remaining = report.summary.failure + report.summary.error - shown;
        console.log(
          `\n... and ${remaining} more issues. See ${options.output || "links_report.json"} for full details.`,
        );
      }
    }
  }

  if (report.summary.failure > 0 || report.summary.error > 0) {
    process.exit(1);
  }
}
