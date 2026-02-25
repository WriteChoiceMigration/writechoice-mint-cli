/**
 * HTTP fetcher using native Node.js fetch() with retry, timeout, and optional Basic Auth.
 */

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_USER_AGENT = "writechoice-scope/1.0";

export class HttpFetcher {
  #timeoutMs;
  #authHeader;
  #userAgent;

  constructor(options = {}) {
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#userAgent = options.userAgent ?? DEFAULT_USER_AGENT;

    if (options.username && options.password) {
      const credentials = Buffer.from(`${options.username}:${options.password}`).toString("base64");
      this.#authHeader = `Basic ${credentials}`;
    }
  }

  /** Fetch the text content of a URL */
  async fetchText(url) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.#timeoutMs);

      const headers = {
        "User-Agent": this.#userAgent,
      };
      if (this.#authHeader) {
        headers["Authorization"] = this.#authHeader;
      }

      const resp = await fetch(url, {
        signal: controller.signal,
        headers,
        redirect: "follow",
      });
      clearTimeout(timer);

      if (!resp.ok) {
        return { success: false, error: `HTTP ${resp.status} ${resp.statusText}` };
      }

      const text = await resp.text();
      return { success: true, text };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  /** Fetch with a single retry after a delay. */
  async fetchTextWithRetry(url, retryDelayMs = 1000) {
    const resp = await this.fetchText(url);
    if (resp.success) return resp;

    await new Promise((r) => setTimeout(r, retryDelayMs));
    return this.fetchText(url);
  }
}
