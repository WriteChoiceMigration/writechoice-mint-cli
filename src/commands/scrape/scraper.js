/**
 * HTML Scraper
 *
 * Fetches HTML from a URL using either:
 *   - Native fetch (default) — fast, for static/server-rendered pages
 *   - Playwright (--playwright flag) — for JavaScript-rendered pages
 */

/**
 * Fetches HTML from a URL using native fetch.
 * @param {string} url
 * @returns {Promise<string>} HTML string
 */
export async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; writechoice-mint-cli/1.0)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} — ${url}`);
  }

  return response.text();
}

/**
 * Fetches HTML from a URL using Playwright (for JS-rendered pages).
 * @param {string} url
 * @param {Object} playwrightConfig - playwright settings from config
 * @returns {Promise<string>} HTML string
 */
export async function fetchHtmlPlaywright(url, playwrightConfig = {}) {
  const { chromium } = await import("playwright");

  const headless = playwrightConfig.headless !== false;
  const waitForSelector = playwrightConfig.wait_for_selector || null;
  const waitTime = playwrightConfig.wait_time || 3;
  const timeout = (playwrightConfig.page_load_timeout || 30) * 1000;

  const browser = await chromium.launch({ headless });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(timeout);

    await page.goto(url, { waitUntil: "domcontentloaded" });

    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout }).catch(() => {
        // Selector not found within timeout — continue anyway
      });
    } else {
      // Wait a fixed time for JS to settle
      await page.waitForTimeout(waitTime * 1000);
    }

    const html = await page.content();
    return html;
  } finally {
    await browser.close();
  }
}

/**
 * Fetches HTML from a URL, using Playwright if requested.
 * @param {string} url
 * @param {boolean} usePlaywright
 * @param {Object} playwrightConfig
 * @returns {Promise<string>} HTML string
 */
export async function fetchPage(url, usePlaywright = false, playwrightConfig = {}) {
  if (usePlaywright) {
    return fetchHtmlPlaywright(url, playwrightConfig);
  }
  return fetchHtml(url);
}
