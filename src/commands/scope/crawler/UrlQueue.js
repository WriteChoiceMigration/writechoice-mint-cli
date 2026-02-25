/**
 * BFS URL queue with deduplication via normalizeUrl and retry support.
 */

import { normalizeUrl } from "./UrlUtils.js";

export class UrlQueue {
  /** @type {Set<string>} */
  #seen = new Set();
  /** @type {Array<{url: string, retries: number}>} */
  #queue = [];
  #processedCount = 0;
  #maxRetries;

  constructor(maxRetries = 1) {
    this.#maxRetries = maxRetries;
  }

  /** Add a URL to the queue. Returns true if newly added. */
  add(url) {
    const normalized = normalizeUrl(url);
    if (this.#seen.has(normalized)) return false;
    this.#seen.add(normalized);
    this.#queue.push({ url: normalized, retries: 0 });
    return true;
  }

  /** Add multiple URLs at once. Returns the count of new URLs added. */
  addAll(urls) {
    let added = 0;
    for (const url of urls) {
      if (this.add(url)) added++;
    }
    return added;
  }

  /** Get the next URL from the queue, or undefined if empty */
  next() {
    const entry = this.#queue.shift();
    if (!entry) return undefined;
    this.#processedCount++;
    return entry.url;
  }

  /** Re-queue a URL for retry. Returns true if re-queued. */
  retry(url) {
    const normalized = normalizeUrl(url);
    const existingIdx = this.#queue.findIndex((e) => e.url === normalized);
    if (existingIdx !== -1) return false;
    this.#processedCount--;
    this.#queue.push({ url: normalized, retries: 0 });
    return true;
  }

  /** Check if a URL (normalized) has been seen */
  has(url) {
    return this.#seen.has(normalizeUrl(url));
  }

  get pending() {
    return this.#queue.length;
  }

  get processed() {
    return this.#processedCount;
  }

  get totalSeen() {
    return this.#seen.size;
  }

  get isEmpty() {
    return this.#queue.length === 0;
  }

  getAllSeen() {
    return Array.from(this.#seen);
  }
}
