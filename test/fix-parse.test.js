import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  segmentContent,
  fixVoidTags,
  fixStrayAngleBrackets,
} from "../src/commands/fix/parse.js";

// ─────────────────────────────────────────────────────────────────────────────
// segmentContent
// ─────────────────────────────────────────────────────────────────────────────

describe("segmentContent", () => {
  it("returns a single unprotected segment for plain text", () => {
    const segs = segmentContent("Hello world.");
    assert.equal(segs.length, 1);
    assert.equal(segs[0].protected, false);
    assert.ok(segs[0].text.includes("Hello world."));
  });

  it("marks fenced code block content as protected", () => {
    const content = "Before.\n```\ncode here\n```\nAfter.";
    const segs = segmentContent(content);
    const protectedSegs = segs.filter((s) => s.protected);
    assert.ok(protectedSegs.length > 0);
    const protectedText = protectedSegs.map((s) => s.text).join("");
    assert.ok(protectedText.includes("code here"));
  });

  it("keeps text before and after a fence as unprotected", () => {
    const content = "Before.\n```\ncode\n```\nAfter.";
    const segs = segmentContent(content);
    const unprotected = segs.filter((s) => !s.protected).map((s) => s.text).join("");
    assert.ok(unprotected.includes("Before."));
    assert.ok(unprotected.includes("After."));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fixVoidTags
// ─────────────────────────────────────────────────────────────────────────────

describe("fixVoidTags", () => {
  it("self-closes <br>", () => {
    const { text, count } = fixVoidTags("Line one.<br>Line two.");
    assert.equal(count, 1);
    assert.ok(text.includes("<br />"));
    assert.ok(!text.includes("<br>"));
  });

  it("self-closes <hr>", () => {
    const { text, count } = fixVoidTags("---<hr>---");
    assert.equal(count, 1);
    assert.ok(text.includes("<hr />"));
  });

  it("self-closes <img> with attributes", () => {
    const { text, count } = fixVoidTags('<img src="/img/x.png" alt="x">');
    assert.equal(count, 1);
    assert.ok(text.includes('<img src="/img/x.png" alt="x" />'));
  });

  it("does not change already self-closing tags", () => {
    const input = '<img src="/img/x.png" />';
    const { text, count } = fixVoidTags(input);
    assert.equal(count, 0);
    assert.equal(text, input);
  });

  it("does not modify void tags inside inline code", () => {
    const { text, count } = fixVoidTags("Use `<br>` for a line break.");
    assert.equal(count, 0);
    assert.ok(text.includes("`<br>`"));
  });

  it("fixes multiple void tags in one pass", () => {
    const { count } = fixVoidTags("<br><hr><input type='text'>");
    assert.equal(count, 3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fixStrayAngleBrackets
// ─────────────────────────────────────────────────────────────────────────────

describe("fixStrayAngleBrackets", () => {
  it("escapes stray < in text (comparison expression)", () => {
    const { text, count } = fixStrayAngleBrackets("value 3 < 10 here");
    assert.equal(count, 1);
    assert.ok(text.includes("&lt;"));
  });

  it("does not escape < at start of a valid tag", () => {
    const { text } = fixStrayAngleBrackets("<strong>bold</strong>");
    assert.ok(text.includes("<strong>"));
    assert.ok(!text.includes("&lt;strong"));
  });

  it("does not escape > used as a blockquote at line start", () => {
    const { text } = fixStrayAngleBrackets("> This is a blockquote.");
    assert.ok(!text.includes("&gt;"));
    assert.ok(text.startsWith(">"));
  });

  it("does not modify inline code content", () => {
    const input = "Use `x < 10` in code.";
    const { text } = fixStrayAngleBrackets(input);
    assert.ok(text.includes("`x < 10`"));
  });

  it("preserves valid JSX/HTML tags intact", () => {
    const input = "See the <Card title=\"test\" /> component.";
    const { text } = fixStrayAngleBrackets(input);
    assert.ok(text.includes('<Card title="test" />'));
  });
});
