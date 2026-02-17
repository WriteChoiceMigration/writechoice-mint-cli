import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  processContent,
  processInfoTokens,
} from "../src/commands/fix/codeblocks.js";

// ─────────────────────────────────────────────────────────────────────────────
// processInfoTokens — unit tests for token manipulation
// ─────────────────────────────────────────────────────────────────────────────

describe("processInfoTokens — expandable", () => {
  const opts = (overrides) => ({ threshold: 15, expandable: true, ...overrides });

  it("adds expandable when lineCount > threshold", () => {
    const { newTokens, changes } = processInfoTokens(["js"], 20, 1, opts());
    assert.ok(newTokens.includes("expandable"));
    assert.equal(changes.length, 1);
  });

  it("removes expandable when lineCount < threshold", () => {
    const { newTokens } = processInfoTokens(["js", "expandable"], 5, 1, opts());
    assert.ok(!newTokens.includes("expandable"));
  });

  it("does not touch expandable when lineCount === threshold (boundary)", () => {
    const { newTokens: without } = processInfoTokens(["js"], 15, 1, opts());
    assert.ok(!without.includes("expandable"), "not added at exact threshold");

    const { newTokens: withExp } = processInfoTokens(["js", "expandable"], 15, 1, opts());
    assert.ok(withExp.includes("expandable"), "not removed at exact threshold");
  });

  it("skips expandable processing when expandable: false", () => {
    const { newTokens } = processInfoTokens(["js"], 20, 1, opts({ expandable: false }));
    assert.ok(!newTokens.includes("expandable"));
  });

  it("respects custom threshold", () => {
    const { newTokens } = processInfoTokens(["js"], 5, 1, opts({ threshold: 3 }));
    assert.ok(newTokens.includes("expandable"));
  });
});

describe("processInfoTokens — lines", () => {
  const opts = (overrides) => ({ threshold: 15, expandable: false, ...overrides });

  it("adds lines when --lines flag is set and lines is absent", () => {
    const { newTokens } = processInfoTokens(["js"], 5, 1, opts({ lines: true }));
    assert.ok(newTokens.includes("lines"));
  });

  it("does not add lines if already present", () => {
    const { newTokens } = processInfoTokens(["js", "lines"], 5, 1, opts({ lines: true }));
    assert.equal(newTokens.filter((t) => t === "lines").length, 1);
  });

  it("removes lines when --remove-lines is set and lines is present", () => {
    const { newTokens } = processInfoTokens(["js", "lines"], 5, 1, opts({ removeLines: true }));
    assert.ok(!newTokens.includes("lines"));
  });

  it("does not remove lines if not present", () => {
    const { changes } = processInfoTokens(["js"], 5, 1, opts({ removeLines: true }));
    assert.equal(changes.length, 0);
  });
});

describe("processInfoTokens — wrap", () => {
  const opts = (overrides) => ({ threshold: 15, expandable: false, ...overrides });

  it("adds wrap when --wrap flag is set and wrap is absent", () => {
    const { newTokens } = processInfoTokens(["js"], 5, 1, opts({ wrap: true }));
    assert.ok(newTokens.includes("wrap"));
  });

  it("removes wrap when --remove-wrap is set and wrap is present", () => {
    const { newTokens } = processInfoTokens(["js", "wrap"], 5, 1, opts({ removeWrap: true }));
    assert.ok(!newTokens.includes("wrap"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// processContent — integration
// ─────────────────────────────────────────────────────────────────────────────

describe("processContent", () => {
  const makeBlock = (info, lines = 5) => {
    const body = Array.from({ length: lines }, (_, i) => `line ${i + 1}`).join("\n");
    return `\`\`\`${info}\n${body}\n\`\`\`\n`;
  };

  it("adds expandable to a block with more lines than threshold", () => {
    const content = makeBlock("js", 20);
    const { newContent, changes } = processContent(content, { threshold: 15, expandable: true });
    assert.ok(newContent.includes("```js expandable"));
    assert.equal(changes.length, 1);
  });

  it("removes expandable from a block with fewer lines than threshold", () => {
    const content = makeBlock("js expandable", 5);
    const { newContent } = processContent(content, { threshold: 15, expandable: true });
    assert.ok(!newContent.includes("expandable"));
  });

  it("preserves the language token when adding expandable", () => {
    const content = makeBlock("python", 20);
    const { newContent } = processContent(content, { threshold: 15, expandable: true });
    assert.ok(newContent.includes("python"));
    assert.ok(newContent.includes("expandable"));
  });

  it("adds lines to all code blocks", () => {
    const content = makeBlock("js", 5) + "\n" + makeBlock("ts", 5);
    const { changes } = processContent(content, { threshold: 15, lines: true });
    assert.equal(changes.length, 2);
  });

  it("does not change content when no flags are set and expandable is disabled", () => {
    const content = makeBlock("js", 5);
    const { newContent, changes } = processContent(content, { expandable: false });
    assert.equal(changes.length, 0);
    assert.equal(newContent, content);
  });

  it("preserves content outside code blocks unchanged", () => {
    const content = "Some intro text.\n\n" + makeBlock("js", 5) + "\nTrailing text.\n";
    const { newContent } = processContent(content, { expandable: false, lines: true });
    assert.ok(newContent.includes("Some intro text."));
    assert.ok(newContent.includes("Trailing text."));
  });

  it("handles files with no code blocks", () => {
    const content = "# Heading\n\nJust text here.\n";
    const { newContent, changes } = processContent(content, { threshold: 15, expandable: true });
    assert.equal(changes.length, 0);
    assert.equal(newContent, content);
  });
});
