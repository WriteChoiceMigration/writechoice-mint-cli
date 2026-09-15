import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { convertTabsToCodeGroup } from "../src/commands/fix/tabs.js";

// ─────────────────────────────────────────────────────────────────────────────
// Core conversion
// ─────────────────────────────────────────────────────────────────────────────

describe("convertTabsToCodeGroup — basic conversion", () => {
  it("converts a <Tabs> block where every <Tab> has a single code block", () => {
    const input = `<Tabs>
<Tab title="Python">
\`\`\`python
print("hello")
\`\`\`
</Tab>
<Tab title="JavaScript">
\`\`\`js
console.log("hello")
\`\`\`
</Tab>
</Tabs>`;

    const { newContent, count } = convertTabsToCodeGroup(input);
    assert.equal(count, 1);
    assert.ok(newContent.includes("<CodeGroup>"), "has CodeGroup open");
    assert.ok(newContent.includes("</CodeGroup>"), "has CodeGroup close");
    assert.ok(newContent.includes("```python Python"), "python fence with title");
    assert.ok(newContent.includes("```js JavaScript"), "js fence with title");
    assert.ok(newContent.includes('print("hello")'), "python content preserved");
    assert.ok(newContent.includes('console.log("hello")'), "js content preserved");
    assert.ok(!newContent.includes("<Tabs>"), "no Tabs left");
    assert.ok(!newContent.includes("<Tab "), "no Tab left");
  });

  it("preserves the code block language on the fence", () => {
    const input = `<Tabs>
<Tab title="Shell">
\`\`\`bash
echo hi
\`\`\`
</Tab>
</Tabs>`;
    const { newContent, count } = convertTabsToCodeGroup(input);
    assert.equal(count, 1);
    assert.ok(newContent.includes("```bash Shell"), "language + title on fence");
  });

  it("converts a fence with a flag (e.g. 'lines') after the language, preserving the flag", () => {
    const input = `<Tabs>
<Tab title="OpenAI">
\`\`\`python lines
from openai import OpenAI
\`\`\`
</Tab>
<Tab title="Curl">
\`\`\`bash
curl -X POST 'http://example.com'
\`\`\`
</Tab>
</Tabs>`;
    const { newContent, count } = convertTabsToCodeGroup(input);
    assert.equal(count, 1);
    assert.ok(newContent.includes("```python OpenAI lines"), "title inserted before preserved flag");
    assert.ok(newContent.includes("```bash Curl"), "unaffected sibling tab still converts");
    assert.ok(!newContent.includes("<Tabs>"), "no Tabs left");
  });

  it("preserves multiple flags after the language", () => {
    const input = `<Tabs>
<Tab title="Example">
\`\`\`js lines expandable
console.log("hi")
\`\`\`
</Tab>
</Tabs>`;
    const { newContent, count } = convertTabsToCodeGroup(input);
    assert.equal(count, 1);
    assert.ok(newContent.includes("```js Example lines expandable"));
  });

  it("converts and preserves key=value / key={...} meta options (icon, highlight, focus, nocopy, twoslash)", () => {
    const flags = ["icon=square-js", "highlight={1,3-5}", "focus={2,4-5}", "nocopy", 'nocopy="false"', "twoslash"];
    for (const flag of flags) {
      const input = `<Tabs>\n<Tab title="A">\n\`\`\`js ${flag}\ncode()\n\`\`\`\n</Tab>\n</Tabs>`;
      const { newContent, count } = convertTabsToCodeGroup(input);
      assert.equal(count, 1, `expected conversion for flag: ${flag}`);
      assert.ok(newContent.includes(`\`\`\`js A ${flag}`), `expected flag preserved for: ${flag}`);
    }
  });

  it("handles a tab with no language (bare fence)", () => {
    const input = `<Tabs>
<Tab title="Plain">
\`\`\`
plain text
\`\`\`
</Tab>
</Tabs>`;
    const { newContent, count } = convertTabsToCodeGroup(input);
    assert.equal(count, 1);
    assert.ok(newContent.includes("``` Plain"), "empty lang + title");
  });

  it("converts multiple independent <Tabs> blocks in one file", () => {
    const block = `<Tabs>
<Tab title="A">
\`\`\`js
a()
\`\`\`
</Tab>
</Tabs>`;
    const input = block + "\n\nsome text\n\n" + block;
    const { count } = convertTabsToCodeGroup(input);
    assert.equal(count, 2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cases that must NOT be converted
// ─────────────────────────────────────────────────────────────────────────────

describe("convertTabsToCodeGroup — skipped blocks", () => {
  it("leaves a tab with non-code content unchanged", () => {
    const input = `<Tabs>
<Tab title="Doc">
Some paragraph text here.
</Tab>
</Tabs>`;
    const { newContent, count } = convertTabsToCodeGroup(input);
    assert.equal(count, 0);
    assert.equal(newContent, input);
  });

  it("leaves a tab with a code block AND extra text unchanged", () => {
    const input = `<Tabs>
<Tab title="Example">
Some intro text.

\`\`\`js
code()
\`\`\`
</Tab>
</Tabs>`;
    const { newContent, count } = convertTabsToCodeGroup(input);
    assert.equal(count, 0);
    assert.equal(newContent, input);
  });

  it("leaves a block unchanged when a fence already has title=\"...\"", () => {
    const input = `<Tabs>
<Tab title="Docker">
\`\`\`sh title="docker run litellm" lines
docker run image
\`\`\`
</Tab>
<Tab title="Pip">
\`\`\`sh title="pip install litellm" lines
pip install litellm
\`\`\`
</Tab>
</Tabs>`;
    const { newContent, count } = convertTabsToCodeGroup(input);
    assert.equal(count, 0);
    assert.equal(newContent, input);
  });

  it("leaves a block unchanged when a fence has a bare title before a flag", () => {
    // "Expandable example" is a bare title, "expandable" after it is the flag.
    const input = `<Tabs>
<Tab title="A">
\`\`\`python Expandable example expandable
code()
\`\`\`
</Tab>
</Tabs>`;
    const { newContent, count } = convertTabsToCodeGroup(input);
    assert.equal(count, 0);
    assert.equal(newContent, input);
  });

  it("leaves a block unchanged when a fence has an unrecognized attribute", () => {
    const input = `<Tabs>
<Tab title="A">
\`\`\`js madeUpFlag="x"
code()
\`\`\`
</Tab>
</Tabs>`;
    const { newContent, count } = convertTabsToCodeGroup(input);
    assert.equal(count, 0);
    assert.equal(newContent, input);
  });

  it("leaves a mixed block (one code tab, one text tab) unchanged", () => {
    const input = `<Tabs>
<Tab title="Code">
\`\`\`py
pass
\`\`\`
</Tab>
<Tab title="Note">
Just a description.
</Tab>
</Tabs>`;
    const { newContent, count } = convertTabsToCodeGroup(input);
    assert.equal(count, 0);
    assert.equal(newContent, input);
  });

  it("leaves <Tabs> with extra content between tabs unchanged", () => {
    const input = `<Tabs>
<Tab title="A">
\`\`\`js
a()
\`\`\`
</Tab>
some stray text
<Tab title="B">
\`\`\`js
b()
\`\`\`
</Tab>
</Tabs>`;
    const { newContent, count } = convertTabsToCodeGroup(input);
    assert.equal(count, 0);
    assert.equal(newContent, input);
  });

  it("does not touch content outside <Tabs> blocks", () => {
    const input = `# Heading

Regular paragraph.

<Tabs>
<Tab title="Ex">
Not code.
</Tab>
</Tabs>

Footer text.`;
    const { newContent, count } = convertTabsToCodeGroup(input);
    assert.equal(count, 0);
    assert.ok(newContent.includes("# Heading"));
    assert.ok(newContent.includes("Footer text."));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Idempotency and edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe("convertTabsToCodeGroup — edge cases", () => {
  it("is idempotent: running twice on already-converted content changes nothing", () => {
    const input = `<Tabs>
<Tab title="Go">
\`\`\`go
fmt.Println("hi")
\`\`\`
</Tab>
</Tabs>`;
    const { newContent: once } = convertTabsToCodeGroup(input);
    const { newContent: twice, count } = convertTabsToCodeGroup(once);
    assert.equal(count, 0, "second pass finds nothing to convert");
    assert.equal(once, twice);
  });

  it("returns count 0 and unchanged content when there are no <Tabs> blocks", () => {
    const input = "# Just markdown\n\nNo tabs here.";
    const { newContent, count } = convertTabsToCodeGroup(input);
    assert.equal(count, 0);
    assert.equal(newContent, input);
  });

  it("converts one block and leaves an unconvertible block unchanged", () => {
    const good = `<Tabs>
<Tab title="Node">
\`\`\`js
run()
\`\`\`
</Tab>
</Tabs>`;
    const bad = `<Tabs>
<Tab title="Prose">
Some text, not code.
</Tab>
</Tabs>`;
    const input = good + "\n\n" + bad;
    const { newContent, count } = convertTabsToCodeGroup(input);
    assert.equal(count, 1);
    assert.ok(newContent.includes("<CodeGroup>"), "good block converted");
    assert.ok(newContent.includes("<Tabs>"), "bad block kept");
  });
});
