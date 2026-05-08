import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as cheerio from "cheerio";
import { PlaceholderManager } from "../src/commands/scrape/placeholder-manager.js";
import { ImageProcessor } from "../src/commands/scrape/image-processor.js";

const PAGE_URL = "https://example.com/docs/overview";

// ─── resolveUrl ───────────────────────────────────────────────────────────────

describe("ImageProcessor.resolveUrl — keep_remote strategy", () => {
  it("returns the absolute URL unchanged", () => {
    const ip = new ImageProcessor(PAGE_URL, { strategy: "keep_remote" });
    assert.equal(ip.resolveUrl("https://cdn.example.com/img.png"), "https://cdn.example.com/img.png");
  });

  it("makes a relative URL absolute against the page URL", () => {
    const ip = new ImageProcessor(PAGE_URL, { strategy: "keep_remote" });
    const result = ip.resolveUrl("/images/logo.png");
    assert.equal(result, "https://example.com/images/logo.png");
  });

  it("returns falsy input as-is", () => {
    const ip = new ImageProcessor(PAGE_URL, { strategy: "keep_remote" });
    assert.equal(ip.resolveUrl(""), "");
  });
});

describe("ImageProcessor.resolveUrl — download_by_url strategy (dryRun)", () => {
  it("returns the MDX src path without downloading in dryRun mode", () => {
    const ip = new ImageProcessor(PAGE_URL, { strategy: "download_by_url", folder: "images" }, "output", true);
    const result = ip.resolveUrl("https://cdn.example.com/assets/logo.png");
    assert.equal(result, "/images/assets/logo.png");
  });
});

describe("ImageProcessor.resolveUrl — download_by_page strategy (dryRun)", () => {
  it("returns a page-scoped MDX src path without downloading in dryRun mode", () => {
    const ip = new ImageProcessor(PAGE_URL, { strategy: "download_by_page", folder: "images" }, "output", true);
    const result = ip.resolveUrl("https://cdn.example.com/whatever/logo.png");
    assert.equal(result, "/images/docs/overview/logo.png");
  });
});

// ─── processImages ────────────────────────────────────────────────────────────

describe("ImageProcessor.processImages — keep_remote strategy", () => {
  it("replaces an img element with a Frame placeholder", () => {
    const $ = cheerio.load('<img src="https://cdn.example.com/img.png" alt="test" />');
    const pm = new PlaceholderManager();
    const ip = new ImageProcessor(PAGE_URL, { strategy: "keep_remote" });
    ip.processImages($, pm);

    const html = $.html();
    assert.ok(!html.includes("<img"), "img element replaced");

    const restored = pm.restore(html);
    assert.ok(restored.includes("<Frame>"), "wrapped in Frame");
    assert.ok(restored.includes("https://cdn.example.com/img.png"), "src preserved");
    assert.ok(restored.includes('alt="test"'), "alt preserved");
  });

  it("removes img elements with empty src", () => {
    const $ = cheerio.load('<img src="" />');
    const pm = new PlaceholderManager();
    const ip = new ImageProcessor(PAGE_URL, { strategy: "keep_remote" });
    ip.processImages($, pm);
    assert.ok(!$.html().includes("<img"), "img removed");
  });

  it("makes relative image src absolute before storing", () => {
    const $ = cheerio.load('<img src="/static/logo.png" />');
    const pm = new PlaceholderManager();
    const ip = new ImageProcessor(PAGE_URL, { strategy: "keep_remote" });
    ip.processImages($, pm);

    const restored = pm.restore($.html());
    assert.ok(restored.includes("https://example.com/static/logo.png"), "relative src resolved to absolute");
  });

  it("records no failures on keep_remote (no download attempted)", () => {
    const $ = cheerio.load('<img src="https://cdn.example.com/img.png" />');
    const pm = new PlaceholderManager();
    const ip = new ImageProcessor(PAGE_URL, { strategy: "keep_remote" });
    ip.processImages($, pm);
    assert.equal(ip.failures.length, 0);
  });
});

describe("ImageProcessor.processTableImages — keep_remote strategy", () => {
  it("updates src on img elements inside table cells without Frame wrapping", () => {
    const $ = cheerio.load('<table><tr><td><img src="/img.png" alt="x" /></td></tr></table>');
    const ip = new ImageProcessor(PAGE_URL, { strategy: "keep_remote" });
    const $table = $("table");
    ip.processTableImages($, $table);

    // src should be made absolute, element NOT replaced with Frame placeholder
    assert.ok($("img").attr("src").startsWith("https://"), "src made absolute");
    assert.ok($("img").length === 1, "img still in DOM (no placeholder)");
  });
});
