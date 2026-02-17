import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractFrontmatterTitle,
  removeDuplicateH1,
} from "../src/commands/fix/h1.js";

// ─────────────────────────────────────────────────────────────────────────────
// extractFrontmatterTitle
// ─────────────────────────────────────────────────────────────────────────────

describe("extractFrontmatterTitle", () => {
  it("returns null when there is no frontmatter", () => {
    assert.equal(extractFrontmatterTitle("# Heading\n\nBody."), null);
  });

  it("returns null when frontmatter has no title field", () => {
    const content = `---\ndescription: Something\n---\n\nBody.`;
    assert.equal(extractFrontmatterTitle(content), null);
  });

  it("returns an unquoted title", () => {
    const content = `---\ntitle: Getting Started\n---\n\nBody.`;
    assert.equal(extractFrontmatterTitle(content), "Getting Started");
  });

  it("returns a double-quoted title (strips quotes)", () => {
    const content = `---\ntitle: "Getting Started"\n---\n\nBody.`;
    assert.equal(extractFrontmatterTitle(content), "Getting Started");
  });

  it("returns a single-quoted title (strips quotes)", () => {
    const content = `---\ntitle: 'Getting Started'\n---\n\nBody.`;
    assert.equal(extractFrontmatterTitle(content), "Getting Started");
  });

  it("trims whitespace from the title value", () => {
    const content = `---\ntitle:   Padded Title   \n---\n\nBody.`;
    assert.equal(extractFrontmatterTitle(content), "Padded Title");
  });

  it("is case-insensitive for the 'title' key", () => {
    const content = `---\nTitle: My Page\n---\n\nBody.`;
    assert.equal(extractFrontmatterTitle(content), "My Page");
  });

  it("returns the correct title when other fields are present", () => {
    const content = `---\ndescription: Intro\ntitle: API Reference\nsidebar: true\n---\n\nBody.`;
    assert.equal(extractFrontmatterTitle(content), "API Reference");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// removeDuplicateH1
// ─────────────────────────────────────────────────────────────────────────────

describe("removeDuplicateH1", () => {
  it("returns unchanged content when there is no frontmatter", () => {
    const content = "# Getting Started\n\nBody.";
    const { newContent, changed } = removeDuplicateH1(content, "Getting Started");
    assert.equal(changed, false);
    assert.equal(newContent, content);
  });

  it("removes the H1 when it matches the title", () => {
    const content = `---\ntitle: Getting Started\n---\n\n# Getting Started\n\nBody.`;
    const { newContent, changed } = removeDuplicateH1(content, "Getting Started");
    assert.equal(changed, true);
    assert.ok(!newContent.includes("# Getting Started"));
    assert.ok(newContent.includes("Body."));
  });

  it("does not change content when H1 does not match the title", () => {
    const content = `---\ntitle: Getting Started\n---\n\n# Introduction\n\nBody.`;
    const { newContent, changed } = removeDuplicateH1(content, "Getting Started");
    assert.equal(changed, false);
    assert.equal(newContent, content);
  });

  it("does not change content when there is no H1 after frontmatter", () => {
    const content = `---\ntitle: Getting Started\n---\n\nBody without a heading.`;
    const { newContent, changed } = removeDuplicateH1(content, "Getting Started");
    assert.equal(changed, false);
    assert.equal(newContent, content);
  });

  it("removes the H1 and the immediately following blank line", () => {
    const content = `---\ntitle: My Page\n---\n\n# My Page\n\nFirst paragraph.`;
    const { newContent, changed } = removeDuplicateH1(content, "My Page");
    assert.equal(changed, true);
    // The blank line after the H1 should also be gone
    assert.ok(!newContent.includes("# My Page\n\n"));
    assert.ok(newContent.includes("First paragraph."));
  });

  it("removes H1 that follows one import statement", () => {
    const content = [
      "---",
      "title: test",
      "---",
      "",
      'import { InlineImage } from "/snippets/InlineImage.jsx";',
      "",
      "# test",
      "",
      "Body.",
    ].join("\n");
    const { newContent, changed } = removeDuplicateH1(content, "test");
    assert.equal(changed, true);
    assert.ok(!newContent.includes("# test"));
    assert.ok(newContent.includes("Body."));
  });

  it("removes H1 that follows multiple import statements", () => {
    const content = [
      "---",
      "title: My Page",
      "---",
      "",
      'import { Foo } from "/snippets/Foo.jsx";',
      'import { Bar } from "/snippets/Bar.jsx";',
      "",
      "# My Page",
      "",
      "Body.",
    ].join("\n");
    const { newContent, changed } = removeDuplicateH1(content, "My Page");
    assert.equal(changed, true);
    assert.ok(!newContent.includes("# My Page"));
    assert.ok(newContent.includes("Body."));
  });

  it("does not remove H1 that is not the first content line", () => {
    const content = `---\ntitle: My Page\n---\n\nSome intro text.\n\n# My Page\n\nBody.`;
    const { newContent, changed } = removeDuplicateH1(content, "My Page");
    assert.equal(changed, false);
    assert.equal(newContent, content);
  });

  it("does not remove H2 or lower headings", () => {
    const content = `---\ntitle: My Page\n---\n\n## My Page\n\nBody.`;
    const { newContent, changed } = removeDuplicateH1(content, "My Page");
    assert.equal(changed, false);
    assert.equal(newContent, content);
  });

  it("is idempotent — running twice produces no further change", () => {
    const content = `---\ntitle: Getting Started\n---\n\n# Getting Started\n\nBody.`;
    const { newContent: pass1 } = removeDuplicateH1(content, "Getting Started");
    const { newContent: pass2, changed: changed2 } = removeDuplicateH1(
      pass1,
      "Getting Started"
    );
    assert.equal(changed2, false);
    assert.equal(pass1, pass2);
  });

  it("preserves frontmatter content exactly", () => {
    const content = `---\ntitle: My Page\ndescription: A description.\nsidebar: true\n---\n\n# My Page\n\nBody.`;
    const { newContent } = removeDuplicateH1(content, "My Page");
    assert.ok(newContent.startsWith("---\ntitle: My Page\ndescription: A description.\nsidebar: true\n---\n"));
  });

  it("handles Windows-style CRLF line endings in frontmatter", () => {
    const content = "---\r\ntitle: My Page\r\n---\r\n\n# My Page\n\nBody.";
    const { changed } = removeDuplicateH1(content, "My Page");
    assert.equal(changed, true);
  });
});
