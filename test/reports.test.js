import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateMdxParseMarkdown,
  generateLinksMarkdown,
  normalizeFormat,
} from "../src/utils/reports.js";

// ─── normalizeFormat ──────────────────────────────────────────────────────────

describe("normalizeFormat", () => {
  it("returns 'json' when format is undefined", () => {
    assert.equal(normalizeFormat(undefined), "json");
    assert.equal(normalizeFormat(), "json");
  });

  it("lowercases the format string", () => {
    assert.equal(normalizeFormat("JSON"), "json");
    assert.equal(normalizeFormat("MD"), "md");
  });

  it("maps 'markdown' to 'md'", () => {
    assert.equal(normalizeFormat("markdown"), "md");
    assert.equal(normalizeFormat("MARKDOWN"), "md");
  });

  it("passes 'json' through unchanged", () => {
    assert.equal(normalizeFormat("json"), "json");
  });
});

// ─── generateMdxParseMarkdown ────────────────────────────────────────────────

describe("generateMdxParseMarkdown", () => {
  function makeReport(overrides = {}) {
    return {
      summary: { total: 5, valid: 4, errors: 1 },
      errors: [
        {
          filePath: "docs/intro.mdx",
          error: { message: "Unexpected token", line: 12, column: 5 },
        },
      ],
      valid: ["docs/overview.mdx"],
      timestamp: "2024-01-01T00:00:00.000Z",
      ...overrides,
    };
  }

  it("starts with the correct H1 heading", () => {
    const result = generateMdxParseMarkdown(makeReport());
    assert.ok(result.startsWith("# MDX Validation Report"));
  });

  it("includes summary counts", () => {
    const result = generateMdxParseMarkdown(makeReport());
    assert.ok(result.includes("**Total files**: 5"));
    assert.ok(result.includes("**Valid files**: 4"));
    assert.ok(result.includes("**Files with errors**: 1"));
  });

  it("includes error file path", () => {
    const result = generateMdxParseMarkdown(makeReport());
    assert.ok(result.includes("docs/intro.mdx"));
  });

  it("includes error message and line number", () => {
    const result = generateMdxParseMarkdown(makeReport());
    assert.ok(result.includes("Unexpected token"));
    assert.ok(result.includes("Line 12"));
  });

  it("includes column number when present", () => {
    const result = generateMdxParseMarkdown(makeReport());
    assert.ok(result.includes("Column: 5"));
  });

  it("returns a string with no 'errors' section when errors array is empty", () => {
    const report = makeReport({ errors: [], summary: { total: 2, valid: 2, errors: 0 } });
    const result = generateMdxParseMarkdown(report);
    assert.ok(!result.includes("## Files with Errors"));
  });
});

// ─── generateLinksMarkdown ────────────────────────────────────────────────────

describe("generateLinksMarkdown", () => {
  function makeReport(overrides = {}) {
    return {
      summary: { total_links: 10, success: 8, failure: 1, error: 1 },
      configuration: {
        base_url: "https://docs.example.com",
        concurrency: 5,
        execution_time_seconds: "2.34",
        scanned_directories: ["docs"],
        excluded_directories: ["snippets"],
      },
      results_by_file: {
        "docs/page.mdx": [
          {
            status: "failure",
            source: { lineNumber: 10, linkText: "anchor", rawHref: "/page#bad", linkType: "markdown" },
            sourceUrl: "https://docs.example.com/page",
            targetUrl: "https://docs.example.com/page#bad",
            errorMessage: "Anchor not found",
          },
        ],
      },
      timestamp: "2024-01-01T00:00:00.000Z",
      ...overrides,
    };
  }

  it("starts with the correct H1 heading", () => {
    const result = generateLinksMarkdown(makeReport());
    assert.ok(result.startsWith("# Links Validation Report"));
  });

  it("includes summary stats", () => {
    const result = generateLinksMarkdown(makeReport());
    assert.ok(result.includes("**Total links**: 10"));
    assert.ok(result.includes("**Success**: 8"));
    assert.ok(result.includes("**Failure**: 1"));
  });

  it("includes configuration section", () => {
    const result = generateLinksMarkdown(makeReport());
    assert.ok(result.includes("## Configuration"));
    assert.ok(result.includes("https://docs.example.com"));
    assert.ok(result.includes("**Concurrency**: 5"));
  });

  it("includes failed link details", () => {
    const result = generateLinksMarkdown(makeReport());
    assert.ok(result.includes("## Failed Links"));
    assert.ok(result.includes("docs/page.mdx:10"));
    assert.ok(result.includes("Anchor not found"));
    assert.ok(result.includes("/page#bad"));
  });

  it("shows success message when all links are valid", () => {
    const report = makeReport({
      summary: { total_links: 5, success: 5, failure: 0, error: 0 },
      results_by_file: {},
    });
    const result = generateLinksMarkdown(report);
    assert.ok(result.includes("All Links Valid") || result.includes("All 5 links"));
  });

  it("separates error results into a distinct section", () => {
    const report = makeReport({
      results_by_file: {
        "docs/page.mdx": [
          {
            status: "error",
            source: { lineNumber: 5, linkText: "link", rawHref: "/broken", linkType: "markdown" },
            targetUrl: "https://docs.example.com/broken",
            errorMessage: "Connection refused",
          },
        ],
      },
    });
    const result = generateLinksMarkdown(report);
    assert.ok(result.includes("## Links with Errors"));
    assert.ok(result.includes("Connection refused"));
  });
});
