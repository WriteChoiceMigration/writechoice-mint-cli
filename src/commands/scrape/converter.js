/**
 * HTML → MDX Converter
 *
 * Orchestrates the 13-step conversion pipeline:
 *  1. Parse HTML with cheerio
 *  2. Remove title element
 *  3. Remove unwanted elements
 *  4. Process components (callouts, accordions, cards, tabs, code groups)
 *  5. Preserve HTML elements (tables, iframes)
 *  6. Process images
 *  7. Pre-process code blocks (language detection)
 *  8. Convert to markdown via turndown
 *  9. Post-process code blocks
 * 10. Escape HTML entities
 * 11. Replace component placeholders
 * 12. Restore preserved HTML
 * 13. Post-process markdown
 * 14. Add YAML frontmatter
 */

import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { PlaceholderManager } from "./placeholder-manager.js";
import { processAllComponents } from "./component-processor.js";
import { preserveAll } from "./html-preserver.js";
import { ImageProcessor } from "./image-processor.js";
import { preProcessCodeBlocks, createTurndownCodeRule } from "./codeblock-processor.js";
import { postProcessAll } from "./post-processor.js";

/**
 * Converts an HTML page to MDX content.
 *
 * @param {string} html - Raw HTML from the fetched page
 * @param {string} pageUrl - URL of the page (for relative URL resolution)
 * @param {Object} scrapeConfig - The merged scrape configuration
 * @returns {{ mdx: string, imageFailures: Array }}
 */
export async function convertPage(html, pageUrl, scrapeConfig = {}) {
  const pm = new PlaceholderManager();

  const contentSelector = scrapeConfig.content_selector || "body";
  const titleSelector = scrapeConfig.title_selector || "h1";
  const elementsToRemove = scrapeConfig.elements_to_remove || [];
  const htmlPreserveElements = scrapeConfig.html_preserve_elements || ["table", "iframe"];
  const htmlPreserveCustom = scrapeConfig.html_preserve_custom || [];
  const componentsConfig = scrapeConfig.components || {};
  const imageConfig = scrapeConfig.images || { strategy: "keep_remote", folder: "images" };
  const codeblockConfig = scrapeConfig.codeblock || {};
  const langPatterns = codeblockConfig.language_class_patterns || ["language-", "lang-", "highlight-"];
  const outputDir = scrapeConfig.output || "output";
  const dryRun = scrapeConfig.dryRun || false;

  // Step 1: Parse HTML
  const $ = cheerio.load(html);

  // Extract title and meta description before scoping to content
  let title = "";
  const $titleEl = $(titleSelector).first();
  if ($titleEl.length) {
    title = $titleEl.text().trim();
  }
  if (!title) {
    title = $("title").first().text().trim();
  }
  // Strip site name suffix (e.g. "Page Title | Site Name" → "Page Title")
  if (title.includes(" | ")) {
    title = title.split(" | ")[0].trim();
  }

  // const metaDesc = $("meta[name='description']").attr("content") || "";
  const ogTitle = $("meta[property='og:title']").attr("content") || "";
  const ogDesc = $("meta[property='og:description']").attr("content") || "";
  const ogImage = $("meta[property='og:image']").attr("content") || "";

  // Scope to content area
  const $content = $(contentSelector);
  if (!$content.length) {
    return { mdx: buildFrontmatter(title, {}) + "\n\n<!-- No content found -->", imageFailures: [] };
  }

  // Work with just the content HTML
  const contentHtml = $content.html() || "";
  const $doc = cheerio.load(contentHtml);

  // Step 2: Remove title element (avoid duplicate H1)
  // We'll let post-processor handle duplicate H1 removal

  // Step 3: Remove unwanted elements
  for (const selector of elementsToRemove) {
    try {
      $doc(selector).remove();
    } catch {
      // Invalid selector — skip
    }
  }

  // Step 4: Process components (imgProcessor needed early for card img resolution)
  const imgProcessor = new ImageProcessor(pageUrl, imageConfig, outputDir, dryRun);
  processAllComponents($doc, componentsConfig, pm, imgProcessor);

  // Step 5 & 6: Preserve HTML + process images
  preserveAll($doc, htmlPreserveElements, htmlPreserveCustom, pm, imgProcessor);
  imgProcessor.processImages($doc, pm);

  // Step 7: Pre-process code blocks (add data-detected-lang)
  preProcessCodeBlocks($doc, langPatterns);

  // Step 8: Convert to Markdown via turndown
  const td = buildTurndownService();
  const bodyHtml = $doc.html() || "";
  let markdown = td.turndown(bodyHtml);

  // Step 9: (Code block language is handled by custom turndown rule above)

  // Step 10: Escape HTML entities outside code blocks
  markdown = pm.escapeHtmlEntities(markdown);

  // Step 11: Replace component placeholders → MDX tags
  markdown = pm.replaceComponentPlaceholders(markdown);

  // Step 12: Restore preserved HTML (tables, iframes, images)
  markdown = pm.restore(markdown);

  // Step 13: Post-process
  markdown = postProcessAll(markdown, title);

  // Step 14: Add YAML frontmatter
  const metaTags = {};
  if (pageUrl) metaTags.permalink = pageUrl;
  // if (metaDesc) metaTags.description = metaDesc;
  if (ogTitle) metaTags["og:title"] = ogTitle;
  if (ogDesc) metaTags["og:description"] = ogDesc;
  if (ogImage) metaTags["og:image"] = ogImage;

  const mdx = buildFrontmatter(title, metaTags) + "\n\n" + markdown;

  return {
    mdx,
    imageFailures: imgProcessor.failures,
  };
}

/**
 * Builds and configures a TurndownService instance.
 */
function buildTurndownService() {
  const td = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
  });

  // Keep preserved HTML elements as-is (restored from placeholders)
  td.keep(["table", "iframe", "frame"]);

  // Custom rule for code blocks with language detection
  const codeRule = createTurndownCodeRule();
  td.addRule("fencedCodeBlock", codeRule);

  // Remove script/style tags
  td.remove(["script", "style", "noscript"]);

  return td;
}

/**
 * Builds YAML frontmatter for an MDX file.
 * @param {string} title
 * @param {Object} metaTags - Optional meta tag key/value pairs
 * @returns {string}
 */
export function buildFrontmatter(title, metaTags = {}) {
  const lines = ["---"];
  if (title) {
    lines.push(`title: "${title.replace(/"/g, '\\"')}"`);
  }

  const metaEntries = Object.entries(metaTags).filter(([, v]) => v);
  for (const [key, value] of metaEntries) {
    lines.push(`${key}: "${String(value).replace(/"/g, '\\"')}"`);
  }

  lines.push("---");
  return lines.join("\n");
}
