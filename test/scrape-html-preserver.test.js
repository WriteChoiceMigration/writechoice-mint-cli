import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as cheerio from "cheerio";
import { PlaceholderManager } from "../src/commands/scrape/placeholder-manager.js";
import { preserveAll } from "../src/commands/scrape/html-preserver.js";

function load(html) {
  return cheerio.load(html);
}

describe("preserveAll — standard elements", () => {
  it("replaces a <table> with a placeholder and restores it", () => {
    const $ = load("<div><table><tr><td>A</td></tr></table><p>text</p></div>");
    const pm = new PlaceholderManager();
    preserveAll($, ["table"], [], pm);

    const html = $.html();
    assert.ok(!html.includes("<table>"), "table replaced with placeholder");

    const restored = pm.restore(html);
    assert.ok(restored.includes("<table>"), "table restored");
    assert.ok(restored.includes("<td>A</td>"), "table content intact");
    assert.ok(restored.includes("<p>text</p>"), "surrounding content preserved");
  });

  it("replaces an <iframe> with a placeholder and restores it", () => {
    const $ = load('<div><iframe src="https://example.com"></iframe></div>');
    const pm = new PlaceholderManager();
    preserveAll($, ["iframe"], [], pm);

    const html = $.html();
    assert.ok(!html.includes("<iframe"), "iframe replaced");

    const restored = pm.restore(html);
    assert.ok(restored.includes("<iframe"), "iframe restored");
  });

  it("preserves multiple tables independently", () => {
    const $ = load("<table id='t1'><tr><td>1</td></tr></table><table id='t2'><tr><td>2</td></tr></table>");
    const pm = new PlaceholderManager();
    preserveAll($, ["table"], [], pm);

    const html = $.html();
    const restored = pm.restore(html);
    assert.ok(restored.includes("id=\"t1\""), "first table restored");
    assert.ok(restored.includes("id=\"t2\""), "second table restored");
  });

  it("removes <colgroup> from tables before preserving", () => {
    const $ = load("<table><colgroup><col/></colgroup><tr><td>X</td></tr></table>");
    const pm = new PlaceholderManager();
    preserveAll($, ["table"], [], pm);

    const restored = pm.restore($.html());
    assert.ok(!restored.includes("<colgroup>"), "colgroup removed");
    assert.ok(restored.includes("<td>X</td>"), "table data preserved");
  });
});

describe("preserveAll — custom selectors", () => {
  it("preserves elements matching a custom CSS selector", () => {
    const $ = load('<div class="preserve-me"><p>keep this</p></div><p>outside</p>');
    const pm = new PlaceholderManager();
    preserveAll($, [], [".preserve-me"], pm);

    const html = $.html();
    assert.ok(!html.includes("keep this"), "preserved element replaced with placeholder");

    const restored = pm.restore(html);
    assert.ok(restored.includes("keep this"), "content restored");
    assert.ok(restored.includes("outside"), "non-matching content untouched");
  });

  it("handles multiple custom selectors independently", () => {
    const $ = load('<div class="a">AAA</div><div class="b">BBB</div><p>CCC</p>');
    const pm = new PlaceholderManager();
    preserveAll($, [], [".a", ".b"], pm);

    const html = $.html();
    const restored = pm.restore(html);
    assert.ok(restored.includes("AAA"), "first selector content restored");
    assert.ok(restored.includes("BBB"), "second selector content restored");
    assert.ok(restored.includes("CCC"), "non-matched content untouched");
  });
});

describe("preserveAll — empty config", () => {
  it("leaves document unchanged when no elements or selectors specified", () => {
    const html = "<div><p>hello</p></div>";
    const $ = load(html);
    const pm = new PlaceholderManager();
    preserveAll($, [], [], pm);
    assert.ok($.html().includes("hello"), "content unchanged");
  });
});
