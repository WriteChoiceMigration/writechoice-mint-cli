import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  processContent,
  ensureImport,
} from "../src/commands/fix/inlineimages.js";

const IMPORT_LINE = 'import { InlineImage } from "/snippets/InlineImage.jsx";';

// ─────────────────────────────────────────────────────────────────────────────
// ensureImport
// ─────────────────────────────────────────────────────────────────────────────

describe("ensureImport", () => {
  it("inserts import at top when no frontmatter", () => {
    const result = ensureImport("Body content.");
    assert.ok(result.startsWith(IMPORT_LINE));
  });

  it("inserts import after frontmatter with blank line below", () => {
    const content = "---\ntitle: My Page\n---\n\nBody.";
    const result = ensureImport(content);
    assert.ok(result.includes(IMPORT_LINE));
    const importIdx = result.indexOf(IMPORT_LINE);
    const afterImport = result.slice(importIdx + IMPORT_LINE.length);
    assert.ok(afterImport.startsWith("\n\n"), "blank line expected after import");
  });

  it("does not insert import if already present", () => {
    const content = `---\ntitle: My Page\n---\n\n${IMPORT_LINE}\n\nBody.`;
    const result = ensureImport(content);
    // Should appear exactly once
    assert.equal(result.split(IMPORT_LINE).length - 1, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// processContent — markdown images
// ─────────────────────────────────────────────────────────────────────────────

describe("processContent — markdown inline images", () => {
  it("converts markdown image inline with text", () => {
    const content = "Click ![icon](/img/icon.png) to continue.";
    const { newContent, count } = processContent(content);
    assert.equal(count, 1);
    assert.ok(newContent.includes('<InlineImage src="/img/icon.png" alt="icon" />'));
  });

  it("preserves alt text", () => {
    const content = "See ![warning sign](/img/warn.png) before proceeding.";
    const { newContent } = processContent(content);
    assert.ok(newContent.includes('alt="warning sign"'));
  });

  it("omits alt attribute when alt is empty", () => {
    const content = "Click ![](/img/icon.png) here.";
    const { newContent } = processContent(content);
    assert.ok(newContent.includes('<InlineImage src="/img/icon.png" />'));
    assert.ok(!newContent.includes('alt='));
  });

  it("does not convert standalone markdown image (alone on its line)", () => {
    const content = "---\ntitle: T\n---\n\n![standalone](/img/hero.png)\n";
    const { count } = processContent(content);
    assert.equal(count, 0);
  });

  it("does not convert linked images [![alt](url)](link)", () => {
    const content = "See [![icon](/img/i.png)](https://example.com) here.";
    const { count } = processContent(content);
    assert.equal(count, 0);
  });

  it("adds import when inline images are found", () => {
    const content = "---\ntitle: T\n---\n\nClick ![x](/img/x.png) here.";
    const { newContent } = processContent(content);
    assert.ok(newContent.includes(IMPORT_LINE));
  });

  it("does not add import when no inline images are found", () => {
    const content = "---\ntitle: T\n---\n\n![standalone](/img/hero.png)\n";
    const { newContent } = processContent(content);
    assert.ok(!newContent.includes(IMPORT_LINE));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// processContent — HTML img tags
// ─────────────────────────────────────────────────────────────────────────────

describe("processContent — HTML img inline images", () => {
  it("converts <img> tag inline with text", () => {
    const content = 'Click <img src="/img/icon.png" alt="icon" /> to continue.';
    const { newContent, count } = processContent(content);
    assert.equal(count, 1);
    assert.ok(newContent.includes("<InlineImage"));
    assert.ok(!newContent.includes("<img"));
  });

  it("preserves all attributes from <img> tag", () => {
    const content = 'See <img src="/img/x.png" alt="x" width="32" /> here.';
    const { newContent } = processContent(content);
    assert.ok(newContent.includes('src="/img/x.png"'));
    assert.ok(newContent.includes('alt="x"'));
    assert.ok(newContent.includes('width="32"'));
  });

  it("does not convert standalone <img> (alone on its line)", () => {
    const content = '\n<img src="/img/hero.png" alt="hero" />\n';
    const { count } = processContent(content);
    assert.equal(count, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// processContent — protected regions
// ─────────────────────────────────────────────────────────────────────────────

describe("processContent — protected regions", () => {
  it("does not convert images inside fenced code blocks", () => {
    const content = "```\nClick ![icon](/img/icon.png) here.\n```";
    const { count } = processContent(content);
    assert.equal(count, 0);
  });

  it("does not convert images inside inline code spans", () => {
    const content = "Use `![alt](url)` in markdown.";
    const { count } = processContent(content);
    assert.equal(count, 0);
  });

  it("does not convert images inside markdown tables", () => {
    const content = "| Column |\n|---|\n| ![img](/img/x.png) |\n";
    const { count } = processContent(content);
    assert.equal(count, 0);
  });

  it("does not convert images inside <Frame> blocks", () => {
    const content = "<Frame>![img](/img/x.png)</Frame>";
    const { count } = processContent(content);
    assert.equal(count, 0);
  });

  it("does not convert images inside HTML tables", () => {
    const content = "<table><tr><td><img src=\"/img/x.png\" /></td></tr></table>";
    const { count } = processContent(content);
    assert.equal(count, 0);
  });

  it("is idempotent — already-converted InlineImage is not touched", () => {
    const content = `${IMPORT_LINE}\n\nClick <InlineImage src="/img/x.png" alt="icon" /> here.`;
    const { newContent, count } = processContent(content);
    assert.equal(count, 0);
    assert.equal(newContent, content);
  });
});
