import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { urlToSlug, urlToFilePath, makeAbsolute, getImagePath } from "../src/commands/scrape/url-utils.js";

describe("urlToSlug", () => {
  it("strips leading slash from pathname", () => {
    assert.equal(urlToSlug("https://example.com/docs/overview"), "docs/overview");
  });

  it("strips trailing slash", () => {
    assert.equal(urlToSlug("https://example.com/docs/overview/"), "docs/overview");
  });

  it("returns 'index' for root URL", () => {
    assert.equal(urlToSlug("https://example.com/"), "index");
    assert.equal(urlToSlug("https://example.com"), "index");
  });

  it("preserves nested paths", () => {
    assert.equal(urlToSlug("https://example.com/a/b/c"), "a/b/c");
  });

  it("ignores query string and hash", () => {
    assert.equal(urlToSlug("https://example.com/page?foo=1#bar"), "page");
  });
});

describe("urlToFilePath", () => {
  it("returns output/slug.mdx", () => {
    assert.equal(urlToFilePath("https://example.com/docs/start", "output"), "output/docs/start.mdx");
  });

  it("defaults output dir to 'output'", () => {
    assert.equal(urlToFilePath("https://example.com/page"), "output/page.mdx");
  });

  it("handles root URL → output/index.mdx", () => {
    assert.equal(urlToFilePath("https://example.com/", "out"), "out/index.mdx");
  });
});

describe("makeAbsolute", () => {
  it("resolves a relative path against the base", () => {
    assert.equal(makeAbsolute("/images/logo.png", "https://example.com/docs/page"), "https://example.com/images/logo.png");
  });

  it("leaves an absolute URL unchanged", () => {
    assert.equal(makeAbsolute("https://cdn.example.com/img.png", "https://example.com/"), "https://cdn.example.com/img.png");
  });

  it("returns the input unchanged when URL construction fails", () => {
    assert.equal(makeAbsolute("not a url", "also not a url"), "not a url");
  });

  it("returns falsy input as-is", () => {
    assert.equal(makeAbsolute("", "https://example.com"), "");
  });
});

describe("getImagePath — keep_remote", () => {
  it("returns original URL as mdxSrc and null savePath", () => {
    const result = getImagePath("https://cdn.example.com/img.png", "https://example.com/page", "keep_remote");
    assert.equal(result.savePath, null);
    assert.equal(result.mdxSrc, "https://cdn.example.com/img.png");
  });
});

describe("getImagePath — download_by_url", () => {
  it("derives save path from image URL pathname", () => {
    const result = getImagePath("https://cdn.example.com/assets/logo.png", "https://example.com/page", "download_by_url", "images");
    assert.equal(result.savePath, "images/assets/logo.png");
    assert.equal(result.mdxSrc, "/images/assets/logo.png");
  });
});

describe("getImagePath — download_by_page", () => {
  it("derives save path from page slug + image filename", () => {
    const result = getImagePath("https://cdn.example.com/whatever/logo.png", "https://example.com/docs/overview", "download_by_page", "images");
    assert.equal(result.savePath, "images/docs/overview/logo.png");
    assert.equal(result.mdxSrc, "/images/docs/overview/logo.png");
  });
});

describe("getImagePath — unknown strategy", () => {
  it("falls through to keep_remote behaviour", () => {
    const url = "https://cdn.example.com/img.png";
    const result = getImagePath(url, "https://example.com/page", "unknown_strategy");
    assert.equal(result.savePath, null);
    assert.equal(result.mdxSrc, url);
  });
});
