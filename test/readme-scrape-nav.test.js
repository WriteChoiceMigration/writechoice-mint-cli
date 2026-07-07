import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { htmlToNav } from "../src/commands/readme/scrape-nav.js";

function section(heading, listInner) {
  return `<section class="rm-Sidebar-section"><h2>${heading}</h2><ul>${listInner}</ul></section>`;
}

function leaf(href, label) {
  return `<li><a href="${href}"><span>${label}</span></a></li>`;
}

function withSubpages(href, label, childrenHtml) {
  return `<li><a href="${href}"><span>${label}</span></a><ul class="subpages">${childrenHtml}</ul></li>`;
}

describe("htmlToNav", () => {
  it("collects pages linked under /docs/", () => {
    const html = section("Documentation", leaf("/docs/getting-started", "Getting Started"));
    const groups = htmlToNav(html, null);
    assert.deepEqual(groups, [{ group: "Documentation", pages: ["docs/getting-started"] }]);
  });

  it("collects pages linked under /reference/ (API reference projects)", () => {
    const html = section("Documentation", leaf("/reference/api-keys", "Authentication"));
    const groups = htmlToNav(html, null);
    assert.deepEqual(groups, [{ group: "Documentation", pages: ["reference/api-keys"] }]);
  });

  it("omits root when the group link just duplicates its first subpage (no dedicated overview page)", () => {
    const children = leaf("/reference/getaccount", "Get account") + leaf("/reference/putaccount", "Update account");
    const html = section("Subskribe API", withSubpages("/reference/getaccount", "Billing", children));
    const groups = htmlToNav(html, null);
    assert.deepEqual(groups, [
      {
        group: "Subskribe API",
        pages: [
          {
            group: "Billing",
            pages: ["reference/getaccount", "reference/putaccount"],
          },
        ],
      },
    ]);
  });

  it("keeps root when the group link points to a distinct overview page", () => {
    const children = leaf("/docs/guides/first-steps", "First steps") + leaf("/docs/guides/advanced", "Advanced");
    const html = section("Getting Started", withSubpages("/docs/guides", "Guides", children));
    const groups = htmlToNav(html, null);
    assert.deepEqual(groups, [
      {
        group: "Getting Started",
        pages: [
          {
            group: "Guides",
            root: "docs/guides",
            pages: ["docs/guides/first-steps", "docs/guides/advanced"],
          },
        ],
      },
    ]);
  });

  it("ignores links that are neither /docs/ nor /reference/", () => {
    const html = section("Documentation", leaf("/changelog/v1", "Changelog"));
    const groups = htmlToNav(html, null);
    assert.deepEqual(groups, [{ group: "Documentation", pages: [] }]);
  });
});
