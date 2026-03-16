/**
 * HTML Scraper
 *
 * Fetches HTML from a URL using either:
 *   - Native fetch (default) — fast, for static/server-rendered pages
 *   - Playwright (--playwright flag) — for JavaScript-rendered pages
 */

import { readFileSync } from "fs";

/**
 * Reads a Playwright storageState file and returns a Cookie header string
 * with all cookies that apply to the given URL.
 * @param {string} storageStatePath
 * @param {string} url
 * @returns {string} Cookie header value, e.g. "name=value; name2=value2"
 */
function loadCookieHeader(storageStatePath, url) {
  let session;
  try {
    session = JSON.parse(readFileSync(storageStatePath, "utf-8"));
  } catch {
    throw new Error(`Could not read session file: ${storageStatePath}`);
  }

  const { hostname } = new URL(url);
  const cookies = (session.cookies || []).filter((c) => {
    const domain = c.domain.replace(/^\./, "");
    return hostname === domain || hostname.endsWith(`.${domain}`);
  });

  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

/**
 * Fetches HTML from a URL using native fetch.
 * @param {string} url
 * @param {string|null} cookieHeader - optional Cookie header value from a saved session
 * @returns {Promise<string>} HTML string
 */
export async function fetchHtml(url, cookieHeader = null) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (compatible; writechoice-mint-cli/1.0)",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };
  if (cookieHeader) headers["Cookie"] = cookieHeader;

  const response = await fetch(url, { headers });

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
  const storageState = playwrightConfig.storage_state || null;

  const browser = await chromium.launch({ headless });
  try {
    const contextOptions = storageState ? { storageState } : {};
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
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
  const storageState = playwrightConfig.storage_state || null;
  const cookieHeader = storageState ? loadCookieHeader(storageState, url) : null;
  return fetchHtml(url, cookieHeader);
}
