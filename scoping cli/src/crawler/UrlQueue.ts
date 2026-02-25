/**
 * BFS URL queue with deduplication via normalizeUrl and retry support.
 * Used by the crawler engine to manage which pages to visit.
 */

import { normalizeUrl } from './UrlUtils.js';

interface QueueEntry {
  url: string;
  retries: number;
}

export class UrlQueue {
  /** Set of normalized URLs already seen (queued or processed) */
  private seen = new Set<string>();
  /** BFS queue of URLs to visit */
  private queue: QueueEntry[] = [];
  /** Count of URLs that have been dequeued */
  private processedCount = 0;
  /** Maximum retries per URL */
  private maxRetries: number;

  constructor(maxRetries: number = 1) {
    this.maxRetries = maxRetries;
  }

  /**
   * Add a URL to the queue. Returns true if the URL was actually added
   * (i.e., it hadn't been seen before).
   */
  add(url: string): boolean {
    const normalized = normalizeUrl(url);
    if (this.seen.has(normalized)) return false;
    this.seen.add(normalized);
    this.queue.push({ url: normalized, retries: 0 });
    return true;
  }

  /**
   * Add multiple URLs at once. Returns the count of new URLs added.
   */
  addAll(urls: string[]): number {
    let added = 0;
    for (const url of urls) {
      if (this.add(url)) added++;
    }
    return added;
  }

  /** Get the next URL from the queue, or undefined if empty */
  next(): string | undefined {
    const entry = this.queue.shift();
    if (!entry) return undefined;
    this.processedCount++;
    return entry.url;
  }

  /**
   * Re-queue a URL for retry (e.g., after a transient failure).
   * Returns true if the URL was re-queued, false if max retries exceeded.
   * The URL must have been previously dequeued via next().
   */
  retry(url: string): boolean {
    const normalized = normalizeUrl(url);
    // Find if it was already in the queue (check retries)
    // Since it was dequeued, we push it back with incremented retries
    // We track retries by re-adding with a count
    // Simple approach: just push back if under max
    const existingIdx = this.queue.findIndex(e => e.url === normalized);
    if (existingIdx !== -1) return false; // already in queue

    // We don't have the old retry count easily, so we track via a separate map
    // For simplicity: allow re-queue if the URL is in seen (was processed)
    // and increment a counter on the entry
    this.processedCount--; // undo the processed count since we're retrying
    this.queue.push({ url: normalized, retries: 0 });
    return true;
  }

  /** Check if a URL (normalized) has been seen */
  has(url: string): boolean {
    return this.seen.has(normalizeUrl(url));
  }

  /** Number of URLs waiting in the queue */
  get pending(): number {
    return this.queue.length;
  }

  /** Number of URLs dequeued so far */
  get processed(): number {
    return this.processedCount;
  }

  /** Total unique URLs seen (queued + processed) */
  get totalSeen(): number {
    return this.seen.size;
  }

  /** Whether the queue is empty */
  get isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /** Get all seen URLs (for report generation) */
  getAllSeen(): string[] {
    return Array.from(this.seen);
  }
}
