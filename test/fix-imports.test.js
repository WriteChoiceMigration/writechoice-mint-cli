import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractComponentNames,
  extractImports,
  buildImportLine,
  insertImportLines,
  MINTLIFY_COMPONENTS,
} from "../src/commands/fix/imports.js";

// ─────────────────────────────────────────────────────────────────────────────
// extractComponentNames
// ─────────────────────────────────────────────────────────────────────────────

describe("extractComponentNames", () => {
  it("extracts a single PascalCase component", () => {
    const names = extractComponentNames("<MyButton />");
    assert.ok(names.has("MyButton"));
  });

  it("extracts a component with children", () => {
    const names = extractComponentNames("<MyCard>\n  content\n</MyCard>");
    assert.ok(names.has("MyCard"));
  });

  it("does not extract lowercase HTML tags", () => {
    const names = extractComponentNames("<div><span>text</span></div>");
    assert.equal(names.size, 0);
  });

  it("extracts multiple components from the same content", () => {
    const names = extractComponentNames("<Alpha />\n<Beta foo='1'>\n</Beta>");
    assert.ok(names.has("Alpha"));
    assert.ok(names.has("Beta"));
  });

  it("does not extract components inside fenced code blocks", () => {
    const content = "```\n<MyComponent />\n```";
    const names = extractComponentNames(content);
    assert.equal(names.size, 0);
  });

  it("does not extract components inside inline code", () => {
    const names = extractComponentNames("Use `<MyComponent />` as shown.");
    assert.equal(names.size, 0);
  });

  it("does not extract components inside JSX comments", () => {
    const names = extractComponentNames("{/* <HiddenComp /> */}");
    assert.equal(names.size, 0);
  });

  it("counts each component only once even if used multiple times", () => {
    const names = extractComponentNames("<Foo />\n<Foo />\n<Foo />");
    assert.equal(names.size, 1);
    assert.ok(names.has("Foo"));
  });

  it("extracts component from closing tag", () => {
    const names = extractComponentNames("<MyComp>text</MyComp>");
    assert.ok(names.has("MyComp"));
    assert.equal(names.size, 1); // opening and closing = same component name
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MINTLIFY_COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

describe("MINTLIFY_COMPONENTS", () => {
  it("contains Note", () => assert.ok(MINTLIFY_COMPONENTS.has("Note")));
  it("contains Frame", () => assert.ok(MINTLIFY_COMPONENTS.has("Frame")));
  it("contains Card", () => assert.ok(MINTLIFY_COMPONENTS.has("Card")));
  it("contains Steps", () => assert.ok(MINTLIFY_COMPONENTS.has("Steps")));
  it("does not contain a custom component", () => assert.ok(!MINTLIFY_COMPONENTS.has("MyWidget")));
});

// ─────────────────────────────────────────────────────────────────────────────
// extractImports
// ─────────────────────────────────────────────────────────────────────────────

describe("extractImports", () => {
  it("extracts a default import", () => {
    const imports = extractImports("import MyComp from '/snippets/my-comp.mdx'");
    assert.ok(imports.has("MyComp"));
    assert.equal(imports.get("MyComp").path, "/snippets/my-comp.mdx");
  });

  it("extracts a named import", () => {
    const imports = extractImports("import { MyComp } from '/snippets/my-comp.js'");
    assert.ok(imports.has("MyComp"));
    assert.equal(imports.get("MyComp").path, "/snippets/my-comp.js");
  });

  it("extracts multiple named imports from one line", () => {
    const imports = extractImports("import { Alpha, Beta } from '/snippets/shared.js'");
    assert.ok(imports.has("Alpha"));
    assert.ok(imports.has("Beta"));
    assert.equal(imports.get("Alpha").path, "/snippets/shared.js");
  });

  it("extracts aliased named import using the local name", () => {
    const imports = extractImports("import { Foo as Bar } from '/snippets/foo.js'");
    assert.ok(imports.has("Bar"));
    assert.ok(!imports.has("Foo"));
  });

  it("extracts imports with double quotes", () => {
    const imports = extractImports(`import MyComp from "/snippets/my-comp.mdx"`);
    assert.ok(imports.has("MyComp"));
  });

  it("returns empty map when no imports", () => {
    const imports = extractImports("# Hello\n\nJust content.");
    assert.equal(imports.size, 0);
  });

  it("ignores non-import lines", () => {
    const imports = extractImports("const x = 1;\n// import Foo from 'bar'");
    assert.equal(imports.size, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildImportLine
// ─────────────────────────────────────────────────────────────────────────────

describe("buildImportLine", () => {
  it("generates default import for .mdx file", () => {
    const line = buildImportLine("MyComp", "/repo/snippets/my-comp.mdx", "/repo");
    assert.equal(line, `import MyComp from "/snippets/my-comp.mdx";`);
  });

  it("generates named import for .js file", () => {
    const line = buildImportLine("MyComp", "/repo/snippets/my-comp.js", "/repo");
    assert.equal(line, `import { MyComp } from "/snippets/my-comp.js";`);
  });

  it("generates named import for .ts file", () => {
    const line = buildImportLine("Widget", "/repo/snippets/widget.ts", "/repo");
    assert.equal(line, `import { Widget } from "/snippets/widget.ts";`);
  });

  it("handles nested snippet path", () => {
    const line = buildImportLine("MyComp", "/repo/snippets/ui/my-comp.mdx", "/repo");
    assert.equal(line, `import MyComp from "/snippets/ui/my-comp.mdx";`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// insertImportLines
// ─────────────────────────────────────────────────────────────────────────────

describe("insertImportLines", () => {
  it("inserts import after frontmatter when no existing imports", () => {
    const content = "---\ntitle: Test\n---\n\n# Heading\n";
    const result = insertImportLines(content, ["import Foo from '/snippets/foo.mdx'"]);
    assert.ok(result.includes("import Foo from '/snippets/foo.mdx'"));
    // import should appear before the heading
    const importIdx = result.indexOf("import Foo");
    const headingIdx = result.indexOf("# Heading");
    assert.ok(importIdx < headingIdx);
  });

  it("adds a blank line between frontmatter and new imports when none exist", () => {
    const content = "---\ntitle: Test\n---\n# Heading\n";
    const result = insertImportLines(content, ["import Foo from '/snippets/foo.mdx'"]);
    // frontmatter end followed by blank line then import
    assert.ok(result.includes("---\n\nimport Foo"));
  });

  it("inserts after existing import block", () => {
    const content = "---\ntitle: Test\n---\nimport Existing from '/snippets/existing.mdx'\n\n# Heading\n";
    const result = insertImportLines(content, ["import New from '/snippets/new.mdx'"]);
    const existingIdx = result.indexOf("import Existing");
    const newIdx = result.indexOf("import New");
    assert.ok(existingIdx < newIdx);
  });

  it("inserts multiple imports at once", () => {
    const content = "---\ntitle: Test\n---\n\n# Heading\n";
    const result = insertImportLines(content, [
      "import Alpha from '/snippets/alpha.mdx'",
      "import Beta from '/snippets/beta.mdx'",
    ]);
    assert.ok(result.includes("import Alpha"));
    assert.ok(result.includes("import Beta"));
  });

  it("returns content unchanged when importLines is empty", () => {
    const content = "---\ntitle: Test\n---\n\n# Heading\n";
    const result = insertImportLines(content, []);
    assert.equal(result, content);
  });

  it("inserts at top when there is no frontmatter", () => {
    const content = "# Heading\n\nText.\n";
    const result = insertImportLines(content, ["import Foo from '/snippets/foo.mdx'"]);
    assert.ok(result.startsWith("import Foo"));
  });
});
