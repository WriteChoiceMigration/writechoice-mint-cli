import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as cheerio from "cheerio";
import {
  detectLanguageFromClasses,
  preProcessCodeBlocks,
  createTurndownCodeRule,
} from "../src/commands/scrape/codeblock-processor.js";

// ─── detectLanguageFromClasses ───────────────────────────────────────────────

describe("detectLanguageFromClasses — class pattern matching", () => {
  const patterns = ["language-", "lang-", "highlight-"];

  function makeEl(html) {
    const $ = cheerio.load(html);
    const el = $("code").first();
    return { el, $ };
  }

  it("detects language from 'language-' prefix", () => {
    const { el, $ } = makeEl('<code class="language-typescript">');
    assert.equal(detectLanguageFromClasses(el, $, patterns), "typescript");
  });

  it("detects language from 'lang-' prefix", () => {
    const { el, $ } = makeEl('<code class="lang-python">');
    assert.equal(detectLanguageFromClasses(el, $, patterns), "python");
  });

  it("normalises 'js' alias to 'javascript'", () => {
    const { el, $ } = makeEl('<code class="language-js">');
    assert.equal(detectLanguageFromClasses(el, $, patterns), "javascript");
  });

  it("normalises 'ts' alias to 'typescript'", () => {
    const { el, $ } = makeEl('<code class="language-ts">');
    assert.equal(detectLanguageFromClasses(el, $, patterns), "typescript");
  });

  it("normalises 'sh' alias to 'bash'", () => {
    const { el, $ } = makeEl('<code class="language-sh">');
    assert.equal(detectLanguageFromClasses(el, $, patterns), "bash");
  });

  it("normalises 'yml' alias to 'yaml'", () => {
    const { el, $ } = makeEl('<code class="lang-yml">');
    assert.equal(detectLanguageFromClasses(el, $, patterns), "yaml");
  });

  it("uses data-language attribute when present", () => {
    const { el, $ } = makeEl('<code data-language="go">');
    assert.equal(detectLanguageFromClasses(el, $, patterns), "go");
  });

  it("uses data-lang attribute when present", () => {
    const { el, $ } = makeEl('<code data-lang="rust">');
    assert.equal(detectLanguageFromClasses(el, $, patterns), "rust");
  });

  it("returns empty string when no recognisable class", () => {
    const { el, $ } = makeEl('<code class="some-other-class">');
    assert.equal(detectLanguageFromClasses(el, $, patterns), "");
  });

  it("falls back to parent element class when child has no matching class", () => {
    const $ = cheerio.load('<pre class="language-java"><code>src</code></pre>');
    const el = $("code").first();
    assert.equal(detectLanguageFromClasses(el, $, patterns), "java");
  });
});

// ─── preProcessCodeBlocks ────────────────────────────────────────────────────

describe("preProcessCodeBlocks", () => {
  it("sets data-detected-lang on <pre> when language is detected", () => {
    const $ = cheerio.load('<pre><code class="language-python">print()</code></pre>');
    preProcessCodeBlocks($);
    assert.equal($("pre").attr("data-detected-lang"), "python");
  });

  it("does not set data-detected-lang when language cannot be detected", () => {
    const $ = cheerio.load("<pre><code>plain text</code></pre>");
    preProcessCodeBlocks($);
    assert.equal($("pre").attr("data-detected-lang"), undefined);
  });

  it("respects custom language_class_patterns from config", () => {
    const $ = cheerio.load('<pre><code class="hljs-javascript">code</code></pre>');
    preProcessCodeBlocks($, ["hljs-"]);
    assert.equal($("pre").attr("data-detected-lang"), "javascript");
  });

  it("annotates multiple pre blocks independently", () => {
    const $ = cheerio.load(`
      <pre><code class="language-go">go code</code></pre>
      <pre><code class="language-rust">rust code</code></pre>
    `);
    preProcessCodeBlocks($);
    const langs = $("pre").map((_, el) => $(el).attr("data-detected-lang")).get();
    assert.deepEqual(langs, ["go", "rust"]);
  });
});

// ─── createTurndownCodeRule ──────────────────────────────────────────────────

describe("createTurndownCodeRule", () => {
  it("returns a rule object with filter and replacement", () => {
    const rule = createTurndownCodeRule();
    assert.deepEqual(rule.filter, ["pre"]);
    assert.equal(typeof rule.replacement, "function");
  });

  it("replacement wraps content in fenced code block", () => {
    const rule = createTurndownCodeRule();
    // Simulate a minimal DOM node (like what turndown passes)
    const node = {
      getAttribute: (attr) => (attr === "data-detected-lang" ? "python" : ""),
      querySelector: () => ({ textContent: "print('hello')" }),
      textContent: "print('hello')",
    };
    const result = rule.replacement("", node);
    assert.ok(result.includes("```python"), "opening fence with language");
    assert.ok(result.includes("print('hello')"), "code content");
    assert.ok(result.includes("```\n\n") || result.endsWith("```"), "closing fence");
  });

  it("omits language when data-detected-lang is absent", () => {
    const rule = createTurndownCodeRule();
    const node = {
      getAttribute: () => "",
      querySelector: () => ({ textContent: "no lang" }),
      textContent: "no lang",
    };
    const result = rule.replacement("", node);
    assert.ok(result.includes("```\n"), "fence with no language label");
    assert.ok(!result.match(/```[a-z]+/), "no language identifier added");
  });
});
