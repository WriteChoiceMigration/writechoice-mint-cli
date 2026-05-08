/**
 * API Fetcher
 *
 * Fetches content from a JSON API endpoint (e.g. Zendesk Help Center API)
 * and extracts the HTML body, page URL, title, and extra frontmatter fields
 * using dot-notation paths defined in scrape.api config.
 */

/**
 * Resolves a dot-notation path against a nested object.
 * e.g. getByPath({ article: { title: "Hello" } }, "article.title") → "Hello"
 * @param {Object} obj
 * @param {string} path
 * @returns {*}
 */
function getByPath(obj, path) {
  return path.split(".").reduce((curr, key) => curr?.[key], obj);
}

/**
 * Fetches a JSON API URL and extracts content fields per apiConfig.
 *
 * @param {string} url - API endpoint URL
 * @param {Object} apiConfig
 * @param {string} apiConfig.content  - Dot-notation path to HTML body (e.g. "article.body")
 * @param {string} apiConfig.filepath - Dot-notation path to page URL used for file naming (e.g. "article.html_url")
 * @param {string} [apiConfig.title]  - Dot-notation path to title (e.g. "article.title")
 * @param {string[]} [apiConfig.fm]   - Dot-notation paths for extra frontmatter fields
 * @param {Object} [apiConfig.headers] - Extra request headers (e.g. auth tokens)
 * @returns {Promise<{ html: string, pageUrl: string, titleOverride: string|null, fmExtra: Object }>}
 */
export async function fetchApiPage(url, apiConfig) {
  const headers = {
    Accept: "application/json",
    "User-Agent": "Mozilla/5.0 (compatible; writechoice-mint-cli/1.0)",
    ...(apiConfig.headers || {}),
  };

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} — ${url}`);
  }

  const data = await response.json();

  const html = getByPath(data, apiConfig.content);
  if (!html || typeof html !== "string") {
    throw new Error(`API response: no content found at path "${apiConfig.content}"`);
  }

  const pageUrl = getByPath(data, apiConfig.filepath);
  if (!pageUrl || typeof pageUrl !== "string") {
    throw new Error(`API response: no filepath found at path "${apiConfig.filepath}"`);
  }

  const titleOverride = apiConfig.title ? (getByPath(data, apiConfig.title) ?? null) : null;

  const fmExtra = {};
  if (Array.isArray(apiConfig.fm)) {
    for (const path of apiConfig.fm) {
      const value = getByPath(data, path);
      if (value != null) {
        const key = path.split(".").pop();
        fmExtra[key] = String(value);
      }
    }
  }

  return { html, pageUrl, titleOverride: titleOverride ? String(titleOverride) : null, fmExtra };
}
