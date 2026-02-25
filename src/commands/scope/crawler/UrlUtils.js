/**
 * URL utility functions for the scope crawler.
 * Pure JavaScript — no external dependencies.
 */

/** Extract origin from a URL string (e.g. "https://example.com") */
export function getOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

/**
 * Normalize a URL for deduplication:
 * - Lowercase pathname
 * - Strip /index.html
 * - Strip .html extension
 * - Strip hash and query params
 * - Remove trailing slash (keep root "/")
 */
export function normalizeUrl(url) {
  try {
    const u = new URL(url);
    let pathname = u.pathname;

    pathname = pathname.toLowerCase();

    if (pathname.endsWith("/index.html")) {
      pathname = pathname.slice(0, -"/index.html".length);
    }

    if (pathname.endsWith(".html")) {
      pathname = pathname.slice(0, -".html".length);
    }

    pathname = pathname.replace(/\/+/g, "/");

    if (!pathname.startsWith("/")) pathname = "/" + pathname;

    let normalized = u.origin + pathname;

    if (normalized.endsWith("/") && normalized.length > u.origin.length + 1) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  } catch {
    return url;
  }
}

/** URL pathname patterns that are never documentation pages */
export const NON_DOC_URL_PATTERNS = [
  // Auth & Account
  /\/(signin|signup|sign-in|sign-up|login|logout|log-in|log-out)(\/|$)/,
  /\/(oauth|sso)(\/|$)/,
  /\/auth\//,
  /\/(account|profile|settings|preferences)(\/|$)/,
  /\/(password|forgot-password|reset-password)(\/|$)/,
  // Community & Social
  /\/community(\/|$)/,
  /\/(posts|topics)\/(new|create)(\/|$)/,
  /\/(contributions|subscriptions|following)(\/|$)/,
  // Utility
  /\/search(\?|\/|$)/,
  /\/requests\/new(\/|$)/,
  /\/(pricing|plans)(\/|$)/,
  /\/(contact|contact-us|feedback)(\/|$)/,
  /\/(cart|checkout|subscribe|unsubscribe)(\/|$)/,
  // Admin & Internal
  /\/(admin|dashboard)(\/|$)/,
  // Blog & News
  /\/(blog|news|press|announcements)(\/|$)/,
  // Commerce
  /\/(shop|store)(\/|$)/,
  // Error pages
  /\/(404|500|error)(\/|$)/,
  // Status & Changelog
  /\/(status|changelog|releases|release-notes)(\/|$)/,
  // Redirect & utility
  /\/(redirect|share|print)(\/|$)/,
  // Legal & Careers
  /\/(careers|jobs|legal|terms|privacy|cookie)(\/|$)/,
  // Community & Forums
  /\/(forum|discuss|discussions)(\/|$)/,
  // Marketplace / Plugin directories
  /\/(marketplace|plugins|extensions)(\/|$)/,
  // Embedded content
  /\/(embed|widget)(\/|$)/,
  // AMP pages
  /\/amp(\/|$)/,
  // Print versions
  /\/print(\/|$)/,
  // Sphinx / ReadTheDocs
  /\/_sources\//,
  /\/(genindex|py-modindex|modindex)(\.html)?(\/|$)/,
  /\/objects\.inv$/,
  /\/_static\//,
  /\/_images\//,
  /\/_downloads\//,
  /\/_modules\//,
  // Raw source files
  /\.rst(\.txt)?$/,
  /\.md\.txt$/,
  // Static assets & build artifacts
  /\/(assets|static|_next|_nuxt|__docusaurus)\//,
  // Feed / Sitemap / Tags / Pagination
  /\/(feed|sitemap)(\.xml)?(\/|$)/,
  /\/tags?\//,
  /\/page\/\d+/,
  // Sphinx search page
  /\/search(\.html)?(\/|$)/,
];

/** File extensions that are never documentation pages */
export const NON_DOC_EXTENSIONS =
  /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|pdf|zip|rst|rst\.txt|md\.txt|inv)$/i;

/** Check whether a URL is a non-documentation page */
export function isNonDocUrl(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (NON_DOC_URL_PATTERNS.some((p) => p.test(pathname))) return true;
    if (NON_DOC_EXTENSIONS.test(pathname)) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Compute default scope prefix from a URL.
 * Uses the full URL path (no last-segment trimming).
 */
export function computeScopePrefix(url) {
  try {
    const u = new URL(url);
    let path = u.pathname.replace(/\/+/g, "/").replace(/\/+$/, "");
    if (!path || path === "/") return u.origin;
    return u.origin + path;
  } catch {
    return url;
  }
}

/**
 * Derive a human-readable label from a URL.
 */
export function labelFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.hostname.split(".");
    if (parts.length > 2) {
      return u.hostname;
    }
    return parts.slice(0, -1).join(".");
  } catch {
    return url;
  }
}
