import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mergeLinksConfig,
  mergeScrapingConfig,
  mergePagesConfig,
  mergeImageCheckConfig,
  mergeKatexConfig,
  mergeDocusaurusConfig,
  mergeCodeblocksConfig,
  mergeNavRedirectsConfig,
  mergeNavRootConfig,
  validateRequiredConfig,
} from "../src/utils/config.js";

// ─── mergeLinksConfig ─────────────────────────────────────────────────────────

describe("mergeLinksConfig", () => {
  it("returns CLI values when no config provided", () => {
    const result = mergeLinksConfig("https://a.com", "https://b.com", { quiet: true }, null);
    assert.equal(result.baseUrl, "https://a.com");
    assert.equal(result.validationBaseUrl, "https://b.com");
  });

  it("falls back to config.source and config.target when CLI values are absent", () => {
    const config = { source: "https://src.com", target: "https://tgt.com" };
    const result = mergeLinksConfig(undefined, undefined, {}, config);
    assert.equal(result.baseUrl, "https://src.com");
    assert.equal(result.validationBaseUrl, "https://tgt.com");
  });

  it("CLI values take precedence over config", () => {
    const config = { source: "https://config.com" };
    const result = mergeLinksConfig("https://cli.com", undefined, {}, config);
    assert.equal(result.baseUrl, "https://cli.com");
  });

  it("defaults headless to true when config is provided but linksConfig.headless is not set", () => {
    const result = mergeLinksConfig(undefined, undefined, {}, {});
    assert.equal(result.options.headless, true);
  });

  it("returns options unchanged (no headless injection) when config is null", () => {
    const result = mergeLinksConfig(undefined, undefined, {}, null);
    assert.equal(result.options.headless, undefined);
  });
});

// ─── mergeScrapingConfig ──────────────────────────────────────────────────────

describe("mergeScrapingConfig", () => {
  it("uses defaults when no config and no CLI options", () => {
    const result = mergeScrapingConfig({}, null);
    assert.deepEqual(result.urls, []);
    assert.equal(result.urlsFile, "urls.json");
    assert.equal(result.output, "output");
    assert.equal(result.concurrency, 3);
    assert.equal(result.dryRun, false);
    assert.equal(result.playwright, false);
  });

  it("CLI options take precedence over config", () => {
    const config = { scrape: { output: "config-output", concurrency: 10 } };
    const result = mergeScrapingConfig({ output: "cli-output", concurrency: 5 }, config);
    assert.equal(result.output, "cli-output");
    assert.equal(result.concurrency, 5);
  });

  it("falls back to config values when CLI options are absent", () => {
    const config = { scrape: { output: "from-config", playwright: true, concurrency: 7 } };
    const result = mergeScrapingConfig({}, config);
    assert.equal(result.output, "from-config");
    assert.equal(result.playwright, true);
    assert.equal(result.concurrency, 7);
  });

  it("parses concurrency string to integer", () => {
    const result = mergeScrapingConfig({ concurrency: "8" }, null);
    assert.equal(result.concurrency, 8);
    assert.equal(typeof result.concurrency, "number");
  });

  it("passes the full scrapeConfig section through", () => {
    const config = { scrape: { content_selector: "main", components: [] } };
    const result = mergeScrapingConfig({}, config);
    assert.equal(result.scrapeConfig.content_selector, "main");
  });
});

// ─── mergePagesConfig ─────────────────────────────────────────────────────────

describe("mergePagesConfig", () => {
  it("uses defaults when nothing provided", () => {
    const result = mergePagesConfig(undefined, {}, null);
    assert.equal(result.baseUrl, null);
    assert.equal(result.docs, "docs.json");
    assert.equal(result.output, "pages_report.json");
    assert.equal(result.batchSize, 100);
    assert.equal(result.local, false);
  });

  it("uses CLI positional baseUrl first", () => {
    const result = mergePagesConfig("https://cli.com", {}, { pages: { url: "https://config.com" } });
    assert.equal(result.baseUrl, "https://cli.com");
  });

  it("falls back to config.pages.url then config.preview", () => {
    const config = { preview: "https://preview.com" };
    const result = mergePagesConfig(undefined, {}, config);
    assert.equal(result.baseUrl, "https://preview.com");
  });

  it("parses batchSize and batchPause as integers", () => {
    const result = mergePagesConfig(undefined, { batchSize: "50", batchPause: "2000" }, null);
    assert.equal(result.batchSize, 50);
    assert.equal(result.batchPause, 2000);
  });
});

// ─── mergeImageCheckConfig ────────────────────────────────────────────────────

describe("mergeImageCheckConfig", () => {
  it("uses defaults when nothing provided", () => {
    const result = mergeImageCheckConfig(undefined, {}, null);
    assert.equal(result.output, "images_report.json");
    assert.equal(result.concurrency, 10);
  });

  it("CLI baseUrl overrides config url", () => {
    const result = mergeImageCheckConfig("https://cli.com", {}, { imageCheck: { url: "https://config.com" } });
    assert.equal(result.baseUrl, "https://cli.com");
  });
});

// ─── mergeKatexConfig ─────────────────────────────────────────────────────────

describe("mergeKatexConfig", () => {
  it("uses defaults when nothing provided", () => {
    const result = mergeKatexConfig(undefined, {}, null);
    assert.equal(result.output, "katex_errors.json");
    assert.equal(result.concurrency, 50);
    assert.equal(result.file, null);
  });

  it("CLI file option takes precedence over config reportFile", () => {
    const config = { katex: { reportFile: "from-config.json" } };
    const result = mergeKatexConfig(undefined, { file: "from-cli.json" }, config);
    assert.equal(result.file, "from-cli.json");
  });

  it("falls back to config.katex.reportFile when CLI file is absent", () => {
    const config = { katex: { reportFile: "saved-report.json" } };
    const result = mergeKatexConfig(undefined, {}, config);
    assert.equal(result.file, "saved-report.json");
  });
});

// ─── mergeDocusaurusConfig ────────────────────────────────────────────────────

describe("mergeDocusaurusConfig", () => {
  it("uses defaults when no config", () => {
    const result = mergeDocusaurusConfig({}, null);
    assert.equal(result.output, null);
    assert.equal(result.dryRun, false);
    assert.equal(result.headingAnchors, false);
  });

  it("CLI output takes precedence over config output", () => {
    const config = { docusaurus: { output: "from-config" } };
    const result = mergeDocusaurusConfig({ output: "from-cli" }, config);
    assert.equal(result.output, "from-cli");
  });

  it("applies headingAnchors from config", () => {
    const config = { docusaurus: { headingAnchors: true } };
    const result = mergeDocusaurusConfig({}, config);
    assert.equal(result.headingAnchors, true);
  });
});

// ─── mergeCodeblocksConfig ────────────────────────────────────────────────────

describe("mergeCodeblocksConfig", () => {
  it("defaults threshold to 15 when not provided", () => {
    const result = mergeCodeblocksConfig({}, null);
    assert.equal(result.threshold, 15);
  });

  it("CLI threshold overrides config threshold", () => {
    const result = mergeCodeblocksConfig({ threshold: 20 }, { codeblocks: { threshold: 10 } });
    assert.equal(result.threshold, 20);
  });

  it("maps config lines='add' to lines: true", () => {
    const result = mergeCodeblocksConfig({}, { codeblocks: { lines: "add" } });
    assert.equal(result.lines, true);
  });

  it("maps config lines='remove' to removeLines: true", () => {
    const result = mergeCodeblocksConfig({}, { codeblocks: { lines: "remove" } });
    assert.equal(result.removeLines, true);
  });

  it("expandable defaults to true", () => {
    const result = mergeCodeblocksConfig({}, null);
    assert.equal(result.expandable, true);
  });

  it("expandable:false from options disables it", () => {
    const result = mergeCodeblocksConfig({ expandable: false }, null);
    assert.equal(result.expandable, false);
  });
});

// ─── mergeNavRedirectsConfig ──────────────────────────────────────────────────

describe("mergeNavRedirectsConfig", () => {
  it("defaults to docs.json and dryRun false", () => {
    const result = mergeNavRedirectsConfig({}, null);
    assert.equal(result.docs, "docs.json");
    assert.equal(result.dryRun, false);
  });

  it("CLI docs path overrides config", () => {
    const result = mergeNavRedirectsConfig({ docs: "custom.json" }, { fix: { redirects: { docs: "other.json" } } });
    assert.equal(result.docs, "custom.json");
  });
});

// ─── mergeNavRootConfig ───────────────────────────────────────────────────────

describe("mergeNavRootConfig", () => {
  it("defaults to docs.json and dryRun false", () => {
    const result = mergeNavRootConfig({}, null);
    assert.equal(result.docs, "docs.json");
    assert.equal(result.dryRun, false);
  });

  it("dryRun: true from options is preserved", () => {
    const result = mergeNavRootConfig({ dryRun: true }, null);
    assert.equal(result.dryRun, true);
  });
});

// ─── validateRequiredConfig ───────────────────────────────────────────────────

describe("validateRequiredConfig", () => {
  it("throws when baseUrl is falsy", () => {
    assert.throws(() => validateRequiredConfig(null, "wc check links"), /Missing required/);
    assert.throws(() => validateRequiredConfig("", "wc check links"), /Missing required/);
    assert.throws(() => validateRequiredConfig(undefined, "wc check links"), /Missing required/);
  });

  it("does not throw when baseUrl is provided", () => {
    assert.doesNotThrow(() => validateRequiredConfig("https://example.com", "wc check links"));
  });
});
