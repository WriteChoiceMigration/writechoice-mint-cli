/**
 * Image Processor
 *
 * Handles image src transformation and optional download based on strategy:
 *   - keep_remote: Leave image URLs unchanged
 *   - download_by_url: Download image, save using image URL's path structure
 *   - download_by_page: Download image, save under page URL's slug directory
 *
 * Regular images are wrapped in <Frame> components.
 * Images inside tables are NOT wrapped in Frame.
 */

import { mkdirSync, writeFileSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { getImagePath, makeAbsolute } from "./url-utils.js";

export class ImageProcessor {
  /**
   * @param {string} pageUrl - URL of the page being scraped
   * @param {Object} imageConfig - scrape.images config (strategy, folder)
   * @param {string} outputDir - Base output directory
   * @param {boolean} dryRun
   */
  constructor(pageUrl, imageConfig = {}, outputDir = "output", dryRun = false) {
    this.pageUrl = pageUrl;
    this.strategy = imageConfig.strategy || "keep_remote";
    this.folder = imageConfig.folder || "images";
    this.outputDir = outputDir;
    this.dryRun = dryRun;
    this.failures = [];
  }

  /**
   * Processes all <img> elements in the document (not inside preserved HTML).
   * Replaces each img with a placeholder stored in pm.
   * @param {Object} $ - Cheerio instance
   * @param {import('./placeholder-manager.js').PlaceholderManager} pm
   */
  processImages($, pm) {
    $("img").each((_, el) => {
      const $el = $(el);
      const src = $el.attr("src") || "";
      const alt = $el.attr("alt") || "";

      if (!src) {
        $el.remove();
        return;
      }

      const absoluteSrc = makeAbsolute(src, this.pageUrl);
      const { savePath, mdxSrc } = getImagePath(
        absoluteSrc,
        this.pageUrl,
        this.strategy,
        this.folder
      );

      if (savePath && !this.dryRun) {
        this._downloadImage(absoluteSrc, savePath);
      }

      const finalSrc = mdxSrc || absoluteSrc;
      const imgTag = `<img src="${finalSrc}"${alt ? ` alt="${alt}"` : ""} />`;
      const frameHtml = `<Frame>${imgTag}</Frame>`;
      const placeholder = pm.store(frameHtml, "IMAGE");
      $el.replaceWith(placeholder);
    });
  }

  /**
   * Processes images inside table elements (no Frame wrapping).
   * @param {Object} $ - Cheerio instance
   * @param {Object} $table - Cheerio table element
   */
  processTableImages($, $table) {
    $table.find("img").each((_, el) => {
      const $el = $(el);
      const src = $el.attr("src") || "";
      const alt = $el.attr("alt") || "";

      if (!src) return;

      const absoluteSrc = makeAbsolute(src, this.pageUrl);
      const { savePath, mdxSrc } = getImagePath(
        absoluteSrc,
        this.pageUrl,
        this.strategy,
        this.folder
      );

      if (savePath && !this.dryRun) {
        this._downloadImage(absoluteSrc, savePath);
      }

      const finalSrc = mdxSrc || absoluteSrc;
      $el.attr("src", finalSrc);
    });
  }

  /**
   * Downloads an image from URL and saves to savePath (relative to cwd).
   * Records failures in this.failures.
   * @param {string} url
   * @param {string} savePath
   */
  async _downloadImage(url, savePath) {
    const fullPath = resolve(savePath);
    if (existsSync(fullPath)) return;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        this.failures.push({ url, savePath, error: `HTTP ${response.status}` });
        return;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, buffer);
    } catch (err) {
      this.failures.push({ url, savePath, error: err.message });
    }
  }
}
