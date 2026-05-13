/**
 * Table Converter
 *
 * Converts simple HTML tables to Markdown tables.
 * "Simple" means no block-level or list elements inside cells
 * (no ul, ol, pre, blockquote, div, or nested table).
 * The original HTML is preserved as a JSX comment above the markdown table.
 */

const COMPLEX_TAGS = ["ul", "ol", "pre", "blockquote", "table", "div"];

/**
 * Returns true if the table contains only inline content safe for markdown cells.
 * @param {Object} $ - Cheerio instance
 * @param {Object} $table - Cheerio element
 */
export function isSimpleTable($, $table) {
  for (const tag of COMPLEX_TAGS) {
    if ($table.find(tag).length > 0) return false;
  }
  return true;
}

/**
 * Converts a cheerio table element to a GFM markdown table string.
 * Returns null if the table has no rows.
 * @param {Object} $ - Cheerio instance
 * @param {Object} $table - Cheerio element
 * @returns {string|null}
 */
export function tableToMarkdown($, $table) {
  const rows = [];

  $table.find("tr").each((_, tr) => {
    const cells = [];
    $(tr)
      .children("th, td")
      .each((_, cell) => {
        const text = $(cell)
          .text()
          .trim()
          .replace(/\|/g, "\\|")
          .replace(/\s+/g, " ");
        cells.push(text);
      });
    if (cells.length > 0) rows.push(cells);
  });

  if (rows.length === 0) return null;

  const colCount = Math.max(...rows.map((r) => r.length));
  const hasHeaderRow =
    $table.find("thead").length > 0 ||
    $table.find("tr").first().children("th").length > 0;

  const pad = (row) => {
    const padded = [...row];
    while (padded.length < colCount) padded.push("");
    return padded;
  };

  const separator = "| " + Array(colCount).fill("---").join(" | ") + " |";
  const lines = [];

  if (hasHeaderRow) {
    lines.push("| " + pad(rows[0]).join(" | ") + " |");
    lines.push(separator);
    for (let i = 1; i < rows.length; i++) {
      lines.push("| " + pad(rows[i]).join(" | ") + " |");
    }
  } else {
    for (const row of rows) {
      lines.push("| " + pad(row).join(" | ") + " |");
    }
  }

  return lines.join("\n");
}

/**
 * Wraps an original HTML table in a JSX comment and prepends it to the markdown table.
 * @param {string} originalHtml
 * @param {string} markdownTable
 * @returns {string}
 */
export function wrapWithOriginalComment(originalHtml, markdownTable) {
  // Escape */ to prevent premature comment close
  const safeHtml = originalHtml.replace(/\*\//g, "* /");
  return `{/*\n${safeHtml}\n*/}\n\n${markdownTable}`;
}
