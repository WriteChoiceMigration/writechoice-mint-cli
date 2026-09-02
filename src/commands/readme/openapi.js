/**
 * wcc readme openapi — Extract inline "# OpenAPI definition" blocks into
 * Mintlify `openapi` frontmatter
 *
 * readme.io API reference pages (converted from /reference/... URLs) embed
 * their full OpenAPI spec fragment inline as:
 *
 *   # OpenAPI definition
 *
 *   ```json
 *   { ...full OpenAPI spec fragment... }
 *   ```
 *
 * Mintlify instead expects a single shared spec file referenced from
 * frontmatter (`openapi: "/openapi/<file> METHOD /path"`). For each file:
 *
 *   1. Parse the embedded JSON and find its single path + method.
 *   2. Look for a spec file under --openapi-dir that already defines that
 *      same path + method.
 *        - If found, add the `openapi` frontmatter key pointing at it and
 *          remove the heading + code block from the body.
 *        - If not found, write the embedded spec verbatim to a new file
 *          under --openapi-dir (named after the operationId or path+method),
 *          then point the frontmatter at that new file the same way.
 */

import { existsSync, readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, basename, relative, resolve } from "path";
import chalk from "chalk";

const EXCLUDED_DIRS = ["node_modules", ".git"];
const HEADING = "# OpenAPI definition";

// ─────────────────────────────────────────────────────────────────────────────
// File discovery
// ─────────────────────────────────────────────────────────────────────────────

function findMdxFiles(repoRoot, directory = null, file = null) {
  if (file) {
    const fullPath = resolve(repoRoot, file);
    return existsSync(fullPath) ? [fullPath] : [];
  }

  const searchDirs = directory ? [resolve(repoRoot, directory)] : [repoRoot];
  const mdxFiles = [];

  function walkDirectory(dir) {
    const dirName = dir.split("/").pop();
    if (EXCLUDED_DIRS.includes(dirName)) return;

    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walkDirectory(fullPath);
        } else if (stat.isFile() && entry.endsWith(".mdx")) {
          mdxFiles.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}: ${error.message}`);
    }
  }

  for (const dir of searchDirs) {
    if (existsSync(dir)) walkDirectory(dir);
  }

  return mdxFiles.sort();
}

// ─────────────────────────────────────────────────────────────────────────────
// Spec file registry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads every *.json spec file under openapiDir into a { filename: spec } map.
 * Malformed JSON files are silently skipped.
 */
export function loadSpecs(openapiDir) {
  const specs = {};
  if (!existsSync(openapiDir)) return specs;

  for (const name of readdirSync(openapiDir).sort()) {
    if (!name.endsWith(".json")) continue;
    try {
      specs[name] = JSON.parse(readFileSync(join(openapiDir, name), "utf-8"));
    } catch {
      continue;
    }
  }
  return specs;
}

/**
 * Returns the filename of a spec already covering this path + method, or null.
 */
export function findExistingSpecFile(specs, path, method) {
  for (const [fname, spec] of Object.entries(specs)) {
    if (spec?.paths?.[path]?.[method]) return fname;
  }
  return null;
}

function slugify(text) {
  const slug = text.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return slug || "spec";
}

/**
 * Picks a unique filename (under openapiDir) for a newly extracted spec.
 */
export function newSpecFilename(spec, path, method, openapiDir) {
  const op = spec?.paths?.[path]?.[method] || {};
  const base = op.operationId || `${method}-${path}`;
  const name = slugify(base);

  let candidate = `${name}.json`;
  let n = 2;
  while (existsSync(join(openapiDir, candidate))) {
    candidate = `${name}-${n}.json`;
    n++;
  }
  return candidate;
}

// ─────────────────────────────────────────────────────────────────────────────
// Block extraction + frontmatter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Finds the "# OpenAPI definition" heading + its following fenced JSON block.
 * Returns { before, path, method, spec, after } or null if not present.
 * Throws if the block is malformed (bad JSON, or not exactly 1 path/method).
 */
export function extractOpenApiBlock(content) {
  const idx = content.indexOf(HEADING);
  if (idx === -1) return null;

  const fenceOpenRe = /\n(`{3,})(\w*)\n/g;
  fenceOpenRe.lastIndex = idx;
  const openMatch = fenceOpenRe.exec(content);
  if (!openMatch) return null;
  const fence = openMatch[1];
  const bodyStart = fenceOpenRe.lastIndex;

  const escapedFence = fence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const closeRe = new RegExp("\\n" + escapedFence + "\\s*$", "gm");
  closeRe.lastIndex = bodyStart;
  const closeMatch = closeRe.exec(content);
  if (!closeMatch) return null;
  const bodyEnd = closeMatch.index;
  const afterIdx = closeRe.lastIndex;

  const body = content.slice(bodyStart, bodyEnd);
  let spec;
  try {
    spec = JSON.parse(body);
  } catch {
    throw new Error("could not parse embedded OpenAPI JSON");
  }

  const paths = spec?.paths || {};
  const pathKeys = Object.keys(paths);
  if (pathKeys.length !== 1) {
    throw new Error(`expected exactly 1 path in embedded spec, found ${pathKeys.length}`);
  }
  const path = pathKeys[0];

  const methods = paths[path] || {};
  const methodKeys = Object.keys(methods);
  if (methodKeys.length !== 1) {
    throw new Error(`expected exactly 1 method for ${path}, found ${methodKeys.length}`);
  }
  const method = methodKeys[0];

  const before = content.slice(0, idx).replace(/\n+$/, "");
  const after = content.slice(afterIdx).replace(/^\n+/, "");

  return { before, path, method, spec, after };
}

/**
 * Appends an `openapi: "..."` key to an existing YAML frontmatter block.
 */
export function addOpenApiFrontmatter(before, openapiValue) {
  // No trailing "\n" required after the closing fence: `before` may end
  // right at the frontmatter (heading immediately follows, no body text).
  const fmMatch = before.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) throw new Error("could not find frontmatter block");
  const newFmBody = `${fmMatch[1]}\nopenapi: "${openapiValue}"`;
  return before.replace(fmMatch[0], `---\n${newFmBody}\n---`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure content converter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a single file's content. `specs` is mutated in place so a spec
 * newly extracted from one file can be reused (deduped) by a later file in
 * the same batch.
 *
 * Returns { content, changed, newSpec: { filename, spec } | null }.
 * Disk writes are left to the caller — this function does no I/O.
 */
export function convertOpenApiDefinition(content, openapiDir, specs) {
  const block = extractOpenApiBlock(content);
  if (!block) return { content, changed: false, newSpec: null };
  const { before, path, method, spec, after } = block;

  let fname = findExistingSpecFile(specs, path, method);
  let newSpec = null;
  if (!fname) {
    fname = newSpecFilename(spec, path, method, openapiDir);
    specs[fname] = spec;
    newSpec = { filename: fname, spec };
  }

  const openapiValue = `/openapi/${fname} ${method.toUpperCase()} ${path}`;
  const newBefore = addOpenApiFrontmatter(before, openapiValue);

  let newContent = newBefore.replace(/\n+$/, "") + "\n";
  if (after.trim()) {
    newContent += "\n" + after.replace(/\n+$/, "") + "\n";
  }

  return { content: newContent, changed: true, newSpec };
}

// ─────────────────────────────────────────────────────────────────────────────
// Duplicate-description comment-out
// ─────────────────────────────────────────────────────────────────────────────
//
// A page whose body is set up for Mintlify's OpenAPI-driven layout already
// renders the spec operation's `description` automatically. If the page
// body is just that same description repeated verbatim, it renders twice —
// wrap the body in an MDX comment ({/* ... */}) so the source is preserved
// but nothing is rendered twice.

const FM_BODY_RE = /^(---\r?\n[\s\S]*?\r?\n---\r?\n?)([\s\S]*)$/;
const OPENAPI_KEY_RE = /^openapi:\s*"(.+?)"\s*$/m;

// Mirrors Python's `str.split(" ", 2)`: splits on the first two spaces only,
// so the third part (the path) keeps any spaces it might contain.
function splitOpenApiValue(value) {
  const firstSpace = value.indexOf(" ");
  if (firstSpace === -1) return null;
  const rest = value.slice(firstSpace + 1);
  const secondSpace = rest.indexOf(" ");
  if (secondSpace === -1) return null;
  return {
    specPath: value.slice(0, firstSpace),
    method: rest.slice(0, secondSpace),
    path: rest.slice(secondSpace + 1),
  };
}

function getSpecDescription(specs, openapiValue) {
  const parsed = splitOpenApiValue(openapiValue);
  if (!parsed) return null;
  const spec = specs[basename(parsed.specPath)];
  if (!spec) return null;
  const op = spec?.paths?.[parsed.path]?.[parsed.method.toLowerCase()];
  return op?.description ?? null;
}

/**
 * Comments out a page's body when it duplicates the `description` of the
 * OpenAPI operation its frontmatter `openapi` key points at.
 * Returns { content, changed }.
 */
export function commentDuplicateOpenApiBody(content, specs) {
  const m = FM_BODY_RE.exec(content);
  if (!m) return { content, changed: false };
  const [, frontmatter, body] = m;

  const openapiMatch = OPENAPI_KEY_RE.exec(frontmatter);
  if (!openapiMatch) return { content, changed: false };

  const description = getSpecDescription(specs, openapiMatch[1]);
  if (description == null) return { content, changed: false };

  const trimmedBody = body.trim();
  if (trimmedBody !== description.trim()) return { content, changed: false };
  if (trimmedBody.startsWith("{/*")) return { content, changed: false }; // already commented out

  const commentedBody = "\n{/*\n" + trimmedBody + "\n*/}\n";
  return { content: frontmatter + commentedBody, changed: true };
}

/**
 * Walks .mdx files and comments out bodies that duplicate their OpenAPI
 * operation's description.
 */
export async function dedupeOpenApiDescription(options) {
  const repoRoot = process.cwd();
  const openapiDir = resolve(repoRoot, options.openapiDir || "openapi");

  if (!options.quiet) {
    console.log(chalk.bold("\n# Comment Out Duplicate OpenAPI Descriptions\n"));
  }

  const dir = options.file ? null : (options.dir || "pages/reference");
  const files = findMdxFiles(repoRoot, dir, options.file);

  if (files.length === 0) {
    console.error(chalk.red("✗ No MDX files found."));
    process.exit(1);
  }

  if (!options.quiet) {
    console.log(`Found ${files.length} MDX file(s) to process\n`);
    if (options.dryRun) console.log(chalk.yellow("Dry run — no files will be written\n"));
  }

  const specs = loadSpecs(openapiDir);
  const changed = [];

  for (const filePath of files) {
    const content = readFileSync(filePath, "utf-8");
    const { content: newContent, changed: didChange } = commentDuplicateOpenApiBody(content, specs);

    if (didChange) {
      const relPath = relative(repoRoot, filePath);
      changed.push(relPath);

      if (options.verbose) console.log(`${chalk.cyan(relPath)}: commented out duplicate body`);
      if (!options.dryRun) writeFileSync(filePath, newContent, "utf-8");
    }
  }

  if (!options.quiet) {
    if (changed.length > 0) {
      const verb = options.dryRun ? "Would comment out" : "Commented out";
      console.log(chalk.green(`\n✓ ${verb} the duplicate body in ${changed.length} of ${files.length} file(s)`));
      if (!options.verbose) {
        for (const relPath of changed) console.log(`  ${chalk.cyan(relPath)}`);
      }
    } else {
      console.log(chalk.yellow("⚠️  No duplicate OpenAPI description bodies found."));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export async function extractOpenApi(options) {
  const repoRoot = process.cwd();
  const openapiDir = resolve(repoRoot, options.openapiDir || "openapi");

  if (!options.quiet) {
    console.log(chalk.bold("\n# Extract OpenAPI Definitions\n"));
  }

  const dir = options.file ? null : (options.dir || "pages/reference");
  const files = findMdxFiles(repoRoot, dir, options.file);

  if (files.length === 0) {
    console.error(chalk.red("✗ No MDX files found."));
    process.exit(1);
  }

  if (!options.quiet) {
    console.log(`Found ${files.length} MDX file(s) to process\n`);
    if (options.dryRun) {
      console.log(chalk.yellow("Dry run — no files will be written\n"));
    }
  }

  const specs = loadSpecs(openapiDir);
  let updated = 0;

  for (const filePath of files) {
    const content = readFileSync(filePath, "utf-8");
    const relPath = relative(repoRoot, filePath);

    let result;
    try {
      result = convertOpenApiDefinition(content, openapiDir, specs);
    } catch (e) {
      if (options.verbose) console.log(chalk.yellow(`${chalk.cyan(relPath)}: skipped (${e.message})`));
      continue;
    }

    if (!result.changed) continue;
    updated++;

    if (result.newSpec) {
      if (options.verbose) console.log(chalk.dim(`  created new spec file: openapi/${result.newSpec.filename}`));
      if (!options.dryRun) {
        mkdirSync(openapiDir, { recursive: true });
        writeFileSync(
          join(openapiDir, result.newSpec.filename),
          JSON.stringify(result.newSpec.spec, null, 2) + "\n",
          "utf-8"
        );
      }
    }

    if (options.verbose) console.log(`${chalk.cyan(relPath)}: extracted OpenAPI definition`);
    if (!options.dryRun) writeFileSync(filePath, result.content, "utf-8");
  }

  if (!options.quiet) {
    if (updated > 0) {
      const verb = options.dryRun ? "Would update" : "Updated";
      console.log(chalk.green(`\n✓ ${verb} ${updated} of ${files.length} file(s)`));
    } else {
      console.log(chalk.yellow("⚠️  No inline OpenAPI definitions found."));
    }
  }
}
