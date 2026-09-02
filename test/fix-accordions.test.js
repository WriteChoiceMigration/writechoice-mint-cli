import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { wrapAccordionGroups, fixAccordions } from "../src/commands/fix/accordions.js";

// ─────────────────────────────────────────────────────────────────────────────
// wrapAccordionGroups (pure)
// ─────────────────────────────────────────────────────────────────────────────

describe("wrapAccordionGroups", () => {
  it("wraps two consecutive sibling Accordions in AccordionGroup", () => {
    const input = '<Accordion title="One">\nBody one\n</Accordion>\n\n<Accordion title="Two">\nBody two\n</Accordion>\n';
    const { newContent, count } = wrapAccordionGroups(input);
    assert.equal(count, 1);
    assert.ok(newContent.includes("<AccordionGroup>"));
    assert.ok(newContent.includes("</AccordionGroup>"));
    // both original Accordions preserved
    assert.ok(newContent.includes('<Accordion title="One">'));
    assert.ok(newContent.includes('<Accordion title="Two">'));
  });

  it("leaves a lone Accordion (no sibling) untouched", () => {
    const input = '<Accordion title="Only">\nBody\n</Accordion>\n';
    const { newContent, count } = wrapAccordionGroups(input);
    assert.equal(count, 0);
    assert.equal(newContent, input);
  });

  it("does not group Accordions separated by other content", () => {
    const input = '<Accordion title="One">\nA\n</Accordion>\n\nSome text.\n\n<Accordion title="Two">\nB\n</Accordion>\n';
    const { count } = wrapAccordionGroups(input);
    assert.equal(count, 0);
  });

  it("does not group Accordions with different indentation", () => {
    const input = '<Accordion title="One">\nA\n</Accordion>\n\n  <Accordion title="Two">\n  B\n  </Accordion>\n';
    const { count } = wrapAccordionGroups(input);
    assert.equal(count, 0);
  });

  it("groups 3+ consecutive siblings into a single AccordionGroup", () => {
    const input = [
      '<Accordion title="One">\nA\n</Accordion>',
      '<Accordion title="Two">\nB\n</Accordion>',
      '<Accordion title="Three">\nC\n</Accordion>',
    ].join("\n\n") + "\n";
    const { newContent, count } = wrapAccordionGroups(input);
    assert.equal(count, 1);
    assert.equal((newContent.match(/<AccordionGroup>/g) || []).length, 1);
  });

  it("is idempotent — running twice produces no further changes", () => {
    const input = '<Accordion title="One">\nA\n</Accordion>\n\n<Accordion title="Two">\nB\n</Accordion>\n';
    const first = wrapAccordionGroups(input);
    const second = wrapAccordionGroups(first.newContent);
    assert.equal(second.count, 0);
    assert.equal(second.newContent, first.newContent);
  });

  it("preserves indentation of the wrapped group", () => {
    const input = '  <Accordion title="One">\n  A\n  </Accordion>\n\n  <Accordion title="Two">\n  B\n  </Accordion>\n';
    const { newContent } = wrapAccordionGroups(input);
    assert.ok(newContent.includes("  <AccordionGroup>"));
    assert.ok(newContent.includes("  </AccordionGroup>"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fixAccordions (integration, temp dir)
// ─────────────────────────────────────────────────────────────────────────────

describe("fixAccordions", () => {
  let tmp, origCwd;

  before(() => {
    tmp = join(tmpdir(), `wc-fix-accordions-test-${Date.now()}`);
    mkdirSync(join(tmp, "pages"), { recursive: true });
    writeFileSync(
      join(tmp, "pages", "example.mdx"),
      '# Title\n\n<Accordion title="One">\nA\n</Accordion>\n\n<Accordion title="Two">\nB\n</Accordion>\n'
    );
    origCwd = process.cwd();
    process.chdir(tmp);
  });

  after(() => {
    process.chdir(origCwd);
    try { rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("wraps sibling Accordions and writes the file", async () => {
    await fixAccordions({ file: null, dir: null, dryRun: false, quiet: true, verbose: false });
    const content = readFileSync(join(tmp, "pages", "example.mdx"), "utf-8");
    assert.ok(content.includes("<AccordionGroup>"));
  });
});
