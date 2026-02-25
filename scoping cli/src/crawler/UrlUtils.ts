/**
 * URL utility functions for the CLI crawler.
 * Extracted from ScopingCrawler.tsx and scopingStore.ts.
 * Pure TypeScript — no Electron dependencies.
 */

/** Extract origin from a URL string (e.g. "https://example.com") */
export function getOrigin(url: string): string {
  try { return new URL(url).origin; } catch { return url; }
}

/**
 * Normalize a URL for deduplication:
 * - Lowercase pathname (Sphinx serves /csl/Language/X.html = /csl/language/x)
 * - Strip /index.html (directory index pages)
 * - Strip .html extension (Sphinx/SSGs serve both /page and /page.html)
 * - Strip hash and query params
 * - Remove trailing slash (keep root "/")
 */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    let pathname = u.pathname;

    // 1. Lowercase the entire pathname
    pathname = pathname.toLowerCase();

    // 2. Strip /index.html (directory index pages)
    if (pathname.endsWith('/index.html')) {
      pathname = pathname.slice(0, -'/index.html'.length);
    }

    // 3. Strip .html extension
    if (pathname.endsWith('.html')) {
      pathname = pathname.slice(0, -'.html'.length);
    }

    // 4. Collapse duplicate slashes
    pathname = pathname.replace(/\/+/g, '/');

    // 5. Ensure pathname starts with /
    if (!pathname.startsWith('/')) pathname = '/' + pathname;

    let normalized = u.origin + pathname;

    // 6. Remove trailing slash (but keep root "/")
    if (normalized.endsWith('/') && normalized.length > u.origin.length + 1) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  } catch {
    return url;
  }
}

/** URL pathname patterns that are never documentation pages */
export const NON_DOC_URL_PATTERNS: RegExp[] = [
  // Auth & Account
  /\/(signin|signup|sign-in|sign-up|login|logout|log-in|log-out)(\/|$)/,
  /\/(oauth|sso)(\/|$)/,
  /\/auth\//,
  /\/(account|profile|settings|preferences)(\/|$)/,
  /\/(password|forgot-password|reset-password)(\/|$)/,
  // Community & Social (Zendesk, forums)
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

  // ===== Sphinx / ReadTheDocs =====
  /\/_sources\//,                                      // Raw .rst source files for every page
  /\/(genindex|py-modindex|modindex)(\.html)?(\/|$)/,  // Generated indices
  /\/objects\.inv$/,                                   // Intersphinx inventory
  /\/_static\//,                                       // Static assets (CSS, JS, fonts)
  /\/_images\//,                                       // Sphinx image directory
  /\/_downloads\//,                                    // Downloadable files directory
  /\/_modules\//,                                      // Auto-generated Python module sources

  // ===== Raw source files (any SSG) =====
  /\.rst(\.txt)?$/,                                    // reStructuredText source views
  /\.md\.txt$/,                                        // Markdown source views

  // ===== Static assets & build artifacts =====
  /\/(assets|static|_next|_nuxt|__docusaurus)\//,

  // ===== Feed / Sitemap / Tags / Pagination =====
  /\/(feed|sitemap)(\.xml)?(\/|$)/,
  /\/tags?\//,
  /\/page\/\d+/,                                       // Pagination URLs (/page/2, /page/3)

  // ===== Sphinx search page =====
  /\/search(\.html)?(\/|$)/,
];

/** File extensions that are never documentation pages */
export const NON_DOC_EXTENSIONS = /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|pdf|zip|rst|rst\.txt|md\.txt|inv)$/i;

/** Check whether a URL is a non-documentation page */
export function isNonDocUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    // Pattern-based filter
    if (NON_DOC_URL_PATTERNS.some(p => p.test(pathname))) return true;
    // Extension-based filter (source files, assets)
    if (NON_DOC_EXTENSIONS.test(pathname)) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Compute default scope prefix from a URL.
 * Uses the full URL path (no last-segment trimming).
 * e.g. https://example.com/hc/en-us/articles/123 -> https://example.com/hc/en-us/articles/123
 * e.g. https://example.com/hc/en-us -> https://example.com/hc/en-us
 * e.g. https://example.com/ -> https://example.com
 *
 * Extracted from scopingStore.ts.
 */
export function computeScopePrefix(url: string): string {
  try {
    const u = new URL(url);
    // Remove trailing slash and collapse duplicate slashes
    let path = u.pathname.replace(/\/+/g, "/").replace(/\/+$/, "");
    // If the path is empty or just "/", use origin
    if (!path || path === "/") return u.origin;
    return u.origin + path;
  } catch {
    return url;
  }
}

/**
 * Derive a human-readable label from a URL.
 * Returns the full hostname if there's a subdomain, otherwise just the domain minus TLD.
 *
 * Extracted from scopingStore.ts.
 */
export function labelFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.hostname.split(".");
    // Use subdomain if present (e.g., docs.example.com -> "docs.example.com")
    if (parts.length > 2) {
      return u.hostname;
    }
    return parts.slice(0, -1).join(".");
  } catch {
    return url;
  }
}
