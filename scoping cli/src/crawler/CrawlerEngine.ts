/**
 * CrawlerEngine - Orchestrates the full scoping workflow for documentation sites.
 *
 * For each URL:
 * 1. Launch Puppeteer, navigate, capture final URL after redirects
 * 2. Compute effective scope prefix from final URL
 * 3. Discover URLs from sitemaps and page navigation
 * 4. BFS analysis with concurrent workers
 * 5. Build ScopingSite, generate and output report
 */

import { PuppeteerAdapter } from "./PuppeteerAdapter.js";
import { UrlQueue } from "./UrlQueue.js";
import {
  normalizeUrl,
  isNonDocUrl,
  computeScopePrefix,
  labelFromUrl,
  getOrigin,
} from "./UrlUtils.js";
import { HttpFetcher } from "./HttpFetcher.js";
import { discoverFromSitemaps, fetchLinksFromHtml } from "./SitemapDiscovery.js";
import { analyzeHtmlContent } from "./HtmlAnalyzer.js";
import { isDocPage, pruneAnalysis } from "./PageClassifier.js";
import {
  generateReport,
  formatReportAsText,
  buildTypeformSummary,
  formatTypeformSummaryAsText,
} from "../report/ReportGenerator.js";
import { ProgressReporter } from "../progress/ProgressReporter.js";
import type {
  CliOptions,
  ScopingSite,
  ScopingPageAnalysis,
  ScopingCategory,
} from "../types.js";
import * as fs from "node:fs";
import * as path from "node:path";

export class CrawlerEngine {
  private adapter: PuppeteerAdapter;
  private httpFetcher: HttpFetcher;
  private progress: ProgressReporter;
  private aborted = false;

  constructor(private options: CliOptions) {
    const authParts = options.auth?.split(":") ?? [];
    const username = authParts[0];
    const password = authParts.slice(1).join(":");

    this.adapter = new PuppeteerAdapter({
      concurrency: options.concurrency,
      headless: options.headless,
      auth: username && password ? { username, password } : undefined,
    });

    this.httpFetcher = new HttpFetcher({
      username: username || undefined,
      password: password || undefined,
    });

    this.progress = new ProgressReporter({
      verbose: options.verbose,
      quiet: options.quiet,
    });
  }

  async run(urls: string[]): Promise<void> {
    const startTime = Date.now();

    // SIGINT graceful shutdown
    const onSigint = () => {
      this.aborted = true;
      this.progress.warn("Received SIGINT, finishing current pages...");
    };
    process.on("SIGINT", onSigint);

    try {
      await this.adapter.launch();
      this.progress.debug(
        `Browser launched with ${this.adapter.pageCount} page(s)`,
      );

      const sites: ScopingSite[] = [];

      for (const inputUrl of urls) {
        if (this.aborted) break;

        const site = await this.processSite(inputUrl);
        if (site) sites.push(site);
      }

      // Generate report
      this.progress.update({
        phase: "reporting",
        currentSite: "",
        pagesDiscovered: 0,
        pagesAnalyzed: 0,
        totalPages: 0,
        errors: 0,
      });

      const report = generateReport(sites);

      // Build Typeform summary (same as app does)
      const typeformSummary = buildTypeformSummary(sites, report, []);

      // Output
      if (this.options.format === "text") {
        // Match app output: full report text + typeform summary
        const reportText = formatReportAsText(report);
        const typeformText = formatTypeformSummaryAsText(typeformSummary);
        const fullText = reportText + "\n\n" + typeformText;

        if (this.options.output) {
          const outPath = this.options.output.replace(/\.json$/, ".txt");
          this.ensureOutputDir(outPath);
          fs.writeFileSync(outPath, fullText, "utf-8");
          this.progress.succeed(`Report saved to ${outPath}`);
        } else {
          this.progress.stop();
          console.log(fullText);
        }
      } else {
        const outputData = { report, typeformSummary };
        const json = JSON.stringify(outputData, null, 2);
        if (this.options.output) {
          this.ensureOutputDir(this.options.output);
          fs.writeFileSync(this.options.output, json, "utf-8");
          this.progress.succeed(`Report saved to ${this.options.output}`);
        } else {
          this.progress.stop();
          console.log(json);
        }
      }

      // Summary - count platform components + custom components (like the app does)
      let totalComponents = 0;
      for (const site of sites) {
        for (const page of site.analysisResults) {
          totalComponents += page.customComponents?.length || 0;
          if (page.platformComponents) {
            const pc = page.platformComponents as Record<string, any>;
            for (const key of Object.keys(pc)) {
              if (pc[key] && typeof pc[key].total === 'number') {
                totalComponents += pc[key].total;
              }
            }
          }
        }
      }
      this.progress.printSummary({
        sites: sites.length,
        totalPages: sites.reduce((s, site) => s + site.analysisResults.length, 0),
        totalComponents,
        duration: Date.now() - startTime,
      });
    } finally {
      process.off("SIGINT", onSigint);
      await this.adapter.close();
    }
  }

  /**
   * Process a single site: discover URLs, analyze pages, return ScopingSite.
   */
  private async processSite(inputUrl: string): Promise<ScopingSite | null> {
    const siteLabel = labelFromUrl(inputUrl);
    this.progress.start(`Processing ${siteLabel}...`);

    // Step 1: Navigate to capture final URL after redirects
    const page0 = this.adapter.getPage(0);
    let finalUrl: string;
    try {
      await page0.goto(inputUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      finalUrl = page0.url();
    } catch (err) {
      this.progress.fail(`Failed to load ${inputUrl}`);
      this.progress.debug(
        `Navigation error: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }

    // Step 2: Compute effective scope prefix
    const effectiveScopePrefix =
      this.options.scopePrefix || computeScopePrefix(finalUrl);
    const siteOrigin = getOrigin(finalUrl);

    this.progress.debug(`Final URL: ${finalUrl}`);
    this.progress.debug(`Scope prefix: ${effectiveScopePrefix}`);

    // Step 3: URL Discovery
    this.progress.update({
      phase: "discovering",
      currentSite: siteLabel,
      pagesDiscovered: 0,
      pagesAnalyzed: 0,
      totalPages: 0,
      errors: 0,
    });

    const queue = new UrlQueue();
    queue.add(finalUrl);

    // 3a. Sitemap discovery
    const sitemapUrls = await discoverFromSitemaps(
      siteOrigin,
      effectiveScopePrefix,
      this.httpFetcher,
      (msg) => this.progress.debug(msg),
    );
    queue.addAll(sitemapUrls);
    this.progress.debug(`Sitemap discovery added ${sitemapUrls.length} URLs`);

    // 3b. Category discovery via Puppeteer (uses page0 which is already on the site)
    const catResult = await this.adapter.discoverCategories(
      page0,
      finalUrl,
      effectiveScopePrefix,
    );

    let categories: ScopingCategory[] = [];
    let detectedContentSelector = this.options.contentSelector;

    if (catResult) {
      categories = catResult.categories;
      const navUrls = catResult.allUrls.filter(
        (u) =>
          normalizeUrl(u).startsWith(effectiveScopePrefix) && !isNonDocUrl(u),
      );
      queue.addAll(navUrls);
      this.progress.debug(
        `Category discovery found ${categories.length} categories, ${navUrls.length} URLs`,
      );
      if (!detectedContentSelector && catResult.detectedContentSelector) {
        detectedContentSelector = catResult.detectedContentSelector;
      }
    }

    // 3c. Also try HTML-based link extraction as fallback
    const htmlLinks = await fetchLinksFromHtml(
      finalUrl,
      effectiveScopePrefix,
      this.httpFetcher,
      (msg) => this.progress.debug(msg),
    );
    queue.addAll(htmlLinks);

    this.progress.update({
      phase: "discovering",
      currentSite: siteLabel,
      pagesDiscovered: queue.totalSeen,
      pagesAnalyzed: 0,
      totalPages: queue.totalSeen,
      errors: 0,
    });
    this.progress.debug(`Total discovered URLs: ${queue.totalSeen}`);

    // Step 4: BFS analysis with concurrent workers
    const analysisResults: ScopingPageAnalysis[] = [];
    let errors = 0;
    let skippedNonDocCount = 0;
    let skippedUrlCount = 0;
    let activeWorkers = 0;
    const maxPages = this.options.maxPages;

    const processUrl = async (workerIdx: number, url: string): Promise<void> => {
      this.progress.update({
        phase: "analyzing",
        currentSite: siteLabel,
        currentUrl: url,
        pagesDiscovered: queue.totalSeen,
        pagesAnalyzed: analysisResults.length,
        totalPages: Math.min(queue.totalSeen, maxPages),
        errors,
      });

      let analysis: ScopingPageAnalysis | null = null;

      // Try Puppeteer first
      try {
        const workerPage = this.adapter.getPage(workerIdx);
        analysis = await this.adapter.analyzePage(
          workerPage,
          url,
          finalUrl,
          effectiveScopePrefix,
          detectedContentSelector,
        );
      } catch (err) {
        this.progress.debug(
          `Puppeteer failed for ${url}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      // HTTP fallback if Puppeteer fails
      if (!analysis) {
        try {
          const fetchResult = await this.httpFetcher.fetchText(url);
          if (fetchResult.success && fetchResult.text) {
            const partial = analyzeHtmlContent(
              fetchResult.text,
              url,
              effectiveScopePrefix,
              detectedContentSelector,
            );
            // Extract links from raw HTML for discovery
            const linkMatches = fetchResult.text.matchAll(
              /href=["']([^"'#]+?)["']/gi,
            );
            const discoveredLinks: string[] = [];
            for (const m of linkMatches) {
              try {
                let href = m[1];
                if (
                  !href ||
                  href.startsWith("javascript:") ||
                  href.startsWith("mailto:")
                )
                  continue;
                const full = href.startsWith("http")
                  ? href
                  : new URL(href, url).href;
                if (getOrigin(full) === siteOrigin) {
                  discoveredLinks.push(full);
                }
              } catch {
                // skip invalid URLs
              }
            }

            analysis = {
              url,
              title: partial.title || "",
              category: "",
              videos: partial.videos || [],
              externalLinks: partial.externalLinks || [],
              apiRefs: partial.apiRefs || [],
              customComponents: partial.customComponents || [],
              discoveredLinks,
              wordCount: partial.wordCount || 0,
              headings: partial.headings || {
                h1: 0,
                h2: 0,
                h3: 0,
                h4: 0,
                h5: 0,
                h6: 0,
              },
              codeBlocks: partial.codeBlocks || { count: 0, languages: [] },
              tables: partial.tables || { count: 0, totalRows: 0 },
              images: partial.images || { count: 0, external: 0 },
              lists: partial.lists || { ordered: 0, unordered: 0 },
              tabs: partial.tabs || 0,
              accordions: partial.accordions || 0,
              downloadLinks: partial.downloadLinks || {
                count: 0,
                extensions: [],
              },
              forms: partial.forms || 0,
              iframes: partial.iframes || 0,
              tooltips: partial.tooltips || 0,
              openApiSpecs: partial.openApiSpecs || [],
              apiPlaygrounds: partial.apiPlaygrounds || 0,
              graphqlExplorers: partial.graphqlExplorers || 0,
              breadcrumbDepth: partial.breadcrumbDepth || 0,
              sidebarItems: partial.sidebarItems || 0,
              hasPagination: partial.hasPagination || false,
              hasLanguageSwitcher: partial.hasLanguageSwitcher || false,
              platform: partial.platform,
              contentFormat: partial.contentFormat,
              isHomepage: partial.isHomepage || false,
              platformComponents: partial.platformComponents,
              componentSamples: partial.componentSamples,
              contentComponents: partial.contentComponents,
              uniqueSelectors: partial.uniqueSelectors,
              contentSelectorFound: partial.contentSelectorFound || false,
              specialContent: partial.specialContent,
              isApiReferencePage: partial.isApiReferencePage || false,
              playgroundTypes: partial.playgroundTypes,
              apiDocDetails: partial.apiDocDetails,
              detectedApiSpecs: partial.detectedApiSpecs,
              apiEndpoints: partial.apiEndpoints,
              apiType: partial.apiType,
              apiConfidenceScore: partial.apiConfidenceScore,
              interactiveWidgets: partial.interactiveWidgets,
              detectionQuality: "partial" as const,
              analysisMethod: "http-fallback" as const,
            };
          }
        } catch (err) {
          this.progress.debug(
            `HTTP fallback failed for ${url}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      if (!analysis) {
        errors++;
        return;
      }

      // Check if this is a doc page
      if (
        !isDocPage(analysis, detectedContentSelector)
      ) {
        skippedNonDocCount++;
        // Still extract links for discovery even if it's not a doc page
        this.addDiscoveredLinks(
          queue,
          analysis.discoveredLinks,
          effectiveScopePrefix,
          siteOrigin,
        );
        return;
      }

      // Assign category based on URL matching
      analysis.category = this.assignCategory(url, categories);

      // Feed discovered links into queue
      this.addDiscoveredLinks(
        queue,
        analysis.discoveredLinks,
        effectiveScopePrefix,
        siteOrigin,
      );

      // Prune and store
      analysisResults.push(pruneAnalysis(analysis));
    };

    // Concurrent worker loop
    const workerCount = this.adapter.pageCount;
    const workers: Promise<void>[] = [];

    for (let w = 0; w < workerCount; w++) {
      workers.push(
        (async () => {
          while (!this.aborted && analysisResults.length < maxPages) {
            const url = queue.next();
            if (!url) {
              // Wait briefly for in-flight analyses to discover new URLs
              await new Promise((r) => setTimeout(r, 500));
              if (queue.isEmpty && activeWorkers <= 1) break;
              continue;
            }

            // Skip non-doc URLs
            if (isNonDocUrl(url)) {
              skippedUrlCount++;
              continue;
            }

            activeWorkers++;
            try {
              await processUrl(w, url);
            } catch (err) {
              errors++;
              this.progress.debug(
                `Worker ${w} error: ${err instanceof Error ? err.message : String(err)}`,
              );
            } finally {
              activeWorkers--;
            }
          }
        })(),
      );
    }

    await Promise.all(workers);

    // Build the ScopingSite
    const site: ScopingSite = {
      id: siteLabel,
      url: finalUrl,
      label: siteLabel,
      scopePrefix: effectiveScopePrefix,
      contentSelector: detectedContentSelector,
      status: this.aborted ? "error" : "done",
      discoveredUrls: queue.getAllSeen(),
      categories,
      analysisResults,
      skippedUrlCount,
      skippedNonDocCount,
    };

    this.progress.succeed(
      `${siteLabel}: ${analysisResults.length} pages analyzed, ${skippedNonDocCount} skipped, ${errors} errors`,
    );

    return site;
  }

  /**
   * Add discovered links to the queue, filtering by scope and non-doc patterns.
   */
  private addDiscoveredLinks(
    queue: UrlQueue,
    links: string[],
    scopePrefix: string,
    siteOrigin: string,
  ): void {
    for (const link of links) {
      const normalized = normalizeUrl(link);
      if (!normalized.startsWith(scopePrefix)) continue;
      if (getOrigin(normalized) !== siteOrigin) continue;
      if (isNonDocUrl(normalized)) continue;
      queue.add(normalized);
    }
  }

  /**
   * Assign a category to a URL based on the discovered categories.
   */
  private assignCategory(url: string, categories: ScopingCategory[]): string {
    const normalized = normalizeUrl(url);
    for (const cat of categories) {
      for (const catUrl of cat.urls) {
        if (normalizeUrl(catUrl) === normalized) {
          return cat.name;
        }
      }
    }
    return "Uncategorized";
  }

  /**
   * Ensure the output directory exists.
   */
  private ensureOutputDir(filePath: string): void {
    const dir = path.dirname(filePath);
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
