/**
 * URL utilities for the scrape command.
 * Handles URL→slug→filepath mapping and image path resolution.
 */

import { join, basename } from "path";

/**
 * Converts a URL to a file slug (relative path without extension).
 * @param {string} url - Absolute URL
 * @returns {string} Slug, e.g. "getting-started/overview"
 */
export function urlToSlug(url) {
  const parsed = new URL(url);
  const slug = parsed.pathname.replace(/^\//, "").replace(/\/$/, "");
  return slug || "index";
}

/**
 * Converts a URL to an output MDX file path.
 * @param {string} url - Absolute URL
 * @param {string} outputDir - Output directory (default: "output")
 * @returns {string} File path, e.g. "output/getting-started/overview.mdx"
 */
export function urlToFilePath(url, outputDir = "output") {
  const slug = urlToSlug(url);
  return join(outputDir, slug + ".mdx");
}

/**
 * Resolves a possibly-relative URL to an absolute URL.
 * @param {string} url - URL to resolve
 * @param {string} base - Base URL
 * @returns {string} Absolute URL
 */
export function makeAbsolute(url, base) {
  if (!url) return url;
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

/**
 * Determines the local save path and MDX src for an image.
 * @param {string} imgUrl - Absolute image URL
 * @param {string} pageUrl - URL of the page containing the image
 * @param {"keep_remote"|"download_by_url"|"download_by_page"} strategy
 * @param {string} folder - Images folder name (default: "images")
 * @returns {{ savePath: string|null, mdxSrc: string|null }}
 */
export function getImagePath(imgUrl, pageUrl, strategy, folder = "images") {
  if (strategy === "keep_remote") {
    return { savePath: null, mdxSrc: imgUrl };
  }

  const imgParsed = new URL(imgUrl);

  if (strategy === "download_by_url") {
    // Use the image URL's path structure
    const imgPath = imgParsed.pathname.replace(/^\//, "");
    const savePath = join(folder, imgPath);
    const mdxSrc = "/" + folder + "/" + imgPath;
    return { savePath, mdxSrc };
  }

  if (strategy === "download_by_page") {
    // Use the page's slug structure + image filename
    const pageSlug = urlToSlug(pageUrl);
    const imgName = basename(imgParsed.pathname);
    const savePath = join(folder, pageSlug, imgName);
    const mdxSrc = "/" + folder + "/" + pageSlug + "/" + imgName;
    return { savePath, mdxSrc };
  }

  return { savePath: null, mdxSrc: imgUrl };
}
