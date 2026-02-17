import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { processContent } from "../src/commands/fix/images.js";

// ─────────────────────────────────────────────────────────────────────────────
// Markdown images
// ─────────────────────────────────────────────────────────────────────────────

describe("processContent — markdown images", () => {
  it("wraps a standalone markdown image in <Frame>", () => {
    const content = "![hero](/img/hero.png)\n";
    const { newContent, count } = processContent(content);
    assert.equal(count, 1);
    assert.ok(newContent.includes("<Frame>"));
    assert.ok(newContent.includes("![hero](/img/hero.png)"));
    assert.ok(newContent.includes("</Frame>"));
  });

  it("wraps multiple standalone markdown images", () => {
    const content = "![a](/a.png)\n\n![b](/b.png)\n";
    const { count } = processContent(content);
    assert.equal(count, 2);
  });

  it("preserves indentation when wrapping", () => {
    const content = "  ![icon](/img/icon.png)\n";
    const { newContent } = processContent(content);
    assert.ok(newContent.includes("  <Frame>"));
    assert.ok(newContent.includes("  ![icon](/img/icon.png)"));
    assert.ok(newContent.includes("  </Frame>"));
  });

  it("does not wrap images that already have text on the line", () => {
    const content = "Click ![icon](/img/icon.png) to continue.\n";
    const { count } = processContent(content);
    assert.equal(count, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// HTML <img> tags
// ─────────────────────────────────────────────────────────────────────────────

describe("processContent — HTML img tags", () => {
  it("wraps a standalone <img> in <Frame>", () => {
    const content = '<img src="/img/hero.png" alt="hero" />\n';
    const { newContent, count } = processContent(content);
    assert.equal(count, 1);
    assert.ok(newContent.includes("<Frame>"));
    assert.ok(newContent.includes("</Frame>"));
  });

  it("wraps <img> without self-closing slash", () => {
    const content = '<img src="/img/hero.png" alt="hero">\n';
    const { count } = processContent(content);
    assert.equal(count, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Protected regions — must not be wrapped
// ─────────────────────────────────────────────────────────────────────────────

describe("processContent — protected regions", () => {
  it("does not wrap images already inside <Frame>", () => {
    const content = "<Frame>\n![hero](/img/hero.png)\n</Frame>\n";
    const { newContent, count } = processContent(content);
    assert.equal(count, 0);
    assert.equal(newContent, content);
  });

  it("does not wrap images inside fenced code blocks", () => {
    const content = "```\n![img](/img/x.png)\n```\n";
    const { count } = processContent(content);
    assert.equal(count, 0);
  });

  it("does not wrap images inside markdown tables", () => {
    const content = "| Col |\n|---|\n| ![img](/img/x.png) |\n";
    const { count } = processContent(content);
    assert.equal(count, 0);
  });

  it("does not wrap images inside HTML tables", () => {
    const content = '<table><tr><td>\n![img](/img/x.png)\n</td></tr></table>\n';
    const { count } = processContent(content);
    assert.equal(count, 0);
  });

  it("wraps standalone image outside protected regions but not inside", () => {
    const content = "![outside](/a.png)\n\n```\n![inside](/b.png)\n```\n";
    const { count } = processContent(content);
    assert.equal(count, 1);
  });

  it("is idempotent — already wrapped images are not double-wrapped", () => {
    const content = "<Frame>\n![hero](/img/hero.png)\n</Frame>\n";
    const { newContent: pass1 } = processContent(content);
    const { newContent: pass2, count } = processContent(pass1);
    assert.equal(count, 0);
    assert.equal(pass1, pass2);
  });
});
