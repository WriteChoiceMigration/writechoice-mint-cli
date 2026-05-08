/**
 * Post Processor
 *
 * Cleans up markdown output after HTML→Markdown conversion:
 *   1. Removes heading anchor links (e.g. [​](#heading))
 *   2. Removes duplicate H1 if it matches the page title
 *   3. Fixes component/block spacing (blank lines around MDX tags)
 *   4. Normalizes internal links
 *   5. Cleans up excessive blank lines
 */

/**
 * Runs all post-processing steps.
 * @param {string} text - Markdown text
 * @param {string} title - Page title (used to detect duplicate H1)
 * @returns {string}
 */
export function postProcessAll(text, title = "") {
  let result = text;
  result = removeHeadingAnchors(result);
  result = removeDuplicateH1(result, title);
  result = fixComponentSpacing(result);
  result = fixPreservedBlockSpacing(result);
  result = convertInlineStylesToReact(result);
  result = selfCloseVoidElements(result);
  result = cleanExtraBlankLines(result);
  return result;
}

/**
 * Removes markdown anchor links embedded in headings.
 * Patterns like: ## Heading [​](#heading) or ## [My Title](#link)
 * @param {string} text
 * @returns {string}
 */
export function removeHeadingAnchors(text) {
  return text
    // Remove trailing anchor links: ## Heading [​](#anchor) or ## Heading [](#anchor)
    .replace(/^(#{1,6}\s+.*?)\s*\[[^\]]*\]\(#[^)]*\)\s*$/gm, "$1")
    // Remove heading links where the whole heading text is a link
    .replace(/^(#{1,6}\s+)\[([^\]]+)\]\(#[^)]*\)/gm, "$1$2");
}

/**
 * Removes an H1 heading if it duplicates the page title (from frontmatter).
 * @param {string} text
 * @param {string} title
 * @returns {string}
 */
export function removeDuplicateH1(text, title) {
  if (!title) return text;
  const normalized = title.trim().toLowerCase();
  return text.replace(/^# .+$/m, (match) => {
    const headingText = match.replace(/^# /, "").trim().toLowerCase();
    return headingText === normalized ? "" : match;
  });
}

/**
 * Ensures blank lines around MDX component tags for proper rendering.
 * @param {string} text
 * @returns {string}
 */
export function fixComponentSpacing(text) {
  // Normalize spaces/tabs between a closing and opening MDX tag to a blank line
  let result = text.replace(/(<\/[A-Z][a-zA-Z]*>)[ \t]+(<[A-Z][a-zA-Z]*[\s>])/g, "$1\n\n$2");
  // Add blank line before opening MDX tags that don't have one
  result = result.replace(/([^\n])\n(<[A-Z][a-zA-Z]*[\s>])/g, "$1\n\n$2");
  // Add blank line after closing MDX tags that don't have one
  result = result.replace(/(<\/[A-Z][a-zA-Z]*>)\n([^\n])/g, "$1\n\n$2");
  return result;
}

/**
 * Self-closes all HTML void elements for JSX/MDX compatibility.
 * e.g. <img src="x.png"> → <img src="x.png"/>
 * Handles already-self-closed tags and skips code blocks.
 * @param {string} text
 * @returns {string}
 */
export function selfCloseVoidElements(text) {
  const voidTags = "area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr";
  const re = new RegExp(`<(${voidTags})(\\s[^>]*)?>`, "gi");
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part.replace(re, (match, tag, attrs) => {
        if (match.endsWith("/>")) return match;
        const cleanAttrs = attrs ? attrs.replace(/\s*\/$/, "").trimEnd() : "";
        return `<${tag}${cleanAttrs}/>`;
      });
    })
    .join("");
}

/**
 * Reduces more than 2 consecutive blank lines to exactly 2.
 * @param {string} text
 * @returns {string}
 */
export function cleanExtraBlankLines(text) {
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Normalizes internal links. For now, removes trailing slashes from href paths.
 * @param {string} text
 * @returns {string}
 */
export function normalizeLinks(text) {
  // Remove trailing slashes from markdown links that point to internal paths
  return text.replace(/\]\(([^)]+?)\/\)/g, (match, href) => {
    // Only strip if it looks like a path (not a domain root)
    if (href.includes("/") && !href.match(/^https?:\/\/[^/]*\/$/)) {
      return `](${href})`;
    }
    return match;
  });
}

/**
 * Ensures preserved block HTML elements (tables, iframes) are surrounded by blank lines.
 * Without this, Turndown can leave the placeholder inline with surrounding text.
 * @param {string} text
 * @returns {string}
 */
export function fixPreservedBlockSpacing(text) {
  // Blank line before <table> / <iframe> when preceded by non-newline content
  let result = text.replace(/([^\n])(<(?:table|iframe)[\s>])/gi, "$1\n\n$2");
  // Blank line after </table> / </iframe> — handle any trailing whitespace including non-breaking spaces
  result = result.replace(/(<\/(?:table|iframe)>)[^\n]*\n(?!\n)/g, "$1\n\n");
  return result;
}

/**
 * Converts HTML inline style attributes to React JSX object syntax.
 * e.g. style="font-size: 14px; color: red" → style={{fontSize: "14px", color: "red"}}
 * Skips content inside fenced code blocks.
 * @param {string} text
 * @returns {string}
 */
export function convertInlineStylesToReact(text) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part; // inside a code block — leave as-is
      return part.replace(/\bstyle="([^"]*)"/g, (_, css) => {
        const pairs = css
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((decl) => {
            const idx = decl.indexOf(":");
            if (idx === -1) return null;
            const prop = decl
              .slice(0, idx)
              .trim()
              .replace(/-([a-z])/g, (_, l) => l.toUpperCase());
            const value = decl.slice(idx + 1).trim();
            return `${prop}: "${value}"`;
          })
          .filter(Boolean);
        return `style={{${pairs.join(", ")}}}`;
      });
    })
    .join("");
}
