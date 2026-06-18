import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeReadmeNavConfig } from "../src/utils/config.js";

describe("mergeReadmeNavConfig", () => {
  it("returns CLI url and defaults when no config", () => {
    const result = mergeReadmeNavConfig("https://docs.example.com/docs", {}, null);
    assert.equal(result.url, "https://docs.example.com/docs");
    assert.equal(result.output, "nav.json");
    assert.equal(result.linksDir, "links");
    assert.equal(result.noLinks, false);
    assert.equal(result.quiet, false);
  });

  it("falls back to config.readme.url when CLI url is absent", () => {
    const config = { readme: { url: "https://docs.example.com/docs" } };
    const result = mergeReadmeNavConfig(undefined, {}, config);
    assert.equal(result.url, "https://docs.example.com/docs");
  });

  it("falls back to config.source when neither CLI url nor readme.url are set", () => {
    const config = { source: "https://docs.source.com" };
    const result = mergeReadmeNavConfig(undefined, {}, config);
    assert.equal(result.url, "https://docs.source.com");
  });

  it("CLI url takes precedence over config.readme.url and config.source", () => {
    const config = { source: "https://source.com", readme: { url: "https://readme.com" } };
    const result = mergeReadmeNavConfig("https://cli.com", {}, config);
    assert.equal(result.url, "https://cli.com");
  });

  it("returns null url when nothing is provided", () => {
    const result = mergeReadmeNavConfig(undefined, {}, null);
    assert.equal(result.url, null);
  });

  it("reads output from config.readme when CLI option absent", () => {
    const config = { readme: { output: "custom-nav.json" } };
    const result = mergeReadmeNavConfig(undefined, {}, config);
    assert.equal(result.output, "custom-nav.json");
  });

  it("CLI output takes precedence over config", () => {
    const config = { readme: { output: "config-nav.json" } };
    const result = mergeReadmeNavConfig(undefined, { output: "cli-nav.json" }, config);
    assert.equal(result.output, "cli-nav.json");
  });

  it("reads links-dir from config.readme when CLI option absent", () => {
    const config = { readme: { "links-dir": "external" } };
    const result = mergeReadmeNavConfig(undefined, {}, config);
    assert.equal(result.linksDir, "external");
  });

  it("CLI linksDir takes precedence over config", () => {
    const config = { readme: { "links-dir": "config-links" } };
    const result = mergeReadmeNavConfig(undefined, { linksDir: "cli-links" }, config);
    assert.equal(result.linksDir, "cli-links");
  });

  it("sets noLinks=true when Commander passes options.links=false (--no-links flag)", () => {
    const result = mergeReadmeNavConfig(undefined, { links: false }, null);
    assert.equal(result.noLinks, true);
  });

  it("sets noLinks=true when config.readme.no-links is true", () => {
    const config = { readme: { "no-links": true } };
    const result = mergeReadmeNavConfig(undefined, {}, config);
    assert.equal(result.noLinks, true);
  });

  it("CLI --no-links takes precedence even when config has no-links=false", () => {
    const config = { readme: { "no-links": false } };
    const result = mergeReadmeNavConfig(undefined, { links: false }, config);
    assert.equal(result.noLinks, true);
  });

  it("reads quiet from config.readme when CLI option absent", () => {
    const config = { readme: { quiet: true } };
    const result = mergeReadmeNavConfig(undefined, {}, config);
    assert.equal(result.quiet, true);
  });

  it("CLI quiet takes precedence over config", () => {
    const config = { readme: { quiet: false } };
    const result = mergeReadmeNavConfig(undefined, { quiet: true }, config);
    assert.equal(result.quiet, true);
  });
});
