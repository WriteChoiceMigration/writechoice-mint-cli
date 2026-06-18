import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseBrokenLinksReport } from "../src/commands/find/redirects.js";
import { mergeFindRedirectsConfig } from "../src/utils/config.js";

// ─── parseBrokenLinksReport ───────────────────────────────────────────────────

describe("parseBrokenLinksReport", () => {
  it("extracts paths from lines containing ⎿", () => {
    const text = "Some text ⎿ /docs/my-page\nOther ⎿ /api/reference";
    const result = parseBrokenLinksReport(text);
    assert.deepEqual(result, ["/api/reference", "/docs/my-page"]);
  });

  it("strips fragment identifiers", () => {
    const text = "foo ⎿ /docs/page#section";
    assert.deepEqual(parseBrokenLinksReport(text), ["/docs/page"]);
  });

  it("deduplicates paths (same path from multiple lines)", () => {
    const text = "a ⎿ /docs/page\nb ⎿ /docs/page#anchor";
    assert.deepEqual(parseBrokenLinksReport(text), ["/docs/page"]);
  });

  it("ignores lines without ⎿", () => {
    const text = "no separator here\n/also/no/separator";
    assert.deepEqual(parseBrokenLinksReport(text), []);
  });

  it("ignores paths that do not start with /", () => {
    const text = "foo ⎿ https://external.com/page\nbar ⎿ /internal/page";
    assert.deepEqual(parseBrokenLinksReport(text), ["/internal/page"]);
  });

  it("uses the last ⎿-separated segment as the path", () => {
    const text = "file ⎿ page title ⎿ /docs/the-page";
    assert.deepEqual(parseBrokenLinksReport(text), ["/docs/the-page"]);
  });

  it("returns paths sorted alphabetically", () => {
    const text = "a ⎿ /z/page\nb ⎿ /a/page\nc ⎿ /m/page";
    assert.deepEqual(parseBrokenLinksReport(text), ["/a/page", "/m/page", "/z/page"]);
  });

  it("returns empty array for empty input", () => {
    assert.deepEqual(parseBrokenLinksReport(""), []);
  });
});

// ─── mergeFindRedirectsConfig ─────────────────────────────────────────────────

describe("mergeFindRedirectsConfig", () => {
  it("returns defaults when no config and no CLI options", () => {
    const result = mergeFindRedirectsConfig(undefined, {}, null);
    assert.equal(result.base, null);
    assert.equal(result.input, "br.txt");
    assert.equal(result.output, "br_redirects.json");
    assert.equal(result.delay, 500);
    assert.equal(result.quiet, false);
  });

  it("uses CLI base URL", () => {
    const result = mergeFindRedirectsConfig("https://docs.example.com", {}, null);
    assert.equal(result.base, "https://docs.example.com");
  });

  it("falls back to config.find.redirects.base", () => {
    const config = { find: { redirects: { base: "https://find.example.com" } } };
    const result = mergeFindRedirectsConfig(undefined, {}, config);
    assert.equal(result.base, "https://find.example.com");
  });

  it("falls back to config.source when no CLI base and no find.redirects.base", () => {
    const config = { source: "https://source.example.com" };
    const result = mergeFindRedirectsConfig(undefined, {}, config);
    assert.equal(result.base, "https://source.example.com");
  });

  it("CLI base takes precedence over all config", () => {
    const config = { source: "https://source.com", find: { redirects: { base: "https://find.com" } } };
    const result = mergeFindRedirectsConfig("https://cli.com", {}, config);
    assert.equal(result.base, "https://cli.com");
  });

  it("reads input and output from config", () => {
    const config = { find: { redirects: { input: "broken.txt", output: "found.json" } } };
    const result = mergeFindRedirectsConfig(undefined, {}, config);
    assert.equal(result.input, "broken.txt");
    assert.equal(result.output, "found.json");
  });

  it("CLI input and output take precedence over config", () => {
    const config = { find: { redirects: { input: "config.txt", output: "config.json" } } };
    const result = mergeFindRedirectsConfig(undefined, { input: "cli.txt", output: "cli.json" }, config);
    assert.equal(result.input, "cli.txt");
    assert.equal(result.output, "cli.json");
  });

  it("parses delay as integer", () => {
    const result = mergeFindRedirectsConfig(undefined, { delay: "1000" }, null);
    assert.equal(result.delay, 1000);
  });

  it("reads delay from config", () => {
    const config = { find: { redirects: { delay: 200 } } };
    const result = mergeFindRedirectsConfig(undefined, {}, config);
    assert.equal(result.delay, 200);
  });

  it("reads quiet from config", () => {
    const config = { find: { redirects: { quiet: true } } };
    const result = mergeFindRedirectsConfig(undefined, {}, config);
    assert.equal(result.quiet, true);
  });

  it("CLI quiet takes precedence over config", () => {
    const config = { find: { redirects: { quiet: false } } };
    const result = mergeFindRedirectsConfig(undefined, { quiet: true }, config);
    assert.equal(result.quiet, true);
  });
});
