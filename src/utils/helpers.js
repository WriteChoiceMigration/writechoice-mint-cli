import { join, relative, resolve, dirname } from 'path';
import { URL } from 'url';

/**
 * Clean heading text by removing duplicates and extra whitespace.
 *
 * Some headings have duplicate text separated by newlines like:
 * "Create resources\nCreate resources" -> "Create resources"
 */
export function cleanHeadingText(text) {
  // Split by newlines and get unique parts while preserving order
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line);

  // If all lines are the same, return just one
  const uniqueLines = [...new Set(lines)];
  if (uniqueLines.length === 1) {
    return uniqueLines[0];
  }

  // Otherwise, join with space (in case they're genuinely different)
  return lines.join(' ');
}

/**
 * Convert heading text to kebab-case anchor format.
 *
 * Examples:
 *   "Getting Started Guide" -> "getting-started-guide"
 *   "AI/ML Integration" -> "ai-ml-integration"
 */
export function toKebabCase(text) {
  let result = text.toLowerCase();
  // Remove non-alphanumeric except hyphens
  result = result.replace(/[^\w\s-]/g, '');
  // Replace spaces and multiple hyphens
  result = result.replace(/[-\s]+/g, '-');
  return result.replace(/^-+|-+$/g, '');
}

/**
 * Check if a URL is external (http/https)
 */
export function isExternalUrl(href) {
  return href.startsWith('http://') || href.startsWith('https://');
}

/**
 * Check if href is just an anchor (starts with #)
 */
export function isAnchorOnly(href) {
  return href.startsWith('#');
}

/**
 * Normalize URL by removing /index and trailing slashes
 */
export function normalizeUrl(url) {
  // Remove /index.mdx at the end
  if (url.endsWith('/index.mdx')) {
    url = url.slice(0, -10); // Remove "/index.mdx"
  }
  // Remove /index at the end (but not /index-something)
  else if (url.endsWith('/index')) {
    url = url.slice(0, -6); // Remove "/index"
  }

  url = url.replace(/\/+$/, '');
  return url;
}

/**
 * Find the line number for a match position in the content
 */
export function findLineNumber(content, matchStart) {
  return content.slice(0, matchStart).split('\n').length;
}

/**
 * Remove code blocks and frontmatter from content, return cleaned content
 * and list of removed ranges.
 */
export function removeCodeBlocksAndFrontmatter(content) {
  const removedRanges = [];

  // Find frontmatter
  const frontmatterPattern = /^---\n.*?\n---\n/ms;
  const frontmatterMatch = frontmatterPattern.exec(content);
  if (frontmatterMatch) {
    removedRanges.push([frontmatterMatch.index, frontmatterMatch.index + frontmatterMatch[0].length]);
  }

  // Find code blocks
  const codeBlockPattern = /```.*?```/gs;
  let match;
  while ((match = codeBlockPattern.exec(content)) !== null) {
    removedRanges.push([match.index, match.index + match[0].length]);
  }

  // Remove in reverse order to preserve positions
  removedRanges.sort((a, b) => b[0] - a[0]);
  let cleanedContent = content;
  for (const [start, end] of removedRanges) {
    cleanedContent = cleanedContent.slice(0, start) + ' '.repeat(end - start) + cleanedContent.slice(end);
  }

  return { cleanedContent, removedRanges };
}

/**
 * Convert a URL back to an MDX file path.
 *
 * Examples:
 *   "https://docs.nebius.com/kubernetes/gpu/set-up" -> repoRoot / "kubernetes/gpu/set-up.mdx"
 *   "https://docs.nebius.com/portal/" -> repoRoot / "portal/index.mdx"
 */
export function urlToFilePath(url, baseUrl, repoRoot) {
  // Remove base URL to get the path
  let path;
  if (url.startsWith(baseUrl)) {
    path = url.slice(baseUrl.length);
  } else {
    // Try to extract path from URL
    const parsed = new URL(url);
    path = parsed.pathname;
  }

  // Remove leading slash
  path = path.replace(/^\/+/, '');

  // If empty or just /, it's the root index
  if (!path || path === '/') {
    return join(repoRoot, 'index.mdx');
  }

  // Try with .mdx extension first
  const mdxPath = join(repoRoot, `${path}.mdx`);

  // Try with /index.mdx
  const indexPath = join(repoRoot, path, 'index.mdx');

  // Return the .mdx path (we'll check existence later)
  return { mdxPath, indexPath };
}

/**
 * Resolve relative/absolute MDX links to full URLs.
 *
 * Examples:
 *   "./catalog" from /portal/index.mdx -> https://base/portal/catalog
 *   "/plugins/soundcheck" -> https://base/plugins/soundcheck
 *   "./guides/auth" from /portal/getting-started.mdx -> https://base/portal/guides/auth
 *
 * Returns null for external URLs or invalid paths.
 */
export function resolvePath(mdxFilePath, href, baseUrl, repoRoot) {
  // Handle external URLs (skip)
  if (isExternalUrl(href)) {
    return null;
  }

  // Split anchor from path
  let path, anchor;
  if (href.includes('#')) {
    [path, anchor] = href.split('#', 2);
  } else {
    path = href;
    anchor = '';
  }

  // Handle anchor-only links (same page)
  if (!path && anchor) {
    // Convert file path to URL path
    const relPath = relative(repoRoot, mdxFilePath);
    const urlPath = relPath.replace(/\.mdx$/, '');
    const fullUrl = normalizeUrl(`${baseUrl}/${urlPath}`);
    return `${fullUrl}#${anchor}`;
  }

  let fullUrl;

  // Absolute path (starts with /)
  if (path.startsWith('/')) {
    fullUrl = normalizeUrl(baseUrl + path);
  }
  // Relative path
  else {
    // Get MDX file's directory
    const mdxDir = dirname(mdxFilePath);

    // Handle ./ prefix
    if (path.startsWith('./')) {
      path = path.slice(2);
    }

    // Resolve relative to MDX file's directory
    const resolved = resolve(mdxDir, path);

    // Check if resolved path is within repo
    const relToRoot = relative(repoRoot, resolved);
    if (relToRoot.startsWith('..')) {
      // Path is outside repo
      return null;
    }

    const urlPath = relToRoot.replace(/\.mdx$/, '');
    fullUrl = normalizeUrl(`${baseUrl}/${urlPath}`);
  }

  // Add anchor back if present
  if (anchor) {
    fullUrl += '#' + anchor;
  }

  return fullUrl;
}
