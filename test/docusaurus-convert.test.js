/**
 * Tests for the Docusaurus → Mintlify converter.
 *
 * All inner conversion functions (convertAdmonitions, convertFrontmatter, etc.)
 * are private, so we test them through convertDocusaurus() using a temp directory.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { convertDocusaurus } from "../src/commands/docusaurus/index.js";

// ─── Temp dir helpers ─────────────────────────────────────────────────────────

let tmp;

before(() => {
  tmp = join(tmpdir(), `wc-docusaurus-test-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });
});

after(() => {
  try { rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
});

function inputDir(name) {
  const dir = join(tmp, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function outputDir(name) {
  const dir = join(tmp, `out-${name}`);
  return dir;
}

async function convert(srcDir, outDir) {
  const origCwd = process.cwd();
  process.chdir(tmp);
  try {
    await convertDocusaurus(srcDir, { output: outDir, quiet: true, dryRun: false });
  } finally {
    process.chdir(origCwd);
  }
}

function read(outDir, relPath) {
  // outDir is already an absolute path (join(tmp, "out-name"))
  return readFileSync(join(outDir, relPath), "utf-8");
}

// ─── Frontmatter key renaming ─────────────────────────────────────────────────

describe("convertDocusaurus — frontmatter", () => {
  it("renames sidebar_label to sidebarTitle", async () => {
    const src = inputDir("fm-rename");
    writeFileSync(join(src, "page.md"), "---\ntitle: My Page\nsidebar_label: Short Label\n---\n\nContent.\n");
    const out = outputDir("fm-rename");
    await convert(src, out);
    const result = read(out, "page.mdx");
    assert.ok(result.includes("sidebarTitle: Short Label"), "sidebar_label renamed");
    assert.ok(!result.includes("sidebar_label:"), "original key removed");
  });

  it("does not duplicate sidebarTitle if both sidebar_label and sidebarTitle exist", async () => {
    const src = inputDir("fm-nodup");
    writeFileSync(join(src, "page.md"), "---\ntitle: Page\nsidebarTitle: Existing\nsidebar_label: Duplicate\n---\n\nContent.\n");
    const out = outputDir("fm-nodup");
    await convert(src, out);
    const result = read(out, "page.mdx");
    const count = (result.match(/sidebarTitle:/g) || []).length;
    assert.equal(count, 1, "only one sidebarTitle in output");
  });

  it("preserves all other frontmatter keys unchanged", async () => {
    const src = inputDir("fm-other");
    writeFileSync(join(src, "page.md"), "---\ntitle: Page\ndescription: My desc\ncustom_key: value\n---\n\nContent.\n");
    const out = outputDir("fm-other");
    await convert(src, out);
    const result = read(out, "page.mdx");
    assert.ok(result.includes("description: My desc"), "description preserved");
    assert.ok(result.includes("custom_key: value"), "custom key preserved");
  });
});

// ─── H1 handling ─────────────────────────────────────────────────────────────

describe("convertDocusaurus — H1 handling", () => {
  it("removes H1 that matches frontmatter title", async () => {
    const src = inputDir("h1-dup");
    writeFileSync(join(src, "page.md"), "---\ntitle: Getting Started\n---\n\n# Getting Started\n\nContent.\n");
    const out = outputDir("h1-dup");
    await convert(src, out);
    const result = read(out, "page.mdx");
    assert.ok(!result.match(/^# Getting Started$/m), "duplicate H1 removed");
  });

  it("creates frontmatter from H1 when no frontmatter exists", async () => {
    const src = inputDir("h1-nofm");
    writeFileSync(join(src, "page.md"), "# My Title\n\nContent here.\n");
    const out = outputDir("h1-nofm");
    await convert(src, out);
    const result = read(out, "page.mdx");
    assert.ok(result.includes("title: My Title"), "title extracted from H1");
    assert.ok(!result.match(/^# My Title$/m), "H1 removed from body");
  });

  it("promotes H1 to title and demotes old title to sidebarTitle when they differ", async () => {
    const src = inputDir("h1-diff");
    writeFileSync(join(src, "page.md"), "---\ntitle: Short Title\n---\n\n# Full Longer Title\n\nContent.\n");
    const out = outputDir("h1-diff");
    await convert(src, out);
    const result = read(out, "page.mdx");
    assert.ok(result.includes("title: Full Longer Title"), "H1 becomes new title");
    assert.ok(result.includes("sidebarTitle: Short Title"), "old title becomes sidebarTitle");
  });
});

// ─── Admonitions ─────────────────────────────────────────────────────────────

describe("convertDocusaurus — admonitions", () => {
  const admonitionTypes = [
    ["note", "Note"],
    ["tip", "Tip"],
    ["info", "Info"],
    ["warning", "Warning"],
    ["caution", "Warning"],
    ["danger", "Danger"],
  ];

  for (const [docType, mintType] of admonitionTypes) {
    it(`converts :::${docType} to <${mintType}>`, async () => {
      const src = inputDir(`admon-${docType}`);
      writeFileSync(join(src, "page.md"), `---\ntitle: P\n---\n\n:::${docType}\nsome text\n:::\n`);
      const out = outputDir(`admon-${docType}`);
      await convert(src, out);
      const result = read(out, "page.mdx");
      assert.ok(result.includes(`<${mintType}>`), `${docType} → <${mintType}>`);
      assert.ok(result.includes(`</${mintType}>`), `closing tag`);
      assert.ok(!result.includes(`:::${docType}`), "original syntax removed");
    });
  }

  it("preserves admonition title from :::note[Custom Title]", async () => {
    const src = inputDir("admon-title");
    writeFileSync(join(src, "page.md"), "---\ntitle: P\n---\n\n:::note[My Note Title]\nContent.\n:::\n");
    const out = outputDir("admon-title");
    await convert(src, out);
    const result = read(out, "page.mdx");
    assert.ok(result.includes("**My Note Title**"), "admonition title included as bold text");
  });

  it("does not convert ::: inside fenced code blocks", async () => {
    const src = inputDir("admon-code");
    writeFileSync(join(src, "page.md"), "---\ntitle: P\n---\n\n```\n:::note\nsome note\n:::\n```\n");
    const out = outputDir("admon-code");
    await convert(src, out);
    const result = read(out, "page.mdx");
    assert.ok(result.includes(":::note"), "admonition syntax preserved inside code block");
  });
});

// ─── Tabs ────────────────────────────────────────────────────────────────────

describe("convertDocusaurus — tabs", () => {
  it("strips attributes from <Tabs> tag", async () => {
    const src = inputDir("tabs-strip");
    writeFileSync(join(src, "page.md"), '---\ntitle: P\n---\n\n<Tabs groupId="install">\n<TabItem value="npm" label="npm">npm install</TabItem>\n</Tabs>\n');
    const out = outputDir("tabs-strip");
    await convert(src, out);
    const result = read(out, "page.mdx");
    assert.ok(result.includes("<Tabs>"), "Tabs tag stripped of attributes");
    assert.ok(!result.includes('groupId='), "groupId attribute removed");
  });

  it("converts <TabItem label='X'> to <Tab title='X'>", async () => {
    const src = inputDir("tabs-item");
    writeFileSync(join(src, "page.md"), '---\ntitle: P\n---\n\n<Tabs>\n<TabItem value="a" label="Apple">content</TabItem>\n</Tabs>\n');
    const out = outputDir("tabs-item");
    await convert(src, out);
    const result = read(out, "page.mdx");
    assert.ok(result.includes('<Tab title="Apple">'), "TabItem converted to Tab with title");
    assert.ok(result.includes("</Tab>"), "closing Tab tag");
    assert.ok(!result.includes("<TabItem"), "original TabItem removed");
  });
});

// ─── Accordions ──────────────────────────────────────────────────────────────

describe("convertDocusaurus — accordions", () => {
  it("converts <details>/<summary> to <Accordion title='...'>", async () => {
    const src = inputDir("accordion");
    writeFileSync(join(src, "page.md"), "---\ntitle: P\n---\n\n<details>\n<summary>Click me</summary>\n\nHidden content.\n\n</details>\n");
    const out = outputDir("accordion");
    await convert(src, out);
    const result = read(out, "page.mdx");
    assert.ok(result.includes('<Accordion title="Click me">'), "details converted to Accordion");
    assert.ok(result.includes("</Accordion>"), "closing tag");
    assert.ok(!result.includes("<details>"), "details removed");
  });
});

// ─── Link extension stripping ─────────────────────────────────────────────────

describe("convertDocusaurus — internal link extensions", () => {
  it("strips .mdx extension from markdown links", async () => {
    const src = inputDir("links-mdx");
    writeFileSync(join(src, "page.md"), "---\ntitle: P\n---\n\n[Go](./other-page.mdx)\n");
    const out = outputDir("links-mdx");
    await convert(src, out);
    const result = read(out, "page.mdx");
    assert.ok(result.includes("[Go](./other-page)"), ".mdx extension stripped");
  });

  it("strips .md extension from markdown links", async () => {
    const src = inputDir("links-md");
    writeFileSync(join(src, "page.md"), "---\ntitle: P\n---\n\n[Go](./other-page.md)\n");
    const out = outputDir("links-md");
    await convert(src, out);
    const result = read(out, "page.mdx");
    assert.ok(result.includes("[Go](./other-page)"), ".md extension stripped");
  });

  it("preserves anchors when stripping .mdx extension", async () => {
    const src = inputDir("links-anchor");
    writeFileSync(join(src, "page.md"), "---\ntitle: P\n---\n\n[Go](./other.mdx#section)\n");
    const out = outputDir("links-anchor");
    await convert(src, out);
    const result = read(out, "page.mdx");
    assert.ok(result.includes("[Go](./other#section)"), "anchor preserved after stripping extension");
  });
});

// ─── Theme import removal ─────────────────────────────────────────────────────

describe("convertDocusaurus — theme imports", () => {
  it("removes @theme/* import lines", async () => {
    const src = inputDir("theme-import");
    writeFileSync(join(src, "page.md"), "---\ntitle: P\n---\n\nimport Tabs from '@theme/Tabs';\nimport TabItem from '@theme/TabItem';\n\nContent.\n");
    const out = outputDir("theme-import");
    await convert(src, out);
    const result = read(out, "page.mdx");
    assert.ok(!result.includes("@theme/"), "@theme imports removed");
    assert.ok(result.includes("Content."), "body content preserved");
  });

  it("removes @docusaurus/* import lines", async () => {
    const src = inputDir("ds-import");
    writeFileSync(join(src, "page.md"), "---\ntitle: P\n---\n\nimport useDocusaurusContext from '@docusaurus/useDocusaurusContext';\n\nContent.\n");
    const out = outputDir("ds-import");
    await convert(src, out);
    const result = read(out, "page.mdx");
    assert.ok(!result.includes("@docusaurus/"), "@docusaurus imports removed");
  });
});

// ─── HTML comments ────────────────────────────────────────────────────────────

describe("convertDocusaurus — HTML comments", () => {
  it("converts HTML comments to JSX comments", async () => {
    const src = inputDir("html-comments");
    writeFileSync(join(src, "page.md"), "---\ntitle: P\n---\n\n<!-- This is a comment -->\n\nContent.\n");
    const out = outputDir("html-comments");
    await convert(src, out);
    const result = read(out, "page.mdx");
    assert.ok(result.includes("{/* This is a comment */}"), "HTML comment converted to JSX");
    assert.ok(!result.includes("<!--"), "original HTML comment removed");
  });
});

// ─── File output ──────────────────────────────────────────────────────────────

describe("convertDocusaurus — file output", () => {
  it("renames .md files to .mdx in output", async () => {
    const src = inputDir("ext-rename");
    writeFileSync(join(src, "guide.md"), "---\ntitle: Guide\n---\n\nContent.\n");
    const out = outputDir("ext-rename");
    await convert(src, out);
    assert.ok(existsSync(join(out, "guide.mdx")), ".md renamed to .mdx");
    assert.ok(!existsSync(join(out, "guide.md")), "original .md not in output");
  });

  it("copies non-MD files as-is", async () => {
    const src = inputDir("copy-files");
    writeFileSync(join(src, "image.png"), "fake-png");
    const out = outputDir("copy-files");
    await convert(src, out);
    assert.ok(existsSync(join(out, "image.png")), "non-MD file copied");
  });
});
