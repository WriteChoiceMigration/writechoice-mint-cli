/**
 * PageClassifier - Determines whether a page is documentation and prunes analysis data.
 *
 * Extracted from ScopingCrawler.tsx. Contains the isDocPage() decision logic
 * with platform-specific thresholds and the pruneAnalysis() memory optimizer.
 */

import type { ScopingPageAnalysis } from "../types.js";

/**
 * Determines if a page looks like a documentation page based on content signals.
 */
export function isDocPage(
  data: {
    contentSelectorFound?: boolean;
    wordCount: number;
    headings: { h1: number; h2: number; h3: number };
    codeBlocks: { count: number };
    tables?: { count: number };
    lists?: { ordered: number; unordered: number };
    apiPlaygrounds?: number;
    graphqlExplorers?: number;
    openApiSpecs?: string[];
    apiRefs?: string[];
    platform?: string;
  },
  contentSelector?: string,
): boolean {
  // If content selector was found, the page is definitely a doc page
  if (contentSelector && data.contentSelectorFound) {
    return true;
  }

  const totalHeadings =
    (data.headings.h1 || 0) +
    (data.headings.h2 || 0) +
    (data.headings.h3 || 0);

  // API pages (even without much prose)
  if ((data.apiPlaygrounds || 0) > 0) return true;
  if ((data.graphqlExplorers || 0) > 0) return true;
  if ((data.openApiSpecs || []).length > 0) return true;
  if ((data.apiRefs || []).length > 0) return true;

  // If content selector was specified but NOT found, and no API signals matched,
  // skip the page -- it likely doesn't have the expected content structure
  if (contentSelector && !data.contentSelectorFound) {
    return false;
  }

  // Platform-aware thresholds
  const platform = data.platform?.toLowerCase();
  if (platform === "zendesk") {
    if (totalHeadings >= 1 && data.wordCount > 50) return true;
    if (data.wordCount > 100) return true;
  } else if (platform === "readme" || platform === "google-devsite") {
    if (data.wordCount > 50) return true;
  } else if (
    platform === "wikijs" ||
    platform === "confluence" ||
    platform === "notion"
  ) {
    if (data.wordCount > 50) return true;
  }

  // Structured content with substance (default thresholds)
  if (totalHeadings >= 2 && data.wordCount > 100) return true;
  if (totalHeadings === 1 && data.wordCount > 200) return true;

  // Code-heavy pages
  if (data.codeBlocks.count >= 2) return true;
  if (data.codeBlocks.count >= 1 && data.wordCount > 50) return true;

  // Tables with text
  if ((data.tables?.count || 0) > 0 && data.wordCount > 50) return true;

  // Lists with text
  const totalLists =
    (data.lists?.ordered || 0) + (data.lists?.unordered || 0);
  if (totalLists >= 2 && data.wordCount > 100) return true;

  return false;
}

/**
 * Prune a page analysis result to limit memory usage.
 * Drops heavy fields that aren't needed for the final report aggregation,
 * and caps array sizes to prevent OOM on large sites (500+ pages).
 */
export function pruneAnalysis(
  a: ScopingPageAnalysis,
): ScopingPageAnalysis {
  return {
    ...a,
    // discoveredLinks is only used for link discovery during crawl, not in the report.
    // Clear it after the links have already been fed into the queue.
    discoveredLinks: [],
    // Cap external links (only top domains matter for the report)
    externalLinks: a.externalLinks.slice(0, 50),
    // Cap unique selectors (report only needs the most common ones)
    uniqueSelectors: a.uniqueSelectors?.slice(0, 100),
    // Cap content components
    contentComponents: a.contentComponents
      ?.slice(0, 50)
      ?.map((cc) => ({
        ...cc,
        sampleHtml: cc.sampleHtml?.substring(0, 150),
      })) as typeof a.contentComponents,
    // Cap API endpoints
    apiEndpoints: a.apiEndpoints?.slice(0, 50),
    // Cap API doc details
    apiDocDetails: a.apiDocDetails?.slice(0, 10),
    // Cap detected API specs
    detectedApiSpecs: a.detectedApiSpecs?.slice(0, 10),
    // Cap component samples (keep max 2 samples per type)
    componentSamples: a.componentSamples
      ? Object.fromEntries(
          Object.entries(a.componentSamples).map(([k, v]) => [
            k,
            v.slice(0, 2),
          ]),
        )
      : undefined,
    // Cap custom components
    customComponents: a.customComponents.slice(0, 30),
    // Cap videos
    videos: a.videos.slice(0, 20),
  };
}
