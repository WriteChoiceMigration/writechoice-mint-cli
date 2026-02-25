/**
 * HTTP fetcher using native Node.js fetch() with retry, timeout, and optional Basic Auth.
 * Replaces the Electron electronAPI.net.fetchText calls from ScopingCrawler.tsx.
 */

export interface FetchResult {
  success: boolean;
  text?: string;
  error?: string;
}

export interface HttpFetcherOptions {
  /** Timeout per request in milliseconds. Default: 15000 */
  timeoutMs?: number;
  /** Basic Auth username */
  username?: string;
  /** Basic Auth password */
  password?: string;
  /** Custom User-Agent header */
  userAgent?: string;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_USER_AGENT = 'doc-scraper-cli/1.0';

export class HttpFetcher {
  private timeoutMs: number;
  private authHeader: string | undefined;
  private userAgent: string;

  constructor(options: HttpFetcherOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;

    if (options.username && options.password) {
      const credentials = Buffer.from(`${options.username}:${options.password}`).toString('base64');
      this.authHeader = `Basic ${credentials}`;
    }
  }

  /** Fetch the text content of a URL */
  async fetchText(url: string): Promise<FetchResult> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const headers: Record<string, string> = {
        'User-Agent': this.userAgent,
      };
      if (this.authHeader) {
        headers['Authorization'] = this.authHeader;
      }

      const resp = await fetch(url, {
        signal: controller.signal,
        headers,
        redirect: 'follow',
      });
      clearTimeout(timer);

      if (!resp.ok) {
        return { success: false, error: `HTTP ${resp.status} ${resp.statusText}` };
      }

      const text = await resp.text();
      return { success: true, text };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  /**
   * Fetch with a single retry after a delay.
   * Mirrors fetchTextWithRetry from ScopingCrawler.tsx.
   */
  async fetchTextWithRetry(url: string, retryDelayMs: number = 1000): Promise<FetchResult> {
    const resp = await this.fetchText(url);
    if (resp.success) return resp;

    // Retry once after delay
    await new Promise(r => setTimeout(r, retryDelayMs));
    return this.fetchText(url);
  }
}
