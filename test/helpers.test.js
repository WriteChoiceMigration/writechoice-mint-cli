import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  cleanHeadingText,
  toKebabCase,
  isExternalUrl,
  isAnchorOnly,
  normalizeUrl,
  findLineNumber,
  removeCodeBlocksAndFrontmatter,
} from "../src/utils/helpers.js";

// ─── cleanHeadingText ─────────────────────────────────────────────────────────

describe("cleanHeadingText", () => {
  it("returns plain text unchanged", () => {
    assert.equal(cleanHeadingText("Getting Started"), "Getting Started");
  });

  it("deduplicates identical lines separated by newline", () => {
    assert.equal(cleanHeadingText("Create resources\nCreate resources"), "Create resources");
  });

  it("trims whitespace from each line", () => {
    assert.equal(cleanHeadingText("  Hello  \n  Hello  "), "Hello");
  });

  it("joins genuinely different lines with a space", () => {
    const result = cleanHeadingText("Part One\nPart Two");
    assert.equal(result, "Part One Part Two");
  });

  it("strips zero-width and invisible Unicode characters", () => {
    const withZeroWidth = "Hello​World";
    assert.equal(cleanHeadingText(withZeroWidth), "HelloWorld");
  });

  it("filters out blank lines before deduplication", () => {
    assert.equal(cleanHeadingText("Title\n\nTitle"), "Title");
  });
});

// ─── toKebabCase ─────────────────────────────────────────────────────────────

describe("toKebabCase", () => {
  it("lowercases and hyphenates spaces", () => {
    assert.equal(toKebabCase("Getting Started Guide"), "getting-started-guide");
  });

  it("removes non-alphanumeric characters", () => {
    assert.equal(toKebabCase("AI/ML Integration"), "aiml-integration");
  });

  it("collapses multiple hyphens", () => {
    assert.equal(toKebabCase("foo  --  bar"), "foo-bar");
  });

  it("strips leading and trailing hyphens", () => {
    assert.equal(toKebabCase("-hello-"), "hello");
  });

  it("handles already-lowercase kebab input", () => {
    assert.equal(toKebabCase("already-kebab"), "already-kebab");
  });
});

// ─── isExternalUrl ────────────────────────────────────────────────────────────

describe("isExternalUrl", () => {
  it("returns true for http:// URLs", () => {
    assert.ok(isExternalUrl("http://example.com"));
  });

  it("returns true for https:// URLs", () => {
    assert.ok(isExternalUrl("https://example.com/page"));
  });

  it("returns false for relative paths", () => {
    assert.ok(!isExternalUrl("/docs/overview"));
    assert.ok(!isExternalUrl("./page"));
  });

  it("returns false for anchor-only hrefs", () => {
    assert.ok(!isExternalUrl("#section"));
  });
});

// ─── isAnchorOnly ────────────────────────────────────────────────────────────

describe("isAnchorOnly", () => {
  it("returns true for hrefs starting with #", () => {
    assert.ok(isAnchorOnly("#section-title"));
  });

  it("returns false for paths with an anchor", () => {
    assert.ok(!isAnchorOnly("/page#anchor"));
  });

  it("returns false for plain paths", () => {
    assert.ok(!isAnchorOnly("/docs/overview"));
  });
});

// ─── normalizeUrl ────────────────────────────────────────────────────────────

describe("normalizeUrl", () => {
  it("removes trailing slashes", () => {
    assert.equal(normalizeUrl("https://example.com/page/"), "https://example.com/page");
  });

  it("removes /index at the end", () => {
    assert.equal(normalizeUrl("https://example.com/docs/index"), "https://example.com/docs");
  });

  it("removes /index.mdx at the end", () => {
    assert.equal(normalizeUrl("https://example.com/docs/index.mdx"), "https://example.com/docs");
  });

  it("does not remove /index-other suffix", () => {
    assert.equal(normalizeUrl("https://example.com/index-guide"), "https://example.com/index-guide");
  });

  it("leaves clean URLs unchanged", () => {
    assert.equal(normalizeUrl("https://example.com/docs/overview"), "https://example.com/docs/overview");
  });
});

// ─── findLineNumber ───────────────────────────────────────────────────────────

describe("findLineNumber", () => {
  it("returns 1 for a match at the very start", () => {
    assert.equal(findLineNumber("hello", 0), 1);
  });

  it("returns the correct line for a match mid-content", () => {
    const content = "line one\nline two\nline three";
    const pos = content.indexOf("line two");
    assert.equal(findLineNumber(content, pos), 2);
  });

  it("returns the correct line when match is on line 3", () => {
    const content = "a\nb\nc-match";
    const pos = content.indexOf("c-match");
    assert.equal(findLineNumber(content, pos), 3);
  });
});

// ─── removeCodeBlocksAndFrontmatter ──────────────────────────────────────────

describe("removeCodeBlocksAndFrontmatter", () => {
  it("blanks out frontmatter in the cleaned content", () => {
    const input = "---\ntitle: Hello\n---\n\nsome text";
    const { cleanedContent } = removeCodeBlocksAndFrontmatter(input);
    assert.ok(!cleanedContent.includes("title:"), "frontmatter title blanked out");
    assert.ok(cleanedContent.includes("some text"), "body text preserved");
  });

  it("blanks out fenced code blocks", () => {
    const input = "text\n```js\nconst x = 1;\n```\nafter";
    const { cleanedContent } = removeCodeBlocksAndFrontmatter(input);
    assert.ok(!cleanedContent.includes("const x"), "code block content blanked");
    assert.ok(cleanedContent.includes("text"), "surrounding text preserved");
    assert.ok(cleanedContent.includes("after"), "following text preserved");
  });

  it("returns removedRanges with correct entries for frontmatter and code blocks", () => {
    const input = "---\ntitle: T\n---\n\ntext\n```\ncode\n```";
    const { removedRanges } = removeCodeBlocksAndFrontmatter(input);
    assert.ok(removedRanges.length >= 2, "at least 2 ranges removed");
  });

  it("returns empty removedRanges and original content when nothing to remove", () => {
    const input = "just plain text";
    const { cleanedContent, removedRanges } = removeCodeBlocksAndFrontmatter(input);
    assert.equal(cleanedContent, input);
    assert.equal(removedRanges.length, 0);
  });

  it("preserves content length (blanks replaced with spaces, not deleted)", () => {
    const input = "---\ntitle: T\n---\n\ntext";
    const { cleanedContent } = removeCodeBlocksAndFrontmatter(input);
    assert.equal(cleanedContent.length, input.length);
  });
});
