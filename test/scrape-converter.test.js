import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildFrontmatter, convertPage } from "../src/commands/scrape/converter.js";

// ─── buildFrontmatter ────────────────────────────────────────────────────────

describe("buildFrontmatter", () => {
  it("wraps title in --- delimiters", () => {
    const result = buildFrontmatter("My Page");
    assert.equal(result, '---\ntitle: "My Page"\n---');
  });

  it("escapes double-quotes in title", () => {
    const result = buildFrontmatter('He said "hello"');
    assert.ok(result.includes('\\"hello\\"'));
  });

  it("omits title line when title is empty", () => {
    const result = buildFrontmatter("");
    assert.equal(result, "---\n---");
  });

  it("includes meta tag key/value pairs", () => {
    const result = buildFrontmatter("Page", { "og:title": "OG Title", permalink: "https://x.com/page" });
    assert.ok(result.includes('og:title: "OG Title"'));
    assert.ok(result.includes('permalink: "https://x.com/page"'));
  });

  it("omits falsy meta tag values", () => {
    const result = buildFrontmatter("Page", { "og:title": "", description: null });
    assert.ok(!result.includes("og:title"));
    assert.ok(!result.includes("description"));
  });

  it("escapes double-quotes in meta values", () => {
    const result = buildFrontmatter("Page", { description: 'Say "hi"' });
    assert.ok(result.includes('\\"hi\\"'));
  });
});

// ─── convertPage ─────────────────────────────────────────────────────────────

describe("convertPage — basic conversion", () => {
  it("returns an object with mdx and imageFailures", async () => {
    const html = "<html><body><h1>Hello</h1><p>World</p></body></html>";
    const result = await convertPage(html, "https://example.com/page");
    assert.ok(typeof result.mdx === "string");
    assert.ok(Array.isArray(result.imageFailures));
  });

  it("includes title in frontmatter from h1", async () => {
    const html = "<html><body><h1>Getting Started</h1><p>intro</p></body></html>";
    const { mdx } = await convertPage(html, "https://example.com/page");
    assert.ok(mdx.startsWith("---"), "starts with frontmatter");
    assert.ok(mdx.includes('"Getting Started"'));
  });

  it("strips site name suffix from title (e.g. 'Page | Site')", async () => {
    const html = "<html><head><title>Overview | My Site</title></head><body><p>text</p></body></html>";
    const { mdx } = await convertPage(html, "https://example.com/page");
    assert.ok(mdx.includes('"Overview"'), "suffix stripped");
    assert.ok(!mdx.includes("My Site"), "site name not in frontmatter title");
  });

  it("falls back to <title> when no h1 found", async () => {
    const html = "<html><head><title>Fallback Title</title></head><body><p>text</p></body></html>";
    const { mdx } = await convertPage(html, "https://example.com/page");
    assert.ok(mdx.includes('"Fallback Title"'));
  });

  it("uses title override from overrides.title", async () => {
    const html = "<html><body><h1>Original</h1><p>text</p></body></html>";
    const { mdx } = await convertPage(html, "https://example.com/page", {}, { title: "Override Title" });
    assert.ok(mdx.includes('"Override Title"'));
    assert.ok(!mdx.includes('"Original"'));
  });

  it("includes permalink in frontmatter when pageUrl is provided", async () => {
    const html = "<html><body><p>text</p></body></html>";
    const { mdx } = await convertPage(html, "https://example.com/docs/overview");
    assert.ok(mdx.includes("permalink"));
    assert.ok(mdx.includes("https://example.com/docs/overview"));
  });

  it("converts body text to markdown", async () => {
    const html = "<html><body><p>Hello World</p></body></html>";
    const { mdx } = await convertPage(html, "https://example.com/page");
    assert.ok(mdx.includes("Hello World"));
  });

  it("converts headings to ATX markdown", async () => {
    const html = "<html><body><h2>Section</h2><p>text</p></body></html>";
    const { mdx } = await convertPage(html, "https://example.com/page");
    assert.ok(mdx.includes("## Section"), "h2 converted to ## heading");
  });

  it("converts code blocks with language class", async () => {
    const html = '<html><body><pre><code class="language-python">print("hi")</code></pre></body></html>';
    const { mdx } = await convertPage(html, "https://example.com/page");
    assert.ok(mdx.includes("```python"), "fenced code block with language");
  });
});

describe("convertPage — content_selector", () => {
  it("scopes content to the configured selector", async () => {
    const html = `
      <html><body>
        <nav>nav content</nav>
        <main><h1>Main</h1><p>real content</p></main>
      </body></html>
    `;
    const { mdx } = await convertPage(html, "https://example.com/page", { content_selector: "main" });
    assert.ok(mdx.includes("real content"), "main content included");
    assert.ok(!mdx.includes("nav content"), "nav excluded");
  });

  it("returns a no-content placeholder when selector matches nothing", async () => {
    const html = "<html><body><p>text</p></body></html>";
    const { mdx } = await convertPage(html, "https://example.com/page", { content_selector: ".nonexistent" });
    assert.ok(mdx.includes("No content found"));
  });
});

describe("convertPage — elements_to_remove", () => {
  it("removes elements matching the configured selectors", async () => {
    const html = "<html><body><p>keep</p><div class='ads'>remove me</div></body></html>";
    const { mdx } = await convertPage(html, "https://example.com/page", {
      elements_to_remove: [".ads"],
    });
    assert.ok(!mdx.includes("remove me"), "element removed");
    assert.ok(mdx.includes("keep"), "other content kept");
  });

  it("silently ignores invalid selectors", async () => {
    const html = "<html><body><p>text</p></body></html>";
    await assert.doesNotReject(() =>
      convertPage(html, "https://example.com/page", { elements_to_remove: [":::bad:::"] })
    );
  });
});

describe("convertPage — overrides.frontmatter", () => {
  it("merges frontmatter overrides into the YAML header", async () => {
    const html = "<html><body><p>text</p></body></html>";
    const { mdx } = await convertPage(html, "https://example.com/page", {}, {
      frontmatter: { customKey: "custom-value" },
    });
    assert.ok(mdx.includes("customKey"));
    assert.ok(mdx.includes("custom-value"));
  });
});

describe("convertPage — image handling", () => {
  it("keeps remote image URLs by default", async () => {
    const html = '<html><body><img src="https://cdn.example.com/img.png" alt="test"/></body></html>';
    const { mdx, imageFailures } = await convertPage(html, "https://example.com/page");
    assert.ok(mdx.includes("https://cdn.example.com/img.png"), "remote URL kept");
    assert.equal(imageFailures.length, 0);
  });
});
