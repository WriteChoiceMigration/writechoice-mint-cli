import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as cheerio from "cheerio";
import { PlaceholderManager } from "../src/commands/scrape/placeholder-manager.js";
import {
  processCallouts,
  processDetailsElements,
  processAccordions,
  processCards,
  processTabs,
  processCodeGroups,
  processNumberedLists,
  processAllComponents,
} from "../src/commands/scrape/component-processor.js";

function load(html) {
  return cheerio.load(html);
}

// ─── processCallouts ─────────────────────────────────────────────────────────

describe("processCallouts", () => {
  it("replaces a note callout element with a NOTE placeholder", () => {
    const $ = load('<div class="callout note"><p>content</p></div>');
    const pm = new PlaceholderManager();
    processCallouts($, [{ type: "Note", selector: ".callout.note" }], pm);
    const html = $.html();
    assert.ok(!html.includes('<div class="callout note">'), "original element removed");
    const result = pm.replaceComponentPlaceholders(html);
    assert.ok(result.includes("<Note>"), "Note component rendered");
  });

  it("extracts title from title_selector and removes it from content", () => {
    const $ = load('<div class="callout"><h5 class="title">Heads up</h5><p>body</p></div>');
    const pm = new PlaceholderManager();
    processCallouts($, [{ type: "Note", selector: ".callout", title_selector: ".title" }], pm);
    const result = pm.replaceComponentPlaceholders($.html());
    assert.ok(result.includes("**Heads up**"), "title bolded");
    assert.ok(!result.includes("<h5"), "title element removed from inner content");
  });

  it("maps all callout types to correct placeholder types", () => {
    const types = ["Note", "Info", "Warning", "Tip", "Check", "Danger"];
    for (const type of types) {
      const $ = load(`<div class="c">text</div>`);
      const pm = new PlaceholderManager();
      processCallouts($, [{ type, selector: ".c" }], pm);
      const result = pm.replaceComponentPlaceholders($.html());
      assert.ok(result.includes(`<${type}>`), `${type} maps correctly`);
    }
  });

  it("uses content_selector when provided", () => {
    const $ = load('<div class="callout"><div class="body"><p>inner</p></div></div>');
    const pm = new PlaceholderManager();
    processCallouts($, [{ type: "Note", selector: ".callout", content_selector: ".body" }], pm);
    const result = pm.replaceComponentPlaceholders($.html());
    assert.ok(result.includes("inner"), "inner content included");
  });
});

// ─── processDetailsElements ──────────────────────────────────────────────────

describe("processDetailsElements", () => {
  it("converts a single <details> to an Accordion inside AccordionGroup", () => {
    const $ = load("<details><summary>FAQ</summary><p>Answer</p></details>");
    const pm = new PlaceholderManager();
    processDetailsElements($, pm);
    const result = pm.replaceComponentPlaceholders($.html());
    // Cheerio lowercases injected wrapper tags; inner Accordion tags come from placeholder
    // replacement and keep their PascalCase.
    assert.ok(result.includes("<accordiongroup>"), "wrapped in AccordionGroup (lowercased by cheerio)");
    assert.ok(result.includes('<Accordion title="FAQ">'), "title from summary");
    assert.ok(result.includes("<p>Answer</p>"), "content preserved");
  });

  it("groups consecutive <details> into one AccordionGroup", () => {
    const $ = load(`
      <details><summary>Q1</summary><p>A1</p></details>
      <details><summary>Q2</summary><p>A2</p></details>
    `);
    const pm = new PlaceholderManager();
    processDetailsElements($, pm);
    const result = pm.replaceComponentPlaceholders($.html());
    const count = (result.match(/<accordiongroup>/g) || []).length;
    assert.equal(count, 1, "exactly one AccordionGroup for consecutive items");
    assert.ok(result.includes('<Accordion title="Q1">'));
    assert.ok(result.includes('<Accordion title="Q2">'));
  });

  it("uses 'Details' as fallback title when summary is empty", () => {
    const $ = load("<details><summary></summary><p>body</p></details>");
    const pm = new PlaceholderManager();
    processDetailsElements($, pm);
    const result = pm.replaceComponentPlaceholders($.html());
    assert.ok(result.includes('title="Details"'));
  });

  it("does not produce AccordionGroup when no details elements present", () => {
    const $ = load("<p>just a paragraph</p>");
    const pm = new PlaceholderManager();
    processDetailsElements($, pm);
    assert.ok(!$.html().includes("accordiongroup"));
  });
});

// ─── processAccordions ───────────────────────────────────────────────────────

describe("processAccordions", () => {
  it("wraps items in AccordionGroup when group_selector is set", () => {
    const $ = load(`
      <div class="faq-group">
        <div class="faq-item"><h3 class="q">Question 1</h3><p>Answer 1</p></div>
        <div class="faq-item"><h3 class="q">Question 2</h3><p>Answer 2</p></div>
      </div>
    `);
    const pm = new PlaceholderManager();
    processAccordions($, {
      group_selector: ".faq-group",
      item_selector: ".faq-item",
      title_selector: ".q",
    }, pm);
    const result = pm.replaceComponentPlaceholders($.html());
    assert.ok(result.includes("<accordiongroup>"), "wrapper tag (lowercased by cheerio)");
    assert.ok(result.includes('<Accordion title="Question 1">'));
    assert.ok(result.includes('<Accordion title="Question 2">'));
  });

  it("collects all matching items when no group_selector", () => {
    const $ = load(`
      <div class="item"><h3 class="t">T1</h3><p>B1</p></div>
      <div class="item"><h3 class="t">T2</h3><p>B2</p></div>
    `);
    const pm = new PlaceholderManager();
    processAccordions($, { item_selector: ".item", title_selector: ".t" }, pm);
    const result = pm.replaceComponentPlaceholders($.html());
    assert.ok(result.includes("<accordiongroup>"), "wrapper tag (lowercased by cheerio)");
    assert.ok(result.includes("T1"));
    assert.ok(result.includes("T2"));
  });

  it("does nothing when no matching items", () => {
    const $ = load("<div>no items here</div>");
    const pm = new PlaceholderManager();
    processAccordions($, { item_selector: ".missing", title_selector: ".t" }, pm);
    assert.ok(!$.html().includes("AccordionGroup"));
  });
});

// ─── processCards ────────────────────────────────────────────────────────────

describe("processCards", () => {
  it("wraps cards in Columns when group_selector is set", () => {
    const $ = load(`
      <div class="cards">
        <a class="card" href="/go"><h4 class="ct">Go</h4><p>desc</p></a>
      </div>
    `);
    const pm = new PlaceholderManager();
    processCards($, {
      group_selector: ".cards",
      item_selector: ".card",
      title_selector: ".ct",
    }, pm);
    const result = pm.replaceComponentPlaceholders($.html());
    assert.ok(result.includes("<columns"), "Columns wrapper tag (lowercased by cheerio)");
    assert.ok(result.includes('<Card title="Go"'), "Card tag from placeholder replacement keeps PascalCase");
  });

  it("includes href from the card element", () => {
    const $ = load(`
      <div class="cards">
        <a class="card" href="/docs"><h4 class="ct">Docs</h4></a>
      </div>
    `);
    const pm = new PlaceholderManager();
    processCards($, {
      group_selector: ".cards",
      item_selector: ".card",
      title_selector: ".ct",
    }, pm);
    const result = pm.replaceComponentPlaceholders($.html());
    assert.ok(result.includes('href="/docs"'));
  });

  it("groups consecutive sibling cards without group_selector", () => {
    const $ = load(`
      <a class="card" href="/a"><h4 class="ct">A</h4></a>
      <a class="card" href="/b"><h4 class="ct">B</h4></a>
    `);
    const pm = new PlaceholderManager();
    processCards($, { item_selector: ".card", title_selector: ".ct" }, pm);
    const result = pm.replaceComponentPlaceholders($.html());
    const count = (result.match(/<columns/g) || []).length;
    assert.equal(count, 1, "consecutive cards go into one Columns wrapper");
  });
});

// ─── processTabs ─────────────────────────────────────────────────────────────

describe("processTabs", () => {
  it("converts a tab group to <Tabs> with <Tab> children", () => {
    const $ = load(`
      <div class="tab-group">
        <div class="tab-item" data-tab-title="Install">npm install x</div>
        <div class="tab-item" data-tab-title="Usage">import x</div>
      </div>
    `);
    const pm = new PlaceholderManager();
    processTabs($, { group_selector: ".tab-group", item_selector: ".tab-item", title_attr: "data-tab-title" }, pm);
    const result = pm.replaceComponentPlaceholders($.html());
    assert.ok(result.includes("<tabs>"), "Tabs wrapper tag (lowercased by cheerio)");
    assert.ok(result.includes('<Tab title="Install">'), "Tab items keep PascalCase from placeholder replacement");
    assert.ok(result.includes('<Tab title="Usage">'));
  });

  it("uses title_attr when provided", () => {
    const $ = load(`
      <div class="tg">
        <div class="ti" aria-label="Step 1">content 1</div>
      </div>
    `);
    const pm = new PlaceholderManager();
    processTabs($, { group_selector: ".tg", item_selector: ".ti", title_attr: "aria-label" }, pm);
    const result = pm.replaceComponentPlaceholders($.html());
    assert.ok(result.includes('<Tab title="Step 1">'));
  });
});

// ─── processCodeGroups ───────────────────────────────────────────────────────

describe("processCodeGroups", () => {
  it("wraps multiple code blocks in a CODEGROUP placeholder", () => {
    const $ = load(`
      <div class="code-group">
        <pre><code class="language-js">js code</code></pre>
        <pre><code class="language-py">py code</code></pre>
      </div>
    `);
    const pm = new PlaceholderManager();
    processCodeGroups($, { group_selector: ".code-group" }, pm);
    const result = pm.replaceComponentPlaceholders($.html());
    assert.ok(result.includes("<CodeGroup>"));
  });

  it("does not wrap a group containing only one code block", () => {
    const $ = load(`
      <div class="code-group">
        <pre><code>single</code></pre>
      </div>
    `);
    const pm = new PlaceholderManager();
    processCodeGroups($, { group_selector: ".code-group" }, pm);
    assert.ok(!$.html().includes("CODEGROUP"), "no placeholder for single block");
  });
});

// ─── processNumberedLists ────────────────────────────────────────────────────

describe("processNumberedLists", () => {
  it("converts matching <ul> to <ol>", () => {
    const $ = load('<ul class="steps"><li>One</li><li>Two</li></ul>');
    processNumberedLists($, { selector: "ul.steps" });
    assert.ok($.html().includes("<ol>"), "converted to ordered list");
    assert.ok(!$.html().includes('<ul class="steps">'), "original unordered list gone");
  });

  it("leaves non-matching lists unchanged", () => {
    const $ = load("<ul><li>A</li></ul>");
    processNumberedLists($, { selector: "ul.steps" });
    assert.ok($.html().includes("<ul>"), "unmatched list untouched");
  });
});

// ─── processAllComponents — dispatch ─────────────────────────────────────────

describe("processAllComponents — dispatch", () => {
  it("dispatches to generic processor when componentsConfig is an array", () => {
    const $ = load("<details><summary>Q</summary><p>A</p></details>");
    const pm = new PlaceholderManager();
    // An empty array still runs processDetailsElements
    processAllComponents($, [], pm);
    const result = pm.replaceComponentPlaceholders($.html());
    assert.ok(result.includes("<accordiongroup>"), "details processed via generic path (wrapper lowercased by cheerio)");
  });

  it("dispatches to legacy processor when componentsConfig is an object", () => {
    const $ = load('<div class="note"><p>text</p></div>');
    const pm = new PlaceholderManager();
    processAllComponents($, { callouts: [{ type: "Note", selector: ".note" }] }, pm);
    const result = pm.replaceComponentPlaceholders($.html());
    assert.ok(result.includes("<Note>"));
  });

  it("always converts native <details> in legacy mode", () => {
    const $ = load("<details><summary>Q</summary><p>A</p></details>");
    const pm = new PlaceholderManager();
    processAllComponents($, {}, pm);
    const result = pm.replaceComponentPlaceholders($.html());
    assert.ok(result.includes("<accordiongroup>"), "wrapper lowercased by cheerio");
  });
});
