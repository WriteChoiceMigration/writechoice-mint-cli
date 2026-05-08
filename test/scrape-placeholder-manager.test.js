import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PlaceholderManager } from "../src/commands/scrape/placeholder-manager.js";

describe("PlaceholderManager — store / restore", () => {
  it("round-trips a single stored value", () => {
    const pm = new PlaceholderManager();
    const ph = pm.store("<table><tr><td>A</td></tr></table>", "TABLE");
    assert.match(ph, /^\|\|TABLE\|\d+\|[a-f0-9]+\|\|$/);
    const restored = pm.restore(`before ${ph} after`);
    assert.equal(restored, "before <table><tr><td>A</td></tr></table> after");
  });

  it("round-trips multiple stored values independently", () => {
    const pm = new PlaceholderManager();
    const ph1 = pm.store("<table>1</table>", "TABLE");
    const ph2 = pm.store("<iframe src='x'/>", "IFRAME");
    const text = `${ph1} middle ${ph2}`;
    const restored = pm.restore(text);
    assert.equal(restored, "<table>1</table> middle <iframe src='x'/>");
  });

  it("leaves text unchanged when no placeholders are present", () => {
    const pm = new PlaceholderManager();
    assert.equal(pm.restore("hello world"), "hello world");
  });

  it("uses incrementing counters so placeholders are unique across calls", () => {
    const pm = new PlaceholderManager();
    const ph1 = pm.store("a", "X");
    const ph2 = pm.store("b", "X");
    assert.notEqual(ph1, ph2);
  });
});

describe("PlaceholderManager — createComponentPlaceholder", () => {
  it("produces the correct open/close structure", () => {
    const pm = new PlaceholderManager();
    const ph = pm.createComponentPlaceholder("NOTE", "some content", { title: "Heads up" });
    assert.match(ph, /^NOTE\|OPEN\|title="Heads up"\|\n/);
    assert.match(ph, /NOTE\|CLOSE$/);
    assert.ok(ph.includes("some content"));
  });

  it("handles empty props", () => {
    const pm = new PlaceholderManager();
    const ph = pm.createComponentPlaceholder("WARNING", "watch out", {});
    assert.match(ph, /^WARNING\|OPEN\|\|/);
  });

  it("serialises multiple props", () => {
    const pm = new PlaceholderManager();
    const ph = pm.createComponentPlaceholder("CARD", "body", { title: "T", href: "/x" });
    assert.ok(ph.includes('title="T"'));
    assert.ok(ph.includes('href="/x"'));
  });
});

describe("PlaceholderManager — replaceComponentPlaceholders", () => {
  it("replaces a NOTE placeholder with <Note> tags", () => {
    const pm = new PlaceholderManager();
    const ph = pm.createComponentPlaceholder("NOTE", "inner text", {});
    const result = pm.replaceComponentPlaceholders(ph);
    assert.equal(result, "<Note>\ninner text\n</Note>");
  });

  it("maps all known callout types to correct MDX names", () => {
    const pm = new PlaceholderManager();
    const types = ["NOTE", "WARNING", "TIP", "INFO", "CHECK", "DANGER"];
    const expected = ["Note", "Warning", "Tip", "Info", "Check", "Danger"];
    for (let i = 0; i < types.length; i++) {
      const ph = pm.createComponentPlaceholder(types[i], "x", {});
      const result = pm.replaceComponentPlaceholders(ph);
      assert.ok(result.startsWith(`<${expected[i]}`), `${types[i]} → ${expected[i]}`);
    }
  });

  it("maps ACCORDION to <Accordion>", () => {
    const pm = new PlaceholderManager();
    const ph = pm.createComponentPlaceholder("ACCORDION", "details", { title: "FAQ" });
    const result = pm.replaceComponentPlaceholders(ph);
    assert.match(result, /<Accordion title="FAQ">/);
    assert.ok(result.includes("</Accordion>"));
  });

  it("handles CALLOUTTITLE:...|TITLEBREAK| prefix", () => {
    const pm = new PlaceholderManager();
    const ph = pm.createComponentPlaceholder("NOTE", "CALLOUTTITLE:My Title|TITLEBREAK|body text", {});
    const result = pm.replaceComponentPlaceholders(ph);
    assert.ok(result.includes("**My Title**"));
    assert.ok(result.includes("body text"));
  });

  it("passes props through to JSX attributes", () => {
    const pm = new PlaceholderManager();
    const ph = pm.createComponentPlaceholder("CARD", "content", { title: "Go", href: "/go" });
    const result = pm.replaceComponentPlaceholders(ph);
    assert.ok(result.includes('title="Go"'));
    assert.ok(result.includes('href="/go"'));
  });
});

describe("PlaceholderManager — escapeHtmlEntities", () => {
  it("escapes bare < and > outside code blocks", () => {
    const pm = new PlaceholderManager();
    const result = pm.escapeHtmlEntities("x < y and a > b");
    assert.ok(result.includes("&lt;"));
    assert.ok(result.includes("&gt;"));
  });

  it("does not escape inside fenced code blocks", () => {
    const pm = new PlaceholderManager();
    const input = "```\nif x < y:\n    pass\n```";
    const result = pm.escapeHtmlEntities(input);
    assert.ok(result.includes("x < y"), "should not escape inside code block");
  });

  it("does not escape valid HTML tags", () => {
    const pm = new PlaceholderManager();
    const result = pm.escapeHtmlEntities("<Note>some text</Note>");
    assert.ok(result.includes("<Note>"), "opening tag preserved");
    assert.ok(result.includes("</Note>"), "closing tag preserved");
  });

  it("skips placeholder lines", () => {
    const pm = new PlaceholderManager();
    const ph = pm.store("<table>x</table>", "TABLE");
    const result = pm.escapeHtmlEntities(ph);
    assert.equal(result, ph, "placeholder line should pass through unchanged");
  });
});
