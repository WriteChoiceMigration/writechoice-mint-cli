import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { escapeDollarSigns, fixDollarSigns } from "../src/commands/fix/dollar-signs.js";

// ─────────────────────────────────────────────────────────────────────────────
// escapeDollarSigns (pure)
// ─────────────────────────────────────────────────────────────────────────────

describe("escapeDollarSigns", () => {
  it("escapes a bare $ immediately before a digit", () => {
    const { content, count } = escapeDollarSigns("It costs $60 today.");
    assert.equal(content, "It costs \\$60 today.");
    assert.equal(count, 1);
  });

  it("does not double-escape an already-escaped $", () => {
    const { content, count } = escapeDollarSigns("It costs \\$60 today.");
    assert.equal(content, "It costs \\$60 today.");
    assert.equal(count, 0);
  });

  it("does not escape $ not followed by a digit", () => {
    const { content, count } = escapeDollarSigns("Use $x for a variable.");
    assert.equal(content, "Use $x for a variable.");
    assert.equal(count, 0);
  });

  it("escapes both amounts in a two-price sentence (no LaTeX markers present)", () => {
    const { content, count } = escapeDollarSigns("It costs $60 or $70 depending on plan.");
    assert.equal(content, "It costs \\$60 or \\$70 depending on plan.");
    assert.equal(count, 2);
  });

  it("does not escape a LaTeX inline math span containing a backslash", () => {
    const input = "The formula is $5 \\times 10^{3}$ meters.";
    const { content, count } = escapeDollarSigns(input);
    assert.equal(content, input);
    assert.equal(count, 0);
  });

  it("does not escape a LaTeX span containing only a caret", () => {
    const input = "Energy is $2^{n}$ units.";
    const { content, count } = escapeDollarSigns(input);
    assert.equal(content, input);
    assert.equal(count, 0);
  });

  it("does not escape LaTeX display math ($$...$$)", () => {
    const input = "$$2^n + 1$$ is the formula.";
    const { content, count } = escapeDollarSigns(input);
    assert.equal(content, input);
    assert.equal(count, 0);
  });

  it("does not touch a $ inside a fenced code block", () => {
    const input = "```bash\necho $100\n```";
    const { content, count } = escapeDollarSigns(input);
    assert.equal(content, input);
    assert.equal(count, 0);
  });

  it("does not touch a $ inside an inline code span", () => {
    const input = "Run `echo $100` please.";
    const { content, count } = escapeDollarSigns(input);
    assert.equal(content, input);
    assert.equal(count, 0);
  });

  it("escapes prose while leaving adjacent code fences and inline code alone", () => {
    const input = "Cost is $50.\n```\n$60 in code\n```\nAnd `$70 inline`.";
    const { content, count } = escapeDollarSigns(input);
    assert.equal(count, 1);
    assert.ok(content.includes("Cost is \\$50."));
    assert.ok(content.includes("$60 in code"));
    assert.ok(content.includes("`$70 inline`"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fixDollarSigns (integration, temp dir)
// ─────────────────────────────────────────────────────────────────────────────

describe("fixDollarSigns", () => {
  let tmp, origCwd;

  before(() => {
    tmp = join(tmpdir(), `wc-fix-dollar-signs-test-${Date.now()}`);
    mkdirSync(join(tmp, "pages"), { recursive: true });
    writeFileSync(join(tmp, "pages", "example.mdx"), "# Title\n\nIt costs $60 today.\n");
    origCwd = process.cwd();
    process.chdir(tmp);
  });

  after(() => {
    process.chdir(origCwd);
    try { rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("escapes dollar signs and writes the file", async () => {
    await fixDollarSigns({ file: null, dir: null, dryRun: false, quiet: true, verbose: false });
    const content = readFileSync(join(tmp, "pages", "example.mdx"), "utf-8");
    assert.ok(content.includes("\\$60"));
  });
});
