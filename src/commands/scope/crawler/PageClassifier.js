/**
 * PageClassifier - Determines whether a page is documentation and prunes analysis data.
 */

/**
 * Determines if a page looks like a documentation page based on content signals.
 */
export function isDocPage(data, contentSelector) {
  if (contentSelector && data.contentSelectorFound) {
    return true;
  }

  const totalHeadings = (data.headings.h1 || 0) + (data.headings.h2 || 0) + (data.headings.h3 || 0);

  // API pages (even without much prose)
  if ((data.apiPlaygrounds || 0) > 0) return true;
  if ((data.graphqlExplorers || 0) > 0) return true;
  if ((data.openApiSpecs || []).length > 0) return true;
  if ((data.apiRefs || []).length > 0) return true;

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
  } else if (platform === "wikijs" || platform === "confluence" || platform === "notion") {
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
  const totalLists = (data.lists?.ordered || 0) + (data.lists?.unordered || 0);
  if (totalLists >= 2 && data.wordCount > 100) return true;

  return false;
}

/**
 * Prune a page analysis result to limit memory usage.
 */
export function pruneAnalysis(a) {
  return {
    ...a,
    discoveredLinks: [],
    externalLinks: a.externalLinks.slice(0, 50),
    uniqueSelectors: a.uniqueSelectors?.slice(0, 100),
    contentComponents: a.contentComponents
      ?.slice(0, 50)
      ?.map((cc) => ({
        ...cc,
        sampleHtml: cc.sampleHtml?.substring(0, 150),
      })),
    apiEndpoints: a.apiEndpoints?.slice(0, 50),
    apiDocDetails: a.apiDocDetails?.slice(0, 10),
    detectedApiSpecs: a.detectedApiSpecs?.slice(0, 10),
    componentSamples: a.componentSamples
      ? Object.fromEntries(Object.entries(a.componentSamples).map(([k, v]) => [k, v.slice(0, 2)]))
      : undefined,
    customComponents: a.customComponents.slice(0, 30),
    videos: a.videos.slice(0, 20),
  };
}
