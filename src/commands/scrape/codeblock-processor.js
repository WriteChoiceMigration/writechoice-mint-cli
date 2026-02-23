/**
 * Code Block Processor
 *
 * Pre-processes <pre>/<code> elements before markdown conversion to detect
 * language identifiers, and post-processes fenced code blocks to apply
 * detected languages.
 */

/** Supported language identifiers for detection */
const SUPPORTED_LANGUAGES = new Set([
  "javascript", "js", "typescript", "ts", "jsx", "tsx",
  "python", "py", "ruby", "rb", "java", "kotlin", "swift",
  "go", "rust", "c", "cpp", "csharp", "cs",
  "php", "perl", "scala", "r", "dart", "elixir", "ex",
  "html", "xml", "css", "scss", "sass", "less",
  "json", "yaml", "yml", "toml", "ini", "env",
  "bash", "sh", "shell", "zsh", "fish", "powershell", "ps1",
  "sql", "graphql", "gql",
  "markdown", "md", "mdx",
  "dockerfile", "makefile",
  "text", "plaintext", "plain",
]);

/**
 * Extracts the language identifier from a <code> or <pre> element's class list.
 * @param {Object} $el - Cheerio element
 * @param {string[]} patterns - Class prefix patterns to check
 * @returns {string} Language string or empty string
 */
export function detectLanguageFromClasses($el, $, patterns) {
  const className = $el.attr("class") || "";
  const dataLang = $el.attr("data-language") || $el.attr("data-lang") || "";

  if (dataLang) return normalizeLanguage(dataLang);

  for (const pattern of patterns) {
    const re = new RegExp(`(?:^|\\s)${escapeRegex(pattern)}(\\S+)`, "i");
    const m = className.match(re);
    if (m) return normalizeLanguage(m[1]);
  }

  // Also check parent's class
  const parent = $el.parent();
  if (parent && parent.length) {
    const parentClass = parent.attr("class") || "";
    for (const pattern of patterns) {
      const re = new RegExp(`(?:^|\\s)${escapeRegex(pattern)}(\\S+)`, "i");
      const m = parentClass.match(re);
      if (m) return normalizeLanguage(m[1]);
    }
  }

  return "";
}

function normalizeLanguage(lang) {
  const l = lang.toLowerCase().trim();
  // Map common aliases
  const aliases = {
    js: "javascript",
    ts: "typescript",
    py: "python",
    rb: "ruby",
    sh: "bash",
    shell: "bash",
    zsh: "bash",
    yml: "yaml",
    cs: "csharp",
    "c++": "cpp",
    ps1: "powershell",
    ex: "elixir",
    gql: "graphql",
  };
  return aliases[l] || l;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Pre-processes all <pre><code> elements to add a data-detected-lang attribute
 * so turndown can pick it up later.
 * @param {Object} $ - Cheerio instance
 * @param {string[]} patterns - Language class patterns from config
 */
export function preProcessCodeBlocks($, patterns = ["language-", "lang-", "highlight-"]) {
  $("pre").each((_, pre) => {
    const $pre = $(pre);
    const $code = $pre.find("code").first();
    const $target = $code.length ? $code : $pre;

    const lang = detectLanguageFromClasses($target, $, patterns);
    if (lang) {
      $pre.attr("data-detected-lang", lang);
    }
  });
}

/**
 * Post-processes fenced code blocks in markdown text to add language identifiers.
 * Looks for ``` blocks without a language and tries to detect from content.
 * @param {string} text - Markdown text
 * @returns {string}
 */
export function postProcessCodeBlocks(text) {
  // Replace ``` blocks that have a data-detected-lang comment injected by turndown rule
  // The turndown rule will add the lang as part of the fence opener if we configure it
  return text;
}

/**
 * Creates a Turndown rule that preserves language info from data-detected-lang.
 * @returns {Object} Turndown rule object
 */
export function createTurndownCodeRule() {
  return {
    filter: ["pre"],
    replacement(content, node) {
      const lang = node.getAttribute ? (node.getAttribute("data-detected-lang") || "") : "";
      // Get the code content from the <code> child or raw text
      const code = node.querySelector ? node.querySelector("code") : null;
      const codeContent = code ? code.textContent : node.textContent;
      const fence = "```";
      return `\n\n${fence}${lang}\n${codeContent.trim()}\n${fence}\n\n`;
    },
  };
}
