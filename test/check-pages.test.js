import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  normalizeText,
  extractPhrase,
  collectAllPagePaths,
  sourceFileForPage,
} from "../src/commands/check/pages.js";

// ─────────────────────────────────────────────────────────────────────────────
// normalizeText
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeText", () => {
  it("collapses whitespace and lowercases", () => {
    assert.equal(normalizeText("  Hello   World  "), "hello world");
  });

  it("normalizes curly quotes and dashes to plain ASCII", () => {
    assert.equal(normalizeText("It’s a “test” — really"), 'it\'s a "test" - really');
  });

  it("normalizes an ellipsis character", () => {
    assert.equal(normalizeText("Wait…"), "wait...");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// extractPhrase
// ─────────────────────────────────────────────────────────────────────────────

describe("extractPhrase", () => {
  it("extracts a plain-text sentence, skipping frontmatter and headings", () => {
    const md = '---\ntitle: "X"\n---\n\n# Heading\n\nThis is a distinctive sentence used for verification.\n';
    const phrase = extractPhrase(md);
    assert.ok(phrase);
    assert.ok(phrase.includes("this is a distinctive"));
  });

  it("skips fenced code blocks", () => {
    const md = '---\ntitle: "X"\n---\n\n```bash\necho this is inside a code block and should not count\n```\n\nActual prose sentence goes right here for verification.\n';
    const phrase = extractPhrase(md);
    assert.ok(phrase);
    assert.ok(!phrase.includes("echo"));
  });

  it("skips lines that are pure markdown dividers", () => {
    const md = '---\ntitle: "X"\n---\n\n----------\n\nA real sentence with enough length to qualify as a phrase.\n';
    const phrase = extractPhrase(md);
    assert.ok(phrase);
    assert.ok(!phrase.includes("-"));
  });

  it("skips JSX comments", () => {
    const md = '---\ntitle: "X"\n---\n\n{/* internal note that is long enough to otherwise qualify */}\n\nVisible prose sentence that should be picked up instead here.\n';
    const phrase = extractPhrase(md);
    assert.ok(phrase);
    assert.ok(!phrase.includes("internal note"));
  });

  it("returns null when no line is long enough", () => {
    const md = '---\ntitle: "X"\n---\n\nToo short.\n';
    assert.equal(extractPhrase(md), null);
  });

  it("strips markdown link syntax before measuring length", () => {
    const md = '---\ntitle: "X"\n---\n\nSee [the guide](https://example.com/guide) for complete setup instructions.\n';
    const phrase = extractPhrase(md);
    assert.ok(phrase);
    assert.ok(!phrase.includes("("));
    assert.ok(phrase.includes("the guide"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// collectAllPagePaths / sourceFileForPage
// ─────────────────────────────────────────────────────────────────────────────

describe("collectAllPagePaths + sourceFileForPage", () => {
  let tmp;

  before(() => {
    tmp = join(tmpdir(), `wc-check-pages-test-${Date.now()}`);
    mkdirSync(join(tmp, "docs", "guides"), { recursive: true });
    mkdirSync(join(tmp, "node_modules", "ignored"), { recursive: true });
    mkdirSync(join(tmp, "snippets"), { recursive: true });
    writeFileSync(join(tmp, "docs", "index.mdx"), "# Index");
    writeFileSync(join(tmp, "docs", "guides", "setup.mdx"), "# Setup");
    writeFileSync(join(tmp, "docs", "legacy.md"), "# Legacy");
    writeFileSync(join(tmp, "node_modules", "ignored", "readme.mdx"), "# Ignored");
    writeFileSync(join(tmp, "snippets", "shared.mdx"), "# Snippet");
  });

  after(() => {
    try { rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("finds every .mdx/.md file, using posix-style relative paths without extension", () => {
    const pages = collectAllPagePaths(tmp);
    assert.ok(pages.includes("docs/index"));
    assert.ok(pages.includes("docs/guides/setup"));
    assert.ok(pages.includes("docs/legacy"));
  });

  it("excludes node_modules and snippets", () => {
    const pages = collectAllPagePaths(tmp);
    assert.ok(!pages.some((p) => p.includes("ignored")));
    assert.ok(!pages.some((p) => p.includes("snippets")));
  });

  it("sourceFileForPage finds the .mdx file when present", () => {
    const src = sourceFileForPage(tmp, "docs/index");
    assert.equal(src, join(tmp, "docs", "index.mdx"));
  });

  it("sourceFileForPage falls back to .md when no .mdx exists", () => {
    const src = sourceFileForPage(tmp, "docs/legacy");
    assert.equal(src, join(tmp, "docs", "legacy.md"));
  });

  it("sourceFileForPage returns null when neither exists", () => {
    assert.equal(sourceFileForPage(tmp, "docs/nonexistent"), null);
  });
});
