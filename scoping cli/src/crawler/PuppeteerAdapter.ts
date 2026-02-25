import puppeteer, { Browser, Page } from "puppeteer";
import {
  generateNavExpansionScript,
  generateCategoryDiscoveryScript,
  generatePageAnalysisScript,
} from "../../../src/renderer/utils/scopingScripts.js";
import type { ScopingCategory, ScopingPageAnalysis } from "../types.js";

export interface PuppeteerOptions {
  concurrency: number;
  headless: boolean;
  auth?: { username: string; password: string };
}

interface CategoryDiscoveryResult {
  categories: ScopingCategory[];
  allUrls: string[];
  detectedContentSelector: string | null;
}

interface NavExpandedResult {
  expanded: number;
  reason?: string;
}

export class PuppeteerAdapter {
  private browser: Browser | null = null;
  private pages: Page[] = [];

  constructor(private options: PuppeteerOptions) {}

  async launch(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: this.options.headless,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    // Create a pool of pages for concurrent crawling
    this.pages = [];
    for (let i = 0; i < this.options.concurrency; i++) {
      const page = await this.browser.newPage();

      // Set up HTTP Basic auth if provided
      if (this.options.auth) {
        await page.authenticate({
          username: this.options.auth.username,
          password: this.options.auth.password,
        });
      }

      // Set a reasonable viewport and user agent
      await page.setViewport({ width: 1280, height: 900 });

      this.pages.push(page);
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.pages = [];
    }
  }

  /**
   * Execute a script that emits its result via console.log('PREFIX:' + JSON.stringify(data)).
   * This mirrors how the Electron webview captures results from injected scripts.
   *
   * The scoping scripts are IIFEs that run in the page context and log results
   * with a known prefix. We listen on page console events to capture the output.
   */
  private async executeScriptViaConsole<T>(
    page: Page,
    script: string,
    prefix: string,
    timeoutMs: number = 15000,
  ): Promise<T | null> {
    return new Promise<T | null>((resolve) => {
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          page.off("console", onConsole);
          resolve(null);
        }
      }, timeoutMs);

      const onConsole = (msg: import("puppeteer").ConsoleMessage) => {
        if (settled) return;
        const text = msg.text();
        if (text.startsWith(prefix)) {
          settled = true;
          clearTimeout(timer);
          page.off("console", onConsole);
          try {
            const json = text.substring(prefix.length);
            resolve(JSON.parse(json) as T);
          } catch {
            resolve(null);
          }
        }
      };

      page.on("console", onConsole);

      // Scripts are IIFE strings. Wrap in an eval so they execute in the page context.
      // Using page.evaluate with new Function avoids template-literal escaping issues.
      page.evaluate((s: string) => {
        // eslint-disable-next-line no-eval
        eval(s);
      }, script).catch(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          page.off("console", onConsole);
          resolve(null);
        }
      });
    });
  }

  /**
   * Navigate a page to a URL and wait for it to be reasonably loaded.
   */
  private async navigateTo(page: Page, url: string): Promise<boolean> {
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Discover navigation categories and all internal links from a documentation site's base page.
   *
   * This mirrors the Electron flow:
   * 1. Navigate to the URL
   * 2. Run nav expansion script (expand collapsed sidebar items)
   * 3. Run category discovery script (extract nav structure + all links)
   */
  async discoverCategories(
    page: Page,
    url: string,
    scopePrefix?: string,
  ): Promise<CategoryDiscoveryResult | null> {
    const loaded = await this.navigateTo(page, url);
    if (!loaded) return null;

    // Step 1: Expand collapsed navigation
    const navScript = generateNavExpansionScript();
    const navResult = await this.executeScriptViaConsole<NavExpandedResult>(
      page,
      navScript,
      "SCOPING_NAV_EXPANDED:",
      5000,
    );

    // If nav expansion times out or fails, proceed anyway (mirrors Electron behavior)
    if (navResult) {
      // Small delay to let DOM settle after expansion clicks
      await new Promise((r) => setTimeout(r, 300));
    }

    // Step 2: Discover categories and links
    const discoveryScript = generateCategoryDiscoveryScript(url, scopePrefix);
    const result = await this.executeScriptViaConsole<{
      categories: ScopingCategory[];
      allUrls: string[];
      detectedContentSelector: string | null;
      error?: string;
    }>(page, discoveryScript, "SCOPING_CATEGORIES:", 15000);

    if (!result) return null;

    return {
      categories: result.categories || [],
      allUrls: result.allUrls || [],
      detectedContentSelector: result.detectedContentSelector || null,
    };
  }

  /**
   * Analyze a single page for content metrics, components, and discovered links.
   *
   * This mirrors the Electron Phase 2 flow:
   * 1. Navigate to the URL
   * 2. Run page analysis script
   * 3. Parse the SCOPING_ANALYSIS console output
   */
  async analyzePage(
    page: Page,
    url: string,
    baseUrl: string,
    scopePrefix: string,
    contentSelector?: string,
  ): Promise<ScopingPageAnalysis | null> {
    const loaded = await this.navigateTo(page, url);
    if (!loaded) return null;

    const analysisScript = generatePageAnalysisScript(
      baseUrl,
      scopePrefix,
      contentSelector,
    );
    const data = await this.executeScriptViaConsole<Record<string, unknown>>(
      page,
      analysisScript,
      "SCOPING_ANALYSIS:",
      15000,
    );

    if (!data) return null;

    // Build the ScopingPageAnalysis, mirroring exactly how ScopingCrawler.tsx assembles it
    // (see ScopingCrawler.tsx lines 2050-2097 for the exact field mapping)
    const analysis: ScopingPageAnalysis = {
      url,
      title: (data.title as string) || "",
      category: "", // Category is assigned by the caller based on URL matching
      videos: (data.videos as any) || [],
      externalLinks: (data.externalLinks as any) || [],
      apiRefs: (data.apiRefs as string[]) || [],
      customComponents: (data.customComponents as any) || [],
      discoveredLinks: (data.discoveredLinks as string[]) || [],
      wordCount: (data.wordCount as number) || 0,
      headings: (data.headings as any) || { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
      codeBlocks: (data.codeBlocks as any) || { count: 0, languages: [] },
      tables: (data.tables as any) || { count: 0, totalRows: 0 },
      images: (data.images as any) || { count: 0, external: 0 },
      lists: (data.lists as any) || { ordered: 0, unordered: 0 },
      tabs: (data.tabs as number) || 0,
      accordions: (data.accordions as number) || 0,
      downloadLinks: (data.downloadLinks as any) || { count: 0, extensions: [] },
      forms: (data.forms as number) || 0,
      iframes: (data.iframes as number) || 0,
      tooltips: (data.tooltips as number) || 0,
      openApiSpecs: (data.openApiSpecs as any) || [],
      apiPlaygrounds: (data.apiPlaygrounds as number) || 0,
      graphqlExplorers: (data.graphqlExplorers as number) || 0,
      breadcrumbDepth: (data.breadcrumbDepth as number) || 0,
      sidebarItems: (data.sidebarItems as number) || 0,
      hasPagination: (data.hasPagination as boolean) || false,
      hasLanguageSwitcher: (data.hasLanguageSwitcher as boolean) || false,
      platform: (data.platform as any) || undefined,
      contentFormat: (data.contentFormat as any) || undefined,
      isHomepage: (data.isHomepage as boolean) || false,
      // Critical component fields - must match app exactly
      platformComponents: (data.platformComponents as any) || undefined,
      migrationComponents: (data.migrationComponents as any) || undefined,
      componentSamples: (data.componentSamples as any) || undefined,
      contentComponents: (data.contentComponents as any) || undefined,
      uniqueSelectors: (data.uniqueSelectors as any) || undefined,
      contentSelectorFound: (data.contentSelectorFound as boolean) || false,
      specialContent: (data.specialContent as any) || undefined,
      isApiReferencePage: (data.isApiReferencePage as boolean) || false,
      playgroundTypes: (data.playgroundTypes as any) || undefined,
      apiDocDetails: (data.apiDocDetails as any) || undefined,
      detectedApiSpecs: (data.detectedApiSpecs as any) || undefined,
      apiEndpoints: (data.apiEndpoints as any) || undefined,
      apiType: (data.apiType as any) || undefined,
      apiConfidenceScore: (data.apiConfidenceScore as any) || undefined,
      interactiveWidgets: (data.interactiveWidgets as any) || undefined,
      detectionQuality: "full" as const,
      analysisMethod: "webview" as const,
    };

    return analysis;
  }

  getPage(index: number): Page {
    if (index < 0 || index >= this.pages.length) {
      throw new Error(
        `Page index ${index} out of range (0-${this.pages.length - 1})`,
      );
    }
    return this.pages[index];
  }

  get pageCount(): number {
    return this.pages.length;
  }
}
