/**
 * Tests for fix/redirects.js — navRedirects()
 *
 * Tests the redirect path replacement logic by creating temp docs.json +
 * MDX files and verifying that stale source paths are rewritten.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { navRedirects } from "../src/commands/fix/redirects.js";

let tmp;

before(() => {
  tmp = join(tmpdir(), `wc-fix-redirects-test-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });
});

after(() => {
  try { rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
});

function setup(name, redirects, mdxFiles) {
  const dir = join(tmp, name);
  mkdirSync(dir, { recursive: true });

  const docsJson = { navigation: [], redirects };
  writeFileSync(join(dir, "docs.json"), JSON.stringify(docsJson));

  for (const [filename, content] of Object.entries(mdxFiles)) {
    const fullPath = join(dir, filename);
    mkdirSync(join(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, content, "utf-8");
  }

  return dir;
}

async function run(dir, extra = {}) {
  const origCwd = process.cwd();
  process.chdir(dir);
  try {
    await navRedirects({ docs: "docs.json", quiet: true, ...extra });
  } finally {
    process.chdir(origCwd);
  }
}

function readFile(dir, relPath) {
  return readFileSync(join(dir, relPath), "utf-8");
}

// ─── basic replacement ────────────────────────────────────────────────────────

describe("navRedirects — markdown links", () => {
  it("replaces a stale source path in a markdown link", async () => {
    const dir = setup("md-link", [{ source: "/old-path", destination: "/new-path" }], {
      "page.mdx": "See [here](/old-path) for details.\n",
    });
    await run(dir);
    assert.ok(readFile(dir, "page.mdx").includes("(/new-path)"), "markdown link updated");
  });

  it("replaces source path in an href attribute (double quotes)", async () => {
    const dir = setup("href-dq", [{ source: "/old", destination: "/new" }], {
      "page.mdx": '<Button href="/old">Click</Button>\n',
    });
    await run(dir);
    assert.ok(readFile(dir, "page.mdx").includes('href="/new"'), "href updated");
  });

  it("replaces source path in an href attribute (single quotes)", async () => {
    const dir = setup("href-sq", [{ source: "/old", destination: "/new" }], {
      "page.mdx": "<a href='/old'>link</a>\n",
    });
    await run(dir);
    assert.ok(readFile(dir, "page.mdx").includes("href='/new'"), "single-quote href updated");
  });
});

describe("navRedirects — anchor preservation", () => {
  it("replaces source path in link with anchor fragment", async () => {
    const dir = setup("anchor", [{ source: "/old", destination: "/new" }], {
      "page.mdx": "See [here](/old#section) for details.\n",
    });
    await run(dir);
    const content = readFile(dir, "page.mdx");
    assert.ok(content.includes("(/new#section)"), "anchor preserved after replacement");
  });
});

describe("navRedirects — no-op cases", () => {
  it("does not modify files that do not contain the source path", async () => {
    const original = "No redirect needed here.\n";
    const dir = setup("noop", [{ source: "/old", destination: "/new" }], {
      "page.mdx": original,
    });
    await run(dir);
    assert.equal(readFile(dir, "page.mdx"), original, "file unchanged");
  });

  it("does not modify the source path if it appears inside a word boundary", async () => {
    // "/old" should not match "/old-extra" because the lookahead requires ) " ' # or space
    const original = '[link](/old-extra)\n';
    const dir = setup("partial", [{ source: "/old", destination: "/new" }], {
      "page.mdx": original,
    });
    await run(dir);
    assert.ok(readFile(dir, "page.mdx").includes("/old-extra"), "partial match not replaced");
  });
});

describe("navRedirects — multiple redirects", () => {
  it("applies all redirects in a single pass", async () => {
    const dir = setup("multi", [
      { source: "/foo", destination: "/bar" },
      { source: "/baz", destination: "/qux" },
    ], {
      "page.mdx": "Go [here](/foo) or [there](/baz).\n",
    });
    await run(dir);
    const content = readFile(dir, "page.mdx");
    assert.ok(content.includes("(/bar)"), "first redirect applied");
    assert.ok(content.includes("(/qux)"), "second redirect applied");
  });
});

describe("navRedirects — dry-run mode", () => {
  it("does not write files when dryRun is true", async () => {
    const original = "See [here](/old-dry) for details.\n";
    const dir = setup("dryrun", [{ source: "/old-dry", destination: "/new-dry" }], {
      "page.mdx": original,
    });
    await run(dir, { dryRun: true });
    assert.equal(readFile(dir, "page.mdx"), original, "file not modified in dry-run mode");
  });
});

describe("navRedirects — subdirectory scanning", () => {
  it("applies redirects to MDX files in nested subdirectories", async () => {
    const dir = setup("subdir", [{ source: "/legacy", destination: "/modern" }], {
      "sub/deep/page.mdx": "Check out [this](/legacy).\n",
    });
    await run(dir);
    assert.ok(readFile(dir, "sub/deep/page.mdx").includes("(/modern)"), "nested file updated");
  });
});
