/**
 * wcc readme nav <url> — Scrape a readme.io sidebar and convert to Mintlify navigation
 *
 * Loads the given readme.io docs URL with Playwright, expands all collapsed
 * sidebar sections, parses the sidebar HTML, and outputs a Mintlify navigation
 * JSON array. External sidebar links become stub MDX files in --links-dir.
 */

import { mkdirSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { load } from "cheerio";
import chalk from "chalk";

// ---------------------------------------------------------------------------
// Scrape
// ---------------------------------------------------------------------------

async function expandAll(page) {
  while (true) {
    const buttons = await page.$$(
      "button[class*='Sidebar-link-button'][aria-expanded='false']"
    );
    if (!buttons.length) break;
    for (const btn of buttons) {
      try {
        await btn.click();
      } catch (_) {}
    }
    await page.waitForTimeout(300);
  }
}

async function fetchSidebarHtml(url, verbose) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  if (verbose) process.stdout.write(chalk.dim(`  Loading ${url} ...\n`));
  await page.goto(url, { waitUntil: "networkidle" });

  if (verbose) process.stdout.write(chalk.dim("  Expanding all collapsed sections ...\n"));
  await expandAll(page);

  const nav = await page.$("nav.rm-Sidebar");
  if (!nav) {
    await browser.close();
    throw new Error("Could not find nav.rm-Sidebar on the page.");
  }

  const html = await nav.innerHTML();
  await browser.close();

  return `<nav class="rm-Sidebar">\n${html}\n</nav>\n`;
}

// ---------------------------------------------------------------------------
// Convert
// ---------------------------------------------------------------------------

function hrefToPage(href) {
  return href.replace(/^\//, "");
}

function isExternal($, el) {
  const target = $(el).attr("target");
  const rel = $(el).attr("rel") || "";
  return target === "_blank" || rel.includes("noopener");
}

function linkLabel($, el) {
  const span = $(el).find("span").first();
  const raw = span.length ? span.text() : $(el).text();
  return raw.replace(/\s+/g, " ").trim();
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function writeLinkStub(linksDir, title, url) {
  mkdirSync(linksDir, { recursive: true });
  const slug = slugify(title);
  const path = join(linksDir, `${slug}.mdx`);
  writeFileSync(path, `---\ntitle: "${title}"\nurl: "${url}"\n---\n`, "utf-8");
  return `${linksDir}/${slug}`;
}

function parseLi($, li, linksDir) {
  const a = $(li).children("a").first();
  if (!a.length) return null;

  const href = a.attr("href") || "";
  if (!href) return null;

  if (isExternal($, a[0])) {
    if (!linksDir) return null;
    return writeLinkStub(linksDir, linkLabel($, a[0]), href);
  }

  if (!href.startsWith("/docs/")) return null;

  const subpagesUl = $(li).find("ul").filter((_, el) => {
    const cls = $(el).attr("class") || "";
    return cls.includes("subpages");
  }).first();

  if (subpagesUl.length) {
    const groupName = linkLabel($, a[0]);
    const pages = [];
    subpagesUl.children("li").each((_, childLi) => {
      const entry = parseLi($, childLi, linksDir);
      if (entry !== null) pages.push(entry);
    });
    return { group: groupName, root: hrefToPage(href), pages };
  }

  return hrefToPage(href);
}

function parseSection($, section, linksDir) {
  const h2 = $(section).find("h2").first();
  const groupName = h2.length ? h2.text().trim() : "Unnamed";

  const topUl = $(section).find("ul").first();
  const pages = [];
  if (topUl.length) {
    topUl.children("li").each((_, li) => {
      const entry = parseLi($, li, linksDir);
      if (entry !== null) pages.push(entry);
    });
  }

  return { group: groupName, pages };
}

function htmlToNav(html, linksDir) {
  const $ = load(html);
  const groups = [];
  $("section").filter((_, el) => {
    const cls = $(el).attr("class") || "";
    return cls.includes("rm-Sidebar-section");
  }).each((_, section) => {
    groups.push(parseSection($, section, linksDir));
  });
  return groups;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * @param {string} url - readme.io docs URL to scrape
 * @param {Object} options
 * @param {string} [options.output] - Output file path (default: nav.json)
 * @param {string} [options.linksDir] - Directory for external link stubs (default: links)
 * @param {boolean} [options.noLinks] - Skip writing external link stubs
 * @param {boolean} [options.quiet]
 */
export async function readmeScrapeNav(url, options = {}) {
  const verbose = !options.quiet;
  const outputFile = options.output || "nav.json";
  const linksDir = options.linksDir || "links";

  if (verbose) console.log(chalk.cyan("\nScraping readme.io sidebar..."));

  let html;
  try {
    html = await fetchSidebarHtml(url, verbose);
  } catch (err) {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }

  const effectiveLinksDir = options.noLinks ? null : linksDir;
  const groups = htmlToNav(html, effectiveLinksDir);

  writeFileSync(outputFile, JSON.stringify(groups, null, 2) + "\n", "utf-8");

  if (verbose) {
    console.log(chalk.green(`\n  ✓ ${groups.length} group${groups.length !== 1 ? "s" : ""} written to ${outputFile}`));
    if (!options.noLinks && existsSync(linksDir)) {
      const stubs = readdirSync(linksDir);
      if (stubs.length) {
        console.log(chalk.green(`  ✓ ${stubs.length} external link stub${stubs.length !== 1 ? "s" : ""} written to ${linksDir}/`));
      }
    }
  }
}
