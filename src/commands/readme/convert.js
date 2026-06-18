/**
 * wcc readme convert — Convert readme.com markdown files to Mintlify MDX
 *
 * Local mode (default):
 *   Reads .md files from --from dir, converts each to .mdx in --output dir.
 *
 * Fetch mode (--urls-file):
 *   Fetches <url>.md for each URL in the JSON file, saves raw markdown to
 *   --from dir, then converts each file to --output dir.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { resolve, join, basename } from "path";
import chalk from "chalk";

const README_IMAGE_HOST = "files.readme.io";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ---------------------------------------------------------------------------
// Language aliases for code fences
// ---------------------------------------------------------------------------

const LANG_ALIASES = {
  curl: ["bash", "curl"],
  sh: ["bash", "bash"],
  shell: ["bash", "bash"],
  node: ["javascript", ""],
  nodejs: ["javascript", ""],
  js: ["javascript", ""],
  ts: ["typescript", ""],
  rb: ["ruby", ""],
  py: ["python", ""],
};

// ---------------------------------------------------------------------------
// Callout mappings
// ---------------------------------------------------------------------------

const EMOJI_MAP = {
  "👍": "Tip",
  "📘": "Info",
  "🚧": "Warning",
  "❗️": "Warning",
  "❗": "Warning",
  "📝": "Note",
  "⚠️": "Warning",
  "💡": "Tip",
  "❓": "Note",
};

const THEME_MAP = {
  info: "Info",
  warn: "Warning",
  warning: "Warning",
  success: "Check",
  error: "Warning",
  default: null,
};

const ICON_MAP = {
  "💡": "Tip",
  "❓": "Note",
  "❗️": "Warning",
  "⚠️": "Warning",
  "📘": "Info",
  "👍": "Tip",
  "🚧": "Warning",
  "📝": "Note",
};

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

function fmScalar(raw) {
  return raw.replace(/^[>|]-?\s*\n?/, "").split("\n").map(l => l.trim()).filter(Boolean).join(" ");
}

export function convertFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return content;

  const fm = m[1];
  const rest = content.slice(m[0].length);

  const titleM = fm.match(/^title:\s*(.+)$/m);
  const title = titleM ? titleM[1].trim().replace(/^['"]|['"]$/g, "") : "";

  const excerptM = fm.match(/^excerpt:\s*([\s\S]*?)(?=\n\S|\s*$)/m);
  let excerpt = "";
  if (excerptM) {
    const raw = excerptM[1].trim();
    if (raw) excerpt = fmScalar(raw).replace(/^['"]|['"]$/g, "");
  }

  const lines = [`title: "${title}"`];
  if (excerpt) lines.push(`description: "${excerpt.replace(/"/g, '\\"')}"`);

  return "---\n" + lines.join("\n") + "\n---\n" + rest;
}

// ---------------------------------------------------------------------------
// <Callout> component → <Info> / <Tip> / <Warning> / <Note>
// ---------------------------------------------------------------------------

function calloutComponent(icon, theme) {
  if (theme && theme !== "default") return THEME_MAP[theme] ?? "Note";
  return ICON_MAP[icon] ?? "Note";
}

export function convertCalloutTags(content) {
  return content.replace(/<Callout([^>]*)>([\s\S]*?)<\/Callout>/g, (_, attrs, body) => {
    const iconM = attrs.match(/icon=["']([^"']+)["']/);
    const themeM = attrs.match(/theme=["']([^"']+)["']/);
    const icon = iconM ? iconM[1] : "";
    const theme = themeM ? themeM[1] : "default";
    const comp = calloutComponent(icon, theme);
    return `<${comp}>\n${body.replace(/^\n+|\n+$/g, "")}\n</${comp}>`;
  });
}

// ---------------------------------------------------------------------------
// Blockquote callouts → <Tip> / <Info> / <Warning> / <Note>
// ---------------------------------------------------------------------------

export function convertBlockquoteCallouts(content) {
  const lines = content.split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const bqM = lines[i].match(/^> (.+)$/);
    if (bqM) {
      const first = bqM[1];
      let matched = null;
      let title = "";

      for (const [emoji, comp] of Object.entries(EMOJI_MAP)) {
        if (first.startsWith(emoji)) {
          matched = comp;
          title = first.slice(emoji.length).trim();
          break;
        }
      }

      if (matched) {
        const body = [];
        i++;
        while (i < lines.length && (lines[i].startsWith("> ") || lines[i] === ">")) {
          body.push(lines[i].startsWith("> ") ? lines[i].slice(2) : "");
          i++;
        }
        while (body.length && body[0] === "") body.shift();
        while (body.length && body[body.length - 1] === "") body.pop();

        out.push(`<${matched}>`);
        if (title) { out.push(`**${title}**`); out.push(""); }
        out.push(...body);
        out.push(`</${matched}>`);
        continue;
      }
    }

    out.push(lines[i]);
    i++;
  }

  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Links: doc:slug  changelog:slug  ref:slug
// ---------------------------------------------------------------------------

export function convertLinks(content) {
  content = content.replace(/\(doc:([^)#\s]+)#([^)\s]+)\)/g, "(/docs/$1#$2)");
  content = content.replace(/\(doc:([^)\s]+)\)/g, "(/docs/$1)");
  content = content.replace(/\(changelog:([^)\s]+)\)/g, "(/changelog/$1)");
  content = content.replace(/\(ref:([^)\s]+)\)/g, "(/docs/$1)");
  return content;
}

// ---------------------------------------------------------------------------
// Code blocks: normalise language + wrap adjacent blocks in <CodeGroup>
// ---------------------------------------------------------------------------

function normaliseFenceHeader(header) {
  if (!header) return "";
  const [lang, ...rest] = header.split(/\s+/);
  const title = rest.join(" ");
  const alias = LANG_ALIASES[lang.toLowerCase()];
  if (alias) {
    const [normLang, fallbackTitle] = alias;
    const display = title || fallbackTitle;
    return display ? `${normLang} ${display}` : normLang;
  }
  return header;
}

export function convertCodeBlocks(content) {
  const lines = content.split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const fenceM = lines[i].match(/^(`{3,}|~{3,})(\S.*)?$/);
    if (fenceM) {
      const blocks = [];

      while (true) {
        const openM = (lines[i] ?? "").match(/^(`{3,}|~{3,})(\S.*)?$/);
        if (!openM) break;

        const f = openM[1];
        const h = (openM[2] ?? "").trim();
        const norm = normaliseFenceHeader(h);
        const block = [norm ? `${f}${norm}` : f];
        i++;

        while (i < lines.length) {
          if (lines[i].trim() === f || lines[i] === f) {
            block.push(lines[i]);
            i++;
            break;
          }
          block.push(lines[i]);
          i++;
        }

        blocks.push(block);

        if (i < lines.length && /^(`{3,}|~{3,})\S/.test(lines[i])) continue;
        break;
      }

      if (blocks.length > 1) {
        out.push("<CodeGroup>");
        for (const blk of blocks) {
          for (const line of blk) out.push(`  ${line}`);
        }
        out.push("</CodeGroup>");
      } else if (blocks.length === 1) {
        out.push(...blocks[0]);
      }
      continue;
    }

    out.push(lines[i]);
    i++;
  }

  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Misc transforms
// ---------------------------------------------------------------------------

export function convertHorizontalRules(content) {
  return content.replace(/^\*\*\*\s*$/gm, "---");
}

export function convertTableTags(content) {
  content = content.replace(/<Table(?:\s[^>]*)?>/, "<table>");
  content = content.replace(/<\/Table>/g, "</table>");
  return content;
}

function cssToReact(css) {
  const pairs = css.split(";").map(d => d.trim()).filter(d => d.includes(":")).map(d => {
    const [prop, ...rest] = d.split(":");
    const val = rest.join(":").trim();
    const camel = prop.trim().split("-").map((p, i) => i === 0 ? p : p[0].toUpperCase() + p.slice(1)).join("");
    return `${camel}: "${val}"`;
  });
  return "{" + pairs.join(", ") + "}";
}

export function convertInlineStyles(content) {
  return content.replace(/style="([^"]*)"/g, (_, css) => `style={${cssToReact(css)}}`);
}

// ---------------------------------------------------------------------------
// Image downloading
// ---------------------------------------------------------------------------

function readmeFilename(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== README_IMAGE_HOST) return null;
    return parsed.pathname.replace(/^\//, "");
  } catch { return null; }
}

async function ensureImage(url, imagesDir, verbose, dryRun) {
  const filename = readmeFilename(url);
  if (!filename) return url;

  const localPath = join(imagesDir, filename);
  const localSrc = `/images/docs/${filename}`;

  if (existsSync(localPath)) return localSrc;

  if (dryRun) {
    if (verbose) console.log(chalk.dim(`  [would download] ${url}`));
    return localSrc;
  }

  mkdirSync(join(imagesDir, filename, "..").replace(/[^/]+$/, ""), { recursive: true });
  mkdirSync(imagesDir, { recursive: true });

  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(localPath, buf);
    if (verbose) console.log(chalk.dim(`  Downloaded: ${localSrc}`));
  } catch (e) {
    console.warn(chalk.yellow(`  WARNING: could not download ${url}: ${e.message}`));
    return url;
  }

  return localSrc;
}

// ---------------------------------------------------------------------------
// <Image> component → <Frame><img /></Frame>
// ---------------------------------------------------------------------------

const ATTR_RE = String.raw`((?:\s+\w+(?:=(?:"[^"]*"|'[^']*'|\{[^}]*\}))?)*)`;

function parseJsxAttrs(str) {
  const attrs = {};
  for (const m of str.matchAll(/(\w+)=(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g)) {
    attrs[m[1]] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return attrs;
}

async function buildFrame(attrsStr, childCaption, opts) {
  const { imagesDir, verbose, dryRun, noImages } = opts;
  const attrs = parseJsxAttrs(attrsStr);

  let src = attrs.src ?? "";
  if (src && !noImages) src = await ensureImage(src, imagesDir, verbose, dryRun);

  const caption = (attrs.caption || childCaption || "").trim();
  const parts = [];
  if (src) parts.push(`src="${src}"`);
  const alt = attrs.alt ?? "";
  if (alt && !/^\d+$/.test(alt)) parts.push(`alt="${alt}"`);
  if (attrs.width && attrs.width !== "smart") parts.push(`width="${attrs.width}"`);
  if (attrs.align) parts.push(`align="${attrs.align}"`);

  const img = `<img ${parts.join(" ")} />`;
  return caption ? `<Frame caption="${caption.replace(/"/g, "&quot;")}">${img}</Frame>` : `<Frame>${img}</Frame>`;
}

export async function convertImageComponents(content, opts) {
  // <Image ...>children</Image>
  const withChildren = [];
  const promisesA = [];
  content = content.replace(new RegExp(`<Image${ATTR_RE}\\s*>([\\s\\S]*?)<\\/Image>`, "g"), (_, attrs, child) => {
    const idx = withChildren.length;
    promisesA.push(buildFrame(attrs, child.trim(), opts));
    withChildren.push(`__IMAGE_A_${idx}__`);
    return `__IMAGE_A_${idx}__`;
  });
  const resolvedA = await Promise.all(promisesA);
  for (let i = 0; i < resolvedA.length; i++) {
    content = content.replace(`__IMAGE_A_${i}__`, resolvedA[i]);
  }

  // Self-closing <Image ... /> and unclosed <Image ...>
  const selfClosing = [];
  const promisesB = [];
  content = content.replace(new RegExp(`<Image${ATTR_RE}\\s*/?>`, "g"), (_, attrs) => {
    const idx = selfClosing.length;
    promisesB.push(buildFrame(attrs, "", opts));
    selfClosing.push(`__IMAGE_B_${idx}__`);
    return `__IMAGE_B_${idx}__`;
  });
  const resolvedB = await Promise.all(promisesB);
  for (let i = 0; i < resolvedB.length; i++) {
    content = content.replace(`__IMAGE_B_${i}__`, resolvedB[i]);
  }

  return content;
}

export async function convertMarkdownImages(content, opts) {
  const { imagesDir, verbose, dryRun, noImages } = opts;
  const matches = [...content.matchAll(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g)];
  for (const m of matches) {
    const [full, alt, url, title] = m;
    const local = noImages ? url : await ensureImage(url, imagesDir, verbose, dryRun);
    const display = title || (alt && !/^\d+$/.test(alt) ? alt : "");
    content = content.replace(full, `<Frame>![${display}](${local})</Frame>`);
  }
  return content;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function convert(content, opts = {}) {
  content = convertFrontmatter(content);
  content = convertCalloutTags(content);
  content = convertBlockquoteCallouts(content);
  content = convertLinks(content);
  content = convertCodeBlocks(content);
  content = convertHorizontalRules(content);
  content = convertTableTags(content);
  content = convertInlineStyles(content);
  content = await convertImageComponents(content, opts);
  content = await convertMarkdownImages(content, opts);
  return content;
}

export async function convertFile(src, targetDir, opts = {}) {
  const { dryRun, verbose } = opts;
  const text = readFileSync(src, "utf-8");
  const result = await convert(text, opts);
  const out = join(targetDir, basename(src, ".md") + ".mdx");

  if (dryRun) {
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
    if (verbose) console.log(`  ${chalk.dim(basename(src))}  →  ${chalk.green(out)}`);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Fetch mode
// ---------------------------------------------------------------------------

async function fetchUrls(urls, sourceDir, opts) {
  const { dryRun, verbose } = opts;
  if (verbose) console.log(chalk.cyan(`\nFetching ${urls.length} file(s)...`));

  const fetched = [];
  for (const url of urls) {
    const mdUrl = url.replace(/\/$/, "") + ".md";
    const slug = url.replace(/\/$/, "").split("/").pop();
    const dest = join(sourceDir, `${slug}.md`);

    if (dryRun) {
      if (verbose) console.log(chalk.dim(`  [would fetch] ${mdUrl}  →  ${slug}.md`));
      fetched.push(dest);
      continue;
    }

    mkdirSync(sourceDir, { recursive: true });
    try {
      const res = await fetch(mdUrl, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      if (verbose) console.log(chalk.dim(`  Fetched: ${slug}.md`));
      fetched.push(dest);
    } catch (e) {
      console.warn(chalk.yellow(`  WARNING: could not fetch ${mdUrl}: ${e.message}`));
    }
  }

  return fetched;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * @param {Object} options
 * @param {string} options.from       - Source directory for .md files
 * @param {string|null} options.urlsFile - JSON file with URLs to fetch
 * @param {string} options.output     - Output directory for .mdx files
 * @param {string} options.imagesDir  - Directory to save downloaded images
 * @param {boolean} options.noImages  - Skip downloading images
 * @param {boolean} options.dryRun
 * @param {boolean} options.quiet
 */
export async function readmeConvert(options) {
  const verbose = !options.quiet;
  const sourceDir = resolve(process.cwd(), options.from);
  const targetDir = resolve(process.cwd(), options.output);
  const imagesDir = resolve(process.cwd(), options.imagesDir);

  const opts = { imagesDir, verbose, dryRun: options.dryRun, noImages: options.noImages };

  let files;

  if (options.urlsFile) {
    const urlsPath = resolve(process.cwd(), options.urlsFile);
    if (!existsSync(urlsPath)) {
      console.error(chalk.red(`Error: urls file not found: ${urlsPath}`));
      process.exit(1);
    }
    let urls;
    try {
      urls = JSON.parse(readFileSync(urlsPath, "utf-8"));
    } catch (e) {
      console.error(chalk.red(`Error parsing ${options.urlsFile}: ${e.message}`));
      process.exit(1);
    }
    files = await fetchUrls(urls, sourceDir, opts);
  } else {
    if (!existsSync(sourceDir)) {
      console.error(chalk.red(`Error: source directory not found: ${sourceDir}`));
      process.exit(1);
    }
    files = readdirSync(sourceDir)
      .filter(f => f.endsWith(".md"))
      .sort()
      .map(f => join(sourceDir, f));

    if (!files.length) {
      console.error(chalk.red(`Error: no .md files found in ${sourceDir}`));
      process.exit(1);
    }
  }

  if (verbose) {
    console.log(chalk.cyan(`\nConverting ${files.length} file(s) to MDX...`));
    if (options.dryRun) console.log(chalk.yellow("  [dry-run] No files will be written\n"));
  }

  for (const f of files) {
    await convertFile(f, targetDir, opts);
  }

  if (verbose && !options.dryRun) {
    console.log(chalk.green(`\n  ✓ ${files.length} file${files.length !== 1 ? "s" : ""} written to ${options.output}`));
  }
}
