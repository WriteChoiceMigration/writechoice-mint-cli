import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  convertFrontmatter,
  convertCalloutTags,
  convertBlockquoteCallouts,
  convertLinks,
  convertCodeBlocks,
  convertHorizontalRules,
  convertTableTags,
  convertInlineStyles,
} from "../src/commands/readme/convert.js";
import { mergeReadmeConvertConfig } from "../src/utils/config.js";

// ─── mergeReadmeConvertConfig ─────────────────────────────────────────────────

describe("mergeReadmeConvertConfig", () => {
  it("returns defaults when no config and no CLI options", () => {
    const result = mergeReadmeConvertConfig({}, null);
    assert.equal(result.from, "readme/docs");
    assert.equal(result.urlsFile, null);
    assert.equal(result.output, "pages");
    assert.equal(result.imagesDir, "images/docs");
    assert.equal(result.noImages, false);
    assert.equal(result.dryRun, false);
    assert.equal(result.quiet, false);
  });

  it("reads values from config.readme.convert", () => {
    const config = { readme: { convert: { from: "src/md", output: "out", "images-dir": "imgs", "no-images": true, "dry-run": true, quiet: true } } };
    const result = mergeReadmeConvertConfig({}, config);
    assert.equal(result.from, "src/md");
    assert.equal(result.output, "out");
    assert.equal(result.imagesDir, "imgs");
    assert.equal(result.noImages, true);
    assert.equal(result.dryRun, true);
    assert.equal(result.quiet, true);
  });

  it("CLI options take precedence over config", () => {
    const config = { readme: { convert: { from: "config-src", output: "config-out" } } };
    const result = mergeReadmeConvertConfig({ from: "cli-src", output: "cli-out" }, config);
    assert.equal(result.from, "cli-src");
    assert.equal(result.output, "cli-out");
  });

  it("sets noImages=true when Commander passes options.images=false (--no-images)", () => {
    const result = mergeReadmeConvertConfig({ images: false }, null);
    assert.equal(result.noImages, true);
  });

  it("sets noImages=true when config has no-images=true", () => {
    const config = { readme: { convert: { "no-images": true } } };
    const result = mergeReadmeConvertConfig({}, config);
    assert.equal(result.noImages, true);
  });

  it("reads urls-file from config", () => {
    const config = { readme: { convert: { "urls-file": "my-urls.json" } } };
    const result = mergeReadmeConvertConfig({}, config);
    assert.equal(result.urlsFile, "my-urls.json");
  });

  it("CLI urlsFile takes precedence over config", () => {
    const config = { readme: { convert: { "urls-file": "config-urls.json" } } };
    const result = mergeReadmeConvertConfig({ urlsFile: "cli-urls.json" }, config);
    assert.equal(result.urlsFile, "cli-urls.json");
  });
});

// ─── convertFrontmatter ───────────────────────────────────────────────────────

describe("convertFrontmatter", () => {
  it("extracts title and excerpt into Mintlify frontmatter", () => {
    const input = `---\ntitle: "My Page"\nexcerpt: "A description"\n---\n# Body`;
    const result = convertFrontmatter(input);
    assert.ok(result.startsWith('---\ntitle: "My Page"\ndescription: "A description"\n---\n'));
  });

  it("omits description when excerpt is absent", () => {
    const input = `---\ntitle: Hello\n---\nBody`;
    const result = convertFrontmatter(input);
    assert.ok(result.includes('title: "Hello"'));
    assert.ok(!result.includes("description"));
  });

  it("strips surrounding quotes from title", () => {
    const input = `---\ntitle: 'Quoted'\n---\n`;
    assert.ok(convertFrontmatter(input).includes('title: "Quoted"'));
  });

  it("passes through content with no frontmatter unchanged", () => {
    const input = "# Just a heading\nsome text";
    assert.equal(convertFrontmatter(input), input);
  });

  it("escapes double quotes in description", () => {
    const input = `---\ntitle: T\nexcerpt: A "quoted" word here\n---\n`;
    const result = convertFrontmatter(input);
    assert.ok(result.includes('\\"quoted\\"'));
  });
});

// ─── convertCalloutTags ───────────────────────────────────────────────────────

describe("convertCalloutTags", () => {
  it("converts theme=info to <Info>", () => {
    const input = `<Callout theme="info">content</Callout>`;
    assert.equal(convertCalloutTags(input), "<Info>\ncontent\n</Info>");
  });

  it("converts theme=warn to <Warning>", () => {
    const input = `<Callout theme="warn">body</Callout>`;
    assert.equal(convertCalloutTags(input), "<Warning>\nbody\n</Warning>");
  });

  it("converts icon=💡 with theme=default to <Tip>", () => {
    const input = `<Callout icon="💡" theme="default">tip text</Callout>`;
    assert.equal(convertCalloutTags(input), "<Tip>\ntip text\n</Tip>");
  });

  it("strips leading/trailing newlines from body", () => {
    const input = `<Callout theme="info">\n\ncontent\n\n</Callout>`;
    assert.equal(convertCalloutTags(input), "<Info>\ncontent\n</Info>");
  });
});

// ─── convertBlockquoteCallouts ────────────────────────────────────────────────

describe("convertBlockquoteCallouts", () => {
  it("converts 👍 blockquote to <Tip>", () => {
    const input = "> 👍 Great job\n> This is the body";
    const result = convertBlockquoteCallouts(input);
    assert.ok(result.includes("<Tip>"));
    assert.ok(result.includes("**Great job**"));
    assert.ok(result.includes("This is the body"));
    assert.ok(result.includes("</Tip>"));
  });

  it("converts 📘 blockquote to <Info>", () => {
    const result = convertBlockquoteCallouts("> 📘 Note title\n> body");
    assert.ok(result.includes("<Info>"));
  });

  it("leaves regular blockquotes unchanged", () => {
    const input = "> Just a regular quote";
    assert.equal(convertBlockquoteCallouts(input), input);
  });

  it("handles blockquote with no title after emoji", () => {
    const input = "> 🚧\n> Work in progress";
    const result = convertBlockquoteCallouts(input);
    assert.ok(result.includes("<Warning>"));
    assert.ok(!result.includes("**\n**"));
  });
});

// ─── convertLinks ─────────────────────────────────────────────────────────────

describe("convertLinks", () => {
  it("converts doc:slug to /docs/slug", () => {
    assert.equal(convertLinks("[text](doc:my-page)"), "[text](/docs/my-page)");
  });

  it("converts doc:slug#anchor to /docs/slug#anchor", () => {
    assert.equal(convertLinks("[text](doc:my-page#section)"), "[text](/docs/my-page#section)");
  });

  it("converts changelog:slug to /changelog/slug", () => {
    assert.equal(convertLinks("[text](changelog:v1)"), "[text](/changelog/v1)");
  });

  it("converts ref:slug to /docs/slug", () => {
    assert.equal(convertLinks("[text](ref:api-ref)"), "[text](/docs/api-ref)");
  });

  it("leaves regular links unchanged", () => {
    const link = "[text](https://example.com)";
    assert.equal(convertLinks(link), link);
  });
});

// ─── convertCodeBlocks ────────────────────────────────────────────────────────

describe("convertCodeBlocks", () => {
  it("normalises curl to bash with title", () => {
    const input = "```curl\ncurl example\n```";
    const result = convertCodeBlocks(input);
    assert.ok(result.startsWith("```bash curl"));
  });

  it("normalises sh to bash", () => {
    const result = convertCodeBlocks("```sh\necho hi\n```");
    assert.ok(result.startsWith("```bash bash"));
  });

  it("wraps adjacent blocks in <CodeGroup>", () => {
    const input = "```python\nx = 1\n```\n```javascript\nvar x = 1;\n```";
    const result = convertCodeBlocks(input);
    assert.ok(result.includes("<CodeGroup>"));
    assert.ok(result.includes("</CodeGroup>"));
  });

  it("does not wrap a single code block", () => {
    const input = "```python\nx = 1\n```";
    const result = convertCodeBlocks(input);
    assert.ok(!result.includes("<CodeGroup>"));
  });

  it("leaves unknown languages unchanged", () => {
    const result = convertCodeBlocks("```python\npass\n```");
    assert.ok(result.startsWith("```python"));
  });
});

// ─── convertHorizontalRules ───────────────────────────────────────────────────

describe("convertHorizontalRules", () => {
  it("converts *** to ---", () => {
    assert.equal(convertHorizontalRules("***"), "---");
  });

  it("converts *** with trailing spaces", () => {
    assert.equal(convertHorizontalRules("***  "), "---");
  });

  it("does not touch --- or other content", () => {
    assert.equal(convertHorizontalRules("---"), "---");
    assert.equal(convertHorizontalRules("text"), "text");
  });
});

// ─── convertTableTags ─────────────────────────────────────────────────────────

describe("convertTableTags", () => {
  it("converts <Table> to <table>", () => {
    assert.equal(convertTableTags("<Table>content</Table>"), "<table>content</table>");
  });

  it("strips Table attributes", () => {
    assert.equal(convertTableTags(`<Table align={["left","right"]}>x</Table>`), "<table>x</table>");
  });
});

// ─── convertInlineStyles ──────────────────────────────────────────────────────

describe("convertInlineStyles", () => {
  it("converts style string to JSX object", () => {
    const result = convertInlineStyles(`<td style="width: 100%">`);
    assert.ok(result.includes(`style={{width: "100%"}}`));
  });

  it("camelCases hyphenated properties", () => {
    const result = convertInlineStyles(`<td style="border-collapse: collapse">`);
    assert.ok(result.includes("borderCollapse"));
  });

  it("handles multiple properties", () => {
    const result = convertInlineStyles(`<td style="color: red; font-size: 12px">`);
    assert.ok(result.includes(`color: "red"`));
    assert.ok(result.includes(`fontSize: "12px"`));
  });
});
