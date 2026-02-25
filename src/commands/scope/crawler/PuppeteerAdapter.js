/**
 * Puppeteer browser pool management for concurrent page analysis.
 */

import puppeteer from "puppeteer";
import {
  generateNavExpansionScript,
  generateCategoryDiscoveryScript,
  generatePageAnalysisScript,
} from "./scopingScripts.js";

export class PuppeteerAdapter {
  #browser = null;
  #pages = [];
  #options;

  constructor(options) {
    this.#options = options;
  }

  async launch() {
    this.#browser = await puppeteer.launch({
      headless: this.#options.headless,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    this.#pages = [];
    for (let i = 0; i < this.#options.concurrency; i++) {
      const page = await this.#browser.newPage();

      if (this.#options.auth) {
        await page.authenticate({
          username: this.#options.auth.username,
          password: this.#options.auth.password,
        });
      }

      await page.setViewport({ width: 1280, height: 900 });
      this.#pages.push(page);
    }
  }

  async close() {
    if (this.#browser) {
      await this.#browser.close();
      this.#browser = null;
      this.#pages = [];
    }
  }

  /**
   * Execute a script that emits its result via console.log('PREFIX:' + JSON.stringify(data)).
   */
  async #executeScriptViaConsole(page, script, prefix, timeoutMs = 15000) {
    return new Promise((resolve) => {
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          page.off("console", onConsole);
          resolve(null);
        }
      }, timeoutMs);

      const onConsole = (msg) => {
        if (settled) return;
        const text = msg.text();
        if (text.startsWith(prefix)) {
          settled = true;
          clearTimeout(timer);
          page.off("console", onConsole);
          try {
            const json = text.substring(prefix.length);
            resolve(JSON.parse(json));
          } catch {
            resolve(null);
          }
        }
      };

      page.on("console", onConsole);

      page
        .evaluate((s) => {
          // eslint-disable-next-line no-eval
          eval(s);
        }, script)
        .catch(() => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            page.off("console", onConsole);
            resolve(null);
          }
        });
    });
  }

  async #navigateTo(page, url) {
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
   */
  async discoverCategories(page, url, scopePrefix) {
    const loaded = await this.#navigateTo(page, url);
    if (!loaded) return null;

    // Step 1: Expand collapsed navigation
    const navScript = generateNavExpansionScript();
    const navResult = await this.#executeScriptViaConsole(page, navScript, "SCOPING_NAV_EXPANDED:", 5000);

    if (navResult) {
      await new Promise((r) => setTimeout(r, 300));
    }

    // Step 2: Discover categories and links
    const discoveryScript = generateCategoryDiscoveryScript(url, scopePrefix);
    const result = await this.#executeScriptViaConsole(page, discoveryScript, "SCOPING_CATEGORIES:", 15000);

    if (!result) return null;

    return {
      categories: result.categories || [],
      allUrls: result.allUrls || [],
      detectedContentSelector: result.detectedContentSelector || null,
    };
  }

  /**
   * Analyze a single page for content metrics, components, and discovered links.
   */
  async analyzePage(page, url, baseUrl, scopePrefix, contentSelector) {
    const loaded = await this.#navigateTo(page, url);
    if (!loaded) return null;

    const analysisScript = generatePageAnalysisScript(baseUrl, scopePrefix, contentSelector);
    const data = await this.#executeScriptViaConsole(page, analysisScript, "SCOPING_ANALYSIS:", 15000);

    if (!data) return null;

    return {
      url,
      title: data.title || "",
      category: "",
      videos: data.videos || [],
      externalLinks: data.externalLinks || [],
      apiRefs: data.apiRefs || [],
      customComponents: data.customComponents || [],
      discoveredLinks: data.discoveredLinks || [],
      wordCount: data.wordCount || 0,
      headings: data.headings || { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
      codeBlocks: data.codeBlocks || { count: 0, languages: [] },
      tables: data.tables || { count: 0, totalRows: 0 },
      images: data.images || { count: 0, external: 0 },
      lists: data.lists || { ordered: 0, unordered: 0 },
      tabs: data.tabs || 0,
      accordions: data.accordions || 0,
      downloadLinks: data.downloadLinks || { count: 0, extensions: [] },
      forms: data.forms || 0,
      iframes: data.iframes || 0,
      tooltips: data.tooltips || 0,
      openApiSpecs: data.openApiSpecs || [],
      apiPlaygrounds: data.apiPlaygrounds || 0,
      graphqlExplorers: data.graphqlExplorers || 0,
      breadcrumbDepth: data.breadcrumbDepth || 0,
      sidebarItems: data.sidebarItems || 0,
      hasPagination: data.hasPagination || false,
      hasLanguageSwitcher: data.hasLanguageSwitcher || false,
      platform: data.platform || undefined,
      contentFormat: data.contentFormat || undefined,
      isHomepage: data.isHomepage || false,
      platformComponents: data.platformComponents || undefined,
      migrationComponents: data.migrationComponents || undefined,
      componentSamples: data.componentSamples || undefined,
      contentComponents: data.contentComponents || undefined,
      uniqueSelectors: data.uniqueSelectors || undefined,
      contentSelectorFound: data.contentSelectorFound || false,
      specialContent: data.specialContent || undefined,
      isApiReferencePage: data.isApiReferencePage || false,
      playgroundTypes: data.playgroundTypes || undefined,
      apiDocDetails: data.apiDocDetails || undefined,
      detectedApiSpecs: data.detectedApiSpecs || undefined,
      apiEndpoints: data.apiEndpoints || undefined,
      apiType: data.apiType || undefined,
      apiConfidenceScore: data.apiConfidenceScore || undefined,
      interactiveWidgets: data.interactiveWidgets || undefined,
      detectionQuality: "full",
      analysisMethod: "webview",
    };
  }

  getPage(index) {
    if (index < 0 || index >= this.#pages.length) {
      throw new Error(`Page index ${index} out of range (0-${this.#pages.length - 1})`);
    }
    return this.#pages[index];
  }

  get pageCount() {
    return this.#pages.length;
  }
}
