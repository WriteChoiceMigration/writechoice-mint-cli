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
  // Add blank line before opening MDX tags that don't have one
  let result = text.replace(/([^\n])\n(<[A-Z][a-zA-Z]*[\s>])/g, "$1\n\n$2");
  // Add blank line after closing MDX tags that don't have one
  result = result.replace(/(<\/[A-Z][a-zA-Z]*>)\n([^\n])/g, "$1\n\n$2");
  return result;
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
