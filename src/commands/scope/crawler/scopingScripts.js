/**
 * Scoping Mode - Webview Injection Scripts
 * Scripts for category discovery and page analysis during project scoping.
 *
 * Migration-aware: detects source platform components and maps them to
 * Mintlify equivalents with conversion complexity ratings.
 */

/**
 * Expands collapsed navigation elements before category discovery.
 * Auto-detects the sidebar and runs expansion strategies (aria-expanded, details, etc.)
 * Returns via console.log('SCOPING_NAV_EXPANDED:' + JSON.stringify({expanded: N}))
 * Max runtime: 3s
 */
export function generateNavExpansionScript() {
  return `
    (function() {
      // Auto-detect sidebar: try common nav selectors
      var navSelectors = [
        'nav[class*="sidebar"]', 'nav[class*="menu"]', 'nav[class*="nav"]',
        'aside[class*="sidebar"]', 'aside nav', '.sidebar nav', '.sidebar',
        '[role="navigation"]', '#sidebar', '#nav', '.navigation',
        '.menu-content', '.toc-wrapper',
      ];
      var sidebar = null;
      for (var i = 0; i < navSelectors.length; i++) {
        var el = document.querySelector(navSelectors[i]);
        if (el && el.querySelectorAll('a[href]').length >= 3) {
          sidebar = el;
          break;
        }
      }
      if (!sidebar) {
        console.log('SCOPING_NAV_EXPANDED:' + JSON.stringify({ expanded: 0, reason: 'no-sidebar' }));
        return;
      }

      var processed = new WeakSet();
      var expanded = 0;
      var wait = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };

      async function expand() {
        var maxIter = 5;
        for (var iter = 0; iter < maxIter; iter++) {
          var expandedThisRound = 0;

          // Strategy 1: aria-expanded="false"
          var btns = sidebar.querySelectorAll('[aria-expanded="false"]');
          for (var b = 0; b < btns.length; b++) {
            if (processed.has(btns[b])) continue;
            processed.add(btns[b]);
            try { btns[b].click(); expanded++; expandedThisRound++; await wait(100); } catch(e) {}
          }

          // Strategy 2: <details> without open
          var details = sidebar.querySelectorAll('details:not([open])');
          for (var d = 0; d < details.length; d++) {
            if (processed.has(details[d])) continue;
            processed.add(details[d]);
            try { details[d].setAttribute('open', ''); expanded++; expandedThisRound++; } catch(e) {}
          }

          // Strategy 3: Common collapse selectors
          var collapseSels = ['.collapsed', '.is-collapsed', '.closed', '[data-collapsed="true"]', '[data-state="collapsed"]', '[data-expanded="false"]'];
          for (var cs = 0; cs < collapseSels.length; cs++) {
            try {
              var items = sidebar.querySelectorAll(collapseSels[cs]);
              for (var ci = 0; ci < items.length; ci++) {
                if (processed.has(items[ci])) continue;
                processed.add(items[ci]);
                var toggle = items[ci].querySelector('button, [role="button"], summary, .toggle');
                try { (toggle || items[ci]).click(); expanded++; expandedThisRound++; await wait(100); } catch(e) {}
              }
            } catch(e) {}
          }

          await wait(200);
          if (expandedThisRound === 0) break;
        }
        console.log('SCOPING_NAV_EXPANDED:' + JSON.stringify({ expanded: expanded }));
      }

      expand();
    })();
  `;
}

/**
 * Discovers navigation structure and all internal links from a base URL page.
 * Returns categories (nav groupings) and all discoverable links.
 * Data returned via console.log('SCOPING_CATEGORIES:' + JSON.stringify(...))
 */
export function generateCategoryDiscoveryScript(
  baseUrl,
  scopePrefix,
) {
  const scopePrefixStr = scopePrefix ? JSON.stringify(scopePrefix) : "null";
  return `
    (function() {
      // Wait for SPA content to render - poll until internal links appear (max 8s)
      function waitForLinks() {
        return new Promise(function(resolve) {
          var baseOrigin = new URL(${JSON.stringify(baseUrl)}).origin;
          var attempts = 0;
          var maxAttempts = 16; // 16 x 500ms = 8s
          function check() {
            var links = document.querySelectorAll('a[href]');
            var internalCount = 0;
            links.forEach(function(link) {
              var href = link.getAttribute('href');
              if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
              try {
                var full;
                if (href.startsWith('http')) full = href;
                else if (href.startsWith('/')) full = baseOrigin + href;
                else full = new URL(href, window.location.href).href;
                if (new URL(full).origin === baseOrigin) internalCount++;
              } catch(e) {}
            });
            if (internalCount > 2 || attempts >= maxAttempts) {
              resolve();
            } else {
              attempts++;
              setTimeout(check, 500);
            }
          }
          check();
        });
      }

      waitForLinks().then(function() {
      try {
        const baseOrigin = new URL(${JSON.stringify(baseUrl)}).origin;
        const scopePrefix = ${scopePrefixStr};

        // Find navigation/sidebar elements
        const navSelectors = [
          'nav[aria-label]',
          'aside nav',
          'aside',
          '[role="navigation"]',
          '.sidebar',
          '.nav-sidebar',
          '.docs-sidebar',
          '.toc',
          '#sidebar',
          '#nav',
          // Platform-specific
          '.theme-doc-sidebar-container',  // Docusaurus
          '.md-sidebar--primary',          // MkDocs Material
          '.md-sidebar',                   // MkDocs
          '.gitbook-root nav',             // GitBook
          '.VPSidebar',                    // VitePress
          '.sphinxsidebarwrapper',         // Sphinx
          '.nextra-sidebar-container',     // Nextra
        ];

        let navEl = null;
        for (const sel of navSelectors) {
          const el = document.querySelector(sel);
          if (el && el.querySelectorAll('a[href]').length > 3) {
            navEl = el;
            break;
          }
        }

        // If no nav found, fall back to whole page links
        const container = navEl || document.body;

        // Extract category groupings
        const categories = [];
        let currentCategory = { name: 'Uncategorized', urls: [] };

        // Try to find category headers in the nav
        const categorySelectors = [
          '.menu__list-item--collapsed > .menu__link, .menu__list-item > .menu__link--sublist', // Docusaurus
          '.md-nav__title',                         // MkDocs
          'li.group > span, li.group > div',        // Various
          '[class*="section"] > [class*="title"]',  // Generic
          '[class*="category"] > [class*="label"]', // Generic
          'h3', 'h4', 'h5',                         // Heading-based nav
        ];

        // Walk through nav children looking for groups
        const allNavLinks = container.querySelectorAll('a[href]');
        const groupHeaders = [];

        for (const sel of categorySelectors) {
          const headers = container.querySelectorAll(sel);
          if (headers.length > 0) {
            headers.forEach(h => groupHeaders.push(h));
            break;
          }
        }

        if (groupHeaders.length > 0) {
          // Group links by their nearest preceding header
          let catIndex = 0;
          const cats = groupHeaders.map((h, i) => ({
            name: (h.textContent || '').trim().replace(/\\s+/g, ' ').substring(0, 80) || 'Section ' + (i + 1),
            element: h,
            urls: [],
          }));

          allNavLinks.forEach(link => {
            let href = link.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) return;

            let fullUrl;
            try {
              if (href.startsWith('http')) fullUrl = href;
              else if (href.startsWith('/')) fullUrl = baseOrigin + href;
              else fullUrl = new URL(href, ${JSON.stringify(baseUrl)}).href;

              const url = new URL(fullUrl);
              if (url.origin !== baseOrigin) return;
              fullUrl = url.origin + url.pathname;
              // Remove trailing slash for consistency
              if (fullUrl.endsWith('/') && fullUrl.length > baseOrigin.length + 1) {
                fullUrl = fullUrl.slice(0, -1);
              }
            } catch { return; }

            // Find which category this link belongs to by DOM proximity
            let bestCat = cats[0];
            for (let i = cats.length - 1; i >= 0; i--) {
              const catEl = cats[i].element;
              const parent = catEl.closest('li, div, section, ul');
              if (parent && parent.contains(link)) {
                bestCat = cats[i];
                break;
              }
              // Position-based fallback
              if (catEl.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING) {
                if (i + 1 < cats.length) {
                  const nextCat = cats[i + 1].element;
                  if (nextCat.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_PRECEDING) {
                    bestCat = cats[i];
                    break;
                  }
                } else {
                  bestCat = cats[i];
                  break;
                }
              }
            }

            if (!bestCat.urls.includes(fullUrl)) {
              bestCat.urls.push(fullUrl);
            }
          });

          cats.forEach(c => {
            if (c.urls.length > 0) {
              categories.push({ name: c.name, urls: c.urls });
            }
          });
        }

        // Also collect all internal links (even those not in nav)
        const allLinks = new Set();
        document.querySelectorAll('a[href]').forEach(link => {
          let href = link.getAttribute('href');
          if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) return;

          try {
            let fullUrl;
            if (href.startsWith('http')) fullUrl = href;
            else if (href.startsWith('/')) fullUrl = baseOrigin + href;
            else fullUrl = new URL(href, ${JSON.stringify(baseUrl)}).href;

            const url = new URL(fullUrl);
            if (url.origin !== baseOrigin) return;
            let pathname = url.pathname.replace(/\/+/g, '/');
            let normalized = url.origin + pathname;
            if (normalized.endsWith('/') && normalized.length > baseOrigin.length + 1) {
              normalized = normalized.slice(0, -1);
            }
            allLinks.add(normalized);
          } catch {}
        });

        // Filter by scope prefix if provided
        if (scopePrefix) {
          for (const url of Array.from(allLinks)) {
            if (!url.startsWith(scopePrefix)) {
              allLinks.delete(url);
            }
          }
          // Filter category URLs too
          categories.forEach(cat => {
            cat.urls = cat.urls.filter(u => u.startsWith(scopePrefix));
          });
          // Remove empty categories
          for (let i = categories.length - 1; i >= 0; i--) {
            if (categories[i].urls.length === 0) categories.splice(i, 1);
          }
        }

        // If no categories found, put everything in Uncategorized
        if (categories.length === 0 && allLinks.size > 0) {
          categories.push({ name: 'Uncategorized', urls: Array.from(allLinks) });
        }

        // Auto-detect main content container
        let detectedContentSelector = null;
        try {
          const bodyTextLen = (document.body.innerText || '').length;
          if (bodyTextLen > 0) {
            // Platform-specific selectors (most precise first)
            const platformSelectors = [
              '.theme-doc-markdown',           // Docusaurus
              'article.docusaurus-mt-lg',      // Docusaurus v2
              '.md-content article',           // MkDocs Material
              '.md-content',                   // MkDocs
              'main article',                  // GitBook, generic
              '.VPDoc .vp-doc',                // VitePress
              '.vp-doc',                       // VitePress alt
              '[role="main"] article',         // Sphinx/ReadTheDocs
              '.document .documentwrapper',    // Sphinx classic
              '.nextra-content',               // Nextra
              '.sl-markdown-content',          // Starlight
              '#content-area',                 // Mintlify (present on both doc and API pages)
              '.prose',                        // Fumadocs / Tailwind prose
            ];
            // Generic selectors (broader)
            const genericSelectors = [
              'article',
              'main',
              '[role="main"]',
              '.content',
              '#content',
            ];
            const allCandidates = [...platformSelectors, ...genericSelectors];

            let bestSelector = null;
            let bestScore = 0;

            for (const sel of allCandidates) {
              try {
                const el = document.querySelector(sel);
                if (!el) continue;
                const elTextLen = (el.innerText || '').length;
                const ratio = elTextLen / bodyTextLen;
                // Valid if contains 10-95% of body text
                if (ratio >= 0.10 && ratio <= 0.95) {
                  const score = ratio;
                  if (score > bestScore) {
                    bestScore = score;
                    bestSelector = sel;
                  }
                }
              } catch {}
            }
            detectedContentSelector = bestSelector;
          }
        } catch {}

        console.log('SCOPING_CATEGORIES:' + JSON.stringify({
          categories: categories,
          allUrls: Array.from(allLinks),
          detectedContentSelector: detectedContentSelector,
        }));
      } catch (err) {
        console.log('SCOPING_CATEGORIES:' + JSON.stringify({
          categories: [],
          allUrls: [],
          error: err.message,
        }));
      }
      });
    })();
  `;
}

// ============================================================================
// Migration-Aware Component Detection
// ============================================================================
// Maps source platform components → Mintlify equivalents with complexity ratings.
//
// Mintlify native components:
//   Callouts:    <Note>, <Warning>, <Info>, <Tip>, <Check>, <Danger>
//   Cards:       <Card>, <CardGroup>
//   Tabs:        <Tab>, <Tabs>
//   Code Groups: <CodeGroup>
//   Accordions:  <Accordion>, <AccordionGroup>
//   Steps:       <Steps>, <Step>
//   Tooltips:    <Tooltip>
//   Badge:       <Badge>
//   Columns:     <Columns>, <Column>
//   Expandables: <Expandable>
//   Fields:      <ParamField>, <ResponseField>
//   Frames:      <Frame>
//   Icons:       <Icon>
//   Mermaid:     native support
//   Tiles:       <Tile>, <TileGroup>
//   KaTeX math:  native support
//   Tables:      markdown tables
//   Code:        fenced code blocks with highlighting
// ============================================================================

/**
 * Generates the inline JS block for migration-aware component detection.
 * Runs inside the webview after page load. Uses `scopeEl` and `detectedPlatform`
 * from the surrounding generatePageAnalysisScript context.
 *
 * Outputs:
 *   __migrationComponents: array of detected components with Mintlify mapping
 *   __platformComponents:  legacy summary counts (backward compat)
 *   __componentSamples:    HTML snippets for migrator reference
 */
function generateMigrationDetectionBlock() {
  return `
    // ---- Migration-Aware Component Detection ----
    var __migrationComponents = [];
    var __platformComponents = {
      callouts: { total: 0, variants: { note: 0, warning: 0, tip: 0, info: 0, danger: 0, check: 0, caution: 0, important: 0 } },
      tabs: { total: 0 },
      codeGroups: { total: 0 },
      accordions: { total: 0 },
      cards: { total: 0 },
      steps: { total: 0 },
      definitions: { total: 0 },
      embeds: { total: 0 },
      columns: { total: 0 },
      badges: { total: 0 },
      tooltips: { total: 0 },
      math: { total: 0 },
      mermaid: { total: 0 },
      apiFields: { total: 0 },
    };
    var __componentSamples = {};

    function __addMigration(type, sourceComponent, mintlifyEquivalent, complexity, count, sample, notes) {
      if (count <= 0) return;
      __migrationComponents.push({
        type: type,
        sourceComponent: sourceComponent,
        mintlifyEquivalent: mintlifyEquivalent,
        conversionComplexity: complexity, // 'direct' | 'simple' | 'moderate' | 'complex' | 'unsupported'
        count: count,
        sample: (sample || '').substring(0, 500),
        notes: notes || '',
      });
    }

    function __getSample(selector) {
      try {
        var el = scopeEl.querySelector(selector);
        return el ? el.outerHTML.substring(0, 500) : '';
      } catch(e) { return ''; }
    }

    function __count(selector) {
      try { return scopeEl.querySelectorAll(selector).length; } catch(e) { return 0; }
    }

    try {
      var p = detectedPlatform;

      // ================================================================
      // CALLOUTS / ADMONITIONS
      // Every major doc platform has these. All map to Mintlify <Note>, <Warning>, etc.
      // ================================================================
      (function detectCallouts() {
        var calloutTotal = 0;
        var variants = __platformComponents.callouts.variants;

        // --- Docusaurus admonitions ---
        if (p === 'docusaurus') {
          var admonitions = scopeEl.querySelectorAll('[class*="admonition"]');
          admonitions.forEach(function(el) {
            var cls = el.className.toLowerCase();
            if (/note|info/.test(cls)) variants.note++;
            else if (/warning|caution/.test(cls)) variants.warning++;
            else if (/tip/.test(cls)) variants.tip++;
            else if (/danger|error/.test(cls)) variants.danger++;
            else variants.info++;
            calloutTotal++;
          });
          if (calloutTotal > 0) {
            __addMigration('callout', 'Docusaurus admonition', '<Note>/<Warning>/<Tip>/<Info>/<Danger>', 'simple', calloutTotal, __getSample('[class*="admonition"]'), 'Docusaurus :::note → <Note>, :::warning → <Warning>, :::tip → <Tip>, :::danger → <Danger>, :::info → <Info>');
          }

        // --- MkDocs Material admonitions ---
        } else if (p === 'mkdocs') {
          var mkAdmonitions = scopeEl.querySelectorAll('.admonition, .md-typeset .admonition');
          mkAdmonitions.forEach(function(el) {
            var cls = el.className.toLowerCase();
            if (/note/.test(cls)) variants.note++;
            else if (/warning|attention/.test(cls)) variants.warning++;
            else if (/tip|hint/.test(cls)) variants.tip++;
            else if (/info|todo|question|help|faq/.test(cls)) variants.info++;
            else if (/danger|error|failure|bug|fail/.test(cls)) variants.danger++;
            else if (/success|check|done/.test(cls)) variants.check++;
            else if (/caution|important/.test(cls)) { variants.caution++; variants.warning++; }
            else variants.info++;
            calloutTotal++;
          });
          if (calloutTotal > 0) {
            __addMigration('callout', 'MkDocs admonition', '<Note>/<Warning>/<Tip>/<Info>/<Check>', 'simple', calloutTotal, __getSample('.admonition'), 'MkDocs !!! note → <Note>, !!! warning → <Warning>, !!! tip → <Tip>, !!! danger → <Danger>, !!! success → <Check>');
          }
          // MkDocs collapsible admonitions (???note)
          var collapsibleAdm = __count('details.admonition, .md-typeset details');
          if (collapsibleAdm > 0) {
            __addMigration('callout-collapsible', 'MkDocs collapsible admonition', '<Accordion> wrapping callout content', 'moderate', collapsibleAdm, __getSample('details.admonition'), 'MkDocs ???note → <Accordion> with callout styling. No direct 1:1, combine <Accordion> + callout text.');
          }

        // --- VitePress custom blocks ---
        } else if (p === 'vitepress') {
          var vpBlocks = scopeEl.querySelectorAll('.custom-block');
          vpBlocks.forEach(function(el) {
            var cls = el.className.toLowerCase();
            if (/\btip\b/.test(cls)) variants.tip++;
            else if (/\bwarning\b/.test(cls)) variants.warning++;
            else if (/\bdanger\b/.test(cls)) variants.danger++;
            else if (/\binfo\b/.test(cls)) variants.info++;
            else if (/\bdetails\b/.test(cls)) { /* handled as accordion */ }
            else variants.note++;
            calloutTotal++;
          });
          if (calloutTotal > 0) {
            __addMigration('callout', 'VitePress custom block', '<Note>/<Warning>/<Tip>/<Info>/<Danger>', 'simple', calloutTotal, __getSample('.custom-block'), ':::tip → <Tip>, :::warning → <Warning>, :::danger → <Danger>, :::info → <Info>');
          }

        // --- Sphinx/ReadTheDocs admonitions ---
        } else if (p === 'sphinx' || p === 'readthedocs') {
          var sphinxAdm = scopeEl.querySelectorAll('.admonition, .topic, .note, .warning, .tip, .important, .danger, .caution, .hint, .seealso, .versionadded, .versionchanged, .deprecated');
          sphinxAdm.forEach(function(el) {
            var cls = el.className.toLowerCase();
            if (/\bnote\b|seealso/.test(cls)) variants.note++;
            else if (/\bwarning\b|\bcaution\b/.test(cls)) variants.warning++;
            else if (/\btip\b|\bhint\b/.test(cls)) variants.tip++;
            else if (/\bimportant\b/.test(cls)) { variants.important++; variants.warning++; }
            else if (/\bdanger\b|\berror\b/.test(cls)) variants.danger++;
            else if (/version|deprecated/.test(cls)) variants.info++;
            else variants.note++;
            calloutTotal++;
          });
          if (calloutTotal > 0) {
            __addMigration('callout', 'Sphinx/RST admonition', '<Note>/<Warning>/<Tip>/<Info>/<Danger>', 'simple', calloutTotal, __getSample('.admonition, .note, .warning'), '.. note:: → <Note>, .. warning:: → <Warning>, .. tip:: → <Tip>, .. danger:: → <Danger>. Version directives → <Info>.');
          }

        // --- Nextra callouts ---
        } else if (p === 'nextra') {
          var nextraCallouts = scopeEl.querySelectorAll('.nextra-callout, [data-callout-type]');
          nextraCallouts.forEach(function(el) {
            var type = (el.getAttribute('data-callout-type') || el.className || '').toLowerCase();
            if (/warning|error/.test(type)) variants.warning++;
            else if (/info|default/.test(type)) variants.info++;
            else variants.note++;
            calloutTotal++;
          });
          if (calloutTotal > 0) {
            __addMigration('callout', 'Nextra Callout', '<Note>/<Warning>/<Info>', 'simple', calloutTotal, __getSample('.nextra-callout, [data-callout-type]'), 'Nextra <Callout type="warning"> → <Warning>, <Callout type="info"> → <Info>, default → <Note>');
          }

        // --- Starlight asides ---
        } else if (p === 'starlight') {
          var starlightAsides = scopeEl.querySelectorAll('.starlight-aside, aside[class*="aside"]');
          starlightAsides.forEach(function(el) {
            var cls = el.className.toLowerCase();
            if (/note/.test(cls)) variants.note++;
            else if (/caution/.test(cls)) variants.warning++;
            else if (/tip/.test(cls)) variants.tip++;
            else if (/danger/.test(cls)) variants.danger++;
            else variants.info++;
            calloutTotal++;
          });
          if (calloutTotal > 0) {
            __addMigration('callout', 'Starlight aside', '<Note>/<Warning>/<Tip>/<Danger>', 'simple', calloutTotal, __getSample('.starlight-aside, aside[class*="aside"]'), ':::note → <Note>, :::caution → <Warning>, :::tip → <Tip>, :::danger → <Danger>');
          }

        // --- GitBook hints ---
        } else if (p === 'gitbook') {
          var gbHints = scopeEl.querySelectorAll('[class*="hint"], [data-testid*="callout"]');
          gbHints.forEach(function(el) {
            var cls = (el.className + ' ' + (el.getAttribute('data-testid') || '')).toLowerCase();
            if (/warning/.test(cls)) variants.warning++;
            else if (/danger|error/.test(cls)) variants.danger++;
            else if (/success|check/.test(cls)) variants.check++;
            else if (/info/.test(cls)) variants.info++;
            else variants.note++;
            calloutTotal++;
          });
          if (calloutTotal > 0) {
            __addMigration('callout', 'GitBook hint', '<Note>/<Warning>/<Info>/<Check>/<Danger>', 'simple', calloutTotal, __getSample('[class*="hint"], [data-testid*="callout"]'), 'GitBook hint blocks map directly to Mintlify callout variants.');
          }

        // --- ReadMe callouts ---
        } else if (p === 'readme') {
          var rmCallouts = scopeEl.querySelectorAll('.callout, .rdmd-callout, [class*="callout"]');
          rmCallouts.forEach(function(el) {
            var cls = el.className.toLowerCase();
            if (/warn|alert/.test(cls)) variants.warning++;
            else if (/danger|error/.test(cls)) variants.danger++;
            else if (/success|ok/.test(cls)) variants.check++;
            else if (/info/.test(cls)) variants.info++;
            else variants.note++;
            calloutTotal++;
          });
          if (calloutTotal > 0) {
            __addMigration('callout', 'ReadMe callout', '<Note>/<Warning>/<Info>/<Check>/<Danger>', 'simple', calloutTotal, __getSample('.callout, .rdmd-callout'), 'ReadMe callout blocks (📘/🚧/❗/👍) → Mintlify callout variants.');
          }

        // --- Confluence info/warning panels ---
        } else if (p === 'confluence') {
          var confPanels = scopeEl.querySelectorAll('.confluence-information-macro, .aui-message, [class*="panel-"]');
          confPanels.forEach(function(el) {
            var cls = el.className.toLowerCase();
            if (/warning/.test(cls)) variants.warning++;
            else if (/error|problem/.test(cls)) variants.danger++;
            else if (/success|confirmation/.test(cls)) variants.check++;
            else if (/note|tip/.test(cls)) variants.tip++;
            else variants.info++;
            calloutTotal++;
          });
          if (calloutTotal > 0) {
            __addMigration('callout', 'Confluence info macro', '<Note>/<Warning>/<Info>/<Check>/<Danger>', 'moderate', calloutTotal, __getSample('.confluence-information-macro, .aui-message'), 'Confluence macros have specific HTML structure that needs careful extraction.');
          }

        // --- Hugo Docsy alerts ---
        } else if (p === 'hugo-docsy') {
          var docsyAlerts = scopeEl.querySelectorAll('.alert, .td-alert, [class*="alert-"]');
          docsyAlerts.forEach(function(el) {
            var cls = el.className.toLowerCase();
            if (/warning/.test(cls)) variants.warning++;
            else if (/danger|error/.test(cls)) variants.danger++;
            else if (/success/.test(cls)) variants.check++;
            else if (/info|primary/.test(cls)) variants.info++;
            else variants.note++;
            calloutTotal++;
          });
          if (calloutTotal > 0) {
            __addMigration('callout', 'Hugo/Docsy alert', '<Note>/<Warning>/<Info>/<Check>/<Danger>', 'simple', calloutTotal, __getSample('.alert, .td-alert'), 'Bootstrap-style alerts → Mintlify callouts.');
          }

        // --- Fumadocs callouts ---
        } else if (p === 'fumadocs') {
          var fumaCallouts = scopeEl.querySelectorAll('[class*="callout"], [data-callout]');
          fumaCallouts.forEach(function(el) {
            var cls = (el.className + ' ' + (el.getAttribute('data-callout') || '')).toLowerCase();
            if (/warning/.test(cls)) variants.warning++;
            else if (/error|danger/.test(cls)) variants.danger++;
            else if (/tip/.test(cls)) variants.tip++;
            else variants.info++;
            calloutTotal++;
          });
          if (calloutTotal > 0) {
            __addMigration('callout', 'Fumadocs callout', '<Note>/<Warning>/<Tip>/<Danger>', 'simple', calloutTotal, __getSample('[class*="callout"], [data-callout]'), 'Fumadocs callouts → Mintlify callout variants.');
          }
        }

        // --- Generic fallback: blockquotes with emoji/prefix patterns ---
        if (calloutTotal === 0) {
          var blockquotes = scopeEl.querySelectorAll('blockquote');
          var bqCallouts = 0;
          blockquotes.forEach(function(bq) {
            var text = (bq.textContent || '').trim().substring(0, 50);
            if (/^(⚠️|⚡|💡|📝|ℹ️|❗|✅|🔥|📘|🚧|👍|Note:|Warning:|Tip:|Info:|Important:|Caution:)/i.test(text)) {
              bqCallouts++;
              if (/warning|⚠️|🚧|caution/i.test(text)) variants.warning++;
              else if (/tip|💡|⚡/i.test(text)) variants.tip++;
              else if (/danger|❗|🔥/i.test(text)) variants.danger++;
              else if (/check|✅|👍/i.test(text)) variants.check++;
              else variants.note++;
            }
          });
          if (bqCallouts > 0) {
            calloutTotal += bqCallouts;
            __addMigration('callout', 'Blockquote-style callout', '<Note>/<Warning>/<Tip>/<Info>', 'moderate', bqCallouts, __getSample('blockquote'), 'Blockquotes with emoji/prefix patterns (> ⚠️ Warning: ...) need conversion to Mintlify callout components.');
          }

          // GitHub-style alerts (> [!NOTE], > [!WARNING], etc.)
          blockquotes.forEach(function(bq) {
            var firstChild = bq.querySelector('p');
            var text = firstChild ? (firstChild.textContent || '').trim() : '';
            if (/^\\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\\]/i.test(text)) {
              calloutTotal++;
              var match = text.match(/^\\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\\]/i);
              if (match) {
                var ghType = match[1].toLowerCase();
                if (ghType === 'note') variants.note++;
                else if (ghType === 'tip') variants.tip++;
                else if (ghType === 'important') { variants.important++; variants.warning++; }
                else if (ghType === 'warning') variants.warning++;
                else if (ghType === 'caution') variants.warning++;
              }
            }
          });
        }

        // Generic CSS class-based callout detection (for unknown platforms)
        if (calloutTotal === 0) {
          var genericCallouts = scopeEl.querySelectorAll('.callout, .alert:not(.alert-link), .notice, .message, .notification, [role="alert"], [class*="admonition"]');
          genericCallouts.forEach(function(el) {
            var cls = el.className.toLowerCase();
            if (/warning|warn/.test(cls)) variants.warning++;
            else if (/danger|error|critical/.test(cls)) variants.danger++;
            else if (/success|check/.test(cls)) variants.check++;
            else if (/tip|hint/.test(cls)) variants.tip++;
            else if (/info/.test(cls)) variants.info++;
            else variants.note++;
            calloutTotal++;
          });
          if (calloutTotal > 0) {
            __addMigration('callout', 'Generic callout/alert', '<Note>/<Warning>/<Info>/<Tip>/<Check>/<Danger>', 'moderate', calloutTotal, __getSample('.callout, .alert, .notice, .message'), 'Generic callout-like elements detected. Review HTML structure for accurate mapping.');
          }
        }

        __platformComponents.callouts.total = calloutTotal;
      })();

      // ================================================================
      // TABS
      // Most platforms have tab components → Mintlify <Tabs>/<Tab>
      // ================================================================
      (function detectTabs() {
        var tabTotal = 0;

        var tabSelectors = {
          'docusaurus':   { sel: '.tabs-container, [role="tablist"]', label: 'Docusaurus Tabs' },
          'mkdocs':       { sel: '.tabbed-set, .tabbed-labels', label: 'MkDocs content tabs' },
          'vitepress':    { sel: '.vp-code-group, [class*="tabs"]', label: 'VitePress tabs' },
          'nextra':       { sel: '.nextra-tabs, [data-orientation="horizontal"]', label: 'Nextra Tabs' },
          'starlight':    { sel: 'starlight-tabs, .tablist-wrapper', label: 'Starlight Tabs' },
          'gitbook':      { sel: '[class*="tabs"], [data-testid*="tabs"]', label: 'GitBook tabs' },
          'readme':       { sel: '.CodeTabs, [class*="rdmd-code-tabs"]', label: 'ReadMe CodeTabs' },
          'sphinx':       { sel: '.sphinx-tabs, .sphinx-tabs-tab', label: 'Sphinx tabs' },
          'readthedocs':  { sel: '.sphinx-tabs, .sphinx-tabs-tab', label: 'Sphinx tabs' },
          'confluence':   { sel: '.aui-tabs, [class*="tab-pane"]', label: 'Confluence tabs' },
          'hugo-docsy':   { sel: '[data-toggle="tab"], .nav-tabs', label: 'Hugo/Docsy tabs' },
          'fumadocs':     { sel: '[role="tablist"]', label: 'Fumadocs tabs' },
        };

        var matchedSel = tabSelectors[p];
        if (matchedSel) {
          tabTotal = __count(matchedSel.sel);
          if (tabTotal > 0) {
            __addMigration('tabs', matchedSel.label, '<Tabs>/<Tab>', 'simple', tabTotal, __getSample(matchedSel.sel), 'Tab containers map to Mintlify <Tabs>. Each tab panel → <Tab title="...">content</Tab>.');
          }
        }

        // Generic fallback
        if (tabTotal === 0) {
          tabTotal = __count('[role="tablist"], .tabs, .tab-container, .nav-tabs');
          if (tabTotal > 0) {
            __addMigration('tabs', 'Generic tabs', '<Tabs>/<Tab>', 'moderate', tabTotal, __getSample('[role="tablist"], .tabs'), 'Tab UI detected. Extract tab labels and content panels for Mintlify <Tabs>/<Tab>.');
          }
        }

        __platformComponents.tabs.total = tabTotal;
      })();

      // ================================================================
      // CODE GROUPS (multiple code blocks in tabs)
      // → Mintlify <CodeGroup>
      // ================================================================
      (function detectCodeGroups() {
        var cgTotal = 0;

        var cgSelectors = {
          'docusaurus':  { sel: '[class*="codeBlockContainer"] + [class*="codeBlockContainer"], .tabs-container pre', label: 'Docusaurus multi-code' },
          'mkdocs':      { sel: '.tabbed-set pre, .superfences-tabs', label: 'MkDocs SuperFences' },
          'vitepress':   { sel: '.vp-code-group', label: 'VitePress code group' },
          'nextra':      { sel: '.nextra-code-block [role="tablist"]', label: 'Nextra code tabs' },
          'starlight':   { sel: '.code-group, [class*="code-tabs"]', label: 'Starlight code tabs' },
          'readme':      { sel: '.CodeTabs', label: 'ReadMe CodeTabs' },
          'gitbook':     { sel: '[class*="code-tabs"], [data-testid*="code-block"] + [data-testid*="code-block"]', label: 'GitBook code blocks' },
        };

        var matchedCg = cgSelectors[p];
        if (matchedCg) {
          cgTotal = __count(matchedCg.sel);
          if (cgTotal > 0) {
            __addMigration('codeGroup', matchedCg.label, '<CodeGroup>', 'simple', cgTotal, __getSample(matchedCg.sel), 'Multiple code blocks in tabs → Mintlify <CodeGroup>. Wrap each code block with language label.');
          }
        }

        // Generic: adjacent pre blocks might be a code group
        if (cgTotal === 0) {
          try {
            var pres = scopeEl.querySelectorAll('pre');
            var adjacentGroups = 0;
            for (var pi = 0; pi < pres.length - 1; pi++) {
              var nextSib = pres[pi].nextElementSibling;
              if (nextSib && nextSib.tagName === 'PRE') adjacentGroups++;
            }
            if (adjacentGroups > 0) {
              cgTotal = adjacentGroups;
              __addMigration('codeGroup', 'Adjacent code blocks', '<CodeGroup>', 'moderate', adjacentGroups, '', 'Adjacent <pre> blocks may represent multi-language examples. Consider grouping into <CodeGroup>.');
            }
          } catch(e) {}
        }

        __platformComponents.codeGroups.total = cgTotal;
      })();

      // ================================================================
      // ACCORDIONS / EXPANDABLE SECTIONS
      // → Mintlify <Accordion> / <AccordionGroup>
      // ================================================================
      (function detectAccordions() {
        var accTotal = 0;

        // HTML <details> elements (universal across platforms)
        var detailsCount = __count('details');
        // VitePress :::details blocks
        var vpDetails = (p === 'vitepress') ? __count('.custom-block.details') : 0;

        var platformAcc = {
          'docusaurus':  { sel: 'details, [class*="collapsible"]', label: 'Docusaurus details' },
          'mkdocs':      { sel: 'details:not(.admonition), [class*="collapsible"]', label: 'MkDocs details' },
          'vitepress':   { sel: '.custom-block.details, details', label: 'VitePress details block' },
          'gitbook':     { sel: 'details, [class*="expandable"]', label: 'GitBook expandable' },
          'nextra':      { sel: 'details, [class*="collapse"]', label: 'Nextra details' },
          'confluence':  { sel: '.expand-container, [class*="expand-control"]', label: 'Confluence expand macro' },
          'zendesk':     { sel: '.accordion, details, [class*="collapsible"]', label: 'Zendesk accordion' },
        };

        var matchedAcc = platformAcc[p];
        if (matchedAcc) {
          accTotal = __count(matchedAcc.sel);
          if (accTotal > 0) {
            __addMigration('accordion', matchedAcc.label, '<Accordion>/<AccordionGroup>', 'simple', accTotal, __getSample(matchedAcc.sel), '<details><summary>Title</summary>Content</details> → <Accordion title="Title">Content</Accordion>');
          }
        } else if (detailsCount > 0) {
          accTotal = detailsCount;
          __addMigration('accordion', 'HTML <details>', '<Accordion>/<AccordionGroup>', 'simple', detailsCount, __getSample('details'), '<details><summary>Title</summary>Content</details> → <Accordion title="Title">Content</Accordion>');
        }

        // Generic accordion patterns
        if (accTotal === 0) {
          accTotal = __count('.accordion, [data-accordion], [class*="accordion"], [class*="collapsible"], [class*="expandable"]');
          if (accTotal > 0) {
            __addMigration('accordion', 'Generic accordion', '<Accordion>/<AccordionGroup>', 'moderate', accTotal, __getSample('.accordion, [class*="accordion"]'), 'Accordion UI detected. Extract title and content for Mintlify <Accordion>.');
          }
        }

        __platformComponents.accordions.total = accTotal;
      })();

      // ================================================================
      // CARDS / CARD GROUPS
      // → Mintlify <Card> / <CardGroup>
      // ================================================================
      (function detectCards() {
        var cardTotal = 0;

        var cardSelectors = {
          'docusaurus':  { sel: '[class*="card"], [class*="col--"] > [class*="card"]', label: 'Docusaurus card' },
          'nextra':      { sel: '.nextra-card, .nextra-cards > a', label: 'Nextra card' },
          'starlight':   { sel: '.sl-card, .card-grid > [class*="card"], [class*="link-card"]', label: 'Starlight card' },
          'gitbook':     { sel: '[class*="card"], [data-testid*="card"]', label: 'GitBook card' },
          'mkdocs':      { sel: '.md-typeset .grid > [class*="card"], .card', label: 'MkDocs grid card' },
          'readme':      { sel: '[class*="rdmd"] .card, .HubTile', label: 'ReadMe card/tile' },
          'fumadocs':    { sel: '[class*="card"]', label: 'Fumadocs card' },
        };

        var matchedCard = cardSelectors[p];
        if (matchedCard) {
          cardTotal = __count(matchedCard.sel);
          if (cardTotal > 0) {
            __addMigration('card', matchedCard.label, '<Card>/<CardGroup>', 'simple', cardTotal, __getSample(matchedCard.sel), 'Cards with title/description/link → <Card title="..." href="...">description</Card>. Group with <CardGroup cols={2}>.');
          }
        }

        // Generic card detection
        if (cardTotal === 0) {
          cardTotal = __count('[class*="card"]:not([class*="card-"]):not(.card-body):not(.card-header), .feature-card, [class*="tile"]');
          // Filter out false positives: cards should have links or titles
          if (cardTotal > 0) {
            __addMigration('card', 'Generic card', '<Card>/<CardGroup>', 'moderate', cardTotal, __getSample('[class*="card"]'), 'Card-like elements detected. Extract title, description, icon, and href for Mintlify <Card>.');
          }
        }

        __platformComponents.cards.total = cardTotal;
      })();

      // ================================================================
      // STEPS / STEPPER
      // → Mintlify <Steps> / <Step>
      // ================================================================
      (function detectSteps() {
        var stepsTotal = 0;

        var stepsSelectors = {
          'docusaurus':  { sel: '[class*="steps"], ol[class*="step"]', label: 'Docusaurus steps' },
          'nextra':      { sel: '.nextra-steps, .steps', label: 'Nextra Steps' },
          'starlight':   { sel: '.sl-steps, [class*="steps"]', label: 'Starlight Steps' },
          'readme':      { sel: '.recipe-steps, [class*="step"]', label: 'ReadMe recipe steps' },
          'gitbook':     { sel: '[class*="stepper"], [class*="steps"]', label: 'GitBook stepper' },
          'mkdocs':      { sel: '.md-typeset .steps, [class*="procedure"]', label: 'MkDocs steps' },
          'fumadocs':    { sel: '[class*="steps"]', label: 'Fumadocs steps' },
        };

        var matchedSteps = stepsSelectors[p];
        if (matchedSteps) {
          stepsTotal = __count(matchedSteps.sel);
          if (stepsTotal > 0) {
            __addMigration('steps', matchedSteps.label, '<Steps>/<Step>', 'simple', stepsTotal, __getSample(matchedSteps.sel), 'Step sequences → <Steps><Step title="Step 1">content</Step>...</Steps>');
          }
        }

        // Generic: ordered lists with specific patterns
        if (stepsTotal === 0) {
          stepsTotal = __count('[class*="step"], .procedure, .wizard-steps');
          // Also check for numbered heading patterns (## Step 1, ## Step 2, etc.)
          if (stepsTotal === 0) {
            try {
              var headings = scopeEl.querySelectorAll('h2, h3');
              var stepHeadings = 0;
              headings.forEach(function(h) {
                if (/^step\\s+\\d|^\\d+\\.\\s/i.test((h.textContent || '').trim())) stepHeadings++;
              });
              if (stepHeadings >= 2) {
                stepsTotal = stepHeadings;
                __addMigration('steps', 'Heading-based steps', '<Steps>/<Step>', 'moderate', stepHeadings, '', 'Sequential headings like "Step 1", "Step 2" → <Steps>/<Step>. Content between headings becomes step body.');
              }
            } catch(e) {}
          }

          if (stepsTotal > 0 && !__migrationComponents.find(function(m) { return m.type === 'steps'; })) {
            __addMigration('steps', 'Generic steps', '<Steps>/<Step>', 'moderate', stepsTotal, __getSample('[class*="step"]'), 'Step-like elements detected.');
          }
        }

        __platformComponents.steps.total = stepsTotal;
      })();

      // ================================================================
      // DEFINITION LISTS (dl/dt/dd)
      // → Mintlify <ParamField> or <ResponseField> or regular markdown
      // ================================================================
      (function detectDefinitions() {
        var dlCount = __count('dl');
        if (dlCount > 0) {
          var dtCount = __count('dt');
          // Check if these look like API parameter definitions
          var isApiContext = result.isApiReferencePage || __count('[class*="param"], [class*="field"]') > 0;
          if (isApiContext) {
            __addMigration('definitions', 'Definition list (API params)', '<ParamField>/<ResponseField>', 'moderate', dtCount, __getSample('dl'), 'Definition lists in API context → <ParamField name="..." type="...">description</ParamField>');
          } else {
            __addMigration('definitions', 'Definition list', 'Markdown bold + description or <Expandable>', 'simple', dtCount, __getSample('dl'), 'Non-API definition lists can become bold terms with descriptions, or <Expandable> for complex items.');
          }
          __platformComponents.definitions.total = dtCount;
        }
      })();

      // ================================================================
      // COLUMNS / GRID LAYOUTS
      // → Mintlify <Columns> / <Column>
      // ================================================================
      (function detectColumns() {
        var colTotal = 0;

        var colSelectors = {
          'docusaurus':  '[class*="col--"], .row > [class*="col"]',
          'mkdocs':      '.md-typeset .grid, [class*="grid-cols"]',
          'starlight':   '.sl-grid, [class*="grid"]',
          'gitbook':     '[class*="columns"], [class*="grid"]',
        };

        var sel = colSelectors[p];
        if (sel) colTotal = __count(sel);

        // Generic grid/column detection
        if (colTotal === 0) {
          colTotal = __count('[class*="columns"], [class*="col-md"], [class*="col-lg"], [class*="grid-cols"], .row > [class*="col"]');
        }

        if (colTotal > 0) {
          __addMigration('columns', 'Grid/column layout', '<Columns>/<Column>', 'moderate', colTotal, __getSample('[class*="col"], [class*="grid"]'), 'Multi-column layouts → <Columns><Column>left</Column><Column>right</Column></Columns>');
          __platformComponents.columns.total = colTotal;
        }
      })();

      // ================================================================
      // TOOLTIPS
      // → Mintlify <Tooltip>
      // ================================================================
      (function detectTooltips() {
        var ttTotal = __count('[data-tooltip], .tooltip, [aria-describedby], [data-tippy-content], [title]:not(svg title)');
        if (ttTotal > 0) {
          __addMigration('tooltip', 'Tooltip', '<Tooltip>', 'simple', ttTotal, __getSample('[data-tooltip], .tooltip'), 'Hover tooltips → <Tooltip tip="explanation">trigger text</Tooltip>');
          __platformComponents.tooltips.total = ttTotal;
        }
      })();

      // ================================================================
      // BADGES / LABELS
      // → Mintlify <Badge>
      // ================================================================
      (function detectBadges() {
        var badgeTotal = __count('.badge, .label, .tag, [class*="badge"], [class*="chip"], .version-tag, [class*="status-"]');
        if (badgeTotal > 0) {
          __addMigration('badge', 'Badge/label/tag', '<Badge>', 'simple', badgeTotal, __getSample('.badge, [class*="badge"]'), 'Inline badges → <Badge>text</Badge>. Supports color prop for variants.');
          __platformComponents.badges.total = badgeTotal;
        }
      })();

      // ================================================================
      // MATH (KaTeX / MathJax)
      // → Mintlify supports KaTeX natively
      // ================================================================
      (function detectMath() {
        var mathTotal = __count('.MathJax, .katex, .math-display, math, .MathJax_Display, [class*="math-inline"], script[type="math/tex"], script[type*="mathjax"], .arithmatex');
        if (mathTotal > 0) {
          var hasMathJax = __count('.MathJax, .MathJax_Display, script[type*="mathjax"]') > 0;
          var hasKaTeX = __count('.katex') > 0;
          var complexity = hasKaTeX ? 'direct' : 'simple';
          var notes = hasKaTeX
            ? 'KaTeX already used — Mintlify supports KaTeX natively. Just use $$ and $ delimiters.'
            : hasMathJax
              ? 'MathJax → KaTeX. Most LaTeX syntax is compatible. Check for MathJax-specific extensions.'
              : 'Math content detected. Mintlify uses KaTeX. Verify LaTeX compatibility.';
          __addMigration('math', hasMathJax ? 'MathJax' : hasKaTeX ? 'KaTeX' : 'Math content', 'KaTeX (native)', complexity, mathTotal, __getSample('.MathJax, .katex, math'), notes);
          __platformComponents.math.total = mathTotal;
        }
      })();

      // ================================================================
      // MERMAID DIAGRAMS
      // → Mintlify supports Mermaid natively
      // ================================================================
      (function detectMermaid() {
        var mermaidTotal = __count('.mermaid, pre.mermaid, [data-mermaid], code.language-mermaid');
        if (mermaidTotal > 0) {
          __addMigration('mermaid', 'Mermaid diagram', 'Mermaid (native)', 'direct', mermaidTotal, __getSample('.mermaid, pre.mermaid'), 'Mintlify supports Mermaid natively. Just use \`\`\`mermaid code blocks.');
          __platformComponents.mermaid.total = mermaidTotal;
        }

        // Other diagram types that need conversion
        var otherDiagrams = __count('.drawio, [class*="diagram-container"], .plantuml, .graphviz, [class*="d2-"], .kroki');
        if (otherDiagrams > 0) {
          __addMigration('diagram', 'Non-Mermaid diagram', 'Image export or Mermaid rewrite', 'complex', otherDiagrams, __getSample('.drawio, .plantuml, .graphviz'), 'PlantUML/Graphviz/D2/Draw.io diagrams have no native Mintlify support. Export as images or rewrite as Mermaid.');
        }
      })();

      // ================================================================
      // API FIELDS / PARAMETER TABLES
      // → Mintlify <ParamField> / <ResponseField>
      // ================================================================
      (function detectApiFields() {
        var fieldTotal = __count('[class*="param-field"], [class*="parameter"], [class*="api-field"], [class*="field-list"], .api-table tr, [class*="property-row"]');

        // ReadMe specific
        if (p === 'readme') {
          fieldTotal += __count('.rm-ParamName, [class*="rdmd-param"]');
        }

        if (fieldTotal > 0) {
          __addMigration('apiField', 'API parameter field', '<ParamField>/<ResponseField>', 'moderate', fieldTotal, __getSample('[class*="param"], [class*="field"]'), 'API parameter tables → <ParamField name="param" type="string" required>description</ParamField>');
          __platformComponents.apiFields.total = fieldTotal;
        }
      })();

      // ================================================================
      // EMBED CONTENT (video, interactive)
      // → Mintlify supports <iframe>, <video> natively
      // ================================================================
      (function detectEmbeds() {
        var embedTotal = 0;

        // Interactive code playgrounds
        var playgrounds = __count('iframe[src*="codepen.io"], iframe[src*="codesandbox.io"], iframe[src*="stackblitz.com"], iframe[src*="repl.it"], iframe[src*="replit.com"], iframe[src*="jsfiddle.net"]');
        if (playgrounds > 0) {
          __addMigration('embed', 'Code playground (CodePen/CodeSandbox/etc)', '<iframe> embed', 'simple', playgrounds, __getSample('iframe[src*="codepen"], iframe[src*="codesandbox"]'), 'Interactive code embeds can be kept as <iframe> in Mintlify MDX.');
          embedTotal += playgrounds;
        }

        // Figma
        var figma = __count('iframe[src*="figma.com"]');
        if (figma > 0) {
          __addMigration('embed', 'Figma embed', '<iframe> embed', 'simple', figma, __getSample('iframe[src*="figma"]'), 'Figma embeds → keep as <iframe> in Mintlify.');
          embedTotal += figma;
        }

        // Loom
        var loom = __count('iframe[src*="loom.com"]');
        if (loom > 0) {
          __addMigration('embed', 'Loom video', '<iframe> embed', 'simple', loom, __getSample('iframe[src*="loom"]'), 'Loom videos → keep as <iframe> in Mintlify.');
          embedTotal += loom;
        }

        __platformComponents.embeds.total = embedTotal;
      })();

      // ================================================================
      // WEB COMPONENTS / CUSTOM ELEMENTS (unknown tags with hyphens)
      // These are platform-specific or custom and may need special handling
      // ================================================================
      (function detectCustomElements() {
        var knownPlatformTags = new Set([
          // Ignore platform shell tags that aren't content components
          'sl-icon', 'sl-badge', 'md-icon', 'ion-icon',
        ]);

        var tagCounts = {};
        try {
          var allEls = scopeEl.querySelectorAll('*');
          allEls.forEach(function(el) {
            var tag = el.tagName.toLowerCase();
            if (tag.indexOf('-') !== -1 && !tag.startsWith('x-') && !knownPlatformTags.has(tag)) {
              tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            }
          });
        } catch(e) {}

        var customTags = Object.keys(tagCounts).map(function(t) { return { tag: t, count: tagCounts[t] }; });
        customTags.sort(function(a, b) { return b.count - a.count; });

        // Report significant custom elements (count > 1 or clearly content-related)
        customTags.slice(0, 20).forEach(function(ct) {
          if (ct.count >= 1) {
            __addMigration('customElement', '<' + ct.tag + '>', 'Requires custom MDX component or HTML replacement', 'complex', ct.count, __getSample(ct.tag), 'Custom web component. Inspect source to determine if it renders content that needs a Mintlify equivalent or can be replaced with standard HTML/MDX.');
          }
        });
      })();

      // ================================================================
      // VERSION INDICATORS / DEPRECATION NOTICES
      // → Mintlify <Badge> or <Warning>
      // ================================================================
      (function detectVersionIndicators() {
        var versionBadges = __count('.versionadded, .versionchanged, .deprecated, [class*="version-badge"], [class*="since-version"]');
        if (versionBadges > 0) {
          __addMigration('versionIndicator', 'Version/deprecation badge', '<Badge> or <Warning>', 'simple', versionBadges, __getSample('.versionadded, .versionchanged, .deprecated'), 'Version badges (Added in v2.0, Deprecated) → <Badge> for versions, <Warning> for deprecations.');
        }
      })();

      // ================================================================
      // CONTENT COMPONENTS: non-web-component custom elements
      // Detects divs/sections with data-component attributes, styled blocks,
      // embedded widgets, and interactive elements that suggest custom rendering.
      // Also detects interactive widgets and suggests Mintlify mapping.
      // ================================================================
      (function detectContentComponents() {
        var contentComps = [];
        var ccSeen = new Set();
        var __interactiveWidgets = [];

        // Page chrome selectors to ignore
        var CHROME_SELS = 'header, footer, nav, .sidebar, .nav, [role="navigation"], [role="banner"], [role="contentinfo"], .header, .footer, .top-bar, .bottom-bar, .site-header, .site-footer';
        var chromeEls = [];
        try {
          var chromeCandidates = document.querySelectorAll(CHROME_SELS);
          for (var chi = 0; chi < chromeCandidates.length; chi++) chromeEls.push(chromeCandidates[chi]);
        } catch(e) {}

        function isInsideChrome(el) {
          for (var ci = 0; ci < chromeEls.length; ci++) {
            if (chromeEls[ci].contains(el)) return true;
          }
          return false;
        }

        // Common utility classes to filter out (Tailwind, Bootstrap)
        var UTIL_RE = /^(flex|grid|block|inline|hidden|static|relative|absolute|fixed|sticky|overflow|float|clear|p-|m-|px-|py-|mx-|my-|pt-|pb-|pl-|pr-|mt-|mb-|ml-|mr-|w-|h-|min-|max-|gap-|space-|text-|font-|leading-|tracking-|bg-|border-|rounded-|shadow-|opacity-|z-|top-|right-|bottom-|left-|cursor-|select-|transition-|duration-|ease-|animate-|transform-|scale-|rotate-|translate-|origin-|col-|row-|justify-|items-|self-|content-|order-|grow-|shrink-|basis-|sm:|md:|lg:|xl:|2xl:|dark:|hover:|focus:|active:|disabled:|group-|peer-|btn|col-xs|col-sm|col-md|col-lg|container|row$|d-flex|d-grid|d-block|d-none|d-inline|align-|sr-only|visually-hidden)/;

        function ccMeaningfulClasses(el) {
          return (el.className || '').toString().split(/\\s+/).filter(function(c) {
            return c && c.length >= 3 && c.length <= 60 && !UTIL_RE.test(c);
          });
        }

        function ccSelectorHint(el) {
          var eid = el.getAttribute('id');
          if (eid && eid.length < 60 && !/^[0-9]|^__/.test(eid)) return '#' + eid;
          var cls = ccMeaningfulClasses(el);
          if (cls.length > 0) return '.' + cls.slice(0, 2).join('.');
          var tag = el.tagName.toLowerCase();
          var dAttrs = [];
          for (var ai = 0; ai < el.attributes.length; ai++) {
            if (el.attributes[ai].name.startsWith('data-') && el.attributes[ai].value && el.attributes[ai].value.length < 30) {
              dAttrs.push('[' + el.attributes[ai].name + ']');
            }
          }
          if (dAttrs.length > 0) return tag + dAttrs.slice(0, 2).join('');
          return tag;
        }

        // Collect data-* attributes from an element
        function ccGetDataAttrs(el) {
          var attrs = {};
          try {
            for (var ai = 0; ai < el.attributes.length; ai++) {
              var attr = el.attributes[ai];
              if (attr.name.startsWith('data-') && attr.value && attr.value.length < 100) {
                attrs[attr.name] = attr.value;
              }
            }
          } catch(e) {}
          return attrs;
        }

        // Collect sample info from element
        function ccCollectSample(el) {
          var sampleHtml = '';
          var sampleText = '';
          var dataAttributes = {};
          var nestedIn = null;
          try {
            sampleHtml = (el.innerHTML || '').substring(0, 300);
            sampleText = (el.textContent || '').trim().substring(0, 100);
            dataAttributes = ccGetDataAttrs(el);
            // Check if nested inside another custom component
            var parent = el.parentElement;
            while (parent && parent !== scopeEl) {
              if (ccSeen.has(parent)) {
                nestedIn = ccSelectorHint(parent);
                break;
              }
              parent = parent.parentElement;
            }
          } catch(e) {}
          return { sampleHtml: sampleHtml, sampleText: sampleText, dataAttributes: dataAttributes, nestedIn: nestedIn };
        }

        // Suggest Mintlify component mapping based on class/type name
        function ccSuggestMintlify(typeName) {
          var lower = (typeName || '').toLowerCase();
          if (/alert|notice|callout|admonition|warning|caution|danger/.test(lower)) {
            if (/warning|caution/.test(lower)) return { component: 'Warning', confidence: 'high' };
            if (/danger|error|critical/.test(lower)) return { component: 'Danger', confidence: 'high' };
            if (/info|information/.test(lower)) return { component: 'Info', confidence: 'high' };
            if (/tip|hint/.test(lower)) return { component: 'Tip', confidence: 'high' };
            if (/success|check/.test(lower)) return { component: 'Check', confidence: 'high' };
            return { component: 'Note', confidence: 'medium' };
          }
          if (/\\bcard\\b|tile|feature/.test(lower)) return { component: 'Card', confidence: 'medium' };
          if (/accordion|collapsible|expandable/.test(lower)) return { component: 'Accordion', confidence: 'medium' };
          if (/\\btab\\b|\\btabs\\b/.test(lower)) return { component: 'Tabs', confidence: 'medium' };
          if (/\\bstep\\b|\\bsteps\\b|procedure/.test(lower)) return { component: 'Steps', confidence: 'medium' };
          if (/tooltip|popover/.test(lower)) return { component: 'Tooltip', confidence: 'medium' };
          if (/\\bnote\\b/.test(lower)) return { component: 'Note', confidence: 'medium' };
          return null;
        }

        // Determine category for enhanced component
        function ccGetCategory(typeName, el) {
          var lower = (typeName || '').toLowerCase();
          if (/toggle|slider|range|poll|quiz|calculator|playground|picker|editable|search/.test(lower)) return 'interactive';
          if (/callout|alert|notice|admonition|banner|badge|highlight|note|warning|tip|info|danger/.test(lower)) return 'visual';
          if (/layout|grid|column|container|wrapper|section|hero/.test(lower)) return 'structural';
          if (/nav|breadcrumb|toc|sidebar|pagination|menu/.test(lower)) return 'navigation';
          if (typeName.indexOf('data-attr:') === 0 || typeName.indexOf('data:') === 0) return 'data-driven';
          if (el && el.tagName && el.tagName.toLowerCase().indexOf('-') !== -1) return 'web-component';
          if (/form|input|select|textarea|checkbox|radio/.test(lower)) return 'form';
          return 'unknown';
        }

        // Check if element is a mere styling wrapper (single child contains all text)
        function ccIsStylingWrapper(el) {
          try {
            if (el.children.length !== 1) return false;
            var child = el.children[0];
            var elText = (el.textContent || '').trim();
            var childText = (child.textContent || '').trim();
            if (elText.length > 0 && childText.length > 0 && childText.length >= elText.length * 0.95) return true;
          } catch(e) {}
          return false;
        }

        // Check if element qualifies as a component (has enough content)
        function ccQualifies(el, isInteractive) {
          if (isInteractive) return true;
          var text = (el.textContent || '').trim();
          if (text.length < 10 && el.children.length < 2) return false;
          if (ccIsStylingWrapper(el)) return false;
          return true;
        }

        // --- 1. Elements with data-component, data-widget, data-type, data-block, data-element ---
        try {
          var dcEls = scopeEl.querySelectorAll('[data-component], [data-widget], [data-type], [data-block-type], [data-block], [data-element-type], [data-element]');
          for (var di = 0; di < dcEls.length; di++) {
            var dcEl = dcEls[di];
            if (ccSeen.has(dcEl)) continue;
            if (isInsideChrome(dcEl)) continue;
            ccSeen.add(dcEl);
            var dcType = dcEl.getAttribute('data-component') || dcEl.getAttribute('data-widget') || dcEl.getAttribute('data-type') || dcEl.getAttribute('data-block-type') || dcEl.getAttribute('data-block') || dcEl.getAttribute('data-element-type') || dcEl.getAttribute('data-element') || 'data-component';
            var dcSample = ccCollectSample(dcEl);
            var dcMintlify = ccSuggestMintlify(dcType);
            contentComps.push({
              type: 'data-attr:' + dcType,
              category: ccGetCategory('data-attr:' + dcType, dcEl),
              selector: ccSelectorHint(dcEl),
              count: 1,
              confidence: 'high',
              sampleHtml: dcSample.sampleHtml,
              sampleText: dcSample.sampleText,
              dataAttributes: dcSample.dataAttributes,
              nestedIn: dcSample.nestedIn,
              suggestedMintlify: dcMintlify ? dcMintlify.component : null,
              suggestedMintlifyConfidence: dcMintlify ? dcMintlify.confidence : null
            });
          }
        } catch(e) {}

        // --- 1b. Elements with data-testid that suggest custom components ---
        try {
          var testIdEls = scopeEl.querySelectorAll('[data-testid]');
          var componentTestIdRe = /callout|alert|card|tab|accordion|step|tooltip|banner|modal|widget|component|block/i;
          for (var ti = 0; ti < testIdEls.length; ti++) {
            var tiEl = testIdEls[ti];
            if (ccSeen.has(tiEl)) continue;
            if (isInsideChrome(tiEl)) continue;
            var testId = tiEl.getAttribute('data-testid') || '';
            if (componentTestIdRe.test(testId)) {
              ccSeen.add(tiEl);
              var tiSample = ccCollectSample(tiEl);
              var tiMintlify = ccSuggestMintlify(testId);
              contentComps.push({
                type: 'data:testid-' + testId,
                category: ccGetCategory(testId, tiEl),
                selector: '[data-testid="' + testId + '"]',
                count: 1,
                confidence: 'medium',
                sampleHtml: tiSample.sampleHtml,
                sampleText: tiSample.sampleText,
                dataAttributes: tiSample.dataAttributes,
                nestedIn: tiSample.nestedIn,
                suggestedMintlify: tiMintlify ? tiMintlify.component : null,
                suggestedMintlifyConfidence: tiMintlify ? tiMintlify.confidence : null
              });
            }
          }
        } catch(e) {}

        // --- 2. Deep Structural & Interactive Components (BEM, Semantics, IDs, Roles) ---
        try {
          var semanticKeywords = [
            'card', 'alert', 'badge', 'banner', 'box', 'panel', 'item', 'button', 'nav', 'wrapper', 'section', 'layout', 'container', 'hero', 'grid', 'tooltip', 'modal', 'accordion', 'tab', 'menu', 'list', 'header', 'footer', 'sidebar', 'toast', 'snackbar', 'spinner', 'loader', 'avatar', 'tag', 'pill', 'chip', 'divider', 'separator', 'breadcrumb', 'pagination', 'carousel', 'slider', 'stepper', 'timeline', 'progress', 'skeleton', 'popover', 'dropdown', 'select', 'checkbox', 'radio', 'switch', 'toggle', 'input', 'textarea', 'form', 'label', 'icon', 'image', 'video', 'audio', 'iframe', 'canvas', 'svg', 'table', 'row', 'cell', 'col', 'column', 'group', 'content', 'widget', 'module', 'component', 'element', 'block', 'feature', 'highlight', 'callout', 'note', 'warning', 'tip', 'info', 'step', 'demo', 'example', 'snippet', 'code', 'player', 'admonition', 'notice', 'caution', 'danger', 'success', 'check', 'important', 'hint', 'summary', 'details', 'dialog', 'figure', 'figcaption', 'quote', 'blockquote', 'cite', 'caption', 'legend', 'fieldset', 'output', 'meter'
          ];

          // Component-like class patterns (hyphenated multi-word names)
          var componentClassRe = /^[a-z]+-(?:box|panel|card|section|block|banner|bar|group|list|item|wrap|wrapper|container|content|header|footer|body|title|label|icon|image|text|link|btn|button|input|field|form|nav|menu|tab|step|badge|tag|alert|note|tip|info|warning|danger|success|error|callout|accordion|modal|popup|tooltip|dropdown|toggle|slider|carousel|hero|feature|grid|row|col|column|divider|separator|overlay|backdrop|loader|spinner|avatar|chip|pill|timeline|progress|skeleton|breadcrumb|pagination|stepper|demo|example|snippet|player|embed|widget|module|component|element)s?$/i;

          var utilityPrefixes = [
            'mt-', 'mb-', 'ml-', 'mr-', 'mx-', 'my-', 'm-', 'pt-', 'pb-', 'pl-', 'pr-', 'px-', 'py-', 'p-', 'text-', 'bg-', 'border-', 'rounded-', 'shadow-', 'flex', 'grid', 'block', 'hidden', 'inline', 'w-', 'h-', 'max-', 'min-', 'z-', 'opacity-', 'cursor-', 'pointer-', 'select-', 'top-', 'bottom-', 'left-', 'right-', 'inset-', 'relative', 'absolute', 'fixed', 'sticky', 'static', 'overflow-', 'whitespace-', 'break-', 'leading-', 'tracking-', 'font-', 'align-', 'justify-', 'items-', 'content-', 'self-', 'place-', 'order-', 'col-', 'row-', 'auto-', 'gap-', 'space-', 'divide-', 'ring-', 'outline-', 'transform', 'scale-', 'rotate-', 'translate-', 'skew-', 'origin-', 'transition', 'duration-', 'ease-', 'delay-', 'animate-', 'hover:', 'focus:', 'active:', 'sm:', 'md:', 'lg:', 'xl:', '2xl:', 'dark:', 'css-', 'sc-'
          ];

          var interactiveTags = ['button', 'details', 'dialog', 'summary', 'menu', 'nav', 'form', 'input', 'select', 'textarea'];

          // Track BEM blocks for grouping
          var bemBlocks = {};

          var allEls = scopeEl.querySelectorAll('div, section, aside, article, span, button, details, dialog, ul, li, nav, header, footer');

          for (var i = 0; i < allEls.length; i++) {
            var el = allEls[i];
            if (ccSeen.has(el)) continue;
            if (isInsideChrome(el)) continue;

            // Ignore pure textual empty elements unless they are interactive
            if (el.children.length === 0 && !el.className && !el.id) {
               if (interactiveTags.indexOf(el.tagName.toLowerCase()) === -1) continue;
            }

            var tagsAndAttrs = [
              el.tagName.toLowerCase(),
              el.id || '',
              el.getAttribute('data-testid') || '',
              el.getAttribute('data-id') || '',
              el.getAttribute('name') || '',
              el.getAttribute('role') || ''
            ];
            var classes = (el.className || '').toString().split(/\\s+/);

            var matchedTerm = null;
            var isInteractive = false;

            // 2a. Check Classes and BEM first (most precise)
            for (var ci = 0; ci < classes.length; ci++) {
              var c = classes[ci];
              if (!c || c.length < 3 || c.length > 50) continue;

              var isUtility = false;
              for (var ui = 0; ui < utilityPrefixes.length; ui++) {
                if (c.indexOf(utilityPrefixes[ui]) === 0 || c === utilityPrefixes[ui].replace('-', '')) {
                  isUtility = true;
                  break;
                }
              }
              if (isUtility) continue;

              var lowerC = c.toLowerCase();

              // BEM detection: block__element--modifier -> group by block
              if (c.indexOf('__') !== -1) {
                var bemBlock = c.split('__')[0];
                bemBlocks[bemBlock] = (bemBlocks[bemBlock] || 0) + 1;
                matchedTerm = bemBlock;
                break;
              }
              if (c.indexOf('--') !== -1) {
                var bemBase = c.split('--')[0];
                bemBlocks[bemBase] = (bemBlocks[bemBase] || 0) + 1;
                matchedTerm = bemBase;
                break;
              }

              // Component-like class patterns (e.g., alert-box, info-panel, feature-card)
              if (componentClassRe.test(lowerC)) {
                matchedTerm = c;
                break;
              }

              for (var si = 0; si < semanticKeywords.length; si++) {
                if (lowerC.indexOf(semanticKeywords[si]) !== -1) {
                  matchedTerm = c;
                  break;
                }
              }
              if (matchedTerm) break;
            }

            // 2b. Fallback to Tags, IDs, Roles, TestIDs
            if (!matchedTerm) {
              for (var t = 0; t < tagsAndAttrs.length; t++) {
                 var val = tagsAndAttrs[t].toLowerCase();
                 if (!val || val.length < 3) continue;
                 for (var s = 0; s < semanticKeywords.length; s++) {
                   if (val.indexOf(semanticKeywords[s]) !== -1) {
                     matchedTerm = val;
                     break;
                   }
                 }
                 if (matchedTerm) break;
              }
            }

            // 2c. Fallback to Interactivity / Hidden logic
            if (!matchedTerm) {
               if (el.hasAttribute('onclick') || el.getAttribute('tabindex') === '0' || el.style.cursor === 'pointer' || el.style.display === 'none') {
                 matchedTerm = 'interactive-box';
                 isInteractive = true;
               }
            }

            if (matchedTerm && ccQualifies(el, isInteractive)) {
               ccSeen.add(el);
               var elSample = ccCollectSample(el);
               var elMintlify = ccSuggestMintlify(matchedTerm);
               contentComps.push({
                 type: 'semantic:' + matchedTerm,
                 category: ccGetCategory(matchedTerm, el),
                 selector: ccSelectorHint(el),
                 count: 1,
                 confidence: 'medium',
                 sampleHtml: elSample.sampleHtml,
                 sampleText: elSample.sampleText,
                 dataAttributes: elSample.dataAttributes,
                 nestedIn: elSample.nestedIn,
                 suggestedMintlify: elMintlify ? elMintlify.component : null,
                 suggestedMintlifyConfidence: elMintlify ? elMintlify.confidence : null
               });
            }
          }
        } catch(e) {}

        // --- 3. Embedded widgets with data-src, data-embed, data-widget-id ---
        try {
          var wEls = scopeEl.querySelectorAll('[data-src]:not(img):not(video):not(iframe), [data-embed], [data-widget-id], [data-embed-id], [data-integration]');
          for (var wi = 0; wi < wEls.length; wi++) {
            var wEl = wEls[wi];
            if (ccSeen.has(wEl)) continue;
            if (isInsideChrome(wEl)) continue;
            ccSeen.add(wEl);
            var wType = wEl.getAttribute('data-embed') || wEl.getAttribute('data-widget-id') || wEl.getAttribute('data-integration') || 'widget';
            var wSample = ccCollectSample(wEl);
            contentComps.push({
              type: 'widget:' + wType,
              category: 'data-driven',
              selector: ccSelectorHint(wEl),
              count: 1,
              confidence: 'high',
              sampleHtml: wSample.sampleHtml,
              sampleText: wSample.sampleText,
              dataAttributes: wSample.dataAttributes,
              nestedIn: wSample.nestedIn,
              suggestedMintlify: null,
              suggestedMintlifyConfidence: null
            });
          }
        } catch(e) {}

        // --- 4. Interactive elements: unusual roles and custom patterns ---
        try {
          var iEls = scopeEl.querySelectorAll('[role="slider"], [role="spinbutton"], [role="meter"], [role="progressbar"], [role="tree"], [role="treegrid"], [role="feed"], [role="toolbar"], [role="menubar"], [contenteditable="true"]');
          for (var ii = 0; ii < iEls.length; ii++) {
            var iEl = iEls[ii];
            if (ccSeen.has(iEl)) continue;
            if (isInsideChrome(iEl)) continue;
            ccSeen.add(iEl);
            var iRole = iEl.getAttribute('role') || (iEl.getAttribute('contenteditable') ? 'editable' : 'interactive');
            var iSample = ccCollectSample(iEl);
            contentComps.push({
              type: 'interactive:' + iRole,
              category: 'interactive',
              selector: ccSelectorHint(iEl),
              count: 1,
              confidence: 'medium',
              sampleHtml: iSample.sampleHtml,
              sampleText: iSample.sampleText,
              dataAttributes: iSample.dataAttributes,
              nestedIn: iSample.nestedIn,
              suggestedMintlify: null,
              suggestedMintlifyConfidence: null
            });
          }
        } catch(e) {}

        // --- 5. Interactive Widgets Detection ---
        try {
          // Toggle switches
          var toggleEls = scopeEl.querySelectorAll('input[type="checkbox"][class*="toggle"], input[type="checkbox"][role="switch"], [class*="toggle-switch"], [class*="switch"][role="switch"], [class*="toggle"][class*="switch"]');
          var toggleCount = toggleEls.length;
          if (toggleCount > 0) {
            __interactiveWidgets.push({ type: 'toggle', selector: ccSelectorHint(toggleEls[0]), count: toggleCount, hasUserInput: true });
          }

          // Sliders / ranges
          var sliderEls = scopeEl.querySelectorAll('input[type="range"], [role="slider"], [class*="slider"]:not([class*="carousel"]):not([class*="slider-nav"])');
          var sliderCount = sliderEls.length;
          if (sliderCount > 0) {
            __interactiveWidgets.push({ type: 'slider', selector: ccSelectorHint(sliderEls[0]), count: sliderCount, hasUserInput: true });
          }

          // Search bars within content (not main site search)
          var searchEls = scopeEl.querySelectorAll('input[type="search"], [class*="search-bar"], [class*="search-input"], [role="searchbox"]');
          var searchCount = 0;
          for (var sci = 0; sci < searchEls.length; sci++) {
            if (!isInsideChrome(searchEls[sci])) searchCount++;
          }
          if (searchCount > 0) {
            __interactiveWidgets.push({ type: 'search', selector: 'input[type="search"]', count: searchCount, hasUserInput: true });
          }

          // Polls / quizzes (forms with radio buttons inside content)
          var formEls = scopeEl.querySelectorAll('form');
          var pollCount = 0;
          for (var fi = 0; fi < formEls.length; fi++) {
            if (isInsideChrome(formEls[fi])) continue;
            var radios = formEls[fi].querySelectorAll('input[type="radio"]');
            if (radios.length >= 2) pollCount++;
          }
          if (pollCount > 0) {
            __interactiveWidgets.push({ type: 'poll', selector: 'form', count: pollCount, hasUserInput: true });
          }

          // Calculators (forms with number inputs + output display)
          var calcCount = 0;
          for (var fci = 0; fci < formEls.length; fci++) {
            if (isInsideChrome(formEls[fci])) continue;
            var numInputs = formEls[fci].querySelectorAll('input[type="number"]');
            var outputs = formEls[fci].querySelectorAll('output, [class*="result"], [class*="output"]');
            if (numInputs.length >= 1 && outputs.length >= 1) calcCount++;
          }
          if (calcCount > 0) {
            __interactiveWidgets.push({ type: 'calculator', selector: 'form', count: calcCount, hasUserInput: true });
          }

          // Code playgrounds (Monaco, CodeMirror, Ace editors)
          var playgroundEls = scopeEl.querySelectorAll('.monaco-editor, .CodeMirror, .ace_editor, [class*="code-playground"], [class*="code-editor"], [class*="live-editor"], [class*="interactive-code"]');
          var playgroundCount = playgroundEls.length;
          if (playgroundCount > 0) {
            __interactiveWidgets.push({ type: 'playground', selector: ccSelectorHint(playgroundEls[0]), count: playgroundCount, hasUserInput: true });
          }

          // Copy buttons
          var copyBtnEls = scopeEl.querySelectorAll('[class*="copy-button"], [class*="copy-btn"], [class*="clipboard"], button[data-clipboard], [aria-label*="copy" i], [aria-label*="clipboard" i]');
          var copyCount = copyBtnEls.length;
          if (copyCount > 0) {
            __interactiveWidgets.push({ type: 'copy-button', selector: ccSelectorHint(copyBtnEls[0]), count: copyCount, hasUserInput: false });
          }

          // Color pickers
          var colorEls = scopeEl.querySelectorAll('input[type="color"], [class*="color-picker"], [class*="colorpicker"]');
          var colorCount = colorEls.length;
          if (colorCount > 0) {
            __interactiveWidgets.push({ type: 'color-picker', selector: ccSelectorHint(colorEls[0]), count: colorCount, hasUserInput: true });
          }

          // Date pickers
          var dateEls = scopeEl.querySelectorAll('input[type="date"], input[type="datetime-local"], [class*="date-picker"], [class*="datepicker"], [class*="calendar-widget"]');
          var dateCount = dateEls.length;
          if (dateCount > 0) {
            __interactiveWidgets.push({ type: 'date-picker', selector: ccSelectorHint(dateEls[0]), count: dateCount, hasUserInput: true });
          }
        } catch(e) {}

        // Aggregate by type
        var ccAgg = {};
        for (var agi = 0; agi < contentComps.length; agi++) {
          var ccItem = contentComps[agi];
          if (!ccAgg[ccItem.type]) {
            ccAgg[ccItem.type] = {
              type: ccItem.type,
              category: ccItem.category,
              selector: ccItem.selector,
              count: 0,
              confidence: ccItem.confidence,
              sampleHtml: ccItem.sampleHtml,
              sampleText: ccItem.sampleText,
              dataAttributes: ccItem.dataAttributes,
              nestedIn: ccItem.nestedIn,
              suggestedMintlify: ccItem.suggestedMintlify,
              suggestedMintlifyConfidence: ccItem.suggestedMintlifyConfidence
            };
          }
          ccAgg[ccItem.type].count += ccItem.count;
        }
        result.contentComponents = Object.keys(ccAgg).map(function(k) { return ccAgg[k]; }).sort(function(a, b) { return b.count - a.count; }).slice(0, 40);
        result.interactiveWidgets = __interactiveWidgets;
      })();

      // ================================================================
      // POPULATE __componentSamples from migration detection results
      // Provides CSS hints for the report aggregation layer.
      // ================================================================
      (function buildComponentSamples() {
        function csAdd(type, hint) {
          if (!hint) return;
          if (!__componentSamples[type]) __componentSamples[type] = [];
          if (__componentSamples[type].length >= 3) return;
          for (var i = 0; i < __componentSamples[type].length; i++) {
            if (__componentSamples[type][i].cssHint === hint) return;
          }
          __componentSamples[type].push({
            cssHint: hint, confidence: 'high', alternativeType: null,
            source: 'migration-detection', tagName: 'div', variant: null, score: 50
          });
        }

        for (var mi = 0; mi < __migrationComponents.length; mi++) {
          var mc = __migrationComponents[mi];
          if (mc.sample) {
            try {
              var clsM = mc.sample.match(/class="([^"]*)"/);
              if (clsM) {
                var mCls = clsM[1].split(/\\s+/).filter(function(c) { return c && c.length > 2 && c.length < 40; });
                if (mCls.length > 0) csAdd(mc.type, '.' + mCls.slice(0, 2).join('.'));
              }
            } catch(e) {}
          }
        }

        var csSelMap = {
          'callout': '.admonition, .callout, .alert, .notice, [class*="callout"], [role="alert"], .custom-block, [class*="hint"], .nextra-callout, .starlight-aside',
          'tabs': '.tabs, [role="tablist"], .tab-container, .tabbed-set, .vp-code-group',
          'accordion': 'details, .accordion, [class*="accordion"], [class*="collapsible"]',
          'steps': '[class*="steps"], [class*="step"], .procedure',
          'card': '[class*="card"]:not(.card-body):not(.card-header)',
          'embed': 'iframe[src*="codepen"], iframe[src*="codesandbox"], iframe[src*="stackblitz"]',
          'definitions': 'dl'
        };
        for (var csType in csSelMap) {
          if (__componentSamples[csType] && __componentSamples[csType].length >= 3) continue;
          try {
            var csEl = scopeEl.querySelector(csSelMap[csType]);
            if (csEl) {
              var csHint = '';
              var csId = csEl.getAttribute('id');
              if (csId && csId.length < 60) csHint = '#' + csId;
              else {
                var csCls = (csEl.className || '').toString().split(/\\s+/).filter(function(c) { return c && c.length > 2 && c.length < 40; });
                if (csCls.length > 0) csHint = '.' + csCls.slice(0, 2).join('.');
                else csHint = csEl.tagName.toLowerCase();
              }
              csAdd(csType, csHint);
            }
          } catch(e) {}
        }
      })();

    } catch(migrationErr) {
      // Silent fail — don't break the whole analysis
      console.log('SCOPING_MIGRATION_ERROR:' + (migrationErr.message || migrationErr));
    }
  `;
}

/**
 * Analyzes a single page for videos, external links, API refs, and custom components.
 * Data returned via console.log('SCOPING_ANALYSIS:' + JSON.stringify(...))
 */
export function generatePageAnalysisScript(
  baseUrl,
  scopePrefix,
  contentSelector,
) {
  const scopePrefixStr = scopePrefix ? JSON.stringify(scopePrefix) : "null";
  const contentSelectorStr = contentSelector
    ? JSON.stringify(contentSelector)
    : "null";
  return `
    (function() {
      // Wait for page content to render (max 5s)
      function waitForContent() {
        return new Promise(function(resolve) {
          var attempts = 0;
          var maxAttempts = 10; // 10 x 500ms = 5s
          function check() {
            var hasContent = document.querySelector('h1, h2, article, main, [role="main"], .content, #content');
            var linkCount = document.querySelectorAll('a[href]').length;
            if (hasContent || linkCount > 3 || attempts >= maxAttempts) {
              resolve();
            } else {
              attempts++;
              setTimeout(check, 500);
            }
          }
          check();
        });
      }

      waitForContent().then(function() {
      try {
        const baseOrigin = new URL(${JSON.stringify(baseUrl)}).origin;
        const scopePrefix = ${scopePrefixStr};
        const contentSelectorParam = ${contentSelectorStr};

        // Resolve content container for scoped metrics
        let contentContainer = null;
        if (contentSelectorParam) {
          try { contentContainer = document.querySelector(contentSelectorParam); } catch {}
        }
        // When content selector is configured but NOT found, use a dummy element
        // so component/metrics detection returns zeros (page will be filtered by isDocPage)
        const scopeEl = contentContainer || (contentSelectorParam ? document.createElement('div') : document);

        const result = {
          url: window.location.href,
          title: '',
          contentSelectorFound: !!contentContainer,
          videos: [],
          externalLinks: [],
          apiRefs: [],
          customComponents: [],
          discoveredLinks: [],
          // Content metrics
          wordCount: 0,
          headings: { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
          codeBlocks: { count: 0, languages: [] },
          tables: { count: 0, totalRows: 0 },
          images: { count: 0, external: 0 },
          lists: { ordered: 0, unordered: 0 },
          // Interactive elements
          tabs: 0,
          accordions: 0,
          downloadLinks: { count: 0, extensions: [] },
          forms: 0,
          iframes: 0,
          tooltips: 0,
          // API / Playground
          openApiSpecs: [],
          apiPlaygrounds: 0,
          graphqlExplorers: 0,
          // Enhanced API detection
          apiDocDetails: [],
          detectedApiSpecs: [],
          apiEndpoints: [],
          apiType: null,
          apiConfidenceScore: 0,
          interactiveWidgets: [],
          // Structure
          breadcrumbDepth: 0,
          sidebarItems: 0,
          hasPagination: false,
          hasLanguageSwitcher: false,
          // Special content
          specialContent: { thirdPartyEmbeds: [], mathContent: 0, diagramContent: 0, codePlaygrounds: 0 },
          isApiReferencePage: false,
          playgroundTypes: [],
          // Migration-aware detection (NEW)
          migrationComponents: [],
        };

        // Page title
        const h1 = document.querySelector('h1');
        result.title = h1 ? h1.textContent.trim() : document.title;

        // ---- Videos (scoped) ----
        scopeEl.querySelectorAll('iframe[src*="youtube"], iframe[src*="youtu.be"]').forEach(el => {
          result.videos.push({ type: 'youtube', src: el.getAttribute('src') || '' });
        });
        scopeEl.querySelectorAll('iframe[src*="vimeo"]').forEach(el => {
          result.videos.push({ type: 'vimeo', src: el.getAttribute('src') || '' });
        });
        scopeEl.querySelectorAll('iframe[src*="loom.com"]').forEach(el => {
          result.videos.push({ type: 'loom', src: el.getAttribute('src') || '' });
        });
        scopeEl.querySelectorAll('iframe[src*="wistia"], [class*="wistia"]').forEach(el => {
          result.videos.push({ type: 'wistia', src: el.getAttribute('src') || el.className });
        });
        scopeEl.querySelectorAll('video').forEach(el => {
          result.videos.push({ type: 'html5-video', src: el.getAttribute('src') || (el.querySelector('source') || {}).src || '' });
        });
        scopeEl.querySelectorAll('iframe[src*="zendesk"]').forEach(el => {
          result.videos.push({ type: 'zendesk-embed', src: el.getAttribute('src') || '' });
        });

        // ---- External Links (scoped) ----
        scopeEl.querySelectorAll('a[href]').forEach(link => {
          const href = link.getAttribute('href');
          if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) return;
          try {
            let fullUrl;
            if (href.startsWith('http')) fullUrl = href;
            else return;
            const url = new URL(fullUrl);
            if (url.origin !== baseOrigin && result.externalLinks.length < 50) {
              result.externalLinks.push({
                url: fullUrl,
                text: (link.textContent || '').trim().substring(0, 100),
              });
            }
          } catch {}
        });

        // ---- API References (always check full document, not scopeEl which may be empty) ----
        const apiCheckEl = document.body;
        const scopeText = (scopeEl === document ? document.body.innerText : scopeEl.innerText) || '';
        const scopeHtml = (scopeEl === document ? document.body.innerHTML : scopeEl.innerHTML) || '';
        const fullBodyHtml = document.body.innerHTML || '';

        if (apiCheckEl.querySelector('.swagger-ui, .redoc-wrap, [id*="swagger"], [id*="redoc"], swagger-ui, rapi-doc')) {
          result.apiRefs.push('OpenAPI/Swagger UI detected');
        } else if (/["']openapi["']\\s*:\\s*["']|["']swagger["']\\s*:\\s*["']/i.test(fullBodyHtml)) {
          result.apiRefs.push('OpenAPI/Swagger spec embedded');
        }
        if (apiCheckEl.querySelector('.graphiql-container, [class*="graphql"]')) {
          result.apiRefs.push('GraphQL detected');
        }
        // Mintlify API playground detection
        if (apiCheckEl.querySelector('[id^="api-playground"], .api-section, .tryit-button, .method-pill, .openapi-content, .openapi-method, .openapi-schemas, [data-testid*="playground"], .param-field')) {
          result.apiRefs.push('Mintlify API playground detected');
        }
        // Stoplight Elements
        if (apiCheckEl.querySelector('elements-api, .sl-elements, .TryItPanel, [class*="TryIt"]')) {
          result.apiRefs.push('Stoplight Elements detected');
        }
        // Postman
        if (apiCheckEl.querySelector('.postman-run-button, [data-postman], .postman-embed')) {
          result.apiRefs.push('Postman integration detected');
        }
        var hasApiClasses = apiCheckEl.querySelector('[class*="api-method"], [class*="http-method"], .api-content, [class*="endpoint"]');
        var httpVerbBadges = apiCheckEl.querySelectorAll('[class*="get"], [class*="post"], [class*="put"], [class*="delete"], [class*="patch"]');
        var verbBadgeCount = 0;
        httpVerbBadges.forEach(function(el) {
          var text = (el.textContent || '').trim().toUpperCase();
          if (/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$/.test(text)) verbBadgeCount++;
        });
        if (hasApiClasses || verbBadgeCount >= 2) {
          result.apiRefs.push('REST API documentation detected');
        }
        if (document.querySelector('meta[name="readme-deploy"]') || apiCheckEl.querySelector('[class*="rdmd"]')) {
          result.apiRefs.push('readme.com API docs detected');
        }

        // ---- Custom Components / Web Components (scoped) ----
        const customTags = {};
        const allElements = scopeEl.querySelectorAll('*');
        allElements.forEach(el => {
          const tag = el.tagName.toLowerCase();
          if (tag.includes('-') && !tag.startsWith('x-')) {
            customTags[tag] = (customTags[tag] || 0) + 1;
          }
        });

        // Page chrome elements to filter out
        var __chromeEls = [];
        try {
          var __chromeSels = 'header, footer, nav, .sidebar, .nav, [role="navigation"], [role="banner"], [role="contentinfo"], .header, .footer, .top-bar, .bottom-bar, .site-header, .site-footer';
          var __chromeCands = document.querySelectorAll(__chromeSels);
          for (var __chi = 0; __chi < __chromeCands.length; __chi++) __chromeEls.push(__chromeCands[__chi]);
        } catch(e) {}
        function __isChrome(el) {
          for (var ci = 0; ci < __chromeEls.length; ci++) {
            if (__chromeEls[ci].contains(el)) return true;
          }
          return false;
        }

        var contentComps = [];
        var ccSeen = new WeakSet();
        var __iwWidgets = [];

        function ccSelectorHint(el) {
          if (el.id && el.id.length < 50) return '#' + el.id;
          var cls = (el.className || '').toString().split(/\\s+/).filter(function(c) { return c && c.length > 2 && c.length < 40; });
          if (cls.length > 0) return '.' + cls.slice(0, 2).join('.');
          var tag = el.tagName.toLowerCase();
          var dAttrs = [];
          for (var ai = 0; ai < el.attributes.length; ai++) {
            if (el.attributes[ai].name.startsWith('data-') && el.attributes[ai].value && el.attributes[ai].value.length < 30) {
              dAttrs.push('[' + el.attributes[ai].name + ']');
            }
          }
          if (dAttrs.length > 0) return tag + dAttrs.slice(0, 2).join('');
          return tag;
        }

        // Mintlify mapping suggestions
        function __suggestMintlify(name) {
          var l = (name || '').toLowerCase();
          if (/alert|notice|callout|admonition|warning|caution|danger/.test(l)) {
            if (/warning|caution/.test(l)) return 'Warning';
            if (/danger|error|critical/.test(l)) return 'Danger';
            if (/info|information/.test(l)) return 'Info';
            if (/tip|hint/.test(l)) return 'Tip';
            if (/success|check/.test(l)) return 'Check';
            return 'Note';
          }
          if (/\\bcard\\b|tile|feature/.test(l)) return 'Card';
          if (/accordion|collapsible|expandable/.test(l)) return 'Accordion';
          if (/\\btab\\b|\\btabs\\b/.test(l)) return 'Tabs';
          if (/\\bstep\\b|\\bsteps\\b|procedure/.test(l)) return 'Steps';
          if (/tooltip|popover/.test(l)) return 'Tooltip';
          if (/\\bnote\\b/.test(l)) return 'Note';
          return null;
        }

        // Check if element is a styling wrapper
        function __isStylingWrapper(el) {
          try {
            if (el.children.length !== 1) return false;
            var ct = (el.textContent || '').trim();
            var cct = (el.children[0].textContent || '').trim();
            if (ct.length > 0 && cct.length > 0 && cct.length >= ct.length * 0.95) return true;
          } catch(e) {}
          return false;
        }

        // --- Data-attribute-driven component detection ---
        try {
          var __dcEls = scopeEl.querySelectorAll('[data-component], [data-widget], [data-type], [data-block-type], [data-block], [data-element-type], [data-element]');
          for (var __di = 0; __di < __dcEls.length; __di++) {
            var __dcEl = __dcEls[__di];
            if (ccSeen.has(__dcEl)) continue;
            if (__isChrome(__dcEl)) continue;
            ccSeen.add(__dcEl);
            var __dcType = __dcEl.getAttribute('data-component') || __dcEl.getAttribute('data-widget') || __dcEl.getAttribute('data-type') || __dcEl.getAttribute('data-block-type') || __dcEl.getAttribute('data-block') || __dcEl.getAttribute('data-element-type') || __dcEl.getAttribute('data-element') || 'data-component';
            var __dcMint = __suggestMintlify(__dcType);
            contentComps.push({ type: 'data-attr:' + __dcType, selector: ccSelectorHint(__dcEl), count: 1, confidence: 'high', suggestedMintlify: __dcMint, sampleHtml: (__dcEl.innerHTML || '').substring(0, 300), sampleText: (__dcEl.textContent || '').trim().substring(0, 100) });
          }
        } catch(e) {}

        // --- data-testid component detection ---
        try {
          var __compTestIdRe = /callout|alert|card|tab|accordion|step|tooltip|banner|modal|widget|component|block/i;
          var __tiEls = scopeEl.querySelectorAll('[data-testid]');
          for (var __tii = 0; __tii < __tiEls.length; __tii++) {
            var __tiEl = __tiEls[__tii];
            if (ccSeen.has(__tiEl)) continue;
            if (__isChrome(__tiEl)) continue;
            var __tid = __tiEl.getAttribute('data-testid') || '';
            if (__compTestIdRe.test(__tid)) {
              ccSeen.add(__tiEl);
              var __tiMint = __suggestMintlify(__tid);
              contentComps.push({ type: 'data:testid-' + __tid, selector: '[data-testid="' + __tid + '"]', count: 1, confidence: 'medium', suggestedMintlify: __tiMint, sampleHtml: (__tiEl.innerHTML || '').substring(0, 300), sampleText: (__tiEl.textContent || '').trim().substring(0, 100) });
            }
          }
        } catch(e) {}

        // --- Highly Optimized Hybrid Visual & Semantic Detection ---
        try {
          var baseBg = window.getComputedStyle(document.body).backgroundColor || 'rgba(0, 0, 0, 0)';

          var semanticKeywords = [
            'card', 'alert', 'badge', 'banner', 'panel', 'tooltip', 'modal', 'accordion', 'tab',
            'callout', 'note', 'warning', 'tip', 'info', 'step', 'admonition', 'notice', 'caution',
            'danger', 'success', 'hint', 'summary'
          ];

          // Component-like class pattern (hyphenated multi-word names like alert-box, info-panel)
          var __compClassRe = /^[a-z]+-(?:box|panel|card|section|block|banner|bar|group|list|item|wrap|wrapper|container|content|header|footer|body|title|label|icon|text|link|btn|button|field|form|nav|menu|tab|step|badge|tag|alert|note|tip|info|warning|danger|success|error|callout|accordion|modal|popup|tooltip|dropdown|toggle|slider|carousel|hero|feature|grid|row|col|column|divider|overlay|loader|spinner|avatar|chip|pill|timeline|progress|skeleton|breadcrumb|pagination|stepper|demo|example|player|embed|widget|module|component|element)s?$/i;

          // Construct a massive generic query selector to offload finding nodes to the C++ browser engine
          var semanticQueries = semanticKeywords.map(function(k) { return '[class*="' + k + '" i], [id*="' + k + '" i], [data-testid*="' + k + '" i]'; });

          // Include tags
          semanticQueries.push('aside', 'details', 'dialog', 'figure', 'blockquote');

          // Visual Queries: CSS-in-JS classes often start with css- or sc-, and tailwind backgrounds/borders
          var visualQueries = [
              '[class^="css-"]', '[class*=" css-"]', '[class^="sc-"]', '[class*=" sc-"]',
              '[class*="bg-"]', '[class*="border"]', '[class*="shadow"]', '[class*="rounded"]'
          ];

          var allQueries = semanticQueries.concat(visualQueries).join(', ');
          var candidateEls = scopeEl.querySelectorAll(allQueries);

          // Utility blocklist
          var utilityPrefixes = ['mt-', 'mb-', 'ml-', 'mr-', 'mx-', 'my-', 'pt-', 'pb-', 'pl-', 'pr-', 'px-', 'py-', 'text-', 'flex', 'grid', 'max-', 'min-', 'w-', 'h-', 'opacity-', 'cursor-', 'hover:', 'focus:', 'dark:'];

          for (var i = 0; i < candidateEls.length; i++) {
            // Limit to 1000 evaluations to absolutely prevent any crashes
            if (i > 1000) break;

            var el = candidateEls[i];
            if (ccSeen.has(el)) continue;
            if (__isChrome(el)) continue;

            var tName = el.tagName.toLowerCase();
            if (tName === 'path' || tName === 'svg' || tName === 'img' || tName === 'code' || tName === 'span' || tName === 'a') continue;
            if (el.innerText.trim().length < 5 && el.querySelectorAll('img, svg').length === 0) continue;
            if (el.clientHeight > window.innerHeight * 1.5) continue; // Skip huge layout wrappers
            // Skip styling wrappers
            if (__isStylingWrapper(el)) continue;

            var elClass = (el.className || '').toString();
            var elId = el.id || '';
            var elTest = el.getAttribute('data-testid') || '';
            var combinedStr = (elClass + ' ' + elId + ' ' + elTest).toLowerCase();

            var matchedTerm = null;
            var isVisualBox = false;
            var visualTraits = [];

            // 1. Check for Semantic Keyword Matches
            for (var k = 0; k < semanticKeywords.length; k++) {
                if (combinedStr.indexOf(semanticKeywords[k]) !== -1) {
                    var classes = elClass.split(/\\s+/);
                    var exactClass = null;
                    for (var c = 0; c < classes.length; c++) {
                        if (classes[c].toLowerCase().indexOf(semanticKeywords[k]) !== -1) {
                            var isUtil = false;
                            for (var u = 0; u < utilityPrefixes.length; u++) {
                                if (classes[c].indexOf(utilityPrefixes[u]) === 0) { isUtil = true; break; }
                            }
                            if (!isUtil) { exactClass = classes[c]; break; }
                        }
                    }
                    matchedTerm = exactClass || semanticKeywords[k];
                    break;
                }
            }

            // 1b. BEM detection: block__element--modifier -> group by block
            if (!matchedTerm) {
                var __bemClasses = elClass.split(/\\s+/);
                for (var __bi = 0; __bi < __bemClasses.length; __bi++) {
                    var __bc = __bemClasses[__bi];
                    if (!__bc || __bc.length < 3) continue;
                    var isUtilBem = false;
                    for (var __bui = 0; __bui < utilityPrefixes.length; __bui++) {
                        if (__bc.indexOf(utilityPrefixes[__bui]) === 0) { isUtilBem = true; break; }
                    }
                    if (isUtilBem) continue;
                    if (__bc.indexOf('__') !== -1) { matchedTerm = __bc.split('__')[0]; break; }
                    if (__bc.indexOf('--') !== -1) { matchedTerm = __bc.split('--')[0]; break; }
                    // Component-like class patterns (alert-box, info-panel, feature-card)
                    if (__compClassRe.test(__bc.toLowerCase())) { matchedTerm = __bc; break; }
                }
            }

            if (!matchedTerm && ['aside', 'details', 'dialog', 'figure', 'blockquote'].indexOf(tName) !== -1) {
                matchedTerm = tName;
            }

            // 2. If no semantic match, check CSS-OM Visual Traits
            if (!matchedTerm) {
                var style = window.getComputedStyle(el);

                var bg = style.backgroundColor;
                if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && bg !== baseBg) {
                   isVisualBox = true;
                   visualTraits.push('bg-colored');
                }

                var borderWidth = parseFloat(style.borderWidth) || 0;
                var hasShadow = style.boxShadow && style.boxShadow !== 'none';
                if (borderWidth > 0 || hasShadow) {
                   isVisualBox = true;
                   visualTraits.push('bordered');
                }

                if (isVisualBox) {
                    var guess = 'box';
                    if (visualTraits.indexOf('bg-colored') !== -1) guess = 'panel';
                    if (visualTraits.indexOf('bordered') !== -1) guess = 'card';
                    matchedTerm = 'visual:' + guess + ' (' + visualTraits.join('-') + ')';
                }
            }

            // 3. Register Component
            if (matchedTerm) {
               ccSeen.add(el);

               // Prevent registering all children of a known visual box to reduce noise
               var children = el.querySelectorAll('*');
               for(var cst = 0; cst < children.length && cst < 20; cst++) {
                   ccSeen.add(children[cst]);
               }

               var typePrefix = matchedTerm.startsWith('visual:') ? '' : 'semantic:';
               var __mint = __suggestMintlify(matchedTerm);
               contentComps.push({ type: typePrefix + matchedTerm, selector: ccSelectorHint(el), count: 1, confidence: 'high', suggestedMintlify: __mint, sampleHtml: (el.innerHTML || '').substring(0, 300), sampleText: (el.textContent || '').trim().substring(0, 100) });
            }
          }

          // Data attributes generic widget capture
          var wEls = scopeEl.querySelectorAll('[data-src]:not(img):not(video):not(iframe), [data-embed], [data-widget-id], [data-embed-id], [data-integration]');
          for (var wi = 0; wi < wEls.length; wi++) {
            var wEl = wEls[wi];
            if (ccSeen.has(wEl)) continue;
            if (__isChrome(wEl)) continue;
            ccSeen.add(wEl);
            var wType = wEl.getAttribute('data-embed') || wEl.getAttribute('data-widget-id') || wEl.getAttribute('data-integration') || 'widget';
            contentComps.push({ type: 'widget:' + wType, selector: ccSelectorHint(wEl), count: 1, confidence: 'high', suggestedMintlify: null, sampleHtml: (wEl.innerHTML || '').substring(0, 300), sampleText: (wEl.textContent || '').trim().substring(0, 100) });
          }
        } catch(e) {}

        // --- Interactive Widgets Detection (page-level) ---
        try {
          // Toggle switches
          var __toggleEls = scopeEl.querySelectorAll('input[type="checkbox"][class*="toggle"], input[type="checkbox"][role="switch"], [class*="toggle-switch"], [class*="switch"][role="switch"]');
          if (__toggleEls.length > 0) __iwWidgets.push({ type: 'toggle', selector: ccSelectorHint(__toggleEls[0]), count: __toggleEls.length, hasUserInput: true });

          // Sliders / ranges
          var __sliderEls = scopeEl.querySelectorAll('input[type="range"], [role="slider"]');
          if (__sliderEls.length > 0) __iwWidgets.push({ type: 'slider', selector: ccSelectorHint(__sliderEls[0]), count: __sliderEls.length, hasUserInput: true });

          // Search bars within content (not main site search)
          var __searchEls = scopeEl.querySelectorAll('input[type="search"], [role="searchbox"]');
          var __searchCount = 0;
          for (var __sci = 0; __sci < __searchEls.length; __sci++) {
            if (!__isChrome(__searchEls[__sci])) __searchCount++;
          }
          if (__searchCount > 0) __iwWidgets.push({ type: 'search', selector: 'input[type="search"]', count: __searchCount, hasUserInput: true });

          // Polls / quizzes
          var __formEls = scopeEl.querySelectorAll('form');
          var __pollCount = 0;
          var __calcCount = 0;
          for (var __fi = 0; __fi < __formEls.length; __fi++) {
            if (__isChrome(__formEls[__fi])) continue;
            if (__formEls[__fi].querySelectorAll('input[type="radio"]').length >= 2) __pollCount++;
            if (__formEls[__fi].querySelectorAll('input[type="number"]').length >= 1 && __formEls[__fi].querySelectorAll('output, [class*="result"], [class*="output"]').length >= 1) __calcCount++;
          }
          if (__pollCount > 0) __iwWidgets.push({ type: 'poll', selector: 'form', count: __pollCount, hasUserInput: true });
          if (__calcCount > 0) __iwWidgets.push({ type: 'calculator', selector: 'form', count: __calcCount, hasUserInput: true });

          // Code playgrounds
          var __pgEls = scopeEl.querySelectorAll('.monaco-editor, .CodeMirror, .ace_editor, [class*="code-playground"], [class*="code-editor"], [class*="live-editor"], [class*="interactive-code"]');
          if (__pgEls.length > 0) __iwWidgets.push({ type: 'playground', selector: ccSelectorHint(__pgEls[0]), count: __pgEls.length, hasUserInput: true });

          // Copy buttons
          var __cpEls = scopeEl.querySelectorAll('[class*="copy-button"], [class*="copy-btn"], [class*="clipboard"], button[data-clipboard]');
          if (__cpEls.length > 0) __iwWidgets.push({ type: 'copy-button', selector: ccSelectorHint(__cpEls[0]), count: __cpEls.length, hasUserInput: false });

          // Color pickers
          var __colEls = scopeEl.querySelectorAll('input[type="color"], [class*="color-picker"], [class*="colorpicker"]');
          if (__colEls.length > 0) __iwWidgets.push({ type: 'color-picker', selector: ccSelectorHint(__colEls[0]), count: __colEls.length, hasUserInput: true });

          // Date pickers
          var __dtEls = scopeEl.querySelectorAll('input[type="date"], input[type="datetime-local"], [class*="date-picker"], [class*="datepicker"]');
          if (__dtEls.length > 0) __iwWidgets.push({ type: 'date-picker', selector: ccSelectorHint(__dtEls[0]), count: __dtEls.length, hasUserInput: true });
        } catch(e) {}

        // Aggregate semantic components for this page
        var cTagsResult = Object.entries(customTags)
          .map(([tag, count]) => ({ tag, count }))
          .filter(c => c.count > 0);

        var ccAgg = {};
        for (var agi = 0; agi < contentComps.length; agi++) {
          var ccItem = contentComps[agi];
          if (!ccAgg[ccItem.type]) {
            ccAgg[ccItem.type] = { type: ccItem.type, tag: ccItem.type, selector: ccItem.selector, count: 0, confidence: ccItem.confidence, suggestedMintlify: ccItem.suggestedMintlify || null, sampleHtml: ccItem.sampleHtml || '', sampleText: ccItem.sampleText || '' };
          }
          ccAgg[ccItem.type].count += ccItem.count;
        }
        var semanticResults = Object.keys(ccAgg).map(function(k) { return ccAgg[k]; });

        result.customComponents = cTagsResult.sort((a, b) => b.count - a.count).slice(0, 20);
        result.contentComponents = semanticResults.sort(function(a, b) { return b.count - a.count; }).slice(0, 40);
        result.interactiveWidgets = __iwWidgets;

        // ---- Special Content Detection (scoped) ----
        const embedProviders = [
          { name: 'CodePen', sel: 'iframe[src*="codepen.io"], .codepen' },
          { name: 'CodeSandbox', sel: 'iframe[src*="codesandbox.io"]' },
          { name: 'StackBlitz', sel: 'iframe[src*="stackblitz.com"]' },
          { name: 'Replit', sel: 'iframe[src*="repl.it"], iframe[src*="replit.com"]' },
          { name: 'JSFiddle', sel: 'iframe[src*="jsfiddle.net"]' },
          { name: 'GitHub Gist', sel: 'script[src*="gist.github.com"]' },
          { name: 'RunKit', sel: 'iframe[src*="runkit.com"], .runkit-embed' },
          { name: 'Observable', sel: 'iframe[src*="observablehq.com"]' },
          { name: 'Figma', sel: 'iframe[src*="figma.com"]' },
        ];
        for (const ep of embedProviders) {
          try {
            const count = scopeEl.querySelectorAll(ep.sel).length;
            if (count > 0) result.specialContent.thirdPartyEmbeds.push({ provider: ep.name, count });
          } catch(e) {}
        }
        result.specialContent.mathContent = scopeEl.querySelectorAll('.MathJax, .katex, .math-display, math, .MathJax_Display, [class*="math-inline"], script[type="math/tex"], script[type*="mathjax"], .arithmatex').length;
        result.specialContent.diagramContent = scopeEl.querySelectorAll('.mermaid, pre.mermaid, [data-mermaid], .drawio, [class*="diagram-container"], .plantuml, .graphviz, [class*="d2-"], .kroki').length;
        result.specialContent.codePlaygrounds = scopeEl.querySelectorAll('iframe[src*="codepen.io"], iframe[src*="codesandbox.io"], iframe[src*="stackblitz.com"], iframe[src*="repl.it"], iframe[src*="replit.com"], iframe[src*="jsfiddle.net"]').length;

        // ---- Content Metrics (scoped) ----
        var mainEl = contentContainer;
        if (!mainEl && !contentSelectorParam) {
          var bodyTextLen = (document.body.innerText || '').length;
          if (bodyTextLen > 0) {
            var mainCandidates = [
              '.theme-doc-markdown', 'article.docusaurus-mt-lg',
              '.md-content article', '.md-content',
              'main article', '.VPDoc .vp-doc', '.vp-doc',
              '[role="main"] article', '.document .documentwrapper',
              '.nextra-content', '.sl-markdown-content', '.prose',
              'article', 'main', '[role="main"]', '.content', '#content'
            ];
            var bestEl = null;
            var bestRatio = 0;
            for (var ci = 0; ci < mainCandidates.length; ci++) {
              try {
                var candidate = document.querySelector(mainCandidates[ci]);
                if (!candidate) continue;
                var elTextLen = (candidate.innerText || '').length;
                var ratio = elTextLen / bodyTextLen;
                if (ratio >= 0.10 && ratio <= 0.95 && ratio > bestRatio) {
                  bestRatio = ratio;
                  bestEl = candidate;
                }
              } catch(e) {}
            }
            mainEl = bestEl || document.body;
          } else {
            mainEl = document.body;
          }
        }
        const textContent = mainEl ? (mainEl.innerText || '') : '';
        result.wordCount = textContent.split(/\\s+/).filter(w => w.length > 0).length;

        // Headings
        for (let level = 1; level <= 6; level++) {
          result.headings['h' + level] = scopeEl.querySelectorAll('h' + level).length;
        }

        // Code blocks
        const codeEls = scopeEl.querySelectorAll('pre > code, pre.highlight, .code-block, pre[class*="language-"]');
        result.codeBlocks.count = codeEls.length;
        const codeLangs = new Set();
        codeEls.forEach(el => {
          const classes = (el.className || '') + ' ' + ((el.parentElement || {}).className || '');
          const langMatch = classes.match(/(?:language-|lang-)([\\w+#-]+)/);
          if (langMatch) codeLangs.add(langMatch[1].toLowerCase());
        });
        result.codeBlocks.languages = Array.from(codeLangs);

        // Tables
        const tables = scopeEl.querySelectorAll('table');
        result.tables.count = tables.length;
        let totalRows = 0;
        tables.forEach(t => { totalRows += t.querySelectorAll('tr').length; });
        result.tables.totalRows = totalRows;

        // Images
        const imgs = scopeEl.querySelectorAll('img');
        result.images.count = imgs.length;
        let externalImgs = 0;
        imgs.forEach(img => {
          const src = img.getAttribute('src') || '';
          try {
            if (src.startsWith('http') && new URL(src).origin !== baseOrigin) externalImgs++;
          } catch {}
        });
        result.images.external = externalImgs;

        // Lists
        result.lists.ordered = scopeEl.querySelectorAll('ol').length;
        result.lists.unordered = scopeEl.querySelectorAll('ul').length;

        // ---- Interactive Elements ----
        result.tabs = scopeEl.querySelectorAll('.tabs, [role="tablist"], .tab-container, mdx-tabs, div[data-tabs], [class*="tab-panel"]').length;
        result.accordions = scopeEl.querySelectorAll('.accordion, details, [data-accordion], .collapsible, .expandable, [class*="accordion"]').length;

        // Download links
        const downloadExts = ['.pdf', '.zip', '.csv', '.xlsx', '.docx', '.dmg', '.exe', '.pkg', '.tar.gz'];
        const dlExtSet = new Set();
        let dlCount = 0;
        scopeEl.querySelectorAll('a[href]').forEach(a => {
          const href = (a.getAttribute('href') || '').toLowerCase();
          const hasDownloadAttr = a.hasAttribute('download');
          const matchedExt = downloadExts.find(ext => href.endsWith(ext));
          if (matchedExt || hasDownloadAttr) {
            dlCount++;
            if (matchedExt) dlExtSet.add(matchedExt);
            else if (hasDownloadAttr) {
              const ext = href.match(/\\.([a-z0-9]+)$/i);
              if (ext) dlExtSet.add('.' + ext[1]);
            }
          }
        });
        result.downloadLinks = { count: dlCount, extensions: Array.from(dlExtSet) };

        // Forms
        result.forms = scopeEl.querySelectorAll('form').length;

        // Iframes (non-video)
        let iframeCount = 0;
        scopeEl.querySelectorAll('iframe').forEach(iframe => {
          const src = (iframe.getAttribute('src') || '').toLowerCase();
          if (!/youtube|youtu\\.be|vimeo|loom|wistia|zendesk/.test(src)) iframeCount++;
        });
        result.iframes = iframeCount;

        // Tooltips
        result.tooltips = scopeEl.querySelectorAll('[data-tooltip], .tooltip, [aria-describedby]').length;

        // ---- API / Playground (scoped) ----
        const specLinks = new Set();
        scopeEl.querySelectorAll('a[href*="swagger"], a[href*="openapi"], link[href*="swagger"]').forEach(el => {
          specLinks.add(el.getAttribute('href') || '');
        });
        scopeEl.querySelectorAll('a[href$=".yaml"], a[href$=".json"]').forEach(el => {
          const href = el.getAttribute('href') || '';
          if (/openapi|swagger/i.test(href)) specLinks.add(href);
          else if (/api[_-]?spec|spec[_-]?api/i.test(href)) specLinks.add(href);
        });
        result.openApiSpecs = Array.from(specLinks).filter(Boolean);

        // Always check full document for API playgrounds (scopeEl may be empty div when content selector not found)
        var apiDetectEl = document.body;

        // --- URL-based playground detection ---
        var urlPath = window.location.pathname.toLowerCase();
        var urlIsApiPlayground = false;
        // Common URL patterns for API playground/reference pages
        if (/\/(?:api-reference|api-playground|api-explorer|playground|try-it|tryit)(?:\/|$)/.test(urlPath)) {
          urlIsApiPlayground = true;
        }
        // Swagger/Redoc/GraphQL standalone pages
        if (/\/(?:swagger|redoc|graphql-playground|graphiql)(?:\/|$)/.test(urlPath)) {
          urlIsApiPlayground = true;
        }

        // --- DOM-based playground detection (existing + new selectors) ---
        // Only selectors for interactive API playgrounds (not passive API docs)
        var playgroundCountSel = [
          // Known API doc renderers (always interactive)
          '.swagger-ui', '.redoc-wrap', 'redoc', 'rapidoc', 'rapi-doc',
          '.scalar-app', '#scalar-api-reference', 'scalar-api-reference',
          'elements-api', '.sl-elements',
          'bump-api-reference',
          '.api-playground', '.rm-TryItOut', '.rm-APIMethod', '.api-explorer',
          '[id^="api-playground"]', '.tryit-button',
          // Mintlify API playground (interactive elements only)
          '.openapi-content', '[data-testid*="playground"]',
          // Stoplight TryIt panel
          '.TryItPanel', '[class*="TryIt"]',
          // ReadMe TryIt
          '.rm-TryIt', '.rm-RequestForm', '[class*="TryItNow"]',
          // Postman
          '.postman-run-button', '[data-postman]', '.postman-embed',
          // Insomnia
          '[class*="insomnia-"]',
          // Generic interactive API elements
          '.endpoint-playground', '.api-tester',
          '[class*="api-playground"]', '[class*="try-it"]',
          '[class*="request-builder"]', '[class*="api-console"]',
        ].join(', ');
        try {
          result.apiPlaygrounds = apiDetectEl.querySelectorAll(playgroundCountSel).length;
        } catch(e) {
          result.apiPlaygrounds = 0;
        }

        var detectedPlaygroundTypes = [];
        var typeChecks = [
          { sel: '.swagger-ui', type: 'swagger-ui' },
          { sel: '.redoc-wrap, redoc', type: 'redoc' },
          { sel: 'rapidoc, rapi-doc', type: 'rapidoc' },
          { sel: '.scalar-app, #scalar-api-reference, scalar-api-reference', type: 'scalar' },
          { sel: 'elements-api, .sl-elements, .TryItPanel, [class*="TryIt"]', type: 'stoplight' },
          { sel: 'bump-api-reference', type: 'bump' },
          { sel: '.api-playground, [id^="api-playground"], .api-section, .tryit-button, .method-pill, .openapi-content, .openapi-method, .openapi-schemas, [data-testid*="playground"], .param-field', type: 'mintlify-api' },
          { sel: '.rm-TryItOut, .rm-APIMethod, .rm-TryIt, .rm-RequestForm, [class*="TryItNow"]', type: 'readme' },
          { sel: '.postman-run-button, [data-postman], .postman-embed', type: 'postman' },
          { sel: '[class*="insomnia-"]', type: 'insomnia' },
          { sel: '.api-explorer, .endpoint-playground, .api-tester, [class*="api-console"]', type: 'generic' },
        ];
        for (var tci = 0; tci < typeChecks.length; tci++) {
          try {
            if (apiDetectEl.querySelector(typeChecks[tci].sel)) detectedPlaygroundTypes.push(typeChecks[tci].type);
          } catch(e) {}
        }

        // --- Interactive element detection (Try-it buttons, request builders) ---
        try {
          // "Try it" / "Send request" / "Execute" buttons
          var tryItButtons = apiDetectEl.querySelectorAll('button, [role="button"], a.btn, a.button');
          var hasTryItButton = false;
          for (var tib = 0; tib < tryItButtons.length; tib++) {
            var btnText = (tryItButtons[tib].textContent || '').trim().toLowerCase();
            if (/^(try it|try it out|send request|send|execute|run|test endpoint|test api|make request)$/i.test(btnText)) {
              hasTryItButton = true;
              break;
            }
          }
          if (hasTryItButton && detectedPlaygroundTypes.length === 0) {
            detectedPlaygroundTypes.push('generic');
            if (result.apiPlaygrounds === 0) result.apiPlaygrounds = 1;
          }

          // Request builder forms (HTTP method selector + URL input within API context)
          var hasRequestBuilder = !!(
            apiDetectEl.querySelector('select option[value="GET"], select option[value="POST"]') &&
            apiDetectEl.querySelector('input[placeholder*="url" i], input[placeholder*="endpoint" i], input[name*="url" i]')
          );
          if (hasRequestBuilder && detectedPlaygroundTypes.length === 0) {
            detectedPlaygroundTypes.push('generic');
            if (result.apiPlaygrounds === 0) result.apiPlaygrounds = 1;
          }

          // Response code tabs (200, 400, 401, 404, 500)
          var responseCodeEls = apiDetectEl.querySelectorAll('[class*="response-code"], [class*="status-code"], [data-status-code]');
          var responseCodeCount = 0;
          for (var rci = 0; rci < responseCodeEls.length; rci++) {
            var rcText = (responseCodeEls[rci].textContent || '').trim();
            if (/^[1-5]\d{2}$/.test(rcText)) responseCodeCount++;
          }
          // If we see 3+ HTTP status codes displayed, it's likely an API page with response examples
          if (responseCodeCount >= 3 && detectedPlaygroundTypes.length === 0) {
            detectedPlaygroundTypes.push('generic');
          }
        } catch(e) {}

        // URL-based type inference when no DOM type found BUT we know it's a playground from other signals
        if (detectedPlaygroundTypes.length === 0 && urlIsApiPlayground && result.apiPlaygrounds > 0) {
          if (/swagger/.test(urlPath)) detectedPlaygroundTypes.push('swagger-ui');
          else if (/redoc/.test(urlPath)) detectedPlaygroundTypes.push('redoc');
          else if (/graphql/.test(urlPath)) detectedPlaygroundTypes.push('graphql');
          else detectedPlaygroundTypes.push('generic');
        }

        result.playgroundTypes = detectedPlaygroundTypes;

        // GraphQL explorers (check full document)
        result.graphqlExplorers = apiDetectEl.querySelectorAll('.graphiql, [class*="graphql-explorer"], .graphql-playground, [class*="GraphiQL"], [class*="graphql-ide"]').length;

        // ---- API Reference Page Detection (always check full document) ----
        let apiRefSignals = 0;
        const fullBodyText = (document.body.innerText || '');

        // Signal 1: HTTP method + path patterns in text (e.g. "GET /api/v1/users")
        try {
          const httpMethodMatches = fullBodyText.match(/(GET|POST|PUT|PATCH|DELETE)\s+\/[a-zA-Z0-9\/{}_.-]+/g);
          if (httpMethodMatches && httpMethodMatches.length >= 2) apiRefSignals += 2;
        } catch(e) {}

        // Signal 2: Response/request panels
        try {
          const responsePanels = apiDetectEl.querySelectorAll('[class*="response-code"], [class*="response-body"], [class*="request-body"], [class*="response-panel"], [class*="request-panel"]').length;
          if (responsePanels >= 2) apiRefSignals++;
        } catch(e) {}

        // Signal 3: Parameter documentation elements
        try {
          const paramElements = apiDetectEl.querySelectorAll('[class*="param-"], [class*="parameter"], .api-field, [class*="field-list"], .primitive-param-field, .object-param-field, [class*="param-field"], [class*="query-param"], [class*="path-param"], [class*="header-param"], [class*="body-param"]').length;
          if (paramElements >= 3) apiRefSignals++;
        } catch(e) {}

        // Signal 4: Authentication/security panels
        try {
          const authPanels = apiDetectEl.querySelectorAll('[class*="authorization"], [class*="security-scheme"], [class*="auth-scheme"], [class*="api-key"], [class*="bearer-token"]').length;
          if (authPanels > 0) apiRefSignals++;
        } catch(e) {}

        // Signal 5: URL pattern detection (api-reference, reference, api paths)
        try {
          if (/\/(?:api-reference|api-ref|reference\/api|api\/v?\d|apis\/)/.test(urlPath)) apiRefSignals++;
        } catch(e) {}

        // Signal 6: HTTP method badges (colored labels with GET/POST/PUT/DELETE/PATCH)
        try {
          var methodBadges = apiDetectEl.querySelectorAll('[class*="method-badge"], [class*="http-badge"], [class*="method-pill"], [class*="http-method"], [class*="api-method"]');
          var badgeCount = 0;
          for (var mb = 0; mb < methodBadges.length; mb++) {
            var mbText = (methodBadges[mb].textContent || '').trim().toUpperCase();
            if (/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$/.test(mbText)) badgeCount++;
          }
          if (badgeCount >= 2) apiRefSignals++;
        } catch(e) {}

        // Signal 7: Endpoint path elements (displayed API paths like /v1/users/{id})
        try {
          var endpointEls = apiDetectEl.querySelectorAll('[class*="endpoint-url"], [class*="endpoint-path"], [class*="api-path"], [class*="base-url"], code[class*="endpoint"]');
          if (endpointEls.length >= 1) apiRefSignals++;
        } catch(e) {}

        // Signal 8: Response schema/model sections
        try {
          var schemaEls = apiDetectEl.querySelectorAll('[class*="response-schema"], [class*="request-schema"], [class*="schema-table"], [class*="model-"], [class*="properties-table"]').length;
          if (schemaEls >= 1) apiRefSignals++;
        } catch(e) {}

        result.isApiReferencePage = apiRefSignals >= 2 || result.apiPlaygrounds > 0;

        // ---- Enhanced API Documentation Detection ----
        // Detects specific API doc tools, endpoints, auth methods, and produces
        // apiDocDetails, detectedApiSpecs, apiEndpoints, apiType, apiConfidenceScore, interactiveWidgets
        try {
          var __apiDocDetails = [];
          var __detectedApiSpecs = [];
          var __apiEndpoints = [];
          var __apiWeightedScore = 0; // accumulate weighted score for apiConfidenceScore

          // --- Helper: count endpoints on page (method badges + path displays) ---
          function __countEndpoints() {
            var count = 0;
            try {
              // Method badges next to paths
              var methodEls = apiDetectEl.querySelectorAll('[class*="method"], [class*="http-"], [class*="endpoint"], [class*="operation"]');
              for (var mei = 0; mei < methodEls.length; mei++) {
                var meText = (methodEls[mei].textContent || '').trim().toUpperCase();
                if (/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$/.test(meText)) count++;
              }
              // Also count from visible text patterns like "GET /api/users"
              var bodyText = (apiDetectEl.innerText || '');
              var endpointMatches = bodyText.match(/(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\/[a-zA-Z0-9\/{}_.\-:]+/g);
              if (endpointMatches) {
                // Deduplicate
                var seen = {};
                for (var emi = 0; emi < endpointMatches.length; emi++) {
                  if (!seen[endpointMatches[emi]]) {
                    seen[endpointMatches[emi]] = true;
                    if (count === 0) count++;
                    else count++;
                  }
                }
              }
            } catch(e) {}
            return count;
          }

          // --- Helper: detect auth methods on page ---
          function __detectAuthMethods() {
            var methods = [];
            try {
              var fullText = (apiDetectEl.innerText || '').toLowerCase();
              var fullHtml = (apiDetectEl.innerHTML || '').toLowerCase();
              if (/bearer\s+token|authorization:\s*bearer|bearer\s+auth/i.test(fullText) || /bearer-token|class="[^"]*bearer/i.test(fullHtml)) methods.push('Bearer');
              if (/api[_\s-]?key/i.test(fullText) || /class="[^"]*api-key/i.test(fullHtml)) methods.push('API Key');
              if (/oauth\s*2|oauth2/i.test(fullText) || /class="[^"]*oauth/i.test(fullHtml)) methods.push('OAuth2');
              if (/basic\s+auth|authorization:\s*basic/i.test(fullText) || /class="[^"]*basic-auth/i.test(fullHtml)) methods.push('Basic');
              if (/x-api-key|x-auth-token/i.test(fullText)) methods.push('Custom Header');
              if (/cookie\s+auth|session\s+cookie/i.test(fullText)) methods.push('Cookie');
            } catch(e) {}
            return methods.length > 0 ? methods : undefined;
          }

          // --- Helper: detect "try it" / playground capability ---
          function __detectTryIt() {
            var hasTryIt = false;
            try {
              var btns = apiDetectEl.querySelectorAll('button, [role="button"], a.btn, a.button, input[type="submit"]');
              for (var bi = 0; bi < btns.length; bi++) {
                var bText = (btns[bi].textContent || '').trim().toLowerCase();
                if (/^(try it|try it out|send request|send|execute|run|test endpoint|test api|make request|test|try|try it!|send api request)$/i.test(bText)) {
                  hasTryIt = true;
                  break;
                }
              }
            } catch(e) {}
            return hasTryIt;
          }

          var __endpointCount = __countEndpoints();
          var __authMethods = __detectAuthMethods();
          var __hasTryItGlobal = __detectTryIt();

          // --- API Tool Detection ---
          // Each check: detect tool, assign confidence, build apiDocDetails entry

          // Swagger UI
          try {
            var swaggerEl = apiDetectEl.querySelector('.swagger-ui, #swagger-ui, [class*="swagger-ui"]');
            if (swaggerEl || apiDetectEl.querySelector('swagger-ui')) {
              var swVer = undefined;
              try {
                var swVerEl = apiDetectEl.querySelector('.info .version, .swagger-ui .version');
                if (swVerEl) swVer = (swVerEl.textContent || '').trim();
              } catch(e) {}
              __apiDocDetails.push({
                toolType: 'swagger-ui',
                confidence: 'high',
                version: swVer,
                endpointCount: __endpointCount || undefined,
                authMethods: __authMethods,
                hasPlayground: true,
                hasTryIt: true
              });
              __apiWeightedScore += 40;
            }
          } catch(e) {}

          // Redoc
          try {
            var redocEl = apiDetectEl.querySelector('redoc, .redoc-wrap, [class*="redoc"]');
            if (redocEl) {
              __apiDocDetails.push({
                toolType: 'redoc',
                confidence: 'high',
                endpointCount: __endpointCount || undefined,
                authMethods: __authMethods,
                hasPlayground: false,
                hasTryIt: false
              });
              __apiWeightedScore += 35;
            }
          } catch(e) {}

          // Scalar
          try {
            var scalarEl = apiDetectEl.querySelector('scalar-api-reference, #scalar-api-reference, .scalar-app, [class*="scalar-api"], [data-theme-id]');
            if (scalarEl) {
              var isScalar = !!apiDetectEl.querySelector('scalar-api-reference, #scalar-api-reference, .scalar-app');
              if (!isScalar && apiDetectEl.querySelector('[data-theme-id]')) {
                // Verify data-theme-id is scalar-related
                var themeEl = apiDetectEl.querySelector('[data-theme-id]');
                isScalar = /scalar/i.test((themeEl.getAttribute('data-theme-id') || '') + ' ' + (themeEl.className || ''));
              }
              if (isScalar) {
                __apiDocDetails.push({
                  toolType: 'scalar',
                  confidence: 'high',
                  endpointCount: __endpointCount || undefined,
                  authMethods: __authMethods,
                  hasPlayground: true,
                  hasTryIt: true
                });
                __apiWeightedScore += 40;
              }
            }
          } catch(e) {}

          // RapiDoc
          try {
            if (apiDetectEl.querySelector('rapi-doc, rapidoc')) {
              __apiDocDetails.push({
                toolType: 'rapidoc',
                confidence: 'high',
                endpointCount: __endpointCount || undefined,
                authMethods: __authMethods,
                hasPlayground: true,
                hasTryIt: true
              });
              __apiWeightedScore += 40;
            }
          } catch(e) {}

          // Stoplight Elements
          try {
            var stoplightEl = apiDetectEl.querySelector('elements-api, .sl-elements, .TryItPanel, [class*="sl-elements"]');
            if (stoplightEl) {
              var hasSLTryIt = !!apiDetectEl.querySelector('.TryItPanel, [class*="TryIt"]');
              __apiDocDetails.push({
                toolType: 'stoplight',
                confidence: 'high',
                endpointCount: __endpointCount || undefined,
                authMethods: __authMethods,
                hasPlayground: hasSLTryIt,
                hasTryIt: hasSLTryIt
              });
              __apiWeightedScore += 38;
            }
          } catch(e) {}

          // Bump.sh
          try {
            if (apiDetectEl.querySelector('bump-api-reference, [class*="bump-"]')) {
              __apiDocDetails.push({
                toolType: 'bump',
                confidence: apiDetectEl.querySelector('bump-api-reference') ? 'high' : 'medium',
                endpointCount: __endpointCount || undefined,
                authMethods: __authMethods,
                hasPlayground: false,
                hasTryIt: false
              });
              __apiWeightedScore += 30;
            }
          } catch(e) {}

          // Fern
          try {
            var fernEl = apiDetectEl.querySelector('[class*="fern-"], [data-fern-docs], [data-fern]');
            if (fernEl) {
              __apiDocDetails.push({
                toolType: 'fern',
                confidence: apiDetectEl.querySelector('[data-fern-docs]') ? 'high' : 'medium',
                endpointCount: __endpointCount || undefined,
                authMethods: __authMethods,
                hasPlayground: __hasTryItGlobal,
                hasTryIt: __hasTryItGlobal
              });
              __apiWeightedScore += 30;
            }
          } catch(e) {}

          // Mintlify API
          try {
            var mintApiEl = apiDetectEl.querySelector('[id^="api-playground"], .openapi-content, .openapi-method, .openapi-schemas, .param-field, .method-pill');
            if (mintApiEl) {
              var mintHasTryIt = !!apiDetectEl.querySelector('.tryit-button, [data-testid*="playground"], .api-playground');
              __apiDocDetails.push({
                toolType: 'mintlify-api',
                confidence: 'high',
                endpointCount: __endpointCount || undefined,
                authMethods: __authMethods,
                hasPlayground: mintHasTryIt,
                hasTryIt: mintHasTryIt
              });
              __apiWeightedScore += 35;
            }
          } catch(e) {}

          // ReadMe
          try {
            var readmeApiEl = apiDetectEl.querySelector('.rm-TryItOut, .rm-APIMethod, [class*="rdmd"]');
            if (readmeApiEl) {
              var rmHasTryIt = !!apiDetectEl.querySelector('.rm-TryItOut, .rm-TryIt, .rm-RequestForm, [class*="TryItNow"]');
              __apiDocDetails.push({
                toolType: 'readme',
                confidence: 'high',
                endpointCount: __endpointCount || undefined,
                authMethods: __authMethods,
                hasPlayground: rmHasTryIt,
                hasTryIt: rmHasTryIt
              });
              __apiWeightedScore += 35;
            }
          } catch(e) {}

          // Postman
          try {
            if (apiDetectEl.querySelector('.postman-run-button, [data-postman], .postman-embed')) {
              __apiDocDetails.push({
                toolType: 'postman',
                confidence: 'high',
                authMethods: __authMethods,
                hasPlayground: true,
                hasTryIt: true
              });
              __apiWeightedScore += 25;
            }
          } catch(e) {}

          // Apidog
          try {
            if (apiDetectEl.querySelector('[class*="apidog"]')) {
              __apiDocDetails.push({
                toolType: 'apidog',
                confidence: 'medium',
                endpointCount: __endpointCount || undefined,
                authMethods: __authMethods,
                hasPlayground: __hasTryItGlobal,
                hasTryIt: __hasTryItGlobal
              });
              __apiWeightedScore += 25;
            }
          } catch(e) {}

          // GraphiQL
          try {
            if (apiDetectEl.querySelector('.graphiql, [class*="graphiql"], .graphiql-container, [class*="GraphiQL"]')) {
              __apiDocDetails.push({
                toolType: 'graphiql',
                confidence: 'high',
                authMethods: __authMethods,
                hasPlayground: true,
                hasTryIt: true
              });
              __apiWeightedScore += 40;
            }
          } catch(e) {}

          // GraphQL Playground
          try {
            if (apiDetectEl.querySelector('.graphql-playground, [class*="graphql-playground"]')) {
              __apiDocDetails.push({
                toolType: 'graphql-playground',
                confidence: 'high',
                authMethods: __authMethods,
                hasPlayground: true,
                hasTryIt: true
              });
              __apiWeightedScore += 40;
            }
          } catch(e) {}

          // --- Detect API specs (OpenAPI/Swagger/GraphQL/AsyncAPI/gRPC links and embedded) ---
          try {
            // Embedded spec detection
            if (/["']openapi["']\s*:\s*["']3/i.test(fullBodyHtml)) {
              var verMatch = fullBodyHtml.match(/["']openapi["']\s*:\s*["']([0-9.]+)["']/i);
              __detectedApiSpecs.push({ url: pageUrl, type: 'openapi', version: verMatch ? verMatch[1] : '3.0', valid: true });
            } else if (/["']swagger["']\s*:\s*["']2/i.test(fullBodyHtml)) {
              __detectedApiSpecs.push({ url: pageUrl, type: 'swagger', version: '2.0', valid: true });
            }

            // Check for AsyncAPI
            if (/["']asyncapi["']\s*:/i.test(fullBodyHtml)) {
              var asyncVerMatch = fullBodyHtml.match(/["']asyncapi["']\s*:\s*["']([0-9.]+)["']/i);
              __detectedApiSpecs.push({ url: pageUrl, type: 'asyncapi', version: asyncVerMatch ? asyncVerMatch[1] : undefined, valid: true });
            }

            // Links to spec files
            var specLinkEls = apiDetectEl.querySelectorAll('a[href*="swagger"], a[href*="openapi"], a[href$=".yaml"], a[href$=".json"], link[href*="swagger"], link[href*="openapi"]');
            for (var sli = 0; sli < specLinkEls.length; sli++) {
              var specHref = specLinkEls[sli].getAttribute('href') || '';
              if (!specHref) continue;
              var specType = 'openapi';
              if (/swagger/i.test(specHref)) specType = 'swagger';
              else if (/graphql/i.test(specHref)) specType = 'graphql';
              else if (/asyncapi/i.test(specHref)) specType = 'asyncapi';
              else if (/grpc|proto/i.test(specHref)) specType = 'grpc';
              else if (!/openapi|api[_-]?spec|spec[_-]?api/i.test(specHref) && !/\.yaml$|\.json$/i.test(specHref)) continue;
              __detectedApiSpecs.push({ url: specHref, type: specType });
            }

            // GraphQL schema detection
            if (/class="[^"]*graphql|<graphiql|graphql-playground/i.test(fullBodyHtml)) {
              var hasGraphQLSpec = false;
              for (var gsi = 0; gsi < __detectedApiSpecs.length; gsi++) {
                if (__detectedApiSpecs[gsi].type === 'graphql') { hasGraphQLSpec = true; break; }
              }
              if (!hasGraphQLSpec) {
                __detectedApiSpecs.push({ url: pageUrl, type: 'graphql' });
              }
            }
          } catch(e) {}

          // --- Extract API Endpoints from page content ---
          try {
            var bodyTextForEndpoints = (apiDetectEl.innerText || '');
            var epMatches = bodyTextForEndpoints.match(/(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\/[a-zA-Z0-9\/{}_.\-:?&=]+/g);
            if (epMatches) {
              var epSeen = {};
              for (var epi = 0; epi < epMatches.length && __apiEndpoints.length < 100; epi++) {
                var epParts = epMatches[epi].match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/[^\s]+)/);
                if (epParts && !epSeen[epParts[1] + ' ' + epParts[2]]) {
                  epSeen[epParts[1] + ' ' + epParts[2]] = true;
                  __apiEndpoints.push({ method: epParts[1], path: epParts[2] });
                }
              }
            }
          } catch(e) {}

          // --- Detect API type (rest/graphql/grpc/mixed) ---
          var __hasGraphQL = __apiDocDetails.some(function(d) { return d.toolType === 'graphiql' || d.toolType === 'graphql-playground' || d.toolType === 'generic-graphql'; });
          if (!__hasGraphQL) __hasGraphQL = /graphql|__schema|query\s*\{/i.test(fullBodyHtml);
          var __hasGrpc = /grpc|protobuf|\.proto\b/i.test(fullBodyHtml);
          var __hasRest = __apiEndpoints.length > 0 || __apiDocDetails.some(function(d) { return d.toolType !== 'graphiql' && d.toolType !== 'graphql-playground' && d.toolType !== 'generic-graphql' && d.toolType !== 'generic-grpc'; });

          if (__hasGraphQL && __hasRest) result.apiType = 'mixed';
          else if (__hasGraphQL && __hasGrpc) result.apiType = 'mixed';
          else if (__hasGraphQL) result.apiType = 'graphql';
          else if (__hasGrpc) result.apiType = 'grpc';
          else if (__hasRest) result.apiType = 'rest';

          // --- Compute weighted API confidence score (0-100) ---
          // Tool detection is the strongest signal
          if (__apiDocDetails.length > 0) __apiWeightedScore = Math.max(__apiWeightedScore, 40);
          // Method badges / endpoint patterns
          if (__endpointCount >= 5) __apiWeightedScore += 20;
          else if (__endpointCount >= 2) __apiWeightedScore += 15;
          else if (__endpointCount >= 1) __apiWeightedScore += 8;
          // API endpoints extracted
          if (__apiEndpoints.length >= 5) __apiWeightedScore += 15;
          else if (__apiEndpoints.length >= 1) __apiWeightedScore += 8;
          // Parameter/field elements
          if (apiRefSignals >= 4) __apiWeightedScore += 15;
          else if (apiRefSignals >= 2) __apiWeightedScore += 10;
          // URL patterns
          if (urlIsApiPlayground) __apiWeightedScore += 10;
          // Try-it / playground
          if (__hasTryItGlobal) __apiWeightedScore += 5;
          // Auth methods found
          if (__authMethods && __authMethods.length > 0) __apiWeightedScore += 5;
          // Specs detected
          if (__detectedApiSpecs.length > 0) __apiWeightedScore += 10;

          result.apiConfidenceScore = Math.min(100, __apiWeightedScore);
          result.apiDocDetails = __apiDocDetails;
          result.detectedApiSpecs = __detectedApiSpecs;
          result.apiEndpoints = __apiEndpoints;

          // --- API-specific Interactive Widgets (append to existing interactiveWidgets) ---
          try {
            if (result.interactiveWidgets && result.interactiveWidgets.length === 0) {
              // Only detect API-playground widgets if not already found by component detection
              var apiWidgetChecks = [
                { sel: '.swagger-ui .execute, .swagger-ui .try-out', type: 'api-playground', hasInput: true },
                { sel: 'iframe[src*="codepen"], iframe[src*="codesandbox"], iframe[src*="stackblitz"]', type: 'code-playground', hasInput: true },
              ];
              for (var wci = 0; wci < apiWidgetChecks.length; wci++) {
                try {
                  var wEls = apiDetectEl.querySelectorAll(apiWidgetChecks[wci].sel);
                  if (wEls.length > 0) {
                    result.interactiveWidgets.push({
                      type: apiWidgetChecks[wci].type,
                      selector: apiWidgetChecks[wci].sel.split(',')[0].trim(),
                      count: wEls.length,
                      hasUserInput: apiWidgetChecks[wci].hasInput
                    });
                  }
                } catch(e) {}
              }
            }
          } catch(e) {}

          // Also update isApiReferencePage with the richer data
          if (result.apiConfidenceScore >= 30 && !result.isApiReferencePage) {
            result.isApiReferencePage = true;
          }
        } catch(__apiErr) {}

        // ---- Structure ----
        const breadcrumbEl = document.querySelector('.breadcrumb, [aria-label="breadcrumb"], .breadcrumbs, [class*="breadcrumb"]');
        if (breadcrumbEl) {
          const items = breadcrumbEl.querySelectorAll('li, a');
          result.breadcrumbDepth = items.length;
        }

        const sidebarEl = document.querySelector('nav, .sidebar, [role="navigation"], aside');
        if (sidebarEl && scopePrefix) {
          let sidebarCount = 0;
          sidebarEl.querySelectorAll('a[href]').forEach(a => {
            const href = a.getAttribute('href') || '';
            try {
              let full;
              if (href.startsWith('http')) full = href;
              else if (href.startsWith('/')) full = baseOrigin + href;
              else full = new URL(href, window.location.href).href;
              if (full.startsWith(scopePrefix)) sidebarCount++;
            } catch {}
          });
          result.sidebarItems = sidebarCount;
        }

        result.hasPagination = !!(document.querySelector('.pagination, a[rel="next"], .page-nav, .next-prev, [class*="pagination"], [class*="next-page"]'));
        result.hasLanguageSwitcher = !!(
          document.querySelector('[class*="locale"], [class*="language-switch"], [class*="lang-select"], [class*="language-selector"]') ||
          document.querySelector('link[hreflang]')
        );

        // ---- Internal Link Discovery ----
        const internalLinks = new Set();
        document.querySelectorAll('a[href]').forEach(link => {
          const href = link.getAttribute('href');
          if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) return;
          try {
            let fullUrl;
            if (href.startsWith('http')) fullUrl = href;
            else if (href.startsWith('/')) fullUrl = baseOrigin + href;
            else fullUrl = new URL(href, window.location.href).href;
            const url = new URL(fullUrl);
            if (url.origin !== baseOrigin) return;
            let pathname = url.pathname.replace(/\/+/g, '/');
            let normalized = url.origin + pathname;
            if (normalized.endsWith('/') && normalized.length > baseOrigin.length + 1) {
              normalized = normalized.slice(0, -1);
            }
            if (scopePrefix && !normalized.startsWith(scopePrefix)) return;
            internalLinks.add(normalized);
          } catch {}
        });
        result.discoveredLinks = Array.from(internalLinks).slice(0, 500);

        // ---- Platform Detection ----
        let detectedPlatform = 'unknown';
        try {
          const metaGen = (document.querySelector('meta[name="generator"]') || {}).content || '';

          if (/docusaurus/i.test(metaGen) || document.querySelector('#__docusaurus_skipToContent_fallback, #__docusaurus, .theme-doc-markdown')) {
            detectedPlatform = 'docusaurus';
          } else if (/mkdocs/i.test(metaGen) || document.querySelector('.md-typeset, #__md, .md-content')) {
            detectedPlatform = 'mkdocs';
          } else if (document.querySelector('[data-testid="page.contentEditor"], .gitbook-root')) {
            detectedPlatform = 'gitbook';
          } else if (document.querySelector('#VPContent, .VPDoc, .vp-doc') || /vitepress/i.test(metaGen)) {
            detectedPlatform = 'vitepress';
          } else if (document.querySelector('script[src*="readthedocs-data"]') || /readthedocs\\.io|readthedocs\\.org/i.test(window.location.href) || (document.querySelector('.rst-content') && document.querySelector('[data-project]'))) {
            detectedPlatform = 'readthedocs';
          } else if (/sphinx/i.test(metaGen) || document.querySelector('.sphinxsidebarwrapper, .rst-content') || typeof window.DOCUMENTATION_OPTIONS !== 'undefined') {
            detectedPlatform = 'sphinx';
          } else if (document.querySelector('.nextra-sidebar-container, [class*="nextra"]') || /nextra/i.test(metaGen)) {
            detectedPlatform = 'nextra';
          } else if (document.querySelector('#starlight__sidebar, starlight-theme-select, .sl-markdown-content') || (/astro/i.test(metaGen) && document.querySelector('[class*="starlight"]'))) {
            detectedPlatform = 'starlight';
          } else if (document.querySelector('[class*="fumadocs"]')) {
            detectedPlatform = 'fumadocs';
          } else if (document.querySelector('meta[name="readme-deploy"], .readme-tailwind, [class*="rdmd"], #hub-header')) {
            detectedPlatform = 'readme';
          } else if (document.querySelector('.td-content') && document.querySelector('[class*="docsy"]')) {
            detectedPlatform = 'hugo-docsy';
          } else if (/jekyll/i.test(metaGen)) {
            detectedPlatform = 'jekyll';
          } else if (document.querySelector('.powered-by-zendesk') || typeof window.HelpCenter !== 'undefined' || /\\/hc\\/[a-z]{2}/i.test(window.location.pathname)) {
            detectedPlatform = 'zendesk';
          } else if (typeof window.$docsify !== 'undefined' || document.querySelector('[data-docsify]')) {
            detectedPlatform = 'docsify';
          } else if (document.querySelector('.devsite-main-content, .devsite-article, #clouddocs-homepage')) {
            detectedPlatform = 'google-devsite';
          } else if (/mintlify/i.test(metaGen) || document.querySelector('[class*="mintlify"]')) {
            detectedPlatform = 'mintlify';
          } else if (document.querySelector('#wiki-app, .wiki-page') || typeof window.$wiki !== 'undefined') {
            detectedPlatform = 'wikijs';
          } else if (/slate/i.test(metaGen) || (document.querySelector('.tocify') && document.querySelector('.page-wrapper'))) {
            detectedPlatform = 'slate';
          } else if (document.querySelector('.notion-page-content')) {
            detectedPlatform = 'notion';
          } else if (document.querySelector('.confluence-information-macro, .wiki-content')) {
            detectedPlatform = 'confluence';
          }
        } catch {}
        result.platform = detectedPlatform;

        // ---- Migration-Aware Component Detection ----
        ${generateMigrationDetectionBlock()}
        result.migrationComponents = __migrationComponents;
        result.platformComponents = __platformComponents;
        result.componentSamples = __componentSamples;

        // ---- Content Format ----
        let detectedFormat = 'unknown';
        try {
          const p = detectedPlatform;
          if (p === 'nextra' || p === 'fumadocs' || p === 'mintlify') {
            detectedFormat = 'mdx';
          } else if (p === 'docusaurus') {
            const hasMdxIndicators = document.querySelector('[class*="admonition"]') || document.querySelector('[class*="tabs"]');
            detectedFormat = hasMdxIndicators ? 'mdx' : 'markdown';
          } else if (p === 'mkdocs' || p === 'vitepress' || p === 'jekyll' || p === 'hugo-docsy' || p === 'starlight' || p === 'docsify' || p === 'wikijs') {
            detectedFormat = 'markdown';
          } else if (p === 'sphinx' || p === 'readthedocs') {
            detectedFormat = 'rst';
          } else if (p === 'gitbook' || p === 'readme' || p === 'notion' || p === 'confluence' || p === 'zendesk' || p === 'google-devsite' || p === 'slate') {
            detectedFormat = 'html';
          }
        } catch {}
        result.contentFormat = detectedFormat;

        // ---- Homepage Detection ----
        let isHomepage = false;
        try {
          const pathname = window.location.pathname;
          const isRoot = pathname === '/' || pathname === '/docs/' || pathname === '/docs' || /^\\/[a-z]{2}\\/?$/i.test(pathname);
          const hasHero = !!document.querySelector('[class*="hero"], [class*="banner"], [class*="landing"], [class*="jumbotron"]');
          const hasFeatureGrid = !!document.querySelector('[class*="feature"], [class*="highlights"], [class*="cards-grid"]');
          const headingCount = scopeEl.querySelectorAll('h2, h3').length;
          const linkCount = scopeEl.querySelectorAll('a[href]').length;
          const landingRatio = headingCount > 0 ? linkCount / headingCount : linkCount;
          isHomepage = isRoot || hasHero || (hasFeatureGrid && landingRatio > 5);
        } catch {}
        result.isHomepage = isHomepage;

        // ---- Unique Selectors Collection (within content container only) ----
        try {
          var __scopeForSelectors = contentContainer || document.querySelector('main, article, [role="main"]') || document.body;
          if (__scopeForSelectors) {
            var __uniqueSelectors = [];
            var __seenSelectors = {};

            // Only skip: Tailwind-style utilities (short-value like "p-4", "mt-2", "text-sm", "w-1/2"),
            // hashed/generated classes (CSS Modules, Emotion, Styled Components), and very short names
            var __isTailwindUtil = function(cls) {
              // Tailwind patterns: "prefix-value" where value is number/size/fraction
              if (/^-?[a-z]{1,4}-[0-9.\/]+$/.test(cls)) return true;
              // Tailwind size variants: sm, md, lg, xl, 2xl
              if (/^(sm|md|lg|xl|2xl)$/.test(cls)) return true;
              // Tailwind state variants with colon (hover:, focus:, etc.) — these appear as classes sometimes
              if (cls.indexOf(':') >= 0) return true;
              // Single Tailwind utility words (exact match only)
              if (/^(flex|grid|block|inline|hidden|relative|absolute|fixed|sticky|static|overflow|float|clear|rounded|shadow|truncate|antialiased|italic|uppercase|lowercase|capitalize|underline|invisible|visible|sr-only|not-sr-only|resize|outline|appearance|transition|transform|animate)$/.test(cls)) return true;
              // Tailwind spacing/sizing: p-*, m-*, w-*, h-*, gap-*, top-*, etc.
              if (/^-?(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|w|h|min-w|min-h|max-w|max-h|gap|top|bottom|left|right|inset|z|space-x|space-y|divide-x|divide-y)-/.test(cls)) return true;
              // Tailwind color/style: bg-*, text-*, border-*, ring-*, from-*, to-*, via-*
              if (/^(bg|text|border|ring|outline|shadow|from|to|via|fill|stroke|accent|caret|decoration)-/.test(cls)) return true;
              // Tailwind font/text: font-*, leading-*, tracking-*, align-*
              if (/^(font|leading|tracking|indent|align|whitespace|break|hyphens)-/.test(cls)) return true;
              // Tailwind layout: col-*, row-*, order-*, basis-*, grow-*, shrink-*
              if (/^(col|row|order|basis|grow|shrink|place|justify|items|content|self)-/.test(cls)) return true;
              // Tailwind effects: opacity-*, blur-*, brightness-*, contrast-*, etc.
              if (/^(opacity|blur|brightness|contrast|grayscale|hue-rotate|invert|saturate|sepia|backdrop|scale|rotate|translate|skew|origin|cursor|select|scroll|snap|touch|will|columns|aspect)-/.test(cls)) return true;
              return false;
            };

            var __isHashedClass = function(cls) {
              // CSS Modules: ends with random hash like "_abc12def" or "-abc12def"
              if (/[-_][a-z0-9]{6,}$/i.test(cls) && /[0-9]/.test(cls.slice(-6))) return true;
              // Known framework prefixes
              if (/^(css-|sc-|emotion-|chakra-|Mui|makeStyles-|jss\d|styles_|__styles|styled-)/.test(cls)) return true;
              // Hex-like hashes: _a1b2c3d4
              if (/^_[a-f0-9]{6,}$/i.test(cls)) return true;
              return false;
            };

            // Tags to skip: inline text, SVG internals, meta elements
            var __skipTags = {p:1,span:1,a:1,strong:1,em:1,b:1,i:1,u:1,br:1,hr:1,sub:1,sup:1,small:1,mark:1,del:1,ins:1,abbr:1,wbr:1,script:1,style:1,link:1,meta:1,noscript:1,svg:1,path:1,g:1,circle:1,rect:1,line:1,polygon:1,polyline:1,defs:1,use:1,symbol:1,clippath:1,mask:1,image:1};

            var __contentEls = __scopeForSelectors.querySelectorAll('*');
            for (var __ci = 0; __ci < __contentEls.length && __uniqueSelectors.length < 300; __ci++) {
              var __el = __contentEls[__ci];
              if (__el.getAttribute && __el.getAttribute('data-scraperUi')) continue;
              var __tn = (__el.tagName || '').toLowerCase();
              if (__skipTags[__tn]) continue;

              // Collect classes
              if (__el.classList) {
                for (var __cci = 0; __cci < __el.classList.length; __cci++) {
                  var __cls = __el.classList[__cci];
                  if (__cls.length <= 2) continue;
                  if (__isTailwindUtil(__cls)) continue;
                  if (__isHashedClass(__cls)) continue;
                  // Skip pure numbers
                  if (/^-?[0-9.]+$/.test(__cls)) continue;

                  var __sel = '.' + __cls;
                  if (!__seenSelectors[__sel]) {
                    __seenSelectors[__sel] = true;
                    var __elText = (__el.textContent || '');
                    var __txt = __elText.length > 80 ? __elText.trim().substring(0, 80) : __elText.trim();
                    __txt = __txt.replace(/[\\n\\r\\t]+/g, ' ').replace(/ {2,}/g, ' ');
                    __uniqueSelectors.push({ selector: __sel, tag: __tn, sampleText: __txt });
                  }
                }
              }

              // Collect IDs
              var __id = __el.id;
              if (__id && __id.length > 2 && !__isHashedClass(__id)) {
                var __idSel = '#' + __id;
                if (!__seenSelectors[__idSel]) {
                  __seenSelectors[__idSel] = true;
                  var __idElText = (__el.textContent || '');
                  var __idTxt = __idElText.length > 80 ? __idElText.trim().substring(0, 80) : __idElText.trim();
                  __idTxt = __idTxt.replace(/[\\n\\r\\t]+/g, ' ').replace(/ {2,}/g, ' ');
                  __uniqueSelectors.push({ selector: __idSel, tag: __tn, sampleText: __idTxt });
                }
              }
            }
            result.uniqueSelectors = __uniqueSelectors;
          }
        } catch (__usErr) {}

        console.log('SCOPING_ANALYSIS:' + JSON.stringify(result));
      } catch (err) {
        console.log('SCOPING_ANALYSIS:' + JSON.stringify({
          url: window.location.href,
          title: document.title,
          contentSelectorFound: false,
          videos: [],
          externalLinks: [],
          apiRefs: [],
          customComponents: [],
          discoveredLinks: [],
          wordCount: 0,
          headings: { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
          codeBlocks: { count: 0, languages: [] },
          tables: { count: 0, totalRows: 0 },
          images: { count: 0, external: 0 },
          lists: { ordered: 0, unordered: 0 },
          tabs: 0, accordions: 0, downloadLinks: { count: 0, extensions: [] },
          forms: 0, iframes: 0, tooltips: 0,
          openApiSpecs: [], apiPlaygrounds: 0, graphqlExplorers: 0,
          apiDocDetails: [], detectedApiSpecs: [], apiEndpoints: [], apiType: null, apiConfidenceScore: 0, interactiveWidgets: [],
          breadcrumbDepth: 0, sidebarItems: 0, hasPagination: false, hasLanguageSwitcher: false,
          platform: 'unknown', contentFormat: 'unknown', isHomepage: false,
          migrationComponents: [],
          platformComponents: { callouts: { total: 0, variants: {} }, tabs: { total: 0 }, codeGroups: { total: 0 }, accordions: { total: 0 }, cards: { total: 0 }, steps: { total: 0 }, definitions: { total: 0 }, embeds: { total: 0 }, columns: { total: 0 }, badges: { total: 0 }, tooltips: { total: 0 }, math: { total: 0 }, mermaid: { total: 0 }, apiFields: { total: 0 } },
          specialContent: { thirdPartyEmbeds: [], mathContent: 0, diagramContent: 0, codePlaygrounds: 0 },
          isApiReferencePage: false,
          playgroundTypes: [],
          error: err.message,
        }));
      }
      });
    })();
  `;
}
