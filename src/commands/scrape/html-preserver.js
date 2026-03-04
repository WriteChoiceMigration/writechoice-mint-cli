/**
 * HTML Preserver
 *
 * Preserves HTML elements that should not be converted to Markdown
 * (tables, iframes, custom selectors). Replaces them with placeholders
 * before markdown conversion and restores them afterward.
 *
 * Images inside tables are processed inline (without Frame wrapping).
 */

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

      const html = $.html($el);
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
