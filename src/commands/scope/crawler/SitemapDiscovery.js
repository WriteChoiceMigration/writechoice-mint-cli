/**
 * Sitemap discovery logic.
 * Uses HttpFetcher for network requests.
 */

import { normalizeUrl, isNonDocUrl, NON_DOC_EXTENSIONS } from "./UrlUtils.js";

/**
 * Discover URLs from sitemaps (sitemap.xml and robots.txt).
 * Tries /sitemap.xml first, then checks robots.txt for Sitemap: directives.
 * If a sitemap index is found, follows child sitemaps (depth limit 3).
 * Returns deduplicated URLs filtered by the scope prefix.
 */
export async function discoverFromSitemaps(siteOrigin, scopePrefix, fetcher, log) {
  const discoveredUrls = new Set();
  const print = log ?? (() => {});

  const extractUrlsFromSitemap = async (sitemapUrl, depth) => {
    if (depth > 3) return;
    try {
      const resp = await fetcher.fetchText(sitemapUrl);
      if (!resp.success || !resp.text) return;
      const xml = resp.text;

      const sitemapIndexMatches = xml.matchAll(/<sitemap>\s*<loc>\s*([^<]+?)\s*<\/loc>/gi);
      let isSitemapIndex = false;
      for (const m of sitemapIndexMatches) {
        isSitemapIndex = true;
        const childUrl = m[1].trim();
        await extractUrlsFromSitemap(childUrl, depth + 1);
      }

      if (!isSitemapIndex) {
        const locMatches = xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi);
        for (const m of locMatches) {
          const url = m[1].trim();
          try {
            const u = new URL(url);
            if (u.origin !== siteOrigin) continue;
            const normalized = normalizeUrl(url);
            if (scopePrefix && !normalized.startsWith(scopePrefix)) continue;
            if (NON_DOC_EXTENSIONS.test(normalized)) continue;
            if (!isNonDocUrl(normalized)) {
              discoveredUrls.add(normalized);
            }
          } catch {}
        }
      }
    } catch {}
  };

  // 1. Try /sitemap.xml directly
  print(`[sitemap] Trying ${siteOrigin}/sitemap.xml`);
  await extractUrlsFromSitemap(`${siteOrigin}/sitemap.xml`, 0);

  // 2. Check robots.txt for Sitemap: directives
  try {
    print(`[sitemap] Trying ${siteOrigin}/robots.txt`);
    const robotsResp = await fetcher.fetchText(`${siteOrigin}/robots.txt`);
    if (robotsResp.success && robotsResp.text) {
      const sitemapDirectives = robotsResp.text.matchAll(/^Sitemap:\s*(.+)$/gim);
      for (const m of sitemapDirectives) {
        const sitemapUrl = m[1].trim();
        if (sitemapUrl && !sitemapUrl.endsWith("/sitemap.xml")) {
          await extractUrlsFromSitemap(sitemapUrl, 0);
        }
      }
    }
  } catch {}

  print(`[sitemap] Discovered ${discoveredUrls.size} URLs from sitemaps`);
  return Array.from(discoveredUrls);
}

/**
 * Fallback: extract internal links from raw HTML using fetch + regex.
 */
export async function fetchLinksFromHtml(pageUrl, scopePrefix, fetcher, log) {
  const print = log ?? (() => {});
  try {
    print(`[fetch] Fetching: ${pageUrl}`);
    const resp = await fetcher.fetchTextWithRetry(pageUrl, 1000);
    print(`[fetch] Response: success=${resp.success}, textLength=${resp.text?.length || 0}, error=${resp.error || "none"}`);
    if (!resp.success || !resp.text) return [];

    const html = resp.text;
    const origin = new URL(pageUrl).origin;
    const links = new Set();

    const hrefRegex = /href=["']([^"'#]+?)["']/gi;
    let match;
    while ((match = hrefRegex.exec(html)) !== null) {
      let href = match[1];
      if (!href || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("#")) continue;

      try {
        let fullUrl;
        if (href.startsWith("http")) fullUrl = href;
        else fullUrl = new URL(href, pageUrl).href;

        const url = new URL(fullUrl);
        if (url.origin !== origin) continue;

        const normalized = normalizeUrl(fullUrl);
        if (scopePrefix && !normalized.startsWith(scopePrefix)) continue;
        if (NON_DOC_EXTENSIONS.test(normalized)) continue;
        links.add(normalized);
      } catch {}
    }

    return Array.from(links);
  } catch {
    return [];
  }
}
