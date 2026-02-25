function extractProjectName(urls) {
  if (!urls || urls.length === 0) return "project";
  try {
    const u = new URL(urls[0]);
    const parts = u.hostname.split(".");
    return parts.length > 2 ? parts.slice(0, -1).join(".") : parts[0];
  } catch {
    return "project";
  }
}

/**
 * Aggregates analysis results from all sites into a structured report.
 */
export function generateReport(sites, decisions) {
  const report = {
    sites: [],
    totalPages: 0,
    pointsOfAttention: [],
    apiStatus: { detected: false, details: [] },
    customComponentsSummary: [],
    videosSummary: [],
    externalLinkDomains: [],
    contentSummary: {
      totalWords: 0,
      totalCodeBlocks: 0,
      codeLanguages: [],
      totalTables: 0,
      totalImages: 0,
      totalHeadings: { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
      totalLists: { ordered: 0, unordered: 0 },
    },
    interactiveSummary: {
      totalTabs: 0,
      totalAccordions: 0,
      totalDownloads: 0,
      downloadExtensions: [],
      totalForms: 0,
      totalIframes: 0,
      totalTooltips: 0,
    },
    apiSummary: {
      openApiSpecs: [],
      playgroundCount: 0,
      graphqlCount: 0,
    },
    structureSummary: {
      avgBreadcrumbDepth: 0,
      hasMultiLanguage: false,
      hasPagination: false,
    },
    platformComponentsSummary: {
      callouts: { total: 0, variants: { note: 0, warning: 0, tip: 0, info: 0, danger: 0, check: 0 } },
      tabs: { total: 0 },
      codeGroups: { total: 0 },
      accordions: { total: 0 },
      cards: { total: 0 },
      steps: { total: 0 },
      definitions: { total: 0 },
      embeds: { total: 0 },
      badges: { total: 0 },
      tooltips: { total: 0 },
      math: { total: 0 },
      mermaid: { total: 0 },
      apiFields: { total: 0 },
      columns: { total: 0 },
    },
    specialContentSummary: {
      thirdPartyEmbeds: [],
      totalMathContent: 0,
      totalDiagramContent: 0,
      totalCodePlaygrounds: 0,
      apiReferencePages: 0,
    },
    crawlStats: {
      totalDiscovered: 0,
      totalAnalyzed: 0,
      totalSkippedUrl: 0,
      totalSkippedNonDoc: 0,
      totalHttpFallback: 0,
      totalWebview: 0,
    },
  };

  // Video counts by type
  const videoCounts = {};
  // External link domain counts
  const domainCounts = {};
  // API details deduped
  const apiDetailsSet = new Set();
  // Custom component aggregation
  const componentCounts = {};
  // Help center references
  let helpCenterCount = 0;
  // Special content accumulators
  const embedCounts = {};
  let apiReferencePageCount = 0;
  // New aggregation accumulators
  const codeLangCounts = {};
  const dlExtCounts = {};
  const openApiSpecsSet = new Set();
  let breadcrumbSum = 0;
  let breadcrumbPages = 0;
  // Pages with components tracking
  const pagesWithComponentsList = [];
  // Content components aggregation
  const contentComponentCounts = {};
  // Unique selectors: selector -> { tag, sampleText, firstPageUrl, pageCount }
  const uniqueSelectorsMap = {};

  // Enhanced API aggregation accumulators
  const apiToolCounts = {};
  const allDetectedSpecs = [];
  const detectedSpecUrls = new Set();
  let totalApiEndpoints = 0;
  const authMethodsSet = new Set();
  const apiTypesSet = new Set();
  const pagesWithPlayground = [];
  const pagesWithTryIt = [];
  // Interactive widgets aggregation
  const widgetTypeCounts = {};

  for (const site of sites) {
    // Per-site summary
    const categorySummary = {};
    for (const cat of site.categories) {
      categorySummary[cat.name] = cat.urls.length;
    }

    report.sites.push({
      url: site.url,
      label: site.label,
      totalPages: site.analysisResults.length,
      categories: Object.entries(categorySummary).map(([name, count]) => ({ name, count })),
      homepage: site.url,
    });

    report.totalPages += site.analysisResults.length;

    // Aggregate analysis results
    for (const page of site.analysisResults) {
      // Videos
      for (const vid of page.videos) {
        videoCounts[vid.type] = (videoCounts[vid.type] || 0) + 1;
      }

      // External links
      for (const link of page.externalLinks) {
        try {
          const domain = new URL(link.url).hostname;
          domainCounts[domain] = (domainCounts[domain] || 0) + 1;
          if (/help|support|zendesk|freshdesk|intercom/i.test(domain)) {
            helpCenterCount++;
          }
        } catch {}
      }

      // API refs
      for (const ref of page.apiRefs) {
        apiDetailsSet.add(ref);
      }

      // Custom components
      for (const comp of page.customComponents) {
        componentCounts[comp.tag] = (componentCounts[comp.tag] || 0) + comp.count;
      }

      // Content metrics
      report.contentSummary.totalWords += page.wordCount || 0;
      report.contentSummary.totalCodeBlocks += page.codeBlocks?.count || 0;
      report.contentSummary.totalTables += page.tables?.count || 0;
      report.contentSummary.totalImages += page.images?.count || 0;
      for (const lang of (page.codeBlocks?.languages || [])) {
        codeLangCounts[lang] = (codeLangCounts[lang] || 0) + 1;
      }
      // Headings aggregation
      if (page.headings) {
        for (let level = 1; level <= 6; level++) {
          const key = `h${level}`;
          report.contentSummary.totalHeadings[key] += page.headings[key] || 0;
        }
      }
      // Lists aggregation
      if (page.lists) {
        report.contentSummary.totalLists.ordered += page.lists.ordered || 0;
        report.contentSummary.totalLists.unordered += page.lists.unordered || 0;
      }

      // Interactive elements
      report.interactiveSummary.totalTabs += page.tabs || 0;
      report.interactiveSummary.totalAccordions += page.accordions || 0;
      report.interactiveSummary.totalDownloads += page.downloadLinks?.count || 0;
      report.interactiveSummary.totalForms += page.forms || 0;
      report.interactiveSummary.totalIframes += page.iframes || 0;
      report.interactiveSummary.totalTooltips += page.tooltips || 0;

      // Analysis method tracking
      if (page.analysisMethod === 'http-fallback') {
        report.crawlStats.totalHttpFallback++;
      } else {
        report.crawlStats.totalWebview++;
      }
      for (const ext of (page.downloadLinks?.extensions || [])) {
        dlExtCounts[ext] = (dlExtCounts[ext] || 0) + 1;
      }

      // API / Playground
      for (const spec of (page.openApiSpecs || [])) {
        openApiSpecsSet.add(spec);
      }
      report.apiSummary.playgroundCount += page.apiPlaygrounds || 0;
      report.apiSummary.graphqlCount += page.graphqlExplorers || 0;

      // Structure
      if ((page.breadcrumbDepth || 0) > 0) {
        breadcrumbSum += page.breadcrumbDepth;
        breadcrumbPages++;
      }
      if (page.hasLanguageSwitcher) report.structureSummary.hasMultiLanguage = true;
      if (page.hasPagination) report.structureSummary.hasPagination = true;

      // Special content
      if (page.specialContent) {
        for (const embed of page.specialContent.thirdPartyEmbeds) {
          embedCounts[embed.provider] = (embedCounts[embed.provider] || 0) + embed.count;
        }
        report.specialContentSummary.totalMathContent += page.specialContent.mathContent || 0;
        report.specialContentSummary.totalDiagramContent += page.specialContent.diagramContent || 0;
        report.specialContentSummary.totalCodePlaygrounds += page.specialContent.codePlaygrounds || 0;
      }
      if (page.isApiReferencePage) apiReferencePageCount++;

      // Platform components (new fingerprint-based structure with variants)
      if (page.platformComponents) {
        const pc = page.platformComponents;
        const pcs = report.platformComponentsSummary;
        // Callouts with variant breakdown
        if (pc.callouts) {
          pcs.callouts.total += pc.callouts.total || 0;
          if (pc.callouts.variants) {
            for (const v of ['note', 'warning', 'tip', 'info', 'danger', 'check']) {
              pcs.callouts.variants[v] += pc.callouts.variants[v] || 0;
            }
          }
        }
        pcs.tabs.total += pc.tabs?.total || 0;
        pcs.codeGroups.total += pc.codeGroups?.total || 0;
        pcs.accordions.total += pc.accordions?.total || 0;
        pcs.cards.total += pc.cards?.total || 0;
        pcs.steps.total += pc.steps?.total || 0;
        pcs.definitions.total += pc.definitions?.total || 0;
        pcs.embeds.total += pc.embeds?.total || 0;
        pcs.badges.total += pc.badges?.total || 0;
        pcs.tooltips.total += pc.tooltips?.total || 0;
        pcs.math.total += pc.math?.total || 0;
        pcs.mermaid.total += pc.mermaid?.total || 0;
        pcs.apiFields.total += pc.apiFields?.total || 0;
        pcs.columns.total += pc.columns?.total || 0;
      }

      // Content components aggregation
      if (page.contentComponents) {
        for (const cc of page.contentComponents) {
          if (!contentComponentCounts[cc.type]) {
            contentComponentCounts[cc.type] = { count: 0, confidence: cc.confidence, pages: 0 };
          }
          contentComponentCounts[cc.type].count += cc.count;
          contentComponentCounts[cc.type].pages++;
        }
      }

      // Track pages with ANY non-standard component (platform or custom or content)
      const pageCompList = [];

      // Platform components for this page
      if (page.platformComponents) {
        const pc = page.platformComponents;
        if (pc.callouts?.total) pageCompList.push({ type: 'callout', count: pc.callouts.total, confidence: 'high' });
        if (pc.tabs?.total) pageCompList.push({ type: 'tabs', count: pc.tabs.total, confidence: 'high' });
        if (pc.codeGroups?.total) pageCompList.push({ type: 'code-group', count: pc.codeGroups.total, confidence: 'high' });
        if (pc.accordions?.total) pageCompList.push({ type: 'accordion', count: pc.accordions.total, confidence: 'high' });
        if (pc.cards?.total) pageCompList.push({ type: 'card', count: pc.cards.total, confidence: 'high' });
        if (pc.steps?.total) pageCompList.push({ type: 'steps', count: pc.steps.total, confidence: 'high' });
        if (pc.definitions?.total) pageCompList.push({ type: 'definition', count: pc.definitions.total, confidence: 'high' });
        if (pc.embeds?.total) pageCompList.push({ type: 'embed', count: pc.embeds.total, confidence: 'high' });
        if (pc.badges?.total) pageCompList.push({ type: 'badge', count: pc.badges.total, confidence: 'high' });
        if (pc.tooltips?.total) pageCompList.push({ type: 'tooltip', count: pc.tooltips.total, confidence: 'high' });
        if (pc.math?.total) pageCompList.push({ type: 'math', count: pc.math.total, confidence: 'high' });
        if (pc.mermaid?.total) pageCompList.push({ type: 'mermaid', count: pc.mermaid.total, confidence: 'high' });
        if (pc.apiFields?.total) pageCompList.push({ type: 'api-field', count: pc.apiFields.total, confidence: 'high' });
        if (pc.columns?.total) pageCompList.push({ type: 'columns', count: pc.columns.total, confidence: 'high' });
      }

      // Custom web components for this page
      for (const comp of page.customComponents) {
        pageCompList.push({ type: `web-component:${comp.tag}`, count: comp.count, confidence: 'high' });
      }

      // Content components for this page
      if (page.contentComponents) {
        for (const cc of page.contentComponents) {
          pageCompList.push({ type: cc.type, count: cc.count, confidence: cc.confidence });
        }
      }

      if (pageCompList.length > 0) {
        pagesWithComponentsList.push({ url: page.url, components: pageCompList });
      }

      // Unique selectors aggregation: first occurrence per selector
      if (page.uniqueSelectors) {
        for (const us of page.uniqueSelectors) {
          if (uniqueSelectorsMap[us.selector]) {
            uniqueSelectorsMap[us.selector].pageCount++;
          } else {
            uniqueSelectorsMap[us.selector] = {
              tag: us.tag,
              sampleText: us.sampleText,
              firstPageUrl: page.url,
              pageCount: 1,
            };
          }
        }
      }

      // Enhanced API aggregation
      if (page.apiDocDetails) {
        for (const detail of page.apiDocDetails) {
          if (!apiToolCounts[detail.toolType]) {
            apiToolCounts[detail.toolType] = { pageCount: 0, confidence: detail.confidence };
          }
          apiToolCounts[detail.toolType].pageCount++;
          if (detail.endpointCount) totalApiEndpoints += detail.endpointCount;
          if (detail.authMethods) {
            for (const method of detail.authMethods) authMethodsSet.add(method);
          }
          if (detail.hasPlayground && !pagesWithPlayground.includes(page.url)) {
            pagesWithPlayground.push(page.url);
          }
          if (detail.hasTryIt && !pagesWithTryIt.includes(page.url)) {
            pagesWithTryIt.push(page.url);
          }
        }
      }
      if (page.detectedApiSpecs) {
        for (const spec of page.detectedApiSpecs) {
          if (!detectedSpecUrls.has(spec.url)) {
            detectedSpecUrls.add(spec.url);
            allDetectedSpecs.push(spec);
          }
        }
      }
      if (page.apiEndpoints) {
        totalApiEndpoints += page.apiEndpoints.length;
      }
      if (page.apiType) {
        if (page.apiType === 'mixed') {
          apiTypesSet.add('rest');
          apiTypesSet.add('graphql');
        } else {
          apiTypesSet.add(page.apiType);
        }
      }

      // Interactive widgets aggregation
      if (page.interactiveWidgets) {
        for (const widget of page.interactiveWidgets) {
          if (!widgetTypeCounts[widget.type]) {
            widgetTypeCounts[widget.type] = { count: 0, hasUserInput: false };
          }
          widgetTypeCounts[widget.type].count += widget.count;
          if (widget.hasUserInput) widgetTypeCounts[widget.type].hasUserInput = true;
        }
      }
    }
  }

  // Component samples aggregation
  const samplesAgg = {};

  for (const site of sites) {
    for (const page of site.analysisResults) {
      if (!page.componentSamples) continue;
      for (const [type, samples] of Object.entries(page.componentSamples)) {
        if (!samplesAgg[type]) {
          samplesAgg[type] = {
            cssHints: new Set(),
            totalCount: 0,
            highConfidenceCount: 0,
            lowConfidenceCount: 0,
            pageUrls: [],
            pageCssHints: {},
          };
        }
        const agg = samplesAgg[type];
        agg.totalCount += samples.length;
        for (const s of samples) {
          if (s.cssHint) agg.cssHints.add(s.cssHint);
          if (s.confidence === 'high') agg.highConfidenceCount++;
          else agg.lowConfidenceCount++;
        }
        if (agg.pageUrls.length < 10 && !agg.pageUrls.includes(page.url)) {
          agg.pageUrls.push(page.url);
        }
        // Pick the best CSS hint for this page (first sample with a non-tag hint)
        if (!agg.pageCssHints[page.url]) {
          const bestHint = samples.find(s => s.cssHint && (s.cssHint.startsWith('.') || s.cssHint.startsWith('#')));
          agg.pageCssHints[page.url] = bestHint?.cssHint || samples[0]?.cssHint || '';
        }
      }
    }
  }

  // Convert Sets to arrays for the report
  if (Object.keys(samplesAgg).length > 0) {
    report.componentSamplesAggregated = {};
    for (const [type, agg] of Object.entries(samplesAgg)) {
      report.componentSamplesAggregated[type] = {
        cssHints: Array.from(agg.cssHints),
        totalCount: agg.totalCount,
        highConfidenceCount: agg.highConfidenceCount,
        lowConfidenceCount: agg.lowConfidenceCount,
        pageUrls: agg.pageUrls,
        pageCssHints: agg.pageCssHints,
      };
    }
  }

  // Crawl stats aggregation
  for (const site of sites) {
    report.crawlStats.totalDiscovered += site.discoveredUrls.length;
    report.crawlStats.totalAnalyzed += site.analysisResults.length;
    report.crawlStats.totalSkippedUrl += site.skippedUrlCount || 0;
    report.crawlStats.totalSkippedNonDoc += site.skippedNonDocCount || 0;
  }

  // Content selector stats
  const hasAnyContentSelector = sites.some(s => !!s.contentSelector);
  if (hasAnyContentSelector) {
    let totalPages = 0;
    let matchedPages = 0;
    for (const site of sites) {
      for (const page of site.analysisResults) {
        totalPages++;
        if (page.contentSelectorFound) matchedPages++;
      }
    }
    report.contentSelectorStats = {
      configured: true,
      totalPages,
      matchedPages,
      matchRate: totalPages > 0 ? matchedPages / totalPages : 0,
    };
  }

  // Pages with components (capped at 200 entries for report size)
  if (pagesWithComponentsList.length > 0) {
    report.pagesWithComponents = pagesWithComponentsList.slice(0, 200);
  }

  // Unique selectors summary - sorted by page count (most common first)
  const uniqueSelectorsEntries = Object.entries(uniqueSelectorsMap);
  if (uniqueSelectorsEntries.length > 0) {
    report.uniqueSelectorsSummary = uniqueSelectorsEntries
      .map(([selector, data]) => ({
        selector,
        tag: data.tag,
        sampleText: data.sampleText,
        firstPageUrl: data.firstPageUrl,
        pageCount: data.pageCount,
      }))
      .sort((a, b) => b.pageCount - a.pageCount);
  }

  // Finalize aggregations
  report.contentSummary.codeLanguages = Object.entries(codeLangCounts)
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count);

  report.interactiveSummary.downloadExtensions = Object.entries(dlExtCounts)
    .map(([ext, count]) => ({ ext, count }))
    .sort((a, b) => b.count - a.count);

  report.apiSummary.openApiSpecs = Array.from(openApiSpecsSet);
  report.structureSummary.avgBreadcrumbDepth = breadcrumbPages > 0 ? Math.round((breadcrumbSum / breadcrumbPages) * 10) / 10 : 0;

  // Special content summary finalization
  report.specialContentSummary.thirdPartyEmbeds = Object.entries(embedCounts)
    .map(([provider, count]) => ({ provider, count }))
    .sort((a, b) => b.count - a.count);
  report.specialContentSummary.apiReferencePages = apiReferencePageCount;

  // Videos summary
  report.videosSummary = Object.entries(videoCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  // External link domains
  report.externalLinkDomains = Object.entries(domainCounts)
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  // API status
  if (apiDetailsSet.size > 0) {
    report.apiStatus = { detected: true, details: Array.from(apiDetailsSet) };
  }

  // Custom components summary (merging custom tags and semantic BEM classes)
  const baseCustomComponents = Object.entries(componentCounts).map(([tag, count]) => ({ tag, count }));

  const processedSemanticComponents = [];

  for (const [type, data] of Object.entries(contentComponentCounts)) {
    if (!type.startsWith('semantic:') && !type.startsWith('styled:') && !type.startsWith('visual:')) continue;

    const decision = decisions?.[type] || { action: 'include' };

    if (decision.action === 'ignore') {
      continue;
    }

    if (decision.action === 'map' && decision.mappedTo) {
      // If mapped to a Mintlify component, we can increment the platform component count.
      // E.g. mappedTo === 'Card' -> platformComponentsSummary.cards.total += data.count
      const mappedKey = decision.mappedTo.toLowerCase() + 's';
      if (mappedKey in report.platformComponentsSummary) {
        report.platformComponentsSummary[mappedKey].total += data.count;
      } else {
        // Fallback if not a direct mapping, keep it in custom but renamed
        processedSemanticComponents.push({ tag: decision.mappedTo, count: data.count });
      }
      continue;
    }

    // Default 'include' logic
    processedSemanticComponents.push({ tag: type.replace('semantic:', '.').replace('styled:', '.').replace('visual:', 'box:'), count: data.count });
  }

  // Combine and consolidate duplicates (if multiple components mapped to same custom name)
  const allCustom = [...baseCustomComponents, ...processedSemanticComponents];
  const consolidatedMap = new Map();
  for (const { tag, count } of allCustom) {
    consolidatedMap.set(tag, (consolidatedMap.get(tag) || 0) + count);
  }

  report.customComponentsSummary = Array.from(consolidatedMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 40);

  // Points of attention
  const totalVideos = Object.values(videoCounts).reduce((a, b) => a + b, 0);
  if (totalVideos > 0) {
    const types = Object.entries(videoCounts).map(([t, c]) => `${t}: ${c}`).join(", ");
    report.pointsOfAttention.push({
      type: "videos",
      description: `${totalVideos} embedded videos found (${types})`,
      count: totalVideos,
    });
  }

  if (helpCenterCount > 0) {
    report.pointsOfAttention.push({
      type: "help-center",
      description: `${helpCenterCount} references to help center / support platforms`,
      count: helpCenterCount,
    });
  }

  if (report.apiStatus.detected) {
    report.pointsOfAttention.push({
      type: "api-docs",
      description: `API documentation detected: ${report.apiStatus.details.join("; ")}`,
      count: report.apiStatus.details.length,
    });
  }

  // Enhanced custom-components point of attention
  {
    const webCompTypes = report.customComponentsSummary.length;
    const webCompTotal = report.customComponentsSummary.reduce((s, c) => s + c.count, 0);
    const contentCompTypes = Object.keys(contentComponentCounts).length;
    const contentCompTotal = Object.values(contentComponentCounts).reduce((s, c) => s + c.count, 0);

    const totalUniqueTypes = webCompTypes + contentCompTypes;
    const totalInstances = webCompTotal + contentCompTotal;
    const totalPagesAffected = pagesWithComponentsList.length;

    if (totalUniqueTypes > 0) {
      const parts = [];
      if (webCompTypes > 0) parts.push(`${webCompTypes} web component types (${webCompTotal} instances)`);
      if (contentCompTypes > 0) parts.push(`${contentCompTypes} content component types (${contentCompTotal} instances)`);
      const pagesNote = totalPagesAffected > 0 ? ` across ${totalPagesAffected} pages` : '';
      report.pointsOfAttention.push({
        type: "custom-components",
        description: `${totalUniqueTypes} custom component types found: ${parts.join(', ')}${pagesNote}`,
        count: totalInstances,
      });
    }
  }

  // Pages with mixed components (3+ different component types on one page)
  {
    const mixedPages = pagesWithComponentsList.filter(p => p.components.length >= 3);
    if (mixedPages.length > 0) {
      const maxTypes = Math.max(...mixedPages.map(p => p.components.length));
      report.pointsOfAttention.push({
        type: "pages-with-mixed-components",
        description: `${mixedPages.length} page${mixedPages.length !== 1 ? 's' : ''} with 3+ different component types (max ${maxTypes} types on one page)`,
        count: mixedPages.length,
      });
    }
  }

  // Special content points of attention
  const sc = report.specialContentSummary;
  if (sc.thirdPartyEmbeds.length > 0) {
    const totalEmbeds = sc.thirdPartyEmbeds.reduce((s, e) => s + e.count, 0);
    const embedDetails = sc.thirdPartyEmbeds.map(e => `${e.provider}: ${e.count}`).join(', ');
    report.pointsOfAttention.push({
      type: 'third-party-embeds',
      description: `${totalEmbeds} third-party code embeds found (${embedDetails})`,
      count: totalEmbeds,
    });
  }

  if (sc.totalMathContent > 0) {
    let mathPages = 0;
    for (const site of sites) {
      for (const page of site.analysisResults) {
        if ((page.specialContent?.mathContent || 0) > 0) mathPages++;
      }
    }
    report.pointsOfAttention.push({
      type: 'math-content',
      description: `${mathPages} page${mathPages !== 1 ? 's' : ''} with mathematical formulas (MathJax/KaTeX)`,
      count: mathPages,
    });
  }

  if (sc.totalDiagramContent > 0) {
    let diagramPages = 0;
    for (const site of sites) {
      for (const page of site.analysisResults) {
        if ((page.specialContent?.diagramContent || 0) > 0) diagramPages++;
      }
    }
    report.pointsOfAttention.push({
      type: 'diagrams',
      description: `${diagramPages} page${diagramPages !== 1 ? 's' : ''} with diagrams (Mermaid/PlantUML/etc.)`,
      count: diagramPages,
    });
  }

  if (sc.apiReferencePages > 0) {
    report.pointsOfAttention.push({
      type: 'api-reference-pages',
      description: `${sc.apiReferencePages} page${sc.apiReferencePages !== 1 ? 's' : ''} detected as API reference pages`,
      count: sc.apiReferencePages,
    });
  }

  if (sc.totalCodePlaygrounds > 0) {
    let pgPages = 0;
    for (const site of sites) {
      for (const page of site.analysisResults) {
        if ((page.specialContent?.codePlaygrounds || 0) > 0) pgPages++;
      }
    }
    report.pointsOfAttention.push({
      type: 'code-playgrounds',
      description: `${sc.totalCodePlaygrounds} embedded code playgrounds across ${pgPages} page${pgPages !== 1 ? 's' : ''}`,
      count: sc.totalCodePlaygrounds,
    });
  }

  // New points of attention
  if (report.interactiveSummary.totalDownloads > 0) {
    const exts = report.interactiveSummary.downloadExtensions.map(e => `${e.ext}: ${e.count}`).join(", ");
    report.pointsOfAttention.push({
      type: "download-links",
      description: `${report.interactiveSummary.totalDownloads} downloadable files found (${exts})`,
      count: report.interactiveSummary.totalDownloads,
    });
  }

  // Count pages with complex tables (>5 rows)
  let complexTablePages = 0;
  for (const site of sites) {
    for (const page of site.analysisResults) {
      if ((page.tables?.totalRows || 0) > 5) complexTablePages++;
    }
  }
  if (complexTablePages > 0) {
    report.pointsOfAttention.push({
      type: "tables",
      description: `${complexTablePages} pages with complex tables (>5 rows)`,
      count: complexTablePages,
    });
  }

  if (report.interactiveSummary.totalForms > 0) {
    report.pointsOfAttention.push({
      type: "forms",
      description: `${report.interactiveSummary.totalForms} forms detected across pages`,
      count: report.interactiveSummary.totalForms,
    });
  }

  if (report.interactiveSummary.totalIframes > 0) {
    report.pointsOfAttention.push({
      type: "iframes",
      description: `${report.interactiveSummary.totalIframes} non-video iframes detected`,
      count: report.interactiveSummary.totalIframes,
    });
  }

  // Code-heavy pages (>5 code blocks)
  let codeHeavyPages = 0;
  for (const site of sites) {
    for (const page of site.analysisResults) {
      if ((page.codeBlocks?.count || 0) > 5) codeHeavyPages++;
    }
  }
  if (codeHeavyPages > 0) {
    report.pointsOfAttention.push({
      type: "code-heavy",
      description: `${codeHeavyPages} pages with >5 code blocks`,
      count: codeHeavyPages,
    });
  }

  if (report.apiSummary.openApiSpecs.length > 0) {
    report.pointsOfAttention.push({
      type: "openapi-specs",
      description: `${report.apiSummary.openApiSpecs.length} OpenAPI/Swagger spec references found`,
      count: report.apiSummary.openApiSpecs.length,
    });
  }

  if (report.apiSummary.playgroundCount > 0) {
    report.pointsOfAttention.push({
      type: "api-playgrounds",
      description: `${report.apiSummary.playgroundCount} interactive API playground widgets`,
      count: report.apiSummary.playgroundCount,
    });
  }

  if (report.structureSummary.hasMultiLanguage) {
    report.pointsOfAttention.push({
      type: "multi-language",
      description: "Site has language switcher / multi-language content",
      count: 1,
    });
  }

  if (report.structureSummary.hasPagination) {
    report.pointsOfAttention.push({
      type: "pagination",
      description: "Paginated content detected",
      count: 1,
    });
  }

  if (report.interactiveSummary.totalTooltips > 0) {
    report.pointsOfAttention.push({
      type: "tooltips",
      description: `${report.interactiveSummary.totalTooltips} tooltips detected across pages`,
      count: report.interactiveSummary.totalTooltips,
    });
  }

  // Enhanced API summary finalization
  if (Object.keys(apiToolCounts).length > 0) {
    report.apiSummary.detectedTools = Object.entries(apiToolCounts)
      .map(([toolType, data]) => ({ toolType, pageCount: data.pageCount, confidence: data.confidence }))
      .sort((a, b) => b.pageCount - a.pageCount);
  }
  if (allDetectedSpecs.length > 0) {
    report.apiSummary.detectedSpecs = allDetectedSpecs;
  }
  if (totalApiEndpoints > 0) {
    report.apiSummary.totalEndpoints = totalApiEndpoints;
  }
  if (authMethodsSet.size > 0) {
    report.apiSummary.authMethods = Array.from(authMethodsSet);
  }
  if (apiTypesSet.size > 0) {
    report.apiSummary.apiTypes = Array.from(apiTypesSet);
  }
  if (pagesWithPlayground.length > 0) {
    report.apiSummary.pagesWithPlayground = pagesWithPlayground;
  }
  if (pagesWithTryIt.length > 0) {
    report.apiSummary.pagesWithTryIt = pagesWithTryIt;
  }

  // Migration complexity calculation
  report.migrationComplexity = calculateMigrationComplexity(report, widgetTypeCounts);

  // Migration readiness calculation
  const compat = buildMintlifyCompatibility(report, sites);
  const totalDetectedTypes = compat.supported.length + compat.needsCustomBuild.length;
  const supportedPct = totalDetectedTypes > 0 ? (compat.supported.length / totalDetectedTypes) * 100 : 100;
  const customPct = totalDetectedTypes > 0 ? (compat.needsCustomBuild.length / totalDetectedTypes) * 100 : 0;
  let cleanPages = 0;
  let complexPages = 0;
  for (const p of pagesWithComponentsList) {
    if (p.components.length === 0) cleanPages++;
    if (p.components.length >= 3) complexPages++;
  }
  // Pages with no components at all count as clean
  cleanPages += report.totalPages - pagesWithComponentsList.length;
  report.migrationReadiness = {
    score: Math.max(0, Math.min(100, 100 - report.migrationComplexity.score)),
    supportedPercentage: Math.round(supportedPct * 10) / 10,
    customPercentage: Math.round(customPct * 10) / 10,
    cleanPages,
    complexPages,
  };

  // Pages requiring review
  const reviewPages = [];
  for (const site of sites) {
    for (const page of site.analysisResults) {
      const reasons = [];
      const pageEntry = pagesWithComponentsList.find(p => p.url === page.url);
      const uniqueTypes = pageEntry ? new Set(pageEntry.components.map(c => c.type)).size : 0;
      const totalInstances = pageEntry ? pageEntry.components.reduce((s, c) => s + c.count, 0) : 0;

      if (uniqueTypes >= 3) reasons.push(`${uniqueTypes} custom component types`);
      if (page.interactiveWidgets && page.interactiveWidgets.length > 0) reasons.push('Interactive widgets');
      if (page.isApiReferencePage && (!page.apiDocDetails || page.apiDocDetails.length === 0)) reasons.push('API reference without detected API tool');
      if (totalInstances >= 5) reasons.push(`${totalInstances} total custom component instances`);

      if (reasons.length > 0) {
        reviewPages.push({ url: page.url, reasons, componentCount: totalInstances });
      }
    }
  }
  if (reviewPages.length > 0) {
    report.pagesRequiringReview = reviewPages
      .sort((a, b) => b.componentCount - a.componentCount)
      .slice(0, 50);
  }

  // Most complex pages
  const pageComplexity = pagesWithComponentsList.map(p => ({
    url: p.url,
    uniqueComponentTypes: new Set(p.components.map(c => c.type)).size,
    totalComponents: p.components.reduce((s, c) => s + c.count, 0),
  }));
  if (pageComplexity.length > 0) {
    report.mostComplexPages = pageComplexity
      .sort((a, b) => b.uniqueComponentTypes - a.uniqueComponentTypes || b.totalComponents - a.totalComponents)
      .slice(0, 20);
  }

  return report;
}

/**
 * Calculates migration complexity score and factors based on report data.
 */
function calculateMigrationComplexity(
  report,
  widgetTypeCounts
) {
  let score = 0;
  const factors = [];

  // Custom components: 5 per unique type
  const uniqueCustomTypes = report.customComponentsSummary.length;
  if (uniqueCustomTypes > 0) {
    const impact = uniqueCustomTypes * 5;
    score += impact;
    factors.push({
      name: 'Custom components',
      impact: impact > 15 ? 'high' : impact > 5 ? 'medium' : 'low',
      description: `${uniqueCustomTypes} unique custom component types need migration`,
      count: uniqueCustomTypes,
    });
  }

  // API reference pages: 3 per page
  const apiRefPages = report.specialContentSummary.apiReferencePages;
  if (apiRefPages > 0) {
    const impact = apiRefPages * 3;
    score += impact;
    factors.push({
      name: 'API reference pages',
      impact: impact > 15 ? 'high' : impact > 6 ? 'medium' : 'low',
      description: `${apiRefPages} API reference pages require specialized handling`,
      count: apiRefPages,
    });
  }

  // Interactive widgets: 8 per unique type
  const uniqueWidgetTypes = Object.keys(widgetTypeCounts).length;
  if (uniqueWidgetTypes > 0) {
    const impact = uniqueWidgetTypes * 8;
    score += impact;
    factors.push({
      name: 'Interactive widgets',
      impact: impact > 20 ? 'high' : impact > 8 ? 'medium' : 'low',
      description: `${uniqueWidgetTypes} interactive widget types (e.g. ${Object.keys(widgetTypeCounts).slice(0, 3).join(', ')})`,
      count: uniqueWidgetTypes,
    });
  }

  // Third-party embeds: 4 per type
  const embedTypes = report.specialContentSummary.thirdPartyEmbeds.length;
  if (embedTypes > 0) {
    const impact = embedTypes * 4;
    score += impact;
    factors.push({
      name: 'Third-party embeds',
      impact: impact > 12 ? 'high' : impact > 4 ? 'medium' : 'low',
      description: `${embedTypes} third-party embed providers (${report.specialContentSummary.thirdPartyEmbeds.map(e => e.provider).join(', ')})`,
      count: embedTypes,
    });
  }

  // Videos: 2 per type
  const videoTypes = report.videosSummary.length;
  if (videoTypes > 0) {
    const impact = videoTypes * 2;
    score += impact;
    factors.push({
      name: 'Embedded videos',
      impact: 'low',
      description: `${videoTypes} video embed types`,
      count: videoTypes,
    });
  }

  // Forms: 5 per total
  const totalForms = report.interactiveSummary.totalForms;
  if (totalForms > 0) {
    const impact = totalForms * 5;
    score += impact;
    factors.push({
      name: 'Forms',
      impact: impact > 15 ? 'high' : impact > 5 ? 'medium' : 'low',
      description: `${totalForms} forms need custom handling`,
      count: totalForms,
    });
  }

  // Math content: 3 per page with math
  const mathContent = report.specialContentSummary.totalMathContent;
  if (mathContent > 0) {
    const impact = mathContent * 3;
    score += impact;
    factors.push({
      name: 'Math content',
      impact: impact > 12 ? 'high' : impact > 3 ? 'medium' : 'low',
      description: `${mathContent} math elements requiring MathJax/KaTeX integration`,
      count: mathContent,
    });
  }

  // Diagram content: 3 per page with diagrams
  const diagramContent = report.specialContentSummary.totalDiagramContent;
  if (diagramContent > 0) {
    const impact = diagramContent * 3;
    score += impact;
    factors.push({
      name: 'Diagram content',
      impact: impact > 12 ? 'high' : impact > 3 ? 'medium' : 'low',
      description: `${diagramContent} diagram elements requiring renderer integration`,
      count: diagramContent,
    });
  }

  // Cap at 100
  score = Math.min(100, score);

  // Categorize
  let level;
  if (score <= 25) level = 'low';
  else if (score <= 50) level = 'medium';
  else if (score <= 75) level = 'high';
  else level = 'very-high';

  return { score, level, factors };
}

/**
 * Formats a ScopingReport as a plain text string.
 */
export function formatReportAsText(report) {
  const lines = [];

  lines.push("===========================================");
  lines.push("  PROJECT SCOPING REPORT");
  lines.push("===========================================");
  lines.push("");
  lines.push(`Total pages: ${report.totalPages}`);
  lines.push(`Sites analyzed: ${report.sites.length}`);
  lines.push("");

  // Crawl Statistics
  const cs = report.crawlStats;
  if (cs.totalDiscovered > 0) {
    lines.push("-------------------------------------------");
    lines.push("CRAWL STATISTICS");
    lines.push("-------------------------------------------");
    lines.push(`  Total discovered: ${cs.totalDiscovered}`);
    lines.push(`  Analyzed (doc pages): ${cs.totalAnalyzed}`);
    if (cs.totalSkippedUrl > 0) lines.push(`  Skipped (URL filter): ${cs.totalSkippedUrl}`);
    if (cs.totalSkippedNonDoc > 0) lines.push(`  Skipped (non-doc): ${cs.totalSkippedNonDoc}`);
    lines.push(`  Via webview: ${cs.totalWebview}`);
    lines.push(`  Via HTTP fallback: ${cs.totalHttpFallback}`);
    lines.push("");
  }

  // Per-site breakdown
  for (const site of report.sites) {
    lines.push("-------------------------------------------");
    lines.push(`Site: ${site.label}`);
    lines.push(`URL: ${site.url}`);
    lines.push(`Pages: ${site.totalPages}`);

    if (site.categories.length > 0) {
      lines.push("Categories:");
      for (const cat of site.categories) {
        lines.push(`  - ${cat.name}: ${cat.count} pages`);
      }
    }
    lines.push("");
  }

  // Points of attention
  if (report.pointsOfAttention.length > 0) {
    lines.push("-------------------------------------------");
    lines.push("POINTS OF ATTENTION");
    lines.push("-------------------------------------------");
    for (const point of report.pointsOfAttention) {
      lines.push(`  [${point.type.toUpperCase()}] ${point.description}`);
    }
    lines.push("");
  }

  // Videos
  if (report.videosSummary.length > 0) {
    lines.push("-------------------------------------------");
    lines.push("EMBEDDED VIDEOS");
    lines.push("-------------------------------------------");
    for (const v of report.videosSummary) {
      lines.push(`  ${v.type}: ${v.count}`);
    }
    lines.push("");
  }

  // API Documentation
  lines.push("-------------------------------------------");
  lines.push("API DOCUMENTATION");
  lines.push("-------------------------------------------");
  if (report.apiStatus.detected) {
    for (const detail of report.apiStatus.details) {
      lines.push(`  ${detail}`);
    }
  } else {
    lines.push("  No API documentation detected");
  }
  lines.push("");

  // Platform Components
  const pcs = report.platformComponentsSummary;
  const hasPlatComp = pcs.callouts.total || pcs.tabs.total || pcs.codeGroups.total || pcs.accordions.total || pcs.cards.total || pcs.steps.total || pcs.definitions.total || pcs.embeds.total;
  if (hasPlatComp) {
    lines.push("-------------------------------------------");
    lines.push("PLATFORM COMPONENTS (Mintlify equivalents)");
    lines.push("-------------------------------------------");
    if (pcs.callouts.total) {
      const variantParts = [];
      const v = pcs.callouts.variants;
      if (v.note) variantParts.push(`Note (${v.note})`);
      if (v.warning) variantParts.push(`Warning (${v.warning})`);
      if (v.tip) variantParts.push(`Tip (${v.tip})`);
      if (v.info) variantParts.push(`Info (${v.info})`);
      if (v.danger) variantParts.push(`Danger (${v.danger})`);
      if (v.check) variantParts.push(`Check (${v.check})`);
      const variantStr = variantParts.length > 0 ? ` — ${variantParts.join(", ")}` : "";
      lines.push(`  Callouts: ${pcs.callouts.total}${variantStr}`);
    }
    if (pcs.tabs.total) lines.push(`  Tabs: ${pcs.tabs.total} → Tabs`);
    if (pcs.codeGroups.total) lines.push(`  Code Groups: ${pcs.codeGroups.total} → CodeGroup`);
    if (pcs.accordions.total) lines.push(`  Accordions: ${pcs.accordions.total} → Accordion / AccordionGroup`);
    if (pcs.cards.total) lines.push(`  Cards: ${pcs.cards.total} → Card / CardGroup`);
    if (pcs.steps.total) lines.push(`  Steps: ${pcs.steps.total} → Steps / Step`);
    if (pcs.definitions.total) lines.push(`  Definitions: ${pcs.definitions.total} → ResponseField / ParamField`);
    if (pcs.embeds.total) lines.push(`  Embeds: ${pcs.embeds.total} → Frame`);
    lines.push("");
  }

  // Content Selector Match Rate
  if (report.contentSelectorStats?.configured) {
    const cs = report.contentSelectorStats;
    lines.push("-------------------------------------------");
    lines.push("CONTENT SELECTOR");
    lines.push("-------------------------------------------");
    lines.push(`  Match rate: ${(cs.matchRate * 100).toFixed(0)}% (${cs.matchedPages}/${cs.totalPages} pages)`);
    if (cs.matchRate < 0.8) {
      lines.push(`  ⚠ Low match rate — content selector may need adjustment`);
    }
    lines.push("");
  }

  // Custom Components
  if (report.customComponentsSummary.length > 0) {
    lines.push("-------------------------------------------");
    lines.push("CUSTOM WEB COMPONENTS");
    lines.push("-------------------------------------------");
    for (const comp of report.customComponentsSummary) {
      lines.push(`  <${comp.tag}>: ${comp.count} instances`);
    }
    lines.push("");
  }

  // Pages with Components
  if (report.pagesWithComponents && report.pagesWithComponents.length > 0) {
    lines.push("-------------------------------------------");
    lines.push(`PAGES WITH COMPONENTS (${report.pagesWithComponents.length} pages)`);
    lines.push("-------------------------------------------");
    for (const p of report.pagesWithComponents.slice(0, 20)) {
      const compTypes = p.components.map(c => `${c.type}(${c.count})`).join(', ');
      lines.push(`  ${p.url}`);
      lines.push(`    Components: ${compTypes}`);
    }
    if (report.pagesWithComponents.length > 20) {
      lines.push(`  ... and ${report.pagesWithComponents.length - 20} more pages`);
    }
    lines.push("");
  }

  // Unique Selectors (potential custom components)
  if (report.uniqueSelectorsSummary && report.uniqueSelectorsSummary.length > 0) {
    lines.push("-------------------------------------------");
    lines.push(`UNIQUE SELECTORS IN CONTENT (${report.uniqueSelectorsSummary.length} unique classes/IDs)`);
    lines.push("-------------------------------------------");
    lines.push("  Each selector below was found inside the content area.");
    lines.push("  Check the reference page to see if it represents a custom component.");
    lines.push("");
    for (const us of report.uniqueSelectorsSummary.slice(0, 50)) {
      lines.push(`  ${us.selector}  <${us.tag}>  (${us.pageCount} page${us.pageCount !== 1 ? 's' : ''})`);
      lines.push(`    First seen: ${us.firstPageUrl}`);
      if (us.sampleText) lines.push(`    Text: "${us.sampleText.substring(0, 60)}${us.sampleText.length > 60 ? '...' : ''}"`);
    }
    if (report.uniqueSelectorsSummary.length > 50) {
      lines.push(`  ... and ${report.uniqueSelectorsSummary.length - 50} more selectors`);
    }
    lines.push("");
  }

  // Special Content
  const scSum = report.specialContentSummary;
  if (scSum.thirdPartyEmbeds.length > 0 || scSum.totalMathContent > 0 || scSum.totalDiagramContent > 0 || scSum.totalCodePlaygrounds > 0 || scSum.apiReferencePages > 0) {
    lines.push("-------------------------------------------");
    lines.push("SPECIAL CONTENT");
    lines.push("-------------------------------------------");
    if (scSum.thirdPartyEmbeds.length > 0) {
      const totalEmbeds = scSum.thirdPartyEmbeds.reduce((s, e) => s + e.count, 0);
      lines.push(`  Third-party embeds: ${totalEmbeds}`);
      for (const e of scSum.thirdPartyEmbeds) {
        lines.push(`    - ${e.provider}: ${e.count}`);
      }
    }
    if (scSum.totalMathContent > 0) lines.push(`  Math content (MathJax/KaTeX): ${scSum.totalMathContent} elements`);
    if (scSum.totalDiagramContent > 0) lines.push(`  Diagrams (Mermaid/PlantUML/etc.): ${scSum.totalDiagramContent} elements`);
    if (scSum.totalCodePlaygrounds > 0) lines.push(`  Code playgrounds: ${scSum.totalCodePlaygrounds}`);
    if (scSum.apiReferencePages > 0) lines.push(`  API reference pages: ${scSum.apiReferencePages}`);
    lines.push("");
  }

  // Content Complexity
  lines.push("-------------------------------------------");
  lines.push("CONTENT COMPLEXITY");
  lines.push("-------------------------------------------");
  lines.push(`  Total words: ${report.contentSummary.totalWords.toLocaleString()}`);
  lines.push(`  Code blocks: ${report.contentSummary.totalCodeBlocks}`);
  if (report.contentSummary.codeLanguages.length > 0) {
    lines.push(`  Code languages: ${report.contentSummary.codeLanguages.map(l => `${l.language} (${l.count})`).join(", ")}`);
  }
  lines.push(`  Tables: ${report.contentSummary.totalTables}`);
  lines.push(`  Images: ${report.contentSummary.totalImages}`);
  // Headings breakdown
  const th = report.contentSummary.totalHeadings;
  const headingParts = [];
  for (let level = 1; level <= 6; level++) {
    const key = `h${level}`;
    if (th[key] > 0) headingParts.push(`H${level}: ${th[key]}`);
  }
  if (headingParts.length > 0) lines.push(`  Headings: ${headingParts.join(", ")}`);
  // Lists breakdown
  const tl = report.contentSummary.totalLists;
  if (tl.ordered > 0 || tl.unordered > 0) {
    const listParts = [];
    if (tl.ordered > 0) listParts.push(`Ordered: ${tl.ordered}`);
    if (tl.unordered > 0) listParts.push(`Unordered: ${tl.unordered}`);
    lines.push(`  Lists: ${listParts.join(", ")}`);
  }
  lines.push("");

  // Interactive Elements
  const { interactiveSummary: inter } = report;
  if (inter.totalTabs || inter.totalAccordions || inter.totalDownloads || inter.totalForms || inter.totalIframes || inter.totalTooltips) {
    lines.push("-------------------------------------------");
    lines.push("INTERACTIVE ELEMENTS");
    lines.push("-------------------------------------------");
    if (inter.totalTabs) lines.push(`  Tabs: ${inter.totalTabs}`);
    if (inter.totalAccordions) lines.push(`  Accordions: ${inter.totalAccordions}`);
    if (inter.totalTooltips) lines.push(`  Tooltips: ${inter.totalTooltips}`);
    if (inter.totalDownloads) {
      const exts = inter.downloadExtensions.map(e => `${e.ext} (${e.count})`).join(", ");
      lines.push(`  Download links: ${inter.totalDownloads}${exts ? ` — ${exts}` : ""}`);
    }
    if (inter.totalForms) lines.push(`  Forms: ${inter.totalForms}`);
    if (inter.totalIframes) lines.push(`  Non-video iframes: ${inter.totalIframes}`);
    lines.push("");
  }

  // API & Playground
  const { apiSummary: api } = report;
  if (api.openApiSpecs.length > 0 || api.playgroundCount > 0 || api.graphqlCount > 0) {
    lines.push("-------------------------------------------");
    lines.push("API & PLAYGROUND");
    lines.push("-------------------------------------------");
    if (api.openApiSpecs.length > 0) {
      lines.push(`  OpenAPI/Swagger specs: ${api.openApiSpecs.length}`);
      for (const spec of api.openApiSpecs.slice(0, 10)) {
        lines.push(`    - ${spec}`);
      }
    }
    if (api.playgroundCount) lines.push(`  API playgrounds: ${api.playgroundCount}`);
    if (api.graphqlCount) lines.push(`  GraphQL explorers: ${api.graphqlCount}`);
    lines.push("");
  }

  // Site Structure
  const { structureSummary: struct } = report;
  if (struct.avgBreadcrumbDepth > 0 || struct.hasPagination || struct.hasMultiLanguage) {
    lines.push("-------------------------------------------");
    lines.push("SITE STRUCTURE");
    lines.push("-------------------------------------------");
    if (struct.avgBreadcrumbDepth > 0) lines.push(`  Avg breadcrumb depth: ${struct.avgBreadcrumbDepth}`);
    if (struct.hasPagination) lines.push(`  Pagination: detected`);
    if (struct.hasMultiLanguage) lines.push(`  Multi-language: detected`);
    lines.push("");
  }

  // API Documentation Details (enhanced)
  const apiSum = report.apiSummary;
  if (apiSum.detectedTools?.length || apiSum.totalEndpoints || apiSum.authMethods?.length || apiSum.detectedSpecs?.length) {
    lines.push("-------------------------------------------");
    lines.push("API DOCUMENTATION DETAILS");
    lines.push("-------------------------------------------");
    if (apiSum.detectedTools && apiSum.detectedTools.length > 0) {
      lines.push("  Detected API tools:");
      for (const tool of apiSum.detectedTools) {
        lines.push(`    - ${tool.toolType}: ${tool.pageCount} page${tool.pageCount !== 1 ? 's' : ''} (${tool.confidence} confidence)`);
      }
    }
    if (apiSum.totalEndpoints) lines.push(`  Total API endpoints: ${apiSum.totalEndpoints}`);
    if (apiSum.authMethods && apiSum.authMethods.length > 0) {
      lines.push(`  Auth methods: ${apiSum.authMethods.join(', ')}`);
    }
    if (apiSum.apiTypes && apiSum.apiTypes.length > 0) {
      lines.push(`  API types: ${apiSum.apiTypes.join(', ')}`);
    }
    if (apiSum.pagesWithPlayground && apiSum.pagesWithPlayground.length > 0) {
      lines.push(`  Pages with playground: ${apiSum.pagesWithPlayground.length}`);
    }
    if (apiSum.pagesWithTryIt && apiSum.pagesWithTryIt.length > 0) {
      lines.push(`  Pages with "Try it": ${apiSum.pagesWithTryIt.length}`);
    }
    if (apiSum.detectedSpecs && apiSum.detectedSpecs.length > 0) {
      lines.push("  Detected API specs:");
      for (const spec of apiSum.detectedSpecs.slice(0, 10)) {
        const parts = [spec.type];
        if (spec.version) parts.push(`v${spec.version}`);
        if (spec.endpointCount) parts.push(`${spec.endpointCount} endpoints`);
        if (spec.title) parts.push(spec.title);
        lines.push(`    - ${spec.url} (${parts.join(', ')})`);
      }
    }
    lines.push("");
  }

  // Migration Assessment
  if (report.migrationComplexity) {
    const mc = report.migrationComplexity;
    lines.push("-------------------------------------------");
    lines.push("MIGRATION ASSESSMENT");
    lines.push("-------------------------------------------");
    lines.push(`  Complexity score: ${mc.score}/100 (${mc.level})`);
    if (report.migrationReadiness) {
      const mr = report.migrationReadiness;
      lines.push(`  Readiness score: ${mr.score}/100`);
      lines.push(`  Supported components: ${mr.supportedPercentage.toFixed(1)}%`);
      lines.push(`  Custom work required: ${mr.customPercentage.toFixed(1)}%`);
      lines.push(`  Clean pages (no special components): ${mr.cleanPages}`);
      lines.push(`  Complex pages (3+ component types): ${mr.complexPages}`);
    }
    if (mc.factors.length > 0) {
      lines.push("  Complexity factors:");
      for (const factor of mc.factors) {
        lines.push(`    [${factor.impact.toUpperCase()}] ${factor.name}: ${factor.description}`);
      }
    }
    lines.push("");
  }

  // Pages Requiring Review
  if (report.pagesRequiringReview && report.pagesRequiringReview.length > 0) {
    lines.push("-------------------------------------------");
    lines.push(`PAGES REQUIRING REVIEW (${report.pagesRequiringReview.length} pages)`);
    lines.push("-------------------------------------------");
    for (const page of report.pagesRequiringReview.slice(0, 10)) {
      lines.push(`  ${page.url}`);
      lines.push(`    Reasons: ${page.reasons.join('; ')}`);
      lines.push(`    Components: ${page.componentCount}`);
    }
    if (report.pagesRequiringReview.length > 10) {
      lines.push(`  ... and ${report.pagesRequiringReview.length - 10} more pages`);
    }
    lines.push("");
  }

  // Top external link domains
  if (report.externalLinkDomains.length > 0) {
    lines.push("-------------------------------------------");
    lines.push("TOP EXTERNAL LINK DOMAINS");
    lines.push("-------------------------------------------");
    for (const d of report.externalLinkDomains.slice(0, 15)) {
      lines.push(`  ${d.domain}: ${d.count} links`);
    }
    lines.push("");
  }

  lines.push("===========================================");
  lines.push(`Report generated: ${new Date().toISOString()}`);

  return lines.join("\n");
}

// ============================================
// TYPEFORM SUMMARY FUNCTIONS
// ============================================

/** Count platform occurrences across all pages and return most common + confidence */
export function detectMostCommonPlatform(sites) {
  const counts = {};
  let total = 0;
  for (const site of sites) {
    for (const page of site.analysisResults) {
      if (page.platform && page.platform !== 'unknown') {
        counts[page.platform] = (counts[page.platform] || 0) + 1;
        total++;
      }
    }
  }
  if (total === 0) return { platform: 'Unknown', confidence: 'low' };

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [topPlatform, topCount] = sorted[0];
  const ratio = topCount / total;

  let confidence = 'low';
  if (ratio > 0.7) confidence = 'high';
  else if (ratio > 0.4) confidence = 'medium';

  // Capitalize platform name
  const name = topPlatform.charAt(0).toUpperCase() + topPlatform.slice(1);
  return { platform: name, confidence };
}

/** Map platform to Typeform content format options */
export function inferContentFormat(platform, sites) {
  const p = platform.toLowerCase();
  if (['nextra', 'fumadocs', 'mintlify'].includes(p)) return 'Existing MDX files';
  if (p === 'docusaurus') {
    // Check if MDX indicators were found
    let mdxCount = 0;
    let total = 0;
    for (const site of sites) {
      for (const page of site.analysisResults) {
        if (page.contentFormat === 'mdx') mdxCount++;
        total++;
      }
    }
    return mdxCount > total * 0.3 ? 'Existing MDX files' : 'HTML/Markdown conversion needed';
  }
  if (['mkdocs', 'vitepress', 'jekyll', 'hugo-docsy', 'starlight', 'docsify', 'wikijs'].includes(p)) return 'HTML/Markdown conversion needed';
  if (['sphinx', 'readthedocs'].includes(p)) return 'HTML/Markdown conversion needed';
  if (['gitbook', 'readme', 'notion', 'confluence', 'zendesk', 'google-devsite', 'slate'].includes(p)) return 'Needs full scraping';
  return 'Needs full scraping';
}

/** The 20 Mintlify component names for compatibility checking */
const MINTLIFY_COMPONENTS = [
  'Accordion', 'AccordionGroup', 'Card', 'CardGroup',
  'CodeBlock', 'CodeGroup', 'Tabs', 'Tab',
  'Note', 'Warning', 'Info', 'Tip', 'Check', 'Danger',
  'Frame', 'Steps', 'Step', 'Tooltip',
  'ResponseField', 'ParamField', 'Expandable',
];

/** Get the best CSS hint for a component type from aggregated samples */
function getBestCssHint(samplesAgg, sampleType) {
  if (!samplesAgg) return undefined;
  const agg = samplesAgg[sampleType];
  if (!agg || agg.cssHints.length === 0) return undefined;
  // Prefer class/ID hints over bare tag names
  const classHint = agg.cssHints.find(h => h.startsWith('.') || h.startsWith('#'));
  return classHint || agg.cssHints[0];
}

/** Build Mintlify compatibility analysis from report data */
export function buildMintlifyCompatibility(report, _sites) {
  const supported = [];
  const needsCustomBuild = [];
  const samplesAgg = report.componentSamplesAggregated;

  // Use fingerprint-based platform components for precise detection
  const pc = report.platformComponentsSummary;

  // Callouts with variant-level mapping
  if (pc.callouts.total > 0) {
    const v = pc.callouts.variants;
    const calloutHint = getBestCssHint(samplesAgg, 'callout');
    if (v.note) supported.push({ name: 'Note', detectedAs: 'Callout (note)', count: v.note, cssHint: calloutHint });
    if (v.warning) supported.push({ name: 'Warning', detectedAs: 'Callout (warning)', count: v.warning, cssHint: calloutHint });
    if (v.tip) supported.push({ name: 'Tip', detectedAs: 'Callout (tip)', count: v.tip, cssHint: calloutHint });
    if (v.info) supported.push({ name: 'Info', detectedAs: 'Callout (info)', count: v.info, cssHint: calloutHint });
    if (v.danger) supported.push({ name: 'Warning', detectedAs: 'Callout (danger → Warning)', count: v.danger, cssHint: calloutHint });
    if (v.check) supported.push({ name: 'Check', detectedAs: 'Callout (success)', count: v.check, cssHint: calloutHint });
    // If variants didn't cover all callouts, add unclassified as Note
    const variantSum = v.note + v.warning + v.tip + v.info + v.danger + v.check;
    const unclassified = pc.callouts.total - variantSum;
    if (unclassified > 0) {
      const existing = supported.find(s => s.name === 'Note' && s.detectedAs.startsWith('Callout'));
      if (existing) existing.count += unclassified;
      else supported.push({ name: 'Note', detectedAs: 'Callout (unclassified)', count: unclassified, cssHint: calloutHint });
    }
  }

  if (pc.tabs.total > 0) {
    supported.push({ name: 'Tabs', detectedAs: 'Platform tabs', count: pc.tabs.total, cssHint: getBestCssHint(samplesAgg, 'tabs') });
  } else if (report.interactiveSummary.totalTabs > 0) {
    supported.push({ name: 'Tabs', detectedAs: 'Tab containers', count: report.interactiveSummary.totalTabs });
  }
  if (pc.codeGroups.total > 0) {
    supported.push({ name: 'CodeGroup', detectedAs: 'Code groups (tabs with code)', count: pc.codeGroups.total, cssHint: getBestCssHint(samplesAgg, 'code-group') });
  }
  if (pc.accordions.total > 0) {
    supported.push({ name: 'Accordion', detectedAs: 'Accordion / collapsible', count: pc.accordions.total, cssHint: getBestCssHint(samplesAgg, 'accordion') });
  } else if (report.interactiveSummary.totalAccordions > 0) {
    supported.push({ name: 'Accordion', detectedAs: 'Collapsible sections', count: report.interactiveSummary.totalAccordions });
  }
  if (pc.cards.total > 0) {
    supported.push({ name: 'Card / CardGroup', detectedAs: 'Card groups', count: pc.cards.total, cssHint: getBestCssHint(samplesAgg, 'card-group') });
  }
  if (pc.steps.total > 0) {
    supported.push({ name: 'Steps', detectedAs: 'Step sequences', count: pc.steps.total, cssHint: getBestCssHint(samplesAgg, 'steps') });
  }
  if (pc.definitions.total > 0) {
    supported.push({ name: 'ResponseField / ParamField', detectedAs: 'Definition lists', count: pc.definitions.total, cssHint: getBestCssHint(samplesAgg, 'definition') });
  }
  if (pc.embeds.total > 0) {
    supported.push({ name: 'Frame', detectedAs: 'Embedded iframes / video', count: pc.embeds.total, cssHint: getBestCssHint(samplesAgg, 'embed') });
  }
  if (pc.badges.total > 0) {
    supported.push({ name: 'Badge', detectedAs: 'Badges / Tags', count: pc.badges.total, cssHint: getBestCssHint(samplesAgg, 'badge') });
  }
  if (pc.tooltips.total > 0) {
    supported.push({ name: 'Tooltip', detectedAs: 'Tooltips', count: pc.tooltips.total, cssHint: getBestCssHint(samplesAgg, 'tooltip') });
  }
  if (pc.apiFields.total > 0) {
    supported.push({ name: 'ResponseField / ParamField', detectedAs: 'API Parameter fields', count: pc.apiFields.total, cssHint: getBestCssHint(samplesAgg, 'api-field') });
  }
  if (pc.math.total > 0) {
    supported.push({ name: 'Math / Formulas', detectedAs: 'LaTeX / Math block', count: pc.math.total, cssHint: getBestCssHint(samplesAgg, 'math') });
  }
  if (pc.mermaid.total > 0) {
    supported.push({ name: 'Mermaid', detectedAs: 'Mermaid Diagrams', count: pc.mermaid.total, cssHint: getBestCssHint(samplesAgg, 'mermaid') });
  }
  if (pc.columns.total > 0) {
    supported.push({ name: 'Grid / Columns', detectedAs: 'Column layouts', count: pc.columns.total, cssHint: getBestCssHint(samplesAgg, 'columns') });
  }

  // Code blocks from content metrics
  if (report.contentSummary.totalCodeBlocks > 0) {
    supported.push({ name: 'CodeBlock', detectedAs: 'Code blocks', count: report.contentSummary.totalCodeBlocks, cssHint: getBestCssHint(samplesAgg, 'code-block') });
  }

  // Tooltips from interactive summary
  if (report.interactiveSummary.totalTooltips > 0) {
    supported.push({ name: 'Tooltip', detectedAs: 'Tooltip elements', count: report.interactiveSummary.totalTooltips });
  }

  // Low-confidence / "possible" detections from aggregated samples
  if (samplesAgg) {
    for (const [type, agg] of Object.entries(samplesAgg)) {
      if (type === 'unknown-component') continue; // handled separately below
      // Skip types already covered above
      const alreadyCovered = supported.some(s => {
        const typeKey = type.toLowerCase();
        const nameKey = s.name.toLowerCase().replace(/ \/ /g, '/').replace(/\s/g, '');
        return typeKey === 'callout' && ['note', 'warning', 'tip', 'info', 'check', 'danger'].includes(nameKey)
          || typeKey === 'tabs' && nameKey === 'tabs'
          || typeKey === 'code-group' && nameKey === 'codegroup'
          || typeKey === 'accordion' && nameKey === 'accordion'
          || typeKey === 'card-group' && (nameKey === 'card/cardgroup' || nameKey === 'cardgroup')
          || typeKey === 'steps' && nameKey === 'steps'
          || typeKey === 'definition' && (nameKey === 'responsefield/paramfield' || nameKey === 'responsefield')
          || typeKey === 'embed' && nameKey === 'frame'
          || typeKey === 'code-block' && nameKey === 'codeblock';
      });
      if (alreadyCovered) continue;

      // Only add if this type had low-confidence detections and wasn't already reported
      if (agg.lowConfidenceCount > 0 && agg.totalCount > 0) {
        const mintlifyName = type === 'callout' ? 'Note' : type === 'tabs' ? 'Tabs' : type === 'accordion' ? 'Accordion'
          : type === 'steps' ? 'Steps' : type === 'card-group' ? 'Card / CardGroup' : type === 'code-group' ? 'CodeGroup'
          : type === 'definition' ? 'ResponseField / ParamField' : type === 'embed' ? 'Frame' : type === 'code-block' ? 'CodeBlock' : null;
        if (mintlifyName) {
          supported.push({
            name: mintlifyName,
            detectedAs: `${type} (possible)`,
            count: agg.totalCount,
            cssHint: agg.cssHints.find(h => h.startsWith('.') || h.startsWith('#')) || agg.cssHints[0],
            confidence: 'low',
          });
        }
      }
    }

    // Unknown components from samples
    const unknownAgg = samplesAgg['unknown-component'];
    if (unknownAgg && unknownAgg.totalCount > 0) {
      needsCustomBuild.push({ tag: 'unknown-component', count: unknownAgg.totalCount });
    }
  }

  // Third-party embeds need custom handling during migration
  const sc = report.specialContentSummary;
  for (const embed of sc.thirdPartyEmbeds) {
    needsCustomBuild.push({ tag: `embed:${embed.provider}`, count: embed.count });
  }
  if (sc.totalMathContent > 0) {
    needsCustomBuild.push({ tag: 'math-formulas', count: sc.totalMathContent });
  }
  if (sc.totalDiagramContent > 0) {
    needsCustomBuild.push({ tag: 'diagrams', count: sc.totalDiagramContent });
  }

  // Check custom components against Mintlify names
  const mintlifyLower = MINTLIFY_COMPONENTS.map(c => c.toLowerCase());
  for (const comp of report.customComponentsSummary) {
    const tagLower = comp.tag.toLowerCase().replace(/-/g, '');
    const match = MINTLIFY_COMPONENTS.find((_m, i) => mintlifyLower[i] === tagLower);
    if (match) {
      if (!supported.find(s => s.name === match)) {
        supported.push({ name: match, detectedAs: `<${comp.tag}>`, count: comp.count });
      }
    } else {
      needsCustomBuild.push({ tag: comp.tag, count: comp.count });
    }
  }

  const totalDetected = supported.length + needsCustomBuild.length;
  let compatibilityLevel = 'None supported';
  if (totalDetected === 0) compatibilityLevel = 'All supported'; // nothing to worry about
  else if (needsCustomBuild.length === 0) compatibilityLevel = 'All supported';
  else if (supported.length > 0) compatibilityLevel = 'Some supported';

  return { supported, needsCustomBuild, compatibilityLevel };
}

/** Extract common subpath from site URLs (e.g. /docs, /documentation) */
export function extractSubpath(sites) {
  const knownSubpaths = ['/docs', '/documentation', '/help', '/guide', '/guides', '/reference', '/api', '/learn', '/manual', '/kb'];

  for (const site of sites) {
    // Check scopePrefix first
    if (site.scopePrefix) {
      try {
        const path = new URL(site.scopePrefix).pathname;
        if (path && path !== '/') {
          return path.endsWith('/') ? path.slice(0, -1) : path;
        }
      } catch {}
    }
    // Check base URL
    try {
      const path = new URL(site.url).pathname;
      const normalized = path.endsWith('/') ? path.slice(0, -1) : path;
      if (normalized && normalized !== '') {
        const match = knownSubpaths.find(sub => normalized.startsWith(sub));
        if (match) return match;
        if (normalized !== '/') return normalized;
      }
    } catch {}
  }
  return null;
}

/** Detect if any analyzed page is a custom homepage */
export function detectCustomHomepage(sites) {
  for (const site of sites) {
    for (const page of site.analysisResults) {
      if (page.isHomepage) {
        return { has: true, url: page.url };
      }
    }
  }
  return { has: false, url: null };
}

/** Determine navigation structure type from analysis data */
export function detectNavigationStructure(sites) {
  let hasSidebar = false;
  let totalSidebarItems = 0;
  for (const site of sites) {
    for (const page of site.analysisResults) {
      if (page.sidebarItems > 0) {
        hasSidebar = true;
        totalSidebarItems += page.sidebarItems;
      }
    }
  }
  if (hasSidebar && totalSidebarItems > 5) return 'Standard sidebar';
  if (hasSidebar) return 'Needs review';
  return 'Requires custom';
}

/** Fetch and validate OpenAPI specs, returning version + endpoint count */
export async function fetchOpenApiSpecs(
  specUrls,
  baseUrl
) {
  const api = window.electronAPI;
  if (!api?.net) return [];

  const results = [];
  const urlsToCheck = specUrls.slice(0, 10); // Max 10 specs

  for (const specUrl of urlsToCheck) {
    try {
      // Resolve relative URLs
      let fullUrl;
      if (specUrl.startsWith('http')) fullUrl = specUrl;
      else {
        try { fullUrl = new URL(specUrl, baseUrl).href; } catch { continue; }
      }

      const resp = await api.net.fetchText(fullUrl);
      if (!resp.success || !resp.text) {
        results.push({ url: specUrl, valid: false, error: 'Failed to fetch' });
        continue;
      }

      const text = resp.text.trim();
      let version;
      let endpointCount = 0;

      // Try JSON parse
      try {
        const json = JSON.parse(text);
        version = json.openapi || json.swagger || undefined;
        if (json.paths) {
          // Count unique endpoints (each method on each path)
          for (const pathObj of Object.values(json.paths)) {
            if (typeof pathObj === 'object' && pathObj) {
              const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
              for (const method of methods) {
                if (pathObj[method]) endpointCount++;
              }
            }
          }
        }
        results.push({ url: specUrl, valid: true, version, endpointCount });
        continue;
      } catch {}

      // Try YAML-like extraction via regex
      const versionMatch = text.match(/^(?:openapi|swagger)\s*:\s*["']?([0-9.]+)/m);
      if (versionMatch) {
        version = versionMatch[1];
        // Count paths in YAML (lines matching /^  \/...)
        const pathMatches = text.match(/^  \/[^\s:]+:/gm);
        // Count methods under paths (lines with get:, post:, etc.)
        const methodMatches = text.match(/^\s{4,}(get|post|put|patch|delete|head|options)\s*:/gm);
        endpointCount = methodMatches ? methodMatches.length : (pathMatches ? pathMatches.length : 0);
        results.push({ url: specUrl, valid: true, version, endpointCount });
      } else {
        results.push({ url: specUrl, valid: false, error: 'Not a valid OpenAPI/Swagger spec' });
      }
    } catch (err) {
      results.push({ url: specUrl, valid: false, error: err.message || 'Unknown error' });
    }
  }

  return results;
}

/** Build the complete TypeformSummary from aggregated data */
export function buildTypeformSummary(
  sites,
  report,
  specsValidation
) {
  const { platform, confidence: platformConfidence } = detectMostCommonPlatform(sites);
  const contentFormat = inferContentFormat(platform, sites);
  const mintlifyCompat = buildMintlifyCompatibility(report, sites);
  const homepage = detectCustomHomepage(sites);
  const subpath = extractSubpath(sites);
  const navStructure = detectNavigationStructure(sites);

  // API aggregation from spec validation
  let apiEndpointsTotal = null;
  let openApiVersion = null;
  const validSpecs = specsValidation.filter(s => s.valid);
  if (validSpecs.length > 0) {
    apiEndpointsTotal = validSpecs.reduce((sum, s) => sum + (s.endpointCount || 0), 0);
    openApiVersion = validSpecs[0].version || null;
  }

  // Determine auto vs manual fields
  const autoDetectedFields = [];
  const manualInputNeeded = [];

  if (platform !== 'Unknown') autoDetectedFields.push('Platform');
  else manualInputNeeded.push('Platform');

  autoDetectedFields.push('Documentation URL', 'Pages to Migrate');

  if (contentFormat !== 'Needs full scraping') autoDetectedFields.push('Content Format');
  else manualInputNeeded.push('Content Format');

  autoDetectedFields.push('Custom Components', 'Mintlify Compatibility');

  if (homepage.has) autoDetectedFields.push('Custom Homepage');
  else manualInputNeeded.push('Custom Homepage');

  autoDetectedFields.push('Navigation Structure');

  if (subpath) autoDetectedFields.push('Custom Subpath');
  else manualInputNeeded.push('Custom Subpath');

  if (report.apiSummary.openApiSpecs.length > 0) autoDetectedFields.push('OpenAPI Specs');
  if (validSpecs.length > 0) autoDetectedFields.push('API Endpoints', 'OpenAPI Version', 'Specs Validation');
  else if (report.apiSummary.openApiSpecs.length > 0) manualInputNeeded.push('API Endpoints (specs could not be fetched)');

  // Content selector match rate
  const csStats = report.contentSelectorStats;
  const contentSelectorMatchRate = csStats?.configured ? csStats.matchRate : null;

  // Structural complexity assessment
  const complexityFlags = [];
  const pc = report.platformComponentsSummary;
  const totalComponents = pc.callouts.total + pc.tabs.total + pc.codeGroups.total
    + pc.accordions.total + pc.cards.total + pc.steps.total + pc.definitions.total + pc.embeds.total;
  const componentsPerPage = report.totalPages > 0 ? totalComponents / report.totalPages : 0;

  if (componentsPerPage > 3) complexityFlags.push(`High component density (${componentsPerPage.toFixed(1)}/page)`);
  if (report.totalPages > 500) complexityFlags.push(`Large site (${report.totalPages} pages)`);
  if (mintlifyCompat.needsCustomBuild.length > 3) complexityFlags.push(`${mintlifyCompat.needsCustomBuild.length} custom components need manual build`);
  if (report.apiSummary.openApiSpecs.length > 0 && validSpecs.length === 0) complexityFlags.push('OpenAPI specs detected but could not be validated');
  if (csStats?.configured && csStats.matchRate < 0.8) complexityFlags.push(`Content selector match rate low (${(csStats.matchRate * 100).toFixed(0)}%)`);
  if (report.contentSummary.totalCodeBlocks > report.totalPages * 2) complexityFlags.push('Code-heavy documentation');
  if (report.specialContentSummary.thirdPartyEmbeds.length > 0) complexityFlags.push(`${report.specialContentSummary.thirdPartyEmbeds.length} third-party embed types need custom handling`);
  if (report.specialContentSummary.totalMathContent > 0) complexityFlags.push('Math formulas require MathJax/KaTeX integration');
  if (report.specialContentSummary.totalDiagramContent > 0) complexityFlags.push('Diagrams require renderer integration');
  if (report.specialContentSummary.apiReferencePages > 10) complexityFlags.push(`${report.specialContentSummary.apiReferencePages} API reference pages`);

  let structuralComplexity = 'low';
  if (complexityFlags.length >= 3 || report.totalPages > 1000) structuralComplexity = 'high';
  else if (complexityFlags.length >= 1 || report.totalPages > 200) structuralComplexity = 'medium';

  if (contentSelectorMatchRate !== null) autoDetectedFields.push('Content Selector Match Rate');
  autoDetectedFields.push('Structural Complexity');
  if (report.migrationComplexity) autoDetectedFields.push('Migration Complexity');
  if (report.apiSummary.detectedTools?.length) autoDetectedFields.push('Detected API Tools');
  if (report.apiSummary.totalEndpoints) autoDetectedFields.push('Estimated API Endpoints');

  return {
    projectName: extractProjectName(sites.map(s => s.url)),
    platform,
    platformConfidence,
    documentationUrl: sites[0]?.url || '',
    pagesToMigrate: report.totalPages,
    contentFormat,

    hasCustomComponents: report.customComponentsSummary.length > 0,
    customComponentsList: report.customComponentsSummary,
    uniqueComponentsCount: report.customComponentsSummary.length,
    mintlifyCompatibility: mintlifyCompat,

    hasCustomHomepage: homepage.has,
    homepageUrl: homepage.url,
    navigationStructure: navStructure,
    customSubpath: subpath,

    hasOpenApi: report.apiSummary.openApiSpecs.length > 0,
    openApiSpecsCount: report.apiSummary.openApiSpecs.length,
    apiEndpointsTotal,
    openApiVersion,
    specsValidation,
    hasApiPlaygrounds: report.apiSummary.playgroundCount > 0,
    apiPlaygroundCount: report.apiSummary.playgroundCount,
    apiReferencePageCount: report.specialContentSummary.apiReferencePages || 0,
    apiTypes: report.apiStatus.detected ? report.apiStatus.details : [],

    contentSelectorMatchRate,
    structuralComplexity,
    complexityFlags,

    // Enhanced API fields
    detectedApiTools: report.apiSummary.detectedTools?.map(t => t.toolType),
    apiAuthMethods: report.apiSummary.authMethods,
    estimatedApiEndpoints: report.apiSummary.totalEndpoints,
    apiPagePercentage: report.totalPages > 0
      ? Math.round(((report.specialContentSummary.apiReferencePages || 0) / report.totalPages) * 1000) / 10
      : 0,

    // Migration complexity fields
    migrationComplexityScore: report.migrationComplexity?.score,
    migrationComplexityLevel: report.migrationComplexity?.level,

    autoDetectedFields,
    manualInputNeeded,
  };
}

/** Format TypeformSummary as copiable text */
export function formatTypeformSummaryAsText(summary) {
  const lines = [];

  lines.push('MIGRATION SCOPING - AUTO-FILL');
  lines.push('==============================');
  lines.push('');

  lines.push('Section 1: Basic Scope');
  lines.push('------------------------------');
  lines.push(`  Project Name: ${summary.projectName}`);
  lines.push(`  Platform: ${summary.platform} (${summary.platformConfidence} confidence)`);
  lines.push(`  Documentation URL: ${summary.documentationUrl}`);
  lines.push(`  Pages to Migrate: ${summary.pagesToMigrate}`);
  lines.push(`  Content Format: ${summary.contentFormat}`);
  lines.push('');

  lines.push('Section 2: Custom Components');
  lines.push('------------------------------');
  lines.push(`  Has Custom Components: ${summary.hasCustomComponents ? 'Yes' : 'No'}`);
  if (summary.hasCustomComponents) {
    lines.push(`  Unique Component Types: ${summary.uniqueComponentsCount}`);
    lines.push(`  Components: ${summary.customComponentsList.map(c => `<${c.tag}> (${c.count})`).join(', ')}`);
  }
  lines.push(`  Mintlify Compatibility: ${summary.mintlifyCompatibility.compatibilityLevel}`);
  if (summary.mintlifyCompatibility.supported.length > 0) {
    lines.push(`    Supported:`);
    for (const s of summary.mintlifyCompatibility.supported) {
      const cssTag = s.cssHint ? ` [${s.cssHint}]` : '';
      const possibleTag = s.confidence === 'low' ? ' (possible)' : '';
      lines.push(`      - ${s.name} (${s.count})${cssTag}${possibleTag}`);
    }
  }
  if (summary.mintlifyCompatibility.needsCustomBuild.length > 0) {
    lines.push(`    Needs Custom Build: ${summary.mintlifyCompatibility.needsCustomBuild.map(c => `<${c.tag}> (${c.count})`).join(', ')}`);
  }
  lines.push('');

  lines.push('Section 3: Homepage & Navigation');
  lines.push('------------------------------');
  lines.push(`  Custom Homepage: ${summary.hasCustomHomepage ? 'Yes' : 'No'}${summary.homepageUrl ? ` (${summary.homepageUrl})` : ''}`);
  lines.push(`  Navigation Structure: ${summary.navigationStructure}`);
  lines.push(`  Custom Subpath: ${summary.customSubpath || 'None'}`);
  lines.push('');

  lines.push('Section 4: API Documentation');
  lines.push('------------------------------');
  lines.push(`  Has OpenAPI: ${summary.hasOpenApi ? 'Yes' : 'No'}`);
  if (summary.hasOpenApi) {
    lines.push(`  OpenAPI Specs Count: ${summary.openApiSpecsCount}`);
    if (summary.apiEndpointsTotal !== null) lines.push(`  API Endpoints Total: ${summary.apiEndpointsTotal}`);
    if (summary.openApiVersion) lines.push(`  OpenAPI Version: ${summary.openApiVersion}`);
    if (summary.specsValidation.length > 0) {
      lines.push('  Specs Validation:');
      for (const spec of summary.specsValidation) {
        const status = spec.valid ? `Valid (v${spec.version || '?'}, ${spec.endpointCount || 0} endpoints)` : `Invalid: ${spec.error}`;
        lines.push(`    - ${spec.url}: ${status}`);
      }
    }
  }
  lines.push(`  Has API Playgrounds: ${summary.hasApiPlaygrounds ? 'Yes' : 'No'}`);
  if (summary.hasApiPlaygrounds) {
    lines.push(`  Playground Widgets: ${summary.apiPlaygroundCount}`);
  }
  if (summary.apiReferencePageCount > 0) {
    lines.push(`  API Reference Pages: ${summary.apiReferencePageCount}`);
  }
  if (summary.apiTypes.length > 0) {
    lines.push(`  Detected API Types: ${summary.apiTypes.join('; ')}`);
  }
  if (summary.detectedApiTools && summary.detectedApiTools.length > 0) {
    lines.push(`  Detected API Tools: ${summary.detectedApiTools.join(', ')}`);
  }
  if (summary.apiAuthMethods && summary.apiAuthMethods.length > 0) {
    lines.push(`  API Auth Methods: ${summary.apiAuthMethods.join(', ')}`);
  }
  if (summary.estimatedApiEndpoints) {
    lines.push(`  Estimated API Endpoints: ${summary.estimatedApiEndpoints}`);
  }
  if (summary.apiPagePercentage !== undefined && summary.apiPagePercentage > 0) {
    lines.push(`  API Page Percentage: ${summary.apiPagePercentage}%`);
  }
  lines.push('');

  lines.push('Section 5: Quality Metrics');
  lines.push('------------------------------');
  lines.push(`  Structural Complexity: ${summary.structuralComplexity}`);
  if (summary.contentSelectorMatchRate !== null) {
    lines.push(`  Content Selector Match Rate: ${(summary.contentSelectorMatchRate * 100).toFixed(0)}%`);
  }
  if (summary.migrationComplexityScore !== undefined) {
    lines.push(`  Migration Complexity Score: ${summary.migrationComplexityScore}/100 (${summary.migrationComplexityLevel})`);
  }
  if (summary.complexityFlags.length > 0) {
    lines.push('  Complexity Flags:');
    for (const flag of summary.complexityFlags) {
      lines.push(`    - ${flag}`);
    }
  }
  lines.push('');

  lines.push('------------------------------');
  lines.push(`Auto-detected: ${summary.autoDetectedFields.join(', ')}`);
  if (summary.manualInputNeeded.length > 0) {
    lines.push(`Needs manual input: ${summary.manualInputNeeded.join(', ')}`);
  }

  // Quick-reference typeform answers section
  lines.push('');
  lines.push('');
  lines.push('=== TYPEFORM ANSWERS ===');
  lines.push(`Q1 Project Name: ${summary.projectName}`);
  lines.push(`Q2 Platform: ${summary.platform}`);
  lines.push(`Q3 URL: ${summary.documentationUrl}`);
  lines.push(`Q4 Pages: ${summary.pagesToMigrate}`);
  lines.push(`Q5 Format: ${summary.contentFormat}`);
  lines.push(`Q6 Custom Components: ${summary.hasCustomComponents ? 'Yes' : 'No'}`);
  if (summary.hasCustomComponents) {
    const compList = summary.customComponentsList.map(c => `<${c.tag}> (${c.count})`).join(', ');
    lines.push(`Q7 Component List: ${compList}`);
  }
  lines.push(`Q8 Unique Components: ${summary.uniqueComponentsCount}`);
  lines.push(`Q9 Compatibility: ${summary.mintlifyCompatibility.compatibilityLevel}`);
  lines.push(`Q10 Custom Homepage: ${summary.hasCustomHomepage ? 'Yes' : 'No'}`);
  lines.push(`Q12 Navigation: ${summary.navigationStructure}`);
  lines.push(`Q14 Subpath: ${summary.customSubpath || 'None'}`);
  lines.push(`Q15 OpenAPI: ${summary.hasOpenApi ? 'Yes' : 'No'}`);
  if (summary.hasOpenApi) {
    lines.push(`Q16 Specs: ${summary.openApiSpecsCount}`);
    if (summary.apiEndpointsTotal !== null) lines.push(`Q17 Endpoints: ${summary.apiEndpointsTotal}`);
    if (summary.openApiVersion) lines.push(`Q18 Version: ${summary.openApiVersion}`);
  }
  lines.push(`API Playgrounds: ${summary.hasApiPlaygrounds ? `Yes (${summary.apiPlaygroundCount} widgets)` : 'No'}`);
  if (summary.apiReferencePageCount > 0) {
    lines.push(`API Reference Pages: ${summary.apiReferencePageCount}`);
  }
  if (summary.detectedApiTools && summary.detectedApiTools.length > 0) {
    lines.push(`API Tools: ${summary.detectedApiTools.join(', ')}`);
  }
  if (summary.estimatedApiEndpoints) {
    lines.push(`Estimated Endpoints: ${summary.estimatedApiEndpoints}`);
  }
  if (summary.migrationComplexityScore !== undefined) {
    lines.push(`Migration Complexity: ${summary.migrationComplexityScore}/100 (${summary.migrationComplexityLevel})`);
  }

  return lines.join('\n');
}
