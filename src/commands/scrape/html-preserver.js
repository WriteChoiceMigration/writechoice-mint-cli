/**
 * HTML Preserver
 *
 * Preserves HTML elements that should not be converted to Markdown
 * (tables, iframes, custom selectors). Replaces them with placeholders
 * before markdown conversion and restores them afterward.
 *
 * Images inside tables are processed inline (without Frame wrapping).
 */

import { isSimpleTable, tableToMarkdown, wrapWithOriginalComment } from "./table-converter.js";

/**
 * Preserves all configured HTML elements by replacing them with placeholders.
 * @param {Object} $ - Cheerio instance
 * @param {string[]} elements - Element tag names to preserve (e.g. ["table", "iframe"])
 * @param {string[]} customSelectors - CSS selectors to preserve
 * @param {import('./placeholder-manager.js').PlaceholderManager} pm
 * @param {import('./image-processor.js').ImageProcessor} imageProcessor - optional, for table images
 */
export function preserveAll($, elements = [], customSelectors = [], pm, imageProcessor = null) {
  // Process standard elements
  for (const tag of elements) {
    $(tag).each((_, el) => {
      const $el = $(el);

      // Process images inside tables if imageProcessor is provided
      if (tag === "table" && imageProcessor) {
        imageProcessor.processTableImages($, $el);
      }

      // Clean up table-specific elements that don't translate to MDX
      if (tag === "table") {
        $el.find("colgroup").remove();
      }

      const html = $.html($el).trim();
      const placeholder = pm.store(html, tag.toUpperCase());
      $el.replaceWith(placeholder);
    });
  }

  // Process custom selectors
  for (const selector of customSelectors) {
    $(selector).each((_, el) => {
      const $el = $(el);
      const html = $.html($el);
      const placeholder = pm.store(html, "CUSTOM");
      $el.replaceWith(placeholder);
    });
  }
}

/**
 * Converts all tables to markdown when "table" is absent from html_preserve_elements.
 * Simple (text-only) tables become a GFM markdown table with the original HTML as a
 * JSX comment above. Complex tables (containing ul, ol, pre, blockquote, div, or nested
 * tables) are kept as raw HTML via a placeholder.
 * @param {Object} $ - Cheerio instance
 * @param {import('./placeholder-manager.js').PlaceholderManager} pm
 * @param {import('./image-processor.js').ImageProcessor} imageProcessor - optional, for table images
 */
export function convertTablesAsMarkdown($, pm, imageProcessor = null) {
  $("table").each((_, el) => {
    const $el = $(el);

    if (imageProcessor) {
      imageProcessor.processTableImages($, $el);
    }
    $el.find("colgroup").remove();

    const html = $.html($el).trim();

    if (isSimpleTable($, $el)) {
      const mdTable = tableToMarkdown($, $el);
      if (mdTable) {
        const content = wrapWithOriginalComment(html, mdTable);
        $el.replaceWith(pm.store(content, "TABLE"));
        return;
      }
    }

    // Complex table — preserve as raw HTML
    $el.replaceWith(pm.store(html, "TABLE"));
  });
}
