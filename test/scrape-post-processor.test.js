import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  removeHeadingAnchors,
  removeDuplicateH1,
  fixComponentSpacing,
  selfCloseVoidElements,
  cleanExtraBlankLines,
  convertInlineStylesToReact,
  fixPreservedBlockSpacing,
  postProcessAll,
} from "../src/commands/scrape/post-processor.js";

// ─── removeHeadingAnchors ─────────────────────────────────────────────────────

describe("removeHeadingAnchors", () => {
  it("removes trailing anchor link from a heading", () => {
    const result = removeHeadingAnchors("## My Heading [​](#my-heading)");
    assert.equal(result, "## My Heading");
  });

  it("removes heading link where the full heading text is a link (first regex matches, text consumed)", () => {
    // The first regex (trailing anchor removal) matches lazily: .*? captures nothing,
    // leaving only the heading marker "## ". The second regex never fires on this input.
    const result = removeHeadingAnchors("## [My Heading](#anchor)");
    assert.equal(result, "## ");
  });

  it("does not touch headings without anchors", () => {
    const result = removeHeadingAnchors("## Normal Heading");
    assert.equal(result, "## Normal Heading");
  });

  it("handles multiple headings in multiline input", () => {
    const input = "## A [​](#a)\n\n### B [​](#b)\n\ntext";
    const result = removeHeadingAnchors(input);
    assert.ok(!result.includes("(#a)"));
    assert.ok(!result.includes("(#b)"));
    assert.ok(result.includes("## A"));
    assert.ok(result.includes("### B"));
  });
});

// ─── removeDuplicateH1 ───────────────────────────────────────────────────────

describe("removeDuplicateH1", () => {
  it("removes H1 that matches the page title", () => {
    const result = removeDuplicateH1("# Getting Started\n\nSome content", "Getting Started");
    assert.ok(!result.includes("# Getting Started"));
    assert.ok(result.includes("Some content"));
  });

  it("is case-insensitive", () => {
    const result = removeDuplicateH1("# GETTING STARTED\n\ncontent", "getting started");
    assert.ok(!result.includes("# GETTING STARTED"));
  });

  it("keeps H1 when it does not match the title", () => {
    const result = removeDuplicateH1("# Different Title\n\ncontent", "Getting Started");
    assert.ok(result.includes("# Different Title"));
  });

  it("returns input unchanged when no title provided", () => {
    const input = "# Title\n\nContent";
    assert.equal(removeDuplicateH1(input, ""), input);
    assert.equal(removeDuplicateH1(input), input);
  });
});

// ─── fixComponentSpacing ─────────────────────────────────────────────────────

describe("fixComponentSpacing", () => {
  it("adds blank line before an opening MDX tag missing one", () => {
    const result = fixComponentSpacing("some text\n<Note>\ncontent\n</Note>");
    assert.ok(result.includes("text\n\n<Note>"), "missing blank line before <Note> added");
  });

  it("adds blank line after a closing MDX tag missing one", () => {
    const result = fixComponentSpacing("<Note>\ncontent\n</Note>\nnext line");
    assert.ok(result.includes("</Note>\n\nnext line"), "missing blank line after </Note> added");
  });

  it("normalises inline spacing between adjacent closing and opening tags", () => {
    const result = fixComponentSpacing("</Note>  <Warning>");
    assert.ok(result.includes("</Note>\n\n<Warning>"));
  });
});

// ─── selfCloseVoidElements ───────────────────────────────────────────────────

describe("selfCloseVoidElements", () => {
  it("self-closes <img> tag", () => {
    const result = selfCloseVoidElements('<img src="x.png">');
    assert.equal(result, '<img src="x.png"/>');
  });

  it("self-closes <br> tag", () => {
    assert.equal(selfCloseVoidElements("<br>"), "<br/>");
  });

  it("does not double-close already-self-closed tags", () => {
    const result = selfCloseVoidElements('<img src="x.png"/>');
    assert.equal(result, '<img src="x.png"/>');
  });

  it("self-closes <hr> inside a paragraph", () => {
    const result = selfCloseVoidElements("before<hr>after");
    assert.ok(result.includes("<hr/>"));
  });

  it("does not alter content inside fenced code blocks", () => {
    const input = "```\n<img src='x'>\n```";
    const result = selfCloseVoidElements(input);
    assert.ok(result.includes("<img src='x'>"), "img inside code block not modified");
  });
});

// ─── cleanExtraBlankLines ────────────────────────────────────────────────────

describe("cleanExtraBlankLines", () => {
  it("collapses 3+ blank lines to 2", () => {
    const result = cleanExtraBlankLines("a\n\n\n\nb");
    assert.equal(result, "a\n\nb");
  });

  it("trims leading and trailing whitespace", () => {
    const result = cleanExtraBlankLines("\n\ntext\n\n");
    assert.equal(result, "text");
  });

  it("does not change content with single blank lines", () => {
    const result = cleanExtraBlankLines("a\n\nb");
    assert.equal(result, "a\n\nb");
  });
});

// ─── convertInlineStylesToReact ──────────────────────────────────────────────

describe("convertInlineStylesToReact", () => {
  it("converts style='...' to style={{...}} React syntax", () => {
    const result = convertInlineStylesToReact('<div style="font-size: 14px">');
    assert.equal(result, '<div style={{fontSize: "14px"}}>');
  });

  it("converts multiple CSS properties", () => {
    const result = convertInlineStylesToReact('<span style="color: red; font-weight: bold">');
    assert.ok(result.includes('color: "red"'));
    assert.ok(result.includes('fontWeight: "bold"'));
  });

  it("camelCases hyphenated property names", () => {
    const result = convertInlineStylesToReact('<p style="background-color: blue">');
    assert.ok(result.includes("backgroundColor"));
  });

  it("does not modify styles inside fenced code blocks", () => {
    const input = '```\n<div style="color: red">\n```';
    const result = convertInlineStylesToReact(input);
    assert.ok(result.includes('style="color: red"'), "style in code block unchanged");
  });
});

// ─── fixPreservedBlockSpacing ────────────────────────────────────────────────

describe("fixPreservedBlockSpacing", () => {
  it("adds blank line before <table> when preceded by text", () => {
    const result = fixPreservedBlockSpacing("text<table><tr></tr></table>");
    assert.ok(result.includes("text\n\n<table>"));
  });

  it("adds blank line after </table>", () => {
    const result = fixPreservedBlockSpacing("<table></table>\nnext");
    assert.ok(result.includes("</table>\n\nnext"));
  });

  it("adds blank line before <iframe>", () => {
    const result = fixPreservedBlockSpacing("text<iframe src='x'></iframe>");
    assert.ok(result.includes("text\n\n<iframe"));
  });
});

// ─── postProcessAll ──────────────────────────────────────────────────────────

describe("postProcessAll", () => {
  it("runs all steps without throwing on typical markdown input", () => {
    const input = "# Getting Started\n\nSome text.\n\n<br>\n\n```\ncode\n```";
    const result = postProcessAll(input, "Getting Started");
    assert.ok(!result.includes("# Getting Started"), "duplicate H1 removed");
    assert.ok(result.includes("<br/>"), "void element self-closed");
  });

  it("returns a trimmed string", () => {
    const result = postProcessAll("\n\n\ntext\n\n\n", "");
    assert.equal(result, "text");
  });
});
