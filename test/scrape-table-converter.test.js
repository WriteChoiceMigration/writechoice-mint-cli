import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as cheerio from "cheerio";
import { isSimpleTable, tableToMarkdown, wrapWithOriginalComment } from "../src/commands/scrape/table-converter.js";
import { PlaceholderManager } from "../src/commands/scrape/placeholder-manager.js";
import { convertTablesAsMarkdown } from "../src/commands/scrape/html-preserver.js";

function load(html) {
  const $ = cheerio.load(html);
  return { $, $table: $("table").first() };
}

describe("isSimpleTable", () => {
  it("returns true for a plain text table", () => {
    const { $, $table } = load("<table><tr><th>A</th></tr><tr><td>1</td></tr></table>");
    assert.ok(isSimpleTable($, $table));
  });

  it("returns true for a table with inline elements (em, strong, a)", () => {
    const { $, $table } = load(
      "<table><tr><th><strong>Name</strong></th></tr><tr><td><a href='#'>link</a></td></tr></table>"
    );
    assert.ok(isSimpleTable($, $table));
  });

  it("returns false when table contains a <ul>", () => {
    const { $, $table } = load("<table><tr><td><ul><li>item</li></ul></td></tr></table>");
    assert.ok(!isSimpleTable($, $table));
  });

  it("returns false when table contains an <ol>", () => {
    const { $, $table } = load("<table><tr><td><ol><li>item</li></ol></td></tr></table>");
    assert.ok(!isSimpleTable($, $table));
  });

  it("returns false when table contains a <pre>", () => {
    const { $, $table } = load("<table><tr><td><pre>code</pre></td></tr></table>");
    assert.ok(!isSimpleTable($, $table));
  });

  it("returns false when table contains a nested <table>", () => {
    const { $, $table } = load(
      "<table><tr><td><table><tr><td>nested</td></tr></table></td></tr></table>"
    );
    // Outer table — cheerio wraps in html/body, get outermost
    const $outer = $("table").first();
    assert.ok(!isSimpleTable($, $outer));
  });

  it("returns false when table contains a <div>", () => {
    const { $, $table } = load("<table><tr><td><div>block</div></td></tr></table>");
    assert.ok(!isSimpleTable($, $table));
  });
});

describe("tableToMarkdown", () => {
  it("converts a table with thead to a markdown table with separator", () => {
    const { $, $table } = load(
      "<table><thead><tr><th>Name</th><th>Age</th></tr></thead>" +
      "<tbody><tr><td>Alice</td><td>30</td></tr></tbody></table>"
    );
    const md = tableToMarkdown($, $table);
    assert.ok(md.includes("| Name | Age |"), "header row");
    assert.ok(md.includes("| --- | --- |"), "separator row");
    assert.ok(md.includes("| Alice | 30 |"), "data row");
  });

  it("treats first row of th elements as header when no thead", () => {
    const { $, $table } = load(
      "<table><tr><th>Col1</th><th>Col2</th></tr><tr><td>a</td><td>b</td></tr></table>"
    );
    const md = tableToMarkdown($, $table);
    const lines = md.split("\n");
    assert.equal(lines[0], "| Col1 | Col2 |");
    assert.equal(lines[1], "| --- | --- |");
    assert.equal(lines[2], "| a | b |");
  });

  it("outputs rows without a separator when no header row", () => {
    const { $, $table } = load(
      "<table><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></table>"
    );
    const md = tableToMarkdown($, $table);
    assert.ok(!md.includes("---"), "no separator");
    assert.ok(md.includes("| a | b |"));
    assert.ok(md.includes("| c | d |"));
  });

  it("escapes pipe characters inside cells", () => {
    const { $, $table } = load("<table><tr><th>A|B</th></tr><tr><td>x|y</td></tr></table>");
    const md = tableToMarkdown($, $table);
    assert.ok(md.includes("A\\|B"), "pipe in header escaped");
    assert.ok(md.includes("x\\|y"), "pipe in cell escaped");
  });

  it("pads short rows to match column count", () => {
    const { $, $table } = load(
      "<table><thead><tr><th>A</th><th>B</th><th>C</th></tr></thead>" +
      "<tbody><tr><td>1</td></tr></tbody></table>"
    );
    const md = tableToMarkdown($, $table);
    assert.ok(md.includes("| 1 |  |  |"), "short row padded");
  });

  it("returns null for an empty table", () => {
    const { $, $table } = load("<table></table>");
    assert.equal(tableToMarkdown($, $table), null);
  });

  it("collapses whitespace in cell text", () => {
    const { $, $table } = load("<table><tr><th>  hello\n  world  </th></tr></table>");
    const md = tableToMarkdown($, $table);
    assert.ok(md.includes("hello world"), "whitespace collapsed");
  });
});

describe("wrapWithOriginalComment", () => {
  it("wraps html in a JSX block comment above the markdown table", () => {
    const result = wrapWithOriginalComment("<table></table>", "| A |\n| --- |");
    assert.ok(result.startsWith("{/*\n"), "starts with JSX comment open");
    assert.ok(result.includes("<table></table>"), "contains original html");
    assert.ok(result.includes("\n*/}"), "closes JSX comment");
    assert.ok(result.includes("| A |\n| --- |"), "contains markdown table");
  });

  it("escapes */ sequences in the original HTML to prevent comment breakage", () => {
    const result = wrapWithOriginalComment("<td data-x='*/'>oops</td>", "| x |");
    assert.ok(!result.slice(0, result.lastIndexOf("*/}")).includes("*/"), "no raw */ before close");
    assert.ok(result.includes("* /"), "escaped to * /");
  });
});

describe("convertTablesAsMarkdown — integration with html-preserver", () => {
  it("converts a simple table to markdown with JSX comment", () => {
    const $ = cheerio.load("<div><table><thead><tr><th>H</th></tr></thead><tbody><tr><td>V</td></tr></tbody></table></div>");
    const pm = new PlaceholderManager();
    convertTablesAsMarkdown($, pm);

    const html = $.html();
    assert.ok(!html.includes("<table"), "table replaced with placeholder");

    const restored = pm.restore(html);
    assert.ok(restored.includes("{/*"), "JSX comment present");
    assert.ok(restored.includes("| H |"), "markdown header row present");
    assert.ok(restored.includes("| --- |"), "markdown separator present");
    assert.ok(restored.includes("| V |"), "markdown data row present");
  });

  it("keeps a complex table as raw HTML", () => {
    const $ = cheerio.load("<table><tr><td><ul><li>item</li></ul></td></tr></table>");
    const pm = new PlaceholderManager();
    convertTablesAsMarkdown($, pm);

    const restored = pm.restore($.html());
    assert.ok(restored.includes("<table"), "complex table kept as HTML");
    assert.ok(!restored.includes("{/*"), "no JSX comment for complex table");
  });

  it("removes colgroup before conversion", () => {
    const $ = cheerio.load("<table><colgroup><col/></colgroup><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>");
    const pm = new PlaceholderManager();
    convertTablesAsMarkdown($, pm);

    const restored = pm.restore($.html());
    assert.ok(!restored.includes("<colgroup"), "colgroup removed");
    assert.ok(restored.includes("| A |"), "header row present");
  });
});
