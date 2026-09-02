/**
 * wcc readme recipes — Convert legacy recipe .md files into .mdx using
 * Mintlify recipe components (<RequestExample>, <ResponseExample>,
 * <Steps>/<Step>)
 *
 * Input shape:
 *
 *   ---
 *   frontmatter
 *   ---
 *   ```lang Title
 *   ...code...
 *   ```
 *   ```json Response Example
 *   ...json...
 *   ```
 *
 *   # Step Heading
 *   <!-- lang@1-11 -->
 *
 *   Step description text.
 *
 * Output shape:
 *
 *   ---
 *   frontmatter
 *   ---
 *
 *   <RequestExample>
 *   ```lang Title
 *   ...code...
 *   ```
 *   </RequestExample>
 *
 *   <ResponseExample>
 *   ```json Response Example
 *   ...json...
 *   ```
 *   </ResponseExample>
 *
 *   <Steps>
 *
 *   <Step title="Step Heading">
 *
 *   Step description text.
 *   </Step>
 *   </Steps>
 *
 * This is a focused, format-specific transform (not the general readme.com
 * markdown pipeline in convert.js) — recipe pages are structured around
 * fenced code + step headings rather than prose, and running the generic
 * pipeline first would merge the leading request/response fences into a
 * <CodeGroup> before this command gets a chance to split them apart.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { resolve, join, basename } from "path";
import chalk from "chalk";

// ─────────────────────────────────────────────────────────────────────────────
// Parsing helpers
// ─────────────────────────────────────────────────────────────────────────────

const FM_RE = /^(---\r?\n[\s\S]*?\r?\n---\r?\n)([\s\S]*)$/;
const FENCE_RE = /```([^\n`]*)\n([\s\S]*?)\n```/g;
const HEADING_RE = /^#\s+(.+)$/gm;
const COMMENT_LINE_RE = /^<!--[\s\S]*?-->\s*\n+/m;

/**
 * `# Heading` matches that aren't inside a fenced code block (e.g. a Python
 * comment like `# Example: ...` shouldn't be mistaken for one).
 */
function findHeadingsOutsideCode(body) {
  const codeSpans = [];
  FENCE_RE.lastIndex = 0;
  let cm;
  while ((cm = FENCE_RE.exec(body)) !== null) {
    codeSpans.push([cm.index, cm.index + cm[0].length]);
  }
  const insideCode = (pos) => codeSpans.some(([s, e]) => s <= pos && pos < e);

  const headings = [];
  HEADING_RE.lastIndex = 0;
  let hm;
  while ((hm = HEADING_RE.exec(body)) !== null) {
    if (!insideCode(hm.index)) {
      headings.push({ index: hm.index, end: hm.index + hm[0].length, title: hm[1] });
    }
  }
  return headings;
}

/** Returns { blocks, rest }: raw fenced code blocks up to the first heading, and the rest of the body. */
function extractCodeBlocks(body) {
  const headings = findHeadingsOutsideCode(body);
  const headingMatch = headings[0] || null;
  const codeSection = headingMatch ? body.slice(0, headingMatch.index) : body;
  const rest = headingMatch ? body.slice(headingMatch.index) : "";

  const blocks = [];
  FENCE_RE.lastIndex = 0;
  let m;
  while ((m = FENCE_RE.exec(codeSection)) !== null) {
    blocks.push(m[0]);
  }
  return { blocks, rest };
}

function isResponseBlock(block) {
  const firstLine = block.split("\n", 1)[0];
  return firstLine.toLowerCase().includes("response");
}

function buildExamples(blocks) {
  const requestBlocks = blocks.filter((b) => !isResponseBlock(b));
  const responseBlocks = blocks.filter((b) => isResponseBlock(b));

  const parts = [];
  if (requestBlocks.length) parts.push("<RequestExample>\n" + requestBlocks.join("\n") + "\n</RequestExample>");
  if (responseBlocks.length) parts.push("<ResponseExample>\n" + responseBlocks.join("\n") + "\n</ResponseExample>");
  return parts.join("\n\n");
}

function buildSteps(rest) {
  const headings = findHeadingsOutsideCode(rest);
  const steps = [];
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    const title = h.title.trim();
    const start = h.end;
    const end = i + 1 < headings.length ? headings[i + 1].index : rest.length;
    let section = rest.slice(start, end);
    section = section.replace(COMMENT_LINE_RE, ""); // strip only the first comment line (e.g. <!-- lang@1-11 -->)
    section = section.replace(/^\n+|\n+$/g, "");
    steps.push(`<Step title="${title}">\n\n${section}\n</Step>`);
  }
  return "<Steps>\n\n" + steps.join("\n\n") + "\n</Steps>";
}

/**
 * Converts a legacy recipe .md file's content into Mintlify recipe MDX.
 * Throws if the content has no frontmatter block.
 */
export function convertRecipeContent(content) {
  const m = FM_RE.exec(content);
  if (!m) throw new Error("no frontmatter found");
  const [, frontmatter, body] = m;

  const { blocks, rest } = extractCodeBlocks(body);
  const examples = buildExamples(blocks);
  const steps = buildSteps(rest);

  const pieces = [frontmatter.replace(/\n+$/, "")];
  if (examples) pieces.push(examples);
  pieces.push(steps);
  return pieces.join("\n\n") + "\n";
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} options
 * @param {string} options.from   - Source directory of legacy recipe .md files (default: readme/recipes)
 * @param {string} options.output - Output directory for converted .mdx files (default: pages/recipes)
 * @param {boolean} options.dryRun
 * @param {boolean} options.quiet
 */
export async function convertRecipes(options) {
  const verbose = !options.quiet;
  const sourceDir = resolve(process.cwd(), options.from || "readme/recipes");
  const targetDir = resolve(process.cwd(), options.output || "pages/recipes");

  if (!existsSync(sourceDir)) {
    console.error(chalk.red(`Error: source directory not found: ${sourceDir}`));
    process.exit(1);
  }

  const files = readdirSync(sourceDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => join(sourceDir, f));

  if (!files.length) {
    console.error(chalk.red(`Error: no .md files found in ${sourceDir}`));
    process.exit(1);
  }

  if (verbose) {
    console.log(chalk.cyan(`\nConverting ${files.length} recipe file(s) to MDX...`));
    if (options.dryRun) console.log(chalk.yellow("  [dry-run] No files will be written\n"));
  }

  let converted = 0;
  for (const src of files) {
    const content = readFileSync(src, "utf-8");
    const name = basename(src, ".md");

    let result;
    try {
      result = convertRecipeContent(content);
    } catch (e) {
      console.warn(chalk.yellow(`  WARNING: skipped ${name}.md (${e.message})`));
      continue;
    }

    const out = join(targetDir, `${name}.mdx`);
    converted++;

    if (options.dryRun) {
      if (verbose) {
        console.log(chalk.dim(`\n${"=".repeat(60)}`));
        console.log(chalk.dim(`SOURCE : ${src}`));
        console.log(chalk.dim(`TARGET : ${out}`));
        console.log(chalk.dim("=".repeat(60)));
        console.log(result);
      }
    } else {
      mkdirSync(targetDir, { recursive: true });
      writeFileSync(out, result, "utf-8");
      if (verbose) console.log(`  ${chalk.dim(`${name}.md`)}  →  ${chalk.green(out)}`);
    }
  }

  if (verbose && !options.dryRun) {
    console.log(chalk.green(`\n  ✓ ${converted} file${converted !== 1 ? "s" : ""} written to ${options.output || "pages/recipes"}`));
  }
}
