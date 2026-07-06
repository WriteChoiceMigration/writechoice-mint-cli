/**
 * Tests for wc docusaurus nav — Docusaurus sidebars.js → Mintlify navigation.
 *
 * Tests the public docusaurusNav() entry point using temp sidebars files,
 * covering both CommonJS and ESM export formats plus all item types.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { docusaurusNav } from "../src/commands/docusaurus/nav.js";

// ─── Temp dir helpers ─────────────────────────────────────────────────────────

let tmp;

before(() => {
  tmp = join(tmpdir(), `wc-docusaurus-nav-test-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });
});

after(() => {
  try { rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
});

let counter = 0;
function writeSidebars(content) {
  const file = join(tmp, `sidebars-${++counter}.js`);
  writeFileSync(file, content, "utf-8");
  return file;
}

async function run(file, options = {}) {
  const outFile = join(tmp, `nav-${counter}.json`);
  const origCwd = process.cwd();
  process.chdir(tmp);
  try {
    await docusaurusNav(file, { output: outFile, quiet: true, ...options });
  } finally {
    process.chdir(origCwd);
  }
  return JSON.parse(readFileSync(outFile, "utf-8"));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("docusaurusNav — module formats", () => {
  it("loads CommonJS module.exports format", async () => {
    const file = writeSidebars(`
      module.exports = {
        docs: ["intro", "guide"],
      };
    `);
    const nav = await run(file);
    assert.deepEqual(nav, { anchors: [{ anchor: "Docs", pages: ["intro", "guide"] }] });
  });

  it("loads ESM export default format (with leading comments)", async () => {
    // This was broken before the multiline ^ fix: export default preceded by comments
    const file = writeSidebars(`
      // @ts-check
      /** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
      export default {
        docs: ["intro", "guide"],
      };
    `);
    const nav = await run(file);
    assert.deepEqual(nav, { anchors: [{ anchor: "Docs", pages: ["intro", "guide"] }] });
  });

  it("unwraps ESM namespace { __esModule, default } returned by Node.js 22+ require()", async () => {
    // Node 22+ require() of ESM returns { __esModule: true, default: <exports> }.
    // The code must unwrap it to get the real sidebar config.
    const file = writeSidebars(`export default { docs: ["a", "b"] };`);
    const nav = await run(file);
    // Should produce one anchor "Docs" with pages ["a","b"], not two tabs "__esModule"/"default"
    assert.ok(nav.anchors || nav.tabs);
    const pages = nav.anchors ? nav.anchors[0].pages : nav.tabs[0].pages;
    assert.deepEqual(pages, ["a", "b"]);
  });
});

describe("docusaurusNav — single vs multiple sidebars", () => {
  it("single sidebar → anchors", async () => {
    const file = writeSidebars(`module.exports = { docs: ["intro"] };`);
    const nav = await run(file);
    assert.ok(Array.isArray(nav.anchors), "should have anchors");
    assert.equal(nav.anchors[0].anchor, "Docs");
  });

  it("multiple sidebars → tabs", async () => {
    const file = writeSidebars(`module.exports = { docs: ["intro"], sdks: ["sdk/index"] };`);
    const nav = await run(file);
    assert.ok(Array.isArray(nav.tabs), "should have tabs");
    assert.equal(nav.tabs[0].tab, "Docs");
    assert.equal(nav.tabs[1].tab, "Sdks");
  });
});

describe("docusaurusNav — item types", () => {
  it('string items pass through as page ids', async () => {
    const file = writeSidebars(`module.exports = { docs: ["intro", "concepts/overview"] };`);
    const nav = await run(file);
    assert.deepEqual(nav.anchors[0].pages, ["intro", "concepts/overview"]);
  });

  it('type:"doc" items use their id', async () => {
    const file = writeSidebars(`module.exports = {
      docs: [{ type: "doc", id: "intro", label: "Introduction" }],
    };`);
    const nav = await run(file);
    assert.deepEqual(nav.anchors[0].pages, ["intro"]);
  });

  it('type:"category" becomes a group', async () => {
    const file = writeSidebars(`module.exports = {
      docs: [{
        type: "category",
        label: "Guide",
        items: ["guide/start", "guide/next"],
      }],
    };`);
    const nav = await run(file);
    assert.deepEqual(nav.anchors[0].pages, [{
      group: "Guide",
      pages: ["guide/start", "guide/next"],
    }]);
  });

  it('type:"category" with link.type:"doc" gets root property', async () => {
    const file = writeSidebars(`module.exports = {
      docs: [{
        type: "category",
        label: "Feature Flags",
        link: { type: "doc", id: "features/index" },
        items: ["features/basics", "features/rules"],
      }],
    };`);
    const nav = await run(file);
    assert.deepEqual(nav.anchors[0].pages, [{
      group: "Feature Flags",
      root: "features/index",
      pages: ["features/basics", "features/rules"],
    }]);
  });

  it('type:"category" with link.type:"generated-index" does NOT get root', async () => {
    const file = writeSidebars(`module.exports = {
      docs: [{
        type: "category",
        label: "Guide",
        link: { type: "generated-index", title: "Guide overview" },
        items: ["guide/start"],
      }],
    };`);
    const nav = await run(file);
    assert.equal(nav.anchors[0].pages[0].root, undefined);
  });

  it('type:"link" items are skipped', async () => {
    const file = writeSidebars(`module.exports = {
      docs: [
        "intro",
        { type: "link", label: "External", href: "https://example.com" },
        "guide",
      ],
    };`);
    const nav = await run(file);
    assert.deepEqual(nav.anchors[0].pages, ["intro", "guide"]);
  });

  it('type:"html" items are skipped', async () => {
    const file = writeSidebars(`module.exports = {
      docs: ["intro", { type: "html", value: "<hr/>" }, "guide"],
    };`);
    const nav = await run(file);
    assert.deepEqual(nav.anchors[0].pages, ["intro", "guide"]);
  });

  it('type:"ref" items are treated like docs', async () => {
    const file = writeSidebars(`module.exports = {
      docs: [{ type: "ref", id: "shared/faq" }],
    };`);
    const nav = await run(file);
    assert.deepEqual(nav.anchors[0].pages, ["shared/faq"]);
  });
});

describe("docusaurusNav — prefix option", () => {
  it("prepends prefix to all page ids", async () => {
    const file = writeSidebars(`module.exports = {
      docs: [
        "intro",
        { type: "doc", id: "guide/start" },
        {
          type: "category",
          label: "Concepts",
          link: { type: "doc", id: "concepts/index" },
          items: ["concepts/overview"],
        },
      ],
    };`);
    const nav = await run(file, { prefix: "docs" });
    assert.deepEqual(nav.anchors[0].pages, [
      "docs/intro",
      "docs/guide/start",
      {
        group: "Concepts",
        root: "docs/concepts/index",
        pages: ["docs/concepts/overview"],
      },
    ]);
  });

  it("strips trailing slashes from prefix", async () => {
    const file = writeSidebars(`module.exports = { docs: ["intro"] };`);
    const nav = await run(file, { prefix: "docs/" });
    assert.equal(nav.anchors[0].pages[0], "docs/intro");
  });
});

describe("docusaurusNav — nested categories", () => {
  it("converts deeply nested categories", async () => {
    const file = writeSidebars(`module.exports = {
      docs: [{
        type: "category",
        label: "Outer",
        items: [{
          type: "category",
          label: "Inner",
          link: { type: "doc", id: "inner/index" },
          items: ["inner/page"],
        }],
      }],
    };`);
    const nav = await run(file);
    assert.deepEqual(nav.anchors[0].pages, [{
      group: "Outer",
      pages: [{
        group: "Inner",
        root: "inner/index",
        pages: ["inner/page"],
      }],
    }]);
  });
});
