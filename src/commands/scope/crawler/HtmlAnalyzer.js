/**
 * HtmlAnalyzer - Pure HTML content analysis using regex patterns.
 *
 * HTTP fallback analyzer that parses raw HTML without a browser DOM.
 * Extracts content metrics, detects platform/framework, identifies
 * API documentation tooling, and catalogs page components.
 */

/**
 * Analyze raw HTML content to extract rich scoping data.
 * Returns a partial page analysis (everything except discoveredLinks and category).
 */
export function analyzeHtmlContent(html, pageUrl, scopePrefix, contentSelector) {
  const origin = (() => {
    try {
      return new URL(pageUrl).origin;
    } catch {
      return "";
    }
  })();

  // Title
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = (h1Match ? h1Match[1] : titleMatch ? titleMatch[1] : "").replace(/<[^>]+>/g, "").trim();

  // Word count (strip tags)
  const textOnly = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const wordCount = textOnly.split(/\s+/).filter((w) => w.length > 0).length;

  // Headings
  const headings = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
  for (let level = 1; level <= 6; level++) {
    const re = new RegExp(`<h${level}[\\s>]`, "gi");
    headings[`h${level}`] = (html.match(re) || []).length;
  }

  // Code blocks
  const preCount = (html.match(/<pre[\s>]/gi) || []).length;
  const codeLangs = new Set();
  const langMatches = html.matchAll(/class="[^"]*(?:language-|lang-)([a-zA-Z0-9+#-]+)/gi);
  for (const m of langMatches) codeLangs.add(m[1].toLowerCase());
  const codeBlocks = { count: preCount, languages: Array.from(codeLangs) };

  // Tables
  const tableCount = (html.match(/<table[\s>]/gi) || []).length;
  const rowCount = (html.match(/<tr[\s>]/gi) || []).length;
  const tables = { count: tableCount, totalRows: rowCount };

  // Images
  const imgMatches = html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi);
  let imgCount = 0;
  let externalImgs = 0;
  for (const m of imgMatches) {
    imgCount++;
    try {
      if (m[1].startsWith("http") && new URL(m[1]).origin !== origin) externalImgs++;
    } catch {}
  }
  const images = { count: imgCount, external: externalImgs };

  // Lists
  const lists = {
    ordered: (html.match(/<ol[\s>]/gi) || []).length,
    unordered: (html.match(/<ul[\s>]/gi) || []).length,
  };

  // Videos
  const videos = [];
  const iframeMatches = html.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi);
  for (const m of iframeMatches) {
    const src = m[1];
    if (/youtube|youtu\.be/i.test(src)) videos.push({ type: "youtube", src });
    else if (/vimeo/i.test(src)) videos.push({ type: "vimeo", src });
    else if (/loom\.com/i.test(src)) videos.push({ type: "loom", src });
    else if (/wistia/i.test(src)) videos.push({ type: "wistia", src });
  }
  const videoCount = (html.match(/<video[\s>]/gi) || []).length;
  for (let i = 0; i < videoCount; i++) videos.push({ type: "html5-video", src: "" });

  // External links
  const externalLinks = [];
  const linkMatches = html.matchAll(/<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);
  for (const m of linkMatches) {
    try {
      if (new URL(m[1]).origin !== origin) {
        externalLinks.push({
          url: m[1],
          text: m[2].replace(/<[^>]+>/g, "").trim().substring(0, 100),
        });
      }
    } catch {}
  }

  // Tabs / Accordions
  const htmlLower = html.toLowerCase();
  const tabs =
    (htmlLower.match(/class="[^"]*(?:tabs|tablist|tab-container)[^"]*"/gi) || []).length +
    (htmlLower.match(/role="tablist"/gi) || []).length;
  const accordions =
    (htmlLower.match(/class="[^"]*(?:accordion|collapsible|expandable)[^"]*"/gi) || []).length +
    (html.match(/<details[\s>]/gi) || []).length;

  // Download links
  const downloadExts = [".pdf", ".zip", ".csv", ".xlsx", ".docx", ".dmg", ".exe", ".pkg", ".tar.gz"];
  const dlExtSet = new Set();
  let dlCount = 0;
  const allHrefs = html.matchAll(/href=["']([^"']+)["']/gi);
  for (const m of allHrefs) {
    const href = m[1].toLowerCase();
    const matchedExt = downloadExts.find((ext) => href.endsWith(ext));
    if (matchedExt) {
      dlCount++;
      dlExtSet.add(matchedExt);
    }
  }
  const downloadLinks = { count: dlCount, extensions: Array.from(dlExtSet) };

  // Forms
  const forms = (html.match(/<form[\s>]/gi) || []).length;

  // Iframes (non-video)
  let iframes = 0;
  const allIframes = html.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi);
  for (const m of allIframes) {
    if (!/youtube|youtu\.be|vimeo|loom|wistia|zendesk/i.test(m[1])) iframes++;
  }

  // Tooltips
  const tooltips = (htmlLower.match(/data-tooltip|class="[^"]*tooltip[^"]*"|aria-describedby/gi) || []).length;

  // API refs
  const apiRefs = [];
  if (
    /class="[^"]*(?:swagger-ui|redoc-wrap)[^"]*"|id="[^"]*(?:swagger|redoc)[^"]*"|<swagger-ui[\s>]|<rapi-doc[\s>]/i.test(
      html,
    )
  ) {
    apiRefs.push("OpenAPI/Swagger UI detected");
  } else if (/["']openapi["']\s*:\s*["']|["']swagger["']\s*:\s*["']/i.test(html)) {
    apiRefs.push("OpenAPI/Swagger spec embedded");
  }
  if (/class="[^"]*graphiql[^"]*"|class="[^"]*graphql-explorer[^"]*"/i.test(html)) {
    apiRefs.push("GraphQL detected");
  }
  if (
    /id="api-playground|class="[^"]*(?:openapi-content|openapi-method|tryit-button|method-pill|param-field)[^"]*"|data-testid="[^"]*playground/i.test(
      html,
    )
  ) {
    apiRefs.push("Mintlify API playground detected");
  }
  if (/<elements-api[\s>]|class="[^"]*(?:sl-elements|TryItPanel|TryIt)[^"]*"/i.test(html)) {
    apiRefs.push("Stoplight Elements detected");
  }
  if (/postman-run-button|data-postman|postman-embed/i.test(html)) {
    apiRefs.push("Postman integration detected");
  }
  if (/class="[^"]*(?:api-method|http-method|api-content|endpoint)[^"]*"/i.test(html)) {
    apiRefs.push("REST API documentation detected");
  }
  if (/name=["']readme-deploy["']|class="[^"]*rdmd[^"]*"/i.test(html)) {
    apiRefs.push("readme.com API docs detected");
  }

  // OpenAPI specs
  const openApiSpecs = [];
  const specMatches = html.matchAll(/href=["']([^"']*(?:swagger|openapi)[^"']*)["']/gi);
  for (const m of specMatches) openApiSpecs.push(m[1]);
  const yamlJsonMatches = html.matchAll(/href=["']([^"']*(?:\.yaml|\.json)[^"']*)["']/gi);
  for (const m of yamlJsonMatches) {
    if (/openapi|swagger/i.test(m[1])) openApiSpecs.push(m[1]);
    else if (/api[_-]?spec|spec[_-]?api/i.test(m[1])) openApiSpecs.push(m[1]);
  }

  // API Playgrounds
  const apiPlaygroundMatches = (
    html.match(
      /class="[^"]*(?:swagger-ui|redoc-wrap|scalar-app|api-playground|sl-elements|rm-TryItOut|rm-APIMethod|api-explorer|openapi-content|openapi-method|TryItPanel|rm-TryIt|rm-RequestForm|postman-run-button|endpoint-playground|api-tester|api-console|request-builder)[^"]*"|<(?:redoc|rapidoc|rapi-doc|scalar-api-reference|elements-api|bump-api-reference)[\s>]|id="api-playground[^"]*"|class="[^"]*(?:api-section|tryit-button|method-pill|param-field)[^"]*"|data-testid="[^"]*playground[^"]*"|data-postman/gi,
    ) || []
  ).length;

  let urlPath = "";
  try {
    urlPath = new URL(pageUrl).pathname.toLowerCase();
  } catch {}
  const urlIsApiPlayground =
    /\/(?:api-reference|api-playground|api-explorer|playground|try-it|tryit|swagger|redoc|graphql-playground|graphiql)(?:\/|$)/.test(
      urlPath,
    );

  let apiPlaygrounds = apiPlaygroundMatches;
  if (urlIsApiPlayground && apiPlaygrounds === 0) apiPlaygrounds = 1;

  const playgroundTypes = [];
  if (/class="[^"]*swagger-ui[^"]*"/i.test(html)) playgroundTypes.push("swagger-ui");
  if (/class="[^"]*redoc-wrap[^"]*"|<redoc[\s>]/i.test(html)) playgroundTypes.push("redoc");
  if (/<rapidoc[\s>]|<rapi-doc[\s>]/i.test(html)) playgroundTypes.push("rapidoc");
  if (/scalar-app|<scalar-api-reference[\s>]/i.test(html)) playgroundTypes.push("scalar");
  if (/<elements-api[\s>]|class="[^"]*(?:sl-elements|TryItPanel|TryIt)[^"]*"/i.test(html))
    playgroundTypes.push("stoplight");
  if (/<bump-api-reference[\s>]/i.test(html)) playgroundTypes.push("bump");
  if (
    /class="[^"]*(?:api-playground|openapi-content|openapi-method|param-field)[^"]*"|id="api-playground|data-testid="[^"]*playground/i.test(
      html,
    )
  )
    playgroundTypes.push("mintlify-api");
  if (/rm-TryItOut|rm-APIMethod|rm-TryIt|rm-RequestForm|TryItNow/i.test(html)) playgroundTypes.push("readme");
  if (/postman-run-button|data-postman|postman-embed/i.test(html)) playgroundTypes.push("postman");
  if (/class="[^"]*insomnia-[^"]*"/i.test(html)) playgroundTypes.push("insomnia");
  if (/class="[^"]*(?:api-explorer|endpoint-playground|api-tester|api-console)[^"]*"/i.test(html))
    playgroundTypes.push("generic");

  if (playgroundTypes.length === 0 && urlIsApiPlayground) {
    if (/swagger/.test(urlPath)) playgroundTypes.push("swagger-ui");
    else if (/redoc/.test(urlPath)) playgroundTypes.push("redoc");
    else if (/graphql/.test(urlPath)) playgroundTypes.push("graphql");
    else playgroundTypes.push("generic");
  }

  // GraphQL explorers
  const graphqlExplorers = (
    htmlLower.match(/class="[^"]*(?:graphiql|graphql-explorer|graphql-playground|graphql-ide)[^"]*"/gi) || []
  ).length;

  // Custom components (tags with hyphens)
  const customComponents = [];
  const tagCounts = {};
  const customTagMatches = html.matchAll(/<([a-z]+-[a-z0-9-]+)[\s>]/gi);
  for (const m of customTagMatches) {
    const tag = m[1].toLowerCase();
    if (!tag.startsWith("x-")) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  }
  for (const [tag, count] of Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)) {
    customComponents.push({ tag, count });
  }

  // Breadcrumbs
  let breadcrumbDepth = 0;
  const bcMatch = html.match(/class="[^"]*breadcrumb[^"]*"[\s\S]*?<\/(?:nav|ol|ul|div)>/i);
  if (bcMatch) {
    breadcrumbDepth = (bcMatch[0].match(/<li[\s>]|<a[\s>]/gi) || []).length;
  }

  // Pagination
  const hasPagination =
    /class="[^"]*pagination[^"]*"|rel="next"|class="[^"]*page-nav[^"]*"|class="[^"]*next-prev[^"]*"/i.test(html);

  // Language switcher
  const hasLanguageSwitcher =
    /class="[^"]*(?:locale|language-switch|lang-select|language-selector)[^"]*"|hreflang/i.test(html);

  // Sidebar items
  let sidebarItems = 0;
  if (scopePrefix) {
    const sidebarMatch = html.match(
      /<nav[\s\S]*?<\/nav>|class="[^"]*sidebar[^"]*"[\s\S]*?<\/(?:div|aside|nav)>/i,
    );
    if (sidebarMatch) {
      const sidebarHrefs = sidebarMatch[0].matchAll(/href=["']([^"']+)["']/gi);
      for (const m of sidebarHrefs) {
        try {
          let full;
          if (m[1].startsWith("http")) full = m[1];
          else full = new URL(m[1], pageUrl).href;
          if (full.startsWith(scopePrefix)) sidebarItems++;
        } catch {}
      }
    }
  }

  // Platform detection
  let platform;
  const metaGenMatch =
    html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']generator["']/i);
  const metaGen = metaGenMatch ? metaGenMatch[1] : "";

  if (
    /docusaurus/i.test(metaGen) ||
    /__docusaurus_skipToContent_fallback|id="__docusaurus"|theme-doc-markdown/i.test(html)
  ) {
    platform = "docusaurus";
  } else if (/mkdocs/i.test(metaGen) || /md-typeset|id="__md"|class="[^"]*md-content/i.test(html)) {
    platform = "mkdocs";
  } else if (/data-testid="page\.contentEditor"|gitbook-root/i.test(html)) {
    platform = "gitbook";
  } else if (/id="VPContent"|VPDoc|vp-doc/i.test(html) || /vitepress/i.test(metaGen)) {
    platform = "vitepress";
  } else if (
    /readthedocs-data\.js|readthedocs\.io|readthedocs\.org/i.test(html) ||
    (/rst-content/i.test(htmlLower) && /data-project=/i.test(html))
  ) {
    platform = "readthedocs";
  } else if (
    /sphinx/i.test(metaGen) ||
    /sphinxsidebarwrapper|DOCUMENTATION_OPTIONS/i.test(html) ||
    (/rst-content/i.test(htmlLower) && !platform)
  ) {
    platform = "sphinx";
  } else if (/nextra-sidebar-container|class="[^"]*nextra/i.test(html) || /nextra/i.test(metaGen)) {
    platform = "nextra";
  } else if (
    /id="starlight__sidebar"|starlight-theme-select|sl-markdown-content/i.test(html) ||
    (/astro/i.test(metaGen) && /starlight/i.test(htmlLower))
  ) {
    platform = "starlight";
  } else if (/fumadocs/i.test(htmlLower)) {
    platform = "fumadocs";
  } else if (/readme-deploy|readme-tailwind|class="[^"]*rdmd|id="hub-header"/i.test(html)) {
    platform = "readme";
  } else if (/td-content/i.test(htmlLower) && /docsy/i.test(htmlLower)) {
    platform = "hugo-docsy";
  } else if (/jekyll/i.test(metaGen)) {
    platform = "jekyll";
  } else if (/powered-by-zendesk|HelpCenter/i.test(html) || /\/hc\/[a-z]{2}/i.test(pageUrl)) {
    platform = "zendesk";
  } else if (/window\.\$docsify|data-docsify/i.test(html)) {
    platform = "docsify";
  } else if (/devsite-main-content|devsite-article|clouddocs-homepage/i.test(html)) {
    platform = "google-devsite";
  } else if (/mintlify/i.test(metaGen) || /class="[^"]*mintlify/i.test(html)) {
    platform = "mintlify";
  } else if (/id="wiki-app"|wiki-page/i.test(html)) {
    platform = "wikijs";
  } else if (/slate/i.test(metaGen) || (/tocify/i.test(htmlLower) && /page-wrapper/i.test(htmlLower))) {
    platform = "slate";
  } else if (/notion-page-content/i.test(html)) {
    platform = "notion";
  } else if (/confluence-information-macro|class="[^"]*wiki-content/i.test(html)) {
    platform = "confluence";
  }

  // Content format inference from platform
  let contentFormat;
  if (platform === "nextra" || platform === "fumadocs" || platform === "mintlify") {
    contentFormat = "mdx";
  } else if (platform === "docusaurus") {
    contentFormat = /admonition|class="[^"]*tabs/i.test(html) ? "mdx" : "markdown";
  } else if (
    platform === "mkdocs" ||
    platform === "vitepress" ||
    platform === "jekyll" ||
    platform === "hugo-docsy" ||
    platform === "starlight" ||
    platform === "docsify" ||
    platform === "wikijs"
  ) {
    contentFormat = "markdown";
  } else if (platform === "sphinx" || platform === "readthedocs") {
    contentFormat = "rst";
  } else if (
    platform === "gitbook" ||
    platform === "readme" ||
    platform === "notion" ||
    platform === "confluence" ||
    platform === "zendesk" ||
    platform === "google-devsite" ||
    platform === "slate"
  ) {
    contentFormat = "html";
  }

  // Homepage detection
  let isHomepage = false;
  try {
    const pathname = new URL(pageUrl).pathname;
    const isRoot = pathname === "/" || pathname === "/docs/" || pathname === "/docs" || /^\/[a-z]{2}\/?$/i.test(pathname);
    const hasHero = /class="[^"]*(?:hero|banner|landing|jumbotron)[^"]*"/i.test(html);
    const hasFeatureGrid = /class="[^"]*(?:feature|highlights|cards-grid)[^"]*"/i.test(html);
    isHomepage = isRoot || hasHero || hasFeatureGrid;
  } catch {}

  // Special content detection
  const specialContent = {
    thirdPartyEmbeds: [],
    mathContent: 0,
    diagramContent: 0,
    codePlaygrounds: 0,
  };
  const embedPatterns = [
    ["CodePen", /iframe[^>]+src="[^"]*codepen\.io|class="[^"]*codepen/gi],
    ["CodeSandbox", /iframe[^>]+src="[^"]*codesandbox\.io/gi],
    ["StackBlitz", /iframe[^>]+src="[^"]*stackblitz\.com/gi],
    ["Replit", /iframe[^>]+src="[^"]*repl(?:it)?\.(?:com|it)/gi],
    ["JSFiddle", /iframe[^>]+src="[^"]*jsfiddle\.net/gi],
    ["GitHub Gist", /script[^>]+src="[^"]*gist\.github\.com/gi],
    ["RunKit", /iframe[^>]+src="[^"]*runkit\.com|class="[^"]*runkit-embed/gi],
    ["Observable", /iframe[^>]+src="[^"]*observablehq\.com/gi],
    ["Figma", /iframe[^>]+src="[^"]*figma\.com/gi],
  ];
  for (const [provider, regex] of embedPatterns) {
    const matches = html.match(regex);
    if (matches && matches.length > 0) {
      specialContent.thirdPartyEmbeds.push({ provider, count: matches.length });
    }
  }
  specialContent.mathContent = (
    html.match(
      /class="[^"]*(?:MathJax|katex|math-display|MathJax_Display|math-inline|arithmatex)[^"]*"|<math[\s>]|type="math\/tex"|type="[^"]*mathjax/gi,
    ) || []
  ).length;
  specialContent.diagramContent = (
    html.match(
      /class="[^"]*(?:mermaid|drawio|diagram-container|plantuml|graphviz|d2-|kroki)[^"]*"|data-mermaid/gi,
    ) || []
  ).length;
  specialContent.codePlaygrounds = (
    html.match(
      /iframe[^>]+src="[^"]*(?:codepen\.io|codesandbox\.io|stackblitz\.com|repl(?:it)?\.(?:com|it)|jsfiddle\.net)/gi,
    ) || []
  ).length;

  // API reference page detection
  let apiRefSignals = 0;
  const httpMethodMatches = textOnly.match(/(GET|POST|PUT|PATCH|DELETE)\s+\/[a-zA-Z0-9\/{}_.-]+/g);
  if (httpMethodMatches && httpMethodMatches.length >= 2) apiRefSignals += 2;
  if (
    (html.match(
      /class="[^"]*(?:response-code|response-body|request-body|response-panel|request-panel)[^"]*"/gi,
    ) || []).length >= 2
  )
    apiRefSignals++;
  if (
    (html.match(
      /class="[^"]*(?:param-|parameter|field-list|primitive-param-field|object-param-field|query-param|path-param|header-param|body-param)[^"]*"|class="[^"]*(?:api-field|param-field)[^"]*"/gi,
    ) || []).length >= 3
  )
    apiRefSignals++;
  if (/class="[^"]*(?:authorization|security-scheme|auth-scheme|api-key|bearer-token)[^"]*"/i.test(html))
    apiRefSignals++;
  if (/\/(?:api-reference|api-ref|reference\/api|api\/v?\d|apis\/)/.test(urlPath)) apiRefSignals++;
  if (
    (html.match(/class="[^"]*(?:method-badge|http-badge|method-pill|http-method|api-method)[^"]*"/gi) || []).length >= 2
  )
    apiRefSignals++;
  if (
    /class="[^"]*(?:endpoint-url|endpoint-path|api-path|base-url)[^"]*"|class="[^"]*endpoint[^"]*"[^>]*><code/i.test(
      html,
    )
  )
    apiRefSignals++;
  if (
    /class="[^"]*(?:response-schema|request-schema|schema-table|properties-table)[^"]*"|class="[^"]*model-[^"]*"/i.test(
      html,
    )
  )
    apiRefSignals++;
  const isApiReferencePage = apiRefSignals >= 2 || apiPlaygrounds > 0;

  // Content selector detection in raw HTML
  let contentSelectorFound = false;
  if (contentSelector) {
    const parts = contentSelector.split(",").map((s) => s.trim());
    for (const part of parts) {
      const classMatch = part.match(/\.([a-zA-Z0-9_-]+)/);
      const idMatch = part.match(/#([a-zA-Z0-9_-]+)/);
      const tagMatch = part.match(/^([a-zA-Z]+)$/);
      if (classMatch && new RegExp(`class="[^"]*${classMatch[1]}`, "i").test(html)) {
        contentSelectorFound = true;
        break;
      }
      if (idMatch && new RegExp(`id="${idMatch[1]}"`, "i").test(html)) {
        contentSelectorFound = true;
        break;
      }
      if (tagMatch && new RegExp(`<${tagMatch[1]}[\\s>]`, "i").test(html)) {
        contentSelectorFound = true;
        break;
      }
    }
  }

  // Platform component detection
  const calloutVariants = { note: 0, warning: 0, tip: 0, info: 0, danger: 0, check: 0 };
  const admonitionMatches = html.matchAll(/class="[^"]*(?:admonition|callout|alert|notice|hint|attention)[^"]*"/gi);
  let totalCallouts = 0;
  for (const m of admonitionMatches) {
    totalCallouts++;
    const cls = m[0].toLowerCase();
    if (/warning|caution|attention/.test(cls)) calloutVariants.warning++;
    else if (/tip|hint|suggestion/.test(cls)) calloutVariants.tip++;
    else if (/info|information|seealso/.test(cls)) calloutVariants.info++;
    else if (/danger|error|critical/.test(cls)) calloutVariants.danger++;
    else if (/check|success|done/.test(cls)) calloutVariants.check++;
    else calloutVariants.note++;
  }

  const tabsComp = (
    htmlLower.match(/class="[^"]*(?:tabbed-set|tabbed-block|tabs-container|tab-group|tab-panel)[^"]*"|role="tabpanel"/gi) || []
  ).length;
  const codeGroupsComp = (
    htmlLower.match(/class="[^"]*(?:code-group|codegroup|code-tabs|multi-code)[^"]*"/gi) || []
  ).length;
  const accordionsComp =
    (html.match(/<details[\s>]/gi) || []).length +
    (htmlLower.match(/class="[^"]*(?:accordion-item|collapsible-section|toggle-section|disclosure)[^"]*"/gi) || [])
      .length;
  const cardsComp = (
    htmlLower.match(/class="[^"]*(?:card\s|card"|card-grid|card-container|card-item)[^"]*"/gi) || []
  ).length;
  const stepsComp = (
    htmlLower.match(/class="[^"]*(?:steps|stepper|step-list|step-item|procedure)[^"]*"/gi) || []
  ).length;
  const definitionsComp = (html.match(/<dl[\s>]/gi) || []).length;
  const embedsComp = specialContent.thirdPartyEmbeds.reduce((s, e) => s + e.count, 0);
  const badgesComp = (htmlLower.match(/class="[^"]*(?:badge|label|tag|chip)[^"]*"/gi) || []).length;
  const mathComp = specialContent.mathContent;
  const mermaidComp = specialContent.diagramContent;
  const apiFieldsComp = (
    htmlLower.match(/class="[^"]*(?:param-field|response-field|api-field)[^"]*"/gi) || []
  ).length;
  const columnsComp = (htmlLower.match(/class="[^"]*(?:columns|col-\d|grid-cols)[^"]*"/gi) || []).length;

  const platformComponents = {
    callouts: { total: totalCallouts, variants: calloutVariants },
    tabs: { total: tabsComp },
    codeGroups: { total: codeGroupsComp },
    accordions: { total: accordionsComp },
    cards: { total: cardsComp },
    steps: { total: stepsComp },
    definitions: { total: definitionsComp },
    embeds: { total: embedsComp },
    badges: { total: badgesComp },
    tooltips: { total: tooltips },
    math: { total: mathComp },
    mermaid: { total: mermaidComp },
    apiFields: { total: apiFieldsComp },
    columns: { total: columnsComp },
  };

  // Content components detection (BEM patterns, data-attribute components)
  const contentComponents = [];
  const bemRegex = /class="[^"]*([a-z]+-(?:box|panel|card|section|block|widget|container|wrapper))[^"]*"/gi;
  const bemCounts = {};
  let bemMatch;
  while ((bemMatch = bemRegex.exec(html)) !== null) {
    const cls = bemMatch[1].toLowerCase();
    bemCounts[cls] = (bemCounts[cls] || 0) + 1;
  }
  for (const [cls, count] of Object.entries(bemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)) {
    contentComponents.push({
      type: `semantic:${cls}`,
      selector: `.${cls}`,
      count,
      confidence: count >= 3 ? "high" : "medium",
    });
  }

  const dataCompRegex = /data-(component|widget|type)="([^"]+)"/gi;
  const dataCounts = {};
  let dataMatch;
  while ((dataMatch = dataCompRegex.exec(html)) !== null) {
    const key = `${dataMatch[1]}:${dataMatch[2]}`;
    dataCounts[key] = (dataCounts[key] || 0) + 1;
  }
  for (const [key, count] of Object.entries(dataCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)) {
    const [attr, val] = key.split(":");
    contentComponents.push({
      type: `data:${key}`,
      selector: `[data-${attr}="${val}"]`,
      count,
      confidence: count >= 2 ? "high" : "low",
    });
  }

  // Enhanced API detection
  const apiDocDetails = [];
  const apiToolDetectors = [
    { toolType: "swagger-ui", pattern: /class="[^"]*swagger-ui[^"]*"/i, playground: true, tryIt: true },
    { toolType: "redoc", pattern: /class="[^"]*redoc-wrap[^"]*"|<redoc[\s>]/i, playground: false, tryIt: false },
    { toolType: "scalar", pattern: /scalar-app|<scalar-api-reference[\s>]/i, playground: true, tryIt: true },
    { toolType: "rapidoc", pattern: /<rapidoc[\s>]|<rapi-doc[\s>]/i, playground: true, tryIt: true },
    {
      toolType: "stoplight",
      pattern: /<elements-api[\s>]|class="[^"]*(?:sl-elements|TryItPanel|TryIt)[^"]*"/i,
      playground: true,
      tryIt: true,
    },
    { toolType: "bump", pattern: /<bump-api-reference[\s>]/i, playground: false, tryIt: false },
    {
      toolType: "mintlify-api",
      pattern:
        /id="api-playground|class="[^"]*(?:openapi-content|openapi-method|param-field)[^"]*"|data-testid="[^"]*playground/i,
      playground: true,
      tryIt: true,
    },
    {
      toolType: "readme",
      pattern: /rm-TryItOut|rm-APIMethod|rm-TryIt|rm-RequestForm|name=["']readme-deploy["']/i,
      playground: true,
      tryIt: true,
    },
    { toolType: "postman", pattern: /postman-run-button|data-postman|postman-embed/i, playground: true, tryIt: false },
    { toolType: "insomnia", pattern: /class="[^"]*insomnia-[^"]*"/i, playground: true, tryIt: false },
    { toolType: "graphiql", pattern: /class="[^"]*graphiql[^"]*"/i, playground: true, tryIt: true },
    {
      toolType: "graphql-playground",
      pattern: /class="[^"]*graphql-playground[^"]*"/i,
      playground: true,
      tryIt: true,
    },
  ];

  for (const det of apiToolDetectors) {
    if (det.pattern.test(html)) {
      const authMethods = [];
      if (/bearer|authorization.*bearer/i.test(html)) authMethods.push("Bearer");
      if (/api[_-]?key/i.test(html)) authMethods.push("API Key");
      if (/oauth/i.test(html)) authMethods.push("OAuth2");
      if (/basic.*auth/i.test(html)) authMethods.push("Basic");

      apiDocDetails.push({
        toolType: det.toolType,
        confidence: "high",
        hasPlayground: det.playground,
        hasTryIt: det.tryIt,
        authMethods: authMethods.length > 0 ? authMethods : undefined,
      });
    }
  }

  if (apiDocDetails.length === 0 && isApiReferencePage) {
    const hasGraphql = /graphql|__schema|query\s*\{/i.test(html);
    apiDocDetails.push({
      toolType: hasGraphql ? "generic-graphql" : "generic-rest",
      confidence: "medium",
      hasPlayground: apiPlaygrounds > 0,
      hasTryIt: apiPlaygrounds > 0,
    });
  }

  // Extract API endpoints
  const apiEndpoints = [];
  const endpointRegex = /(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/[a-zA-Z0-9\/{}_:.-]+)/g;
  let epMatch;
  const seenEndpoints = new Set();
  while ((epMatch = endpointRegex.exec(textOnly)) !== null && apiEndpoints.length < 50) {
    const key = `${epMatch[1]} ${epMatch[2]}`;
    if (!seenEndpoints.has(key)) {
      seenEndpoints.add(key);
      apiEndpoints.push({ method: epMatch[1], path: epMatch[2] });
    }
  }

  // API confidence score (weighted 0-100)
  let apiConfidenceScore = 0;
  if (apiDocDetails.length > 0) apiConfidenceScore += 30;
  if (apiPlaygrounds > 0) apiConfidenceScore += 20;
  if (apiEndpoints.length >= 2) apiConfidenceScore += 15;
  if (apiEndpoints.length >= 5) apiConfidenceScore += 10;
  if (apiRefs.length > 0) apiConfidenceScore += 10;
  if (openApiSpecs.length > 0) apiConfidenceScore += 15;
  if (urlIsApiPlayground) apiConfidenceScore += 10;
  if (/class="[^"]*(?:param-field|response-field|request-body|response-body)[^"]*"/i.test(html))
    apiConfidenceScore += 10;
  apiConfidenceScore = Math.min(100, apiConfidenceScore);

  // Detected API specs
  const detectedApiSpecs = [];
  if (/["']openapi["']\s*:\s*["']3/i.test(html)) {
    const verMatch = html.match(/["']openapi["']\s*:\s*["']([0-9.]+)["']/i);
    detectedApiSpecs.push({ url: pageUrl, type: "openapi", version: verMatch ? verMatch[1] : "3.0", valid: true });
  } else if (/["']swagger["']\s*:\s*["']2/i.test(html)) {
    detectedApiSpecs.push({ url: pageUrl, type: "swagger", version: "2.0", valid: true });
  }
  if (/["']asyncapi["']\s*:/i.test(html)) {
    detectedApiSpecs.push({ url: pageUrl, type: "asyncapi" });
  }
  const specLinkRegex = /href=["']([^"']*(?:swagger|openapi|asyncapi)[^"']*)["']/gi;
  let specLinkMatch;
  while ((specLinkMatch = specLinkRegex.exec(html)) !== null) {
    let sType = "openapi";
    if (/swagger/i.test(specLinkMatch[1])) sType = "swagger";
    else if (/asyncapi/i.test(specLinkMatch[1])) sType = "asyncapi";
    else if (/graphql/i.test(specLinkMatch[1])) sType = "graphql";
    detectedApiSpecs.push({ url: specLinkMatch[1], type: sType });
  }
  if (/graphql|graphiql|graphql-playground/i.test(htmlLower)) {
    const hasGqlSpec = detectedApiSpecs.some((s) => s.type === "graphql");
    if (!hasGqlSpec) detectedApiSpecs.push({ url: pageUrl, type: "graphql" });
  }

  // API type detection
  let apiType;
  if (apiConfidenceScore > 0) {
    const hasRest = apiEndpoints.length > 0 || /class="[^"]*(?:swagger-ui|redoc|rest-api)[^"]*"/i.test(html);
    const hasGraphql = /graphql|__schema|query\s*\{|mutation\s*\{/i.test(html);
    const hasGrpc = /grpc|protobuf|\.proto\b/i.test(html);
    if ((hasRest && hasGraphql) || (hasRest && hasGrpc) || (hasGraphql && hasGrpc)) apiType = "mixed";
    else if (hasGraphql) apiType = "graphql";
    else if (hasGrpc) apiType = "grpc";
    else if (hasRest) apiType = "rest";
  }

  // Interactive widgets detection
  const interactiveWidgets = [];
  const widgetDetectors = [
    { type: "toggle", pattern: /class="[^"]*(?:toggle|switch)[^"]*"|role="switch"/gi, hasInput: true },
    { type: "slider", pattern: /type="range"|class="[^"]*(?:slider|range)[^"]*"/gi, hasInput: true },
    { type: "calculator", pattern: /class="[^"]*calculator[^"]*"/gi, hasInput: true },
    {
      type: "playground",
      pattern: /class="[^"]*(?:code-playground|live-editor|interactive-code)[^"]*"/gi,
      hasInput: true,
    },
    { type: "poll", pattern: /class="[^"]*(?:poll|survey|vote)[^"]*"/gi, hasInput: true },
    { type: "quiz", pattern: /class="[^"]*(?:quiz|question)[^"]*"/gi, hasInput: true },
  ];
  for (const wd of widgetDetectors) {
    const matches = html.match(wd.pattern);
    if (matches && matches.length > 0) {
      interactiveWidgets.push({
        type: wd.type,
        selector: "",
        count: matches.length,
        hasUserInput: wd.hasInput,
      });
    }
  }

  return {
    url: pageUrl,
    title,
    contentSelectorFound,
    videos,
    externalLinks,
    apiRefs,
    customComponents,
    wordCount,
    headings,
    codeBlocks,
    tables,
    images,
    lists,
    tabs,
    accordions,
    downloadLinks,
    forms,
    iframes,
    tooltips,
    openApiSpecs: [...new Set(openApiSpecs)],
    apiPlaygrounds,
    graphqlExplorers,
    breadcrumbDepth,
    sidebarItems,
    hasPagination,
    hasLanguageSwitcher,
    platform,
    contentFormat,
    isHomepage,
    specialContent,
    isApiReferencePage,
    playgroundTypes,
    platformComponents,
    contentComponents: contentComponents.length > 0 ? contentComponents : undefined,
    apiDocDetails: apiDocDetails.length > 0 ? apiDocDetails : undefined,
    detectedApiSpecs: detectedApiSpecs.length > 0 ? detectedApiSpecs : undefined,
    apiEndpoints: apiEndpoints.length > 0 ? apiEndpoints : undefined,
    apiConfidenceScore: apiConfidenceScore > 0 ? apiConfidenceScore : undefined,
    apiType,
    interactiveWidgets: interactiveWidgets.length > 0 ? interactiveWidgets : undefined,
  };
}
