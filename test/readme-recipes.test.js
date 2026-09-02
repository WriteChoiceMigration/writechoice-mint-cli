import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { convertRecipeContent, convertRecipes } from "../src/commands/readme/recipes.js";

// ─────────────────────────────────────────────────────────────────────────────
// convertRecipeContent (pure)
// ─────────────────────────────────────────────────────────────────────────────

describe("convertRecipeContent", () => {
  it("splits request and response code blocks into RequestExample/ResponseExample", () => {
    const input = '---\ntitle: "X"\n---\n```bash Request\ncurl foo\n```\n```json Response Example\n{"ok":true}\n```\n\n# Step\n\nBody.\n';
    const result = convertRecipeContent(input);
    assert.ok(result.includes("<RequestExample>"));
    assert.ok(result.includes("```bash Request\ncurl foo\n```"));
    assert.ok(result.includes("</RequestExample>"));
    assert.ok(result.includes("<ResponseExample>"));
    assert.ok(result.includes('```json Response Example\n{"ok":true}\n```'));
    assert.ok(result.includes("</ResponseExample>"));
  });

  it("wraps step headings in <Steps>/<Step title=...>", () => {
    const input = '---\ntitle: "X"\n---\n```bash\necho hi\n```\n\n# First Step\n\nDo the thing.\n\n# Second Step\n\nDo another thing.\n';
    const result = convertRecipeContent(input);
    assert.ok(result.includes("<Steps>"));
    assert.ok(result.includes('<Step title="First Step">'));
    assert.ok(result.includes("Do the thing."));
    assert.ok(result.includes('<Step title="Second Step">'));
    assert.ok(result.includes("Do another thing."));
    assert.ok(result.includes("</Steps>"));
  });

  it("strips the first HTML comment line (e.g. line-highlight marker) from a step body", () => {
    const input = '---\ntitle: "X"\n---\n```bash\necho hi\n```\n\n# Step\n<!-- bash@1-2 -->\n\nBody text.\n';
    const result = convertRecipeContent(input);
    assert.ok(!result.includes("<!-- bash@1-2 -->"));
    assert.ok(result.includes("Body text."));
  });

  it("omits ResponseExample when there is no response-labeled code block", () => {
    const input = '---\ntitle: "X"\n---\n```bash\necho hi\n```\n\n# Step\n\nBody.\n';
    const result = convertRecipeContent(input);
    assert.ok(result.includes("<RequestExample>"));
    assert.ok(!result.includes("<ResponseExample>"));
  });

  it("does not treat a heading inside a fenced code block as a step", () => {
    const input = '---\ntitle: "X"\n---\n```python\n# Example: not a heading\nprint(1)\n```\n\n# Real Step\n\nBody.\n';
    const result = convertRecipeContent(input);
    assert.ok(result.includes("# Example: not a heading")); // preserved inside the code block
    assert.ok(result.includes('<Step title="Real Step">'));
    // only one Step block was produced
    assert.equal((result.match(/<Step title=/g) || []).length, 1);
  });

  it("throws when there is no frontmatter block", () => {
    assert.throws(() => convertRecipeContent("# No frontmatter\nBody"), /no frontmatter found/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// convertRecipes (integration, temp dir)
// ─────────────────────────────────────────────────────────────────────────────

describe("convertRecipes", () => {
  let tmp, origCwd;

  before(() => {
    tmp = join(tmpdir(), `wc-readme-recipes-test-${Date.now()}`);
    mkdirSync(join(tmp, "readme", "recipes"), { recursive: true });
    writeFileSync(
      join(tmp, "readme", "recipes", "example.md"),
      '---\ntitle: "Example Recipe"\n---\n```bash Request\ncurl foo\n```\n\n# Step\n\nBody.\n'
    );
    origCwd = process.cwd();
    process.chdir(tmp);
  });

  after(() => {
    process.chdir(origCwd);
    try { rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("defaults to readme/recipes -> pages/recipes and writes the converted file", async () => {
    await convertRecipes({ from: null, output: null, dryRun: false, quiet: true });
    const out = join(tmp, "pages", "recipes", "example.mdx");
    assert.ok(existsSync(out));
    const content = readFileSync(out, "utf-8");
    assert.ok(content.includes("<RequestExample>"));
    assert.ok(content.includes('<Step title="Step">'));
  });

  it("does not delete the source .md file", () => {
    assert.ok(existsSync(join(tmp, "readme", "recipes", "example.md")));
  });

  it("--dry-run does not write files", async () => {
    const dryTmp = join(tmp, "dry-run-check");
    mkdirSync(join(dryTmp, "readme", "recipes"), { recursive: true });
    writeFileSync(
      join(dryTmp, "readme", "recipes", "other.md"),
      '---\ntitle: "Other"\n---\n```bash\necho hi\n```\n\n# Step\n\nBody.\n'
    );
    process.chdir(dryTmp);
    await convertRecipes({ from: null, output: null, dryRun: true, quiet: true });
    assert.ok(!existsSync(join(dryTmp, "pages", "recipes", "other.mdx")));
    process.chdir(tmp);
  });

  it("skips a malformed file (no frontmatter) with a warning instead of crashing the batch", async () => {
    const badTmp = join(tmp, "bad-file-check");
    mkdirSync(join(badTmp, "readme", "recipes"), { recursive: true });
    writeFileSync(join(badTmp, "readme", "recipes", "bad.md"), "# No frontmatter\nBody.\n");
    writeFileSync(
      join(badTmp, "readme", "recipes", "good.md"),
      '---\ntitle: "Good"\n---\n```bash\necho hi\n```\n\n# Step\n\nBody.\n'
    );
    process.chdir(badTmp);
    await convertRecipes({ from: null, output: null, dryRun: false, quiet: true });
    assert.ok(existsSync(join(badTmp, "pages", "recipes", "good.mdx")));
    assert.ok(!existsSync(join(badTmp, "pages", "recipes", "bad.mdx")));
    process.chdir(tmp);
  });
});
