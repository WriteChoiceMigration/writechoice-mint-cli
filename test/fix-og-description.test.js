import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { renameDescriptionToOgDescription, fixOgDescription } from "../src/commands/fix/og-description.js";

// ─────────────────────────────────────────────────────────────────────────────
// renameDescriptionToOgDescription (pure)
// ─────────────────────────────────────────────────────────────────────────────

describe("renameDescriptionToOgDescription", () => {
  it("renames description to og:description in place", () => {
    const input = '---\ntitle: "Page"\ndescription: "A summary"\nicon: "book"\n---\n\nBody.';
    const result = renameDescriptionToOgDescription(input);
    assert.equal(result.changed, true);
    assert.equal(result.overwroteExisting, false);
    assert.equal(result.content, '---\ntitle: "Page"\nog:description: "A summary"\nicon: "book"\n---\n\nBody.');
  });

  it("returns changed:false when there is no description key", () => {
    const input = '---\ntitle: "Page"\n---\n\nBody.';
    const result = renameDescriptionToOgDescription(input);
    assert.equal(result.changed, false);
    assert.equal(result.content, input);
  });

  it("returns changed:false when there is no frontmatter block", () => {
    const input = "# Just a heading\nBody.";
    const result = renameDescriptionToOgDescription(input);
    assert.equal(result.changed, false);
    assert.equal(result.content, input);
  });

  it("drops a pre-existing og:description and uses description's value", () => {
    const input = '---\ntitle: "Page"\ndescription: "New value"\nog:description: "Old value"\n---\n\nBody.';
    const result = renameDescriptionToOgDescription(input);
    assert.equal(result.overwroteExisting, true);
    assert.ok(result.content.includes('og:description: "New value"'));
    assert.ok(!result.content.includes("Old value"));
    // only one og:description line remains
    assert.equal((result.content.match(/og:description:/g) || []).length, 1);
  });

  it("preserves a multi-line block scalar value with its key", () => {
    const input = '---\ntitle: "Page"\ndescription: >\n  A long\n  description\nicon: "book"\n---\n\nBody.';
    const result = renameDescriptionToOgDescription(input);
    assert.ok(result.content.includes("og:description: >\n  A long\n  description"));
    assert.ok(result.content.includes('icon: "book"'));
  });

  it("works when description is immediately followed by the closing fence (no body text)", () => {
    const input = '---\ntitle: "Page"\ndescription: "A summary"\n---\n';
    const result = renameDescriptionToOgDescription(input);
    assert.equal(result.changed, true);
    assert.ok(result.content.includes('og:description: "A summary"'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fixOgDescription (integration, temp dir)
// ─────────────────────────────────────────────────────────────────────────────

describe("fixOgDescription", () => {
  let tmp, origCwd;

  before(() => {
    tmp = join(tmpdir(), `wc-fix-og-description-test-${Date.now()}`);
    mkdirSync(join(tmp, "pages"), { recursive: true });
    writeFileSync(
      join(tmp, "pages", "example.mdx"),
      '---\ntitle: "Example"\ndescription: "A summary"\n---\n\nBody.\n'
    );
    origCwd = process.cwd();
    process.chdir(tmp);
  });

  after(() => {
    process.chdir(origCwd);
    try { rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("renames description and writes the file", async () => {
    await fixOgDescription({ file: null, dir: null, dryRun: false, quiet: true, verbose: false });
    const content = readFileSync(join(tmp, "pages", "example.mdx"), "utf-8");
    assert.ok(content.includes('og:description: "A summary"'));
    assert.ok(!content.includes("\ndescription:"));
  });
});
