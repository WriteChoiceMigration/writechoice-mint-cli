import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { selfCloseVoidTags, fixVoidTags } from "../src/commands/fix/void-tags.js";

// ─────────────────────────────────────────────────────────────────────────────
// selfCloseVoidTags (pure)
// ─────────────────────────────────────────────────────────────────────────────

describe("selfCloseVoidTags", () => {
  it("self-closes an unclosed <img> tag", () => {
    const { content, count } = selfCloseVoidTags('<img src="/pic.png" alt="pic">');
    assert.equal(content, '<img src="/pic.png" alt="pic" />');
    assert.equal(count, 1);
  });

  it("self-closes a bare <br> tag", () => {
    const { content, count } = selfCloseVoidTags("Line one<br>Line two");
    assert.equal(content, "Line one<br />Line two");
    assert.equal(count, 1);
  });

  it("leaves an already self-closed tag unchanged", () => {
    const { content, count } = selfCloseVoidTags('<img src="/pic.png" />');
    assert.equal(content, '<img src="/pic.png" />');
    assert.equal(count, 0);
  });

  it("fixes multiple void tags in one pass", () => {
    const { content, count } = selfCloseVoidTags("<hr><br><img src=\"/a.png\">");
    assert.equal(content, '<hr /><br /><img src="/a.png" />');
    assert.equal(count, 3);
  });

  it("leaves non-void tags untouched", () => {
    const { content, count } = selfCloseVoidTags("<div>text</div>");
    assert.equal(content, "<div>text</div>");
    assert.equal(count, 0);
  });

  it("does not rewrite an unclosed void tag inside a fenced code block", () => {
    const input = '```html\n<img src="/example.png">\n```';
    const { content, count } = selfCloseVoidTags(input);
    assert.equal(content, input);
    assert.equal(count, 0);
  });

  it("does not rewrite an unclosed void tag inside inline code", () => {
    const input = 'Use `<img src="x">` in your markup.';
    const { content, count } = selfCloseVoidTags(input);
    assert.equal(content, input);
    assert.equal(count, 0);
  });

  it("fixes tags outside a code block while leaving the code block itself untouched", () => {
    const input = '<img src="/a.png">\n\n```html\n<img src="/b.png">\n```\n\n<br>';
    const { content, count } = selfCloseVoidTags(input);
    assert.equal(content, '<img src="/a.png" />\n\n```html\n<img src="/b.png">\n```\n\n<br />');
    assert.equal(count, 2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fixVoidTags (integration, temp dir)
// ─────────────────────────────────────────────────────────────────────────────

describe("fixVoidTags", () => {
  let tmp, origCwd;

  before(() => {
    tmp = join(tmpdir(), `wc-fix-void-tags-test-${Date.now()}`);
    mkdirSync(join(tmp, "pages", "docs"), { recursive: true });
    writeFileSync(
      join(tmp, "pages", "docs", "example.mdx"),
      '---\ntitle: "Example"\n---\n\n<img src="/pic.png" alt="pic">\n\nSome text<br>here.\n'
    );
    origCwd = process.cwd();
    process.chdir(tmp);
  });

  after(() => {
    process.chdir(origCwd);
    try { rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("with no --file/--dir, recursively searches the whole repo and writes the fixed file", async () => {
    await fixVoidTags({ file: null, dir: null, dryRun: false, quiet: true, verbose: false });
    const content = readFileSync(join(tmp, "pages", "docs", "example.mdx"), "utf-8");
    assert.ok(content.includes('<img src="/pic.png" alt="pic" />'));
    assert.ok(content.includes("<br />"));
  });

  it("--dir scopes the search to a specific directory", async () => {
    writeFileSync(
      join(tmp, "pages", "docs", "example.mdx"),
      '---\ntitle: "Example"\n---\n\n<img src="/pic.png" alt="pic">\n\nSome text<br>here.\n'
    );
    await fixVoidTags({ file: null, dir: "pages/docs", dryRun: false, quiet: true, verbose: false });
    const content = readFileSync(join(tmp, "pages", "docs", "example.mdx"), "utf-8");
    assert.ok(content.includes('<img src="/pic.png" alt="pic" />'));
  });
});
