import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  extractOpenApiBlock,
  addOpenApiFrontmatter,
  findExistingSpecFile,
  newSpecFilename,
  convertOpenApiDefinition,
  extractOpenApi,
  commentDuplicateOpenApiBody,
  dedupeOpenApiDescription,
} from "../src/commands/readme/openapi.js";

function specFor(path, method, extra = {}) {
  return { paths: { [path]: { [method]: { operationId: "opId", ...extra } } } };
}

// ─────────────────────────────────────────────────────────────────────────────
// extractOpenApiBlock
// ─────────────────────────────────────────────────────────────────────────────

describe("extractOpenApiBlock", () => {
  it("returns null when there is no OpenAPI definition heading", () => {
    assert.equal(extractOpenApiBlock("---\ntitle: X\n---\n\nJust text."), null);
  });

  it("parses path, method, and spec from the fenced JSON block", () => {
    const spec = specFor("/users/{id}", "get");
    const content = `---\ntitle: "X"\n---\n\n# OpenAPI definition\n\n\`\`\`json\n${JSON.stringify(spec)}\n\`\`\`\n`;
    const block = extractOpenApiBlock(content);
    assert.equal(block.path, "/users/{id}");
    assert.equal(block.method, "get");
    assert.deepEqual(block.spec, spec);
  });

  it("captures everything before the heading as 'before', trimmed of trailing newlines", () => {
    const spec = specFor("/a", "get");
    const content = `---\ntitle: "X"\n---\n\nIntro text.\n\n# OpenAPI definition\n\n\`\`\`json\n${JSON.stringify(spec)}\n\`\`\`\n`;
    const block = extractOpenApiBlock(content);
    assert.equal(block.before, '---\ntitle: "X"\n---\n\nIntro text.');
  });

  it("captures everything after the closing fence as 'after', trimmed of leading newlines", () => {
    const spec = specFor("/a", "get");
    const content = `# OpenAPI definition\n\n\`\`\`json\n${JSON.stringify(spec)}\n\`\`\`\n\nTrailer text.\n`;
    const block = extractOpenApiBlock(content);
    assert.equal(block.after, "Trailer text.\n");
  });

  it("throws when the embedded spec has more than one path", () => {
    const spec = { paths: { "/a": { get: {} }, "/b": { get: {} } } };
    const content = `# OpenAPI definition\n\n\`\`\`json\n${JSON.stringify(spec)}\n\`\`\`\n`;
    assert.throws(() => extractOpenApiBlock(content), /expected exactly 1 path/);
  });

  it("throws when the single path has more than one method", () => {
    const spec = { paths: { "/a": { get: {}, post: {} } } };
    const content = `# OpenAPI definition\n\n\`\`\`json\n${JSON.stringify(spec)}\n\`\`\`\n`;
    assert.throws(() => extractOpenApiBlock(content), /expected exactly 1 method/);
  });

  it("throws on malformed JSON in the code block", () => {
    const content = "# OpenAPI definition\n\n```json\n{not valid json\n```\n";
    assert.throws(() => extractOpenApiBlock(content), /could not parse/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// addOpenApiFrontmatter
// ─────────────────────────────────────────────────────────────────────────────

describe("addOpenApiFrontmatter", () => {
  it("appends the openapi key inside an existing frontmatter block", () => {
    const result = addOpenApiFrontmatter('---\ntitle: "X"\n---', "/openapi/x.json GET /a");
    assert.equal(result, '---\ntitle: "X"\nopenapi: "/openapi/x.json GET /a"\n---');
  });

  it("works when the frontmatter is followed by body text", () => {
    const result = addOpenApiFrontmatter('---\ntitle: "X"\n---\n\nIntro.', "/openapi/x.json GET /a");
    assert.ok(result.startsWith('---\ntitle: "X"\nopenapi: "/openapi/x.json GET /a"\n---'));
    assert.ok(result.endsWith("Intro."));
  });

  it("throws when there is no frontmatter block", () => {
    assert.throws(() => addOpenApiFrontmatter("Just text.", "/openapi/x.json GET /a"), /could not find frontmatter/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// findExistingSpecFile / newSpecFilename
// ─────────────────────────────────────────────────────────────────────────────

describe("findExistingSpecFile", () => {
  it("returns the filename covering the given path + method", () => {
    const specs = { "a.json": specFor("/users", "get") };
    assert.equal(findExistingSpecFile(specs, "/users", "get"), "a.json");
  });

  it("returns null when no spec covers the path + method", () => {
    const specs = { "a.json": specFor("/users", "get") };
    assert.equal(findExistingSpecFile(specs, "/users", "post"), null);
  });
});

describe("newSpecFilename", () => {
  it("slugifies the operationId", () => {
    const spec = specFor("/users/{id}", "get", { operationId: "Get User By ID" });
    const name = newSpecFilename(spec, "/users/{id}", "get", "/tmp/nonexistent-openapi-dir");
    assert.equal(name, "get-user-by-id.json");
  });

  it("falls back to method-path when there is no operationId", () => {
    const spec = { paths: { "/a/b": { get: {} } } };
    const name = newSpecFilename(spec, "/a/b", "get", "/tmp/nonexistent-openapi-dir");
    assert.equal(name, "get-a-b.json");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// convertOpenApiDefinition (pure, no I/O)
// ─────────────────────────────────────────────────────────────────────────────

describe("convertOpenApiDefinition", () => {
  it("returns changed:false and unchanged content when there is no block", () => {
    const input = '---\ntitle: "X"\n---\n\nJust text.';
    const result = convertOpenApiDefinition(input, "/tmp/oa", {});
    assert.equal(result.changed, false);
    assert.equal(result.content, input);
  });

  it("creates a new spec entry and rewrites frontmatter when no existing spec matches", () => {
    const spec = specFor("/users/{id}", "get", { operationId: "getUser" });
    const input = `---\ntitle: "Get User"\n---\n\n# OpenAPI definition\n\n\`\`\`json\n${JSON.stringify(spec)}\n\`\`\`\n`;
    const specs = {};
    const result = convertOpenApiDefinition(input, "/tmp/oa", specs);

    assert.equal(result.changed, true);
    assert.equal(result.newSpec.filename, "getuser.json");
    assert.ok(result.content.includes('openapi: "/openapi/getuser.json GET /users/{id}"'));
    assert.ok(!result.content.includes("# OpenAPI definition"));
    // the in-memory registry is updated so later files in the same batch can dedup
    assert.ok(specs["getuser.json"]);
  });

  it("reuses an existing spec instead of creating a new one", () => {
    const spec = specFor("/users/{id}", "get", { operationId: "getUser" });
    const input = `---\ntitle: "Get User Again"\n---\n\n# OpenAPI definition\n\n\`\`\`json\n${JSON.stringify(spec)}\n\`\`\`\n`;
    const specs = { "getuser.json": spec };
    const result = convertOpenApiDefinition(input, "/tmp/oa", specs);

    assert.equal(result.changed, true);
    assert.equal(result.newSpec, null);
    assert.ok(result.content.includes('openapi: "/openapi/getuser.json GET /users/{id}"'));
  });

  it("preserves trailing body content after the code block", () => {
    const spec = specFor("/a", "get");
    const input = `---\ntitle: "X"\n---\n\n# OpenAPI definition\n\n\`\`\`json\n${JSON.stringify(spec)}\n\`\`\`\n\nMore text below.\n`;
    const result = convertOpenApiDefinition(input, "/tmp/oa", {});
    assert.ok(result.content.trim().endsWith("More text below."));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// extractOpenApi (integration, temp dir)
// ─────────────────────────────────────────────────────────────────────────────

describe("extractOpenApi", () => {
  let tmp, origCwd;

  before(() => {
    tmp = join(tmpdir(), `wc-readme-openapi-test-${Date.now()}`);
    mkdirSync(join(tmp, "pages", "reference"), { recursive: true });
    origCwd = process.cwd();
    process.chdir(tmp);
  });

  after(() => {
    process.chdir(origCwd);
    try { rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("defaults to pages/reference, writes a new spec file, and rewrites the MDX file", async () => {
    const spec = specFor("/users/{id}", "get", { operationId: "getUser" });
    writeFileSync(
      join(tmp, "pages", "reference", "get-user.mdx"),
      `---\ntitle: "Get User"\n---\n\n# OpenAPI definition\n\n\`\`\`json\n${JSON.stringify(spec)}\n\`\`\`\n`
    );

    await extractOpenApi({ file: null, dir: null, openapiDir: "openapi", dryRun: false, quiet: true, verbose: false });

    const mdx = readFileSync(join(tmp, "pages", "reference", "get-user.mdx"), "utf-8");
    assert.ok(mdx.includes('openapi: "/openapi/getuser.json GET /users/{id}"'));
    assert.ok(existsSync(join(tmp, "openapi", "getuser.json")));
  });

  it("dedups a second page referencing the same endpoint against the spec written by the first", async () => {
    const spec = specFor("/users/{id}", "get", { operationId: "getUser" });
    writeFileSync(
      join(tmp, "pages", "reference", "get-user-2.mdx"),
      `---\ntitle: "Get User Duplicate"\n---\n\n# OpenAPI definition\n\n\`\`\`json\n${JSON.stringify(spec)}\n\`\`\`\n`
    );

    await extractOpenApi({ file: null, dir: null, openapiDir: "openapi", dryRun: false, quiet: true, verbose: false });

    const mdx = readFileSync(join(tmp, "pages", "reference", "get-user-2.mdx"), "utf-8");
    assert.ok(mdx.includes('openapi: "/openapi/getuser.json GET /users/{id}"'));
    // no second spec file was created for the same endpoint
    assert.ok(!existsSync(join(tmp, "openapi", "getuser-2.json")));
  });

  it("--dry-run does not write files", async () => {
    const spec = specFor("/orders/{id}", "delete", { operationId: "deleteOrder" });
    writeFileSync(
      join(tmp, "pages", "reference", "delete-order.mdx"),
      `---\ntitle: "Delete Order"\n---\n\n# OpenAPI definition\n\n\`\`\`json\n${JSON.stringify(spec)}\n\`\`\`\n`
    );

    await extractOpenApi({ file: null, dir: null, openapiDir: "openapi", dryRun: true, quiet: true, verbose: false });

    const mdx = readFileSync(join(tmp, "pages", "reference", "delete-order.mdx"), "utf-8");
    assert.ok(mdx.includes("# OpenAPI definition"));
    assert.ok(!existsSync(join(tmp, "openapi", "deleteorder.json")));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// commentDuplicateOpenApiBody (pure, no I/O)
// ─────────────────────────────────────────────────────────────────────────────

function specsFor(path, method, description) {
  return { "getuser.json": { paths: { [path]: { [method]: { description } } } } };
}

describe("commentDuplicateOpenApiBody", () => {
  it("comments out a body that exactly duplicates the operation description", () => {
    const specs = specsFor("/users/{id}", "get", "Fetches a user by ID.");
    const input = '---\ntitle: "Get User"\nopenapi: "/openapi/getuser.json GET /users/{id}"\n---\n\nFetches a user by ID.\n';
    const result = commentDuplicateOpenApiBody(input, specs);
    assert.equal(result.changed, true);
    assert.ok(result.content.includes("{/*\nFetches a user by ID.\n*/}"));
  });

  it("leaves a body unchanged when it differs from the description", () => {
    const specs = specsFor("/users/{id}", "get", "Fetches a user by ID.");
    const input = '---\ntitle: "Get User"\nopenapi: "/openapi/getuser.json GET /users/{id}"\n---\n\nCustom body content.\n';
    const result = commentDuplicateOpenApiBody(input, specs);
    assert.equal(result.changed, false);
    assert.equal(result.content, input);
  });

  it("is idempotent — a body already commented out is left alone", () => {
    const specs = specsFor("/users/{id}", "get", "Fetches a user by ID.");
    const input = '---\ntitle: "Get User"\nopenapi: "/openapi/getuser.json GET /users/{id}"\n---\n\nFetches a user by ID.\n';
    const first = commentDuplicateOpenApiBody(input, specs);
    const second = commentDuplicateOpenApiBody(first.content, specs);
    assert.equal(second.changed, false);
  });

  it("returns changed:false when there is no openapi frontmatter key", () => {
    const specs = specsFor("/users/{id}", "get", "Fetches a user by ID.");
    const input = '---\ntitle: "Get User"\n---\n\nFetches a user by ID.\n';
    const result = commentDuplicateOpenApiBody(input, specs);
    assert.equal(result.changed, false);
  });

  it("returns changed:false when the referenced spec file is not loaded", () => {
    const input = '---\ntitle: "Get User"\nopenapi: "/openapi/missing.json GET /users/{id}"\n---\n\nFetches a user by ID.\n';
    const result = commentDuplicateOpenApiBody(input, {});
    assert.equal(result.changed, false);
  });

  it("returns changed:false when the spec has no description for that operation", () => {
    const specs = { "getuser.json": { paths: { "/users/{id}": { get: {} } } } };
    const input = '---\ntitle: "Get User"\nopenapi: "/openapi/getuser.json GET /users/{id}"\n---\n\nSome body text.\n';
    const result = commentDuplicateOpenApiBody(input, specs);
    assert.equal(result.changed, false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// dedupeOpenApiDescription (integration, temp dir)
// ─────────────────────────────────────────────────────────────────────────────

describe("dedupeOpenApiDescription", () => {
  let tmp, origCwd;

  before(() => {
    tmp = join(tmpdir(), `wc-readme-openapi-dedupe-test-${Date.now()}`);
    mkdirSync(join(tmp, "pages", "reference"), { recursive: true });
    mkdirSync(join(tmp, "openapi"), { recursive: true });
    writeFileSync(
      join(tmp, "openapi", "getuser.json"),
      JSON.stringify({ paths: { "/users/{id}": { get: { description: "Fetches a user by ID." } } } })
    );
    writeFileSync(
      join(tmp, "pages", "reference", "get-user.mdx"),
      '---\ntitle: "Get User"\nopenapi: "/openapi/getuser.json GET /users/{id}"\n---\n\nFetches a user by ID.\n'
    );
    origCwd = process.cwd();
    process.chdir(tmp);
  });

  after(() => {
    process.chdir(origCwd);
    try { rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("comments out the duplicate body and writes the file", async () => {
    await dedupeOpenApiDescription({ file: null, dir: null, openapiDir: "openapi", dryRun: false, quiet: true, verbose: false });
    const content = readFileSync(join(tmp, "pages", "reference", "get-user.mdx"), "utf-8");
    assert.ok(content.includes("{/*"));
    assert.ok(content.includes("Fetches a user by ID."));
  });
});
