import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractMetaTags,
  applyMetaToContent,
  fileToUrl,
  yamlValue,
  DEFAULT_META_TAGS,
} from "../src/commands/metadata.js";

// ─────────────────────────────────────────────────────────────────────────────
// yamlValue
// ─────────────────────────────────────────────────────────────────────────────

describe("yamlValue", () => {
  it("wraps plain strings in double quotes", () => {
    assert.equal(yamlValue("Hello World"), '"Hello World"');
  });

  it("uses single quotes when value contains double quotes", () => {
    assert.equal(yamlValue('Say "hello"'), `'Say "hello"'`);
  });

  it("uses escaped double quotes when value contains both quote types", () => {
    const result = yamlValue(`it's "fine"`);
    assert.ok(result.startsWith('"'));
    assert.ok(result.includes('\\"'));
  });

  it("handles empty string", () => {
    assert.equal(yamlValue(""), '""');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fileToUrl
// ─────────────────────────────────────────────────────────────────────────────

describe("fileToUrl", () => {
  it("maps file path to URL relative to scan dir", () => {
    const url = fileToUrl("/project/docs/api/reference.mdx", "/project/docs", "https://docs.example.com");
    assert.equal(url, "https://docs.example.com/api/reference");
  });

  it("strips trailing slash from baseUrl", () => {
    const url = fileToUrl("/project/docs/intro.mdx", "/project/docs", "https://docs.example.com/");
    assert.equal(url, "https://docs.example.com/intro");
  });

  it("handles file at scan dir root", () => {
    const url = fileToUrl("/project/docs/index.mdx", "/project/docs", "https://docs.example.com");
    assert.equal(url, "https://docs.example.com/index");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// extractMetaTags
// ─────────────────────────────────────────────────────────────────────────────

describe("extractMetaTags", () => {
  it("extracts og:title from property attribute", () => {
    const html = `<meta property="og:title" content="My Page Title" />`;
    const result = extractMetaTags(html, DEFAULT_META_TAGS);
    assert.equal(result["og:title"], "My Page Title");
  });

  it("extracts twitter:description from name attribute", () => {
    const html = `<meta name="twitter:description" content="A description." />`;
    const result = extractMetaTags(html, DEFAULT_META_TAGS);
    assert.equal(result["twitter:description"], "A description.");
  });

  it("extracts multiple meta tags from the same HTML", () => {
    const html = [
      `<meta property="og:title" content="Title" />`,
      `<meta property="og:description" content="Desc" />`,
      `<meta property="og:image" content="https://example.com/img.png" />`,
    ].join("\n");
    const result = extractMetaTags(html, DEFAULT_META_TAGS);
    assert.equal(result["og:title"], "Title");
    assert.equal(result["og:description"], "Desc");
    assert.equal(result["og:image"], "https://example.com/img.png");
  });

  it("ignores tags not in the requested list", () => {
    const html = `<meta property="og:locale" content="en_US" />`;
    const result = extractMetaTags(html, DEFAULT_META_TAGS);
    assert.equal(result["og:locale"], undefined);
  });

  it("ignores meta tags with empty content", () => {
    const html = `<meta property="og:title" content="" />`;
    const result = extractMetaTags(html, DEFAULT_META_TAGS);
    assert.equal(result["og:title"], undefined);
  });

  it("handles single-quoted attribute values", () => {
    const html = `<meta property='og:title' content='My Title' />`;
    const result = extractMetaTags(html, DEFAULT_META_TAGS);
    assert.equal(result["og:title"], "My Title");
  });

  it("trims whitespace from content values", () => {
    const html = `<meta property="og:title" content="  Padded Title  " />`;
    const result = extractMetaTags(html, DEFAULT_META_TAGS);
    assert.equal(result["og:title"], "Padded Title");
  });

  it("returns empty object when no matching meta tags found", () => {
    const html = "<html><head><title>Test</title></head></html>";
    const result = extractMetaTags(html, DEFAULT_META_TAGS);
    assert.deepEqual(result, {});
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyMetaToContent
// ─────────────────────────────────────────────────────────────────────────────

describe("applyMetaToContent", () => {
  it("skips content with no frontmatter", () => {
    const content = "# Heading\n\nBody.";
    const { skipped, newContent } = applyMetaToContent(content, { "og:title": "Title" });
    assert.equal(skipped, true);
    assert.equal(newContent, content);
  });

  it("appends missing meta keys to frontmatter", () => {
    const content = "---\ntitle: My Page\n---\n\nBody.";
    const { newContent, added } = applyMetaToContent(content, { "og:title": "My Page" });
    assert.ok(added.includes("og:title"));
    assert.ok(newContent.includes('"og:title"'));
  });

  it("updates existing meta key in frontmatter", () => {
    const content = '---\ntitle: My Page\n"og:title": "Old Title"\n---\n\nBody.';
    const { newContent, updated } = applyMetaToContent(content, { "og:title": "New Title" });
    assert.ok(updated.includes("og:title"));
    assert.ok(newContent.includes("New Title"));
    assert.ok(!newContent.includes("Old Title"));
  });

  it("quotes keys that contain colons", () => {
    const content = "---\ntitle: My Page\n---\n\nBody.";
    const { newContent } = applyMetaToContent(content, { "og:title": "Title" });
    assert.ok(newContent.includes('"og:title"'));
  });

  it("adds multiple keys in one call", () => {
    const content = "---\ntitle: My Page\n---\n\nBody.";
    const { added } = applyMetaToContent(content, {
      "og:title": "Title",
      "og:description": "Desc",
    });
    assert.equal(added.length, 2);
  });

  it("updates single-quoted existing key", () => {
    const content = "---\ntitle: My Page\n'og:title': 'Old'\n---\n\nBody.";
    const { newContent, updated } = applyMetaToContent(content, { "og:title": "New" });
    assert.ok(updated.includes("og:title"));
    assert.ok(newContent.includes("New"));
    assert.ok(!newContent.includes("Old"));
  });

  it("preserves frontmatter keys that are not in metaData", () => {
    const content = "---\ntitle: My Page\ndescription: Keep this.\n---\n\nBody.";
    const { newContent } = applyMetaToContent(content, { "og:title": "Title" });
    assert.ok(newContent.includes("description: Keep this."));
  });

  it("is idempotent — applying same values twice causes no additional changes", () => {
    const content = "---\ntitle: My Page\n---\n\nBody.";
    const meta = { "og:title": "My Page" };
    const { newContent: pass1 } = applyMetaToContent(content, meta);
    const { updated, added } = applyMetaToContent(pass1, meta);
    assert.equal(added.length, 0);
    assert.equal(updated.length, 1); // value matched, still "updated" in place
  });
});
