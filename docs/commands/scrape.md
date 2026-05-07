# wc scrape

Scrapes documentation URLs and converts each page into an MDX file ready for Mintlify.

## Usage

```bash
wc scrape                         # reads urls.json by default
wc scrape --urls-file custom.json
wc scrape https://docs.example.com/page
```

## Options

| Option                  | Description                                  | Default     |
| ----------------------- | -------------------------------------------- | ----------- |
| `[urls...]`             | One or more URLs to scrape                   | —           |
| `--urls-file <file>`    | JSON file with an array of URLs              | `urls.json` |
| `-o, --output <dir>`    | Output directory for MDX files               | `output`    |
| `--playwright`          | Use Playwright for JavaScript-rendered pages | `false`     |
| `-c, --concurrency <n>` | Number of parallel requests                  | `3`         |
| `--dry-run`             | Preview output without writing files         | `false`     |
| `--quiet`               | Suppress terminal output                     | `false`     |

## Examples

Scrape a single page:

```bash
wc scrape https://docs.example.com/getting-started
```

Scrape multiple URLs:

```bash
wc scrape https://docs.example.com/overview https://docs.example.com/api
```

Scrape from a JSON file:

```bash
wc scrape --urls-file urls.json --output my-docs
```

Use Playwright for a JavaScript-rendered site:

```bash
wc scrape --playwright --urls-file urls.json
```

## URL File Format

By default, `wc scrape` reads from `urls.json` in the current directory. Override this with `--urls-file` or `scrape.urls_file` in `config.json`.

The file should be a JSON array of strings:

```json
[
  "https://docs.example.com/getting-started",
  "https://docs.example.com/installation",
  "https://docs.example.com/api-reference/overview"
]
```

## URL → File Mapping

URLs are mapped to output files based on their path:

| URL                                 | Output file                |
| ----------------------------------- | -------------------------- |
| `https://example.com/docs/overview` | `output/docs/overview.mdx` |
| `https://example.com/api/v2/intro`  | `output/api/v2/intro.mdx`  |
| `https://example.com/`              | `output/index.mdx`         |

## Configuration

Add a `scrape` section to your `config.json` to configure advanced options:

```json
{
  "scrape": {
    "urls_file": "urls.json",
    "output": "output",
    "concurrency": 3,
    "playwright": false,
    "content_selector": "main",
    "title_selector": "h1.page-title",
    "elements_to_remove": [".toc", ".breadcrumbs", "nav"],
    "html_preserve_elements": ["table", "iframe"],
    "images": {
      "strategy": "download_by_page",
      "folder": "images"
    },
    "components": [
      {
        "name": "Note",
        "selector": "div.callout.note",
        "props": { "title": ".callout-title" },
        "content": ".callout-body"
      },
      {
        "name": "Warning",
        "selector": "div.callout.warning",
        "props": { "title": ".callout-title" }
      },
      {
        "name": "Accordion",
        "selector": ".accordion-item",
        "group": { "selector": ".accordion-group", "wrapper": "AccordionGroup" },
        "props": { "title": ".accordion-title" },
        "content": ".accordion-content"
      },
      {
        "name": "Tab",
        "selector": ".tab-panel",
        "group": { "selector": ".tabs", "wrapper": "Tabs" },
        "props": { "title": { "attr": "data-tab-label" } }
      }
    ]
  }
}
```

### Playwright Config

Controls Playwright behavior when `playwright: true`. Also used to load a saved session for authenticated scraping (see `wc session`).

| Key                  | Description                                                         | Default |
| -------------------- | ------------------------------------------------------------------- | ------- |
| `headless`           | Run browser in headless mode                                        | `true`  |
| `wait_for_selector`  | Wait for this CSS selector to appear before capturing HTML          | `null`  |
| `wait_time`          | Seconds to wait for JS to settle (used when no `wait_for_selector`) | `3`     |
| `page_load_timeout`  | Max seconds to wait for page load                                   | `30`    |
| `storage_state`      | Path to a session file saved by `wc session` (for auth)            | `null`  |

`storage_state` works with both `playwright: true` (Playwright context) and `playwright: false` (cookies injected into native `fetch`).

```json
"playwright_config": {
  "headless": true,
  "wait_for_selector": "main.content",
  "storage_state": "session.json"
}
```

### Content Selectors

| Key                      | Description                            | Default               |
| ------------------------ | -------------------------------------- | --------------------- |
| `content_selector`       | CSS selector for the main content area | `body`                |
| `title_selector`         | CSS selector for the page title        | `h1`                  |
| `elements_to_remove`     | CSS selectors of elements to strip     | `[]`                  |
| `html_preserve_elements` | HTML tags to keep as raw HTML          | `["table", "iframe"]` |
| `html_preserve_custom`   | Additional CSS selectors to preserve   | `[]`                  |

### Image Strategies

| Strategy           | Behavior                                              |
| ------------------ | ----------------------------------------------------- |
| `keep_remote`      | Keep original remote URLs unchanged (default)         |
| `download_by_url`  | Download images; save using the image URL's path      |
| `download_by_page` | Download images; save under the page's slug directory |

### Component Mappings

`scrape.components` is an array of component definitions. Each entry tells the scraper how to find an HTML pattern on the page and convert it into a Mintlify MDX component.

The `name` you provide becomes the JSX tag in the output — so `"name": "Note"` produces `<Note>...</Note>`, `"name": "Accordion"` produces `<Accordion>...</Accordion>`, and so on. You can target any Mintlify component this way.

Native `<details>`/`<summary>` elements are always converted to `<Accordion>` automatically, regardless of your components config.

#### Component definition

| Key        | Type            | Description                                             |
| ---------- | --------------- | ------------------------------------------------------- |
| `name`     | string          | MDX component name — becomes the JSX tag (e.g. `Note`) |
| `selector` | string          | CSS selector matching each component element            |
| `props`    | object          | Map of prop name → extraction rule (see below)          |
| `content`  | string          | CSS selector for the inner content (defaults to full innerHTML) |
| `group`    | object          | Optional grouping config (see below)                    |

#### Extracting props

Each key in `props` maps to an extraction rule. There are three forms:

| Form | Example | Behavior |
| ---- | ------- | -------- |
| String | `"title": ".callout-title"` | Finds the child element, uses its text content; element is removed from the content area |
| Object with `selector` | `"title": { "selector": ".callout-title" }` | Same as string shorthand |
| Object with `selector` + `attr` | `"icon": { "selector": "img", "attr": "src" }` | Reads an attribute from the child element |
| Object with `attr` only | `"href": { "attr": "href" }` | Reads an attribute from the matched element itself (no child lookup) |
| Add `"image": true` | `"img": { "attr": "data-src", "image": true }` | Treats the value as an image URL — downloaded and resolved per your `images` strategy |
| Add `"child": true` | `"title": { "selector": ".callout-title", "child": true }` | Renders the value as `**bold text**` inside the component body instead of as a JSX prop — use this for Mintlify callouts (`<Note>`, `<Warning>`, etc.) where the title is a child, not an attribute |

#### Grouping

Use `group` when matched items need to be wrapped in a parent component (e.g. `<AccordionGroup>`, `<Tabs>`).

| Form | Behavior |
| ---- | -------- |
| `"group": { "selector": ".faq-group", "wrapper": "AccordionGroup" }` | Finds each container matching `selector`, collects items inside it, wraps them in `wrapper` |
| `"group": { "wrapper": "AccordionGroup" }` | Auto-groups: consecutive sibling matches are collected into one `wrapper` block |
| No `group` key | Each match is converted independently, with no surrounding wrapper |

#### Examples

**Callouts** (`<Note>`, `<Warning>`, `<Tip>`, …)

Mintlify callout titles are children, not props — use `"child": true` so the title is rendered as `**bold text**` inside the component body:

```json
[
  {
    "name": "Note",
    "selector": ".admonition.note",
    "props": { "title": { "selector": ".admonition-title", "child": true } },
    "content": ".admonition-body"
  },
  {
    "name": "Warning",
    "selector": ".admonition.warning",
    "props": { "title": { "selector": ".admonition-title", "child": true } },
    "content": ".admonition-body"
  }
]
```

Output:

```mdx
<Note>
**My callout title**

Content here...
</Note>
```

For components that accept `title` as a JSX prop (e.g. `<Accordion title="...">`), omit `"child": true` and the value will be written as an attribute instead.

**Accordions** (explicit group container)

```json
[
  {
    "name": "Accordion",
    "selector": ".faq-item",
    "group": { "selector": ".faq-section", "wrapper": "AccordionGroup" },
    "props": { "title": ".faq-question" },
    "content": ".faq-answer"
  }
]
```

**Accordions** (auto-group consecutive siblings)

```json
[
  {
    "name": "Accordion",
    "selector": ".accordion-item",
    "group": { "wrapper": "AccordionGroup" },
    "props": { "title": ".accordion-header" },
    "content": ".accordion-body"
  }
]
```

**Cards** with image and link

```json
[
  {
    "name": "Card",
    "selector": "a.card",
    "group": { "wrapper": "CardGroup" },
    "props": {
      "title": "h3.card-title",
      "icon": { "attr": "data-icon" },
      "href": { "attr": "href" },
      "img":  { "selector": "img.card-thumb", "attr": "src", "image": true }
    },
    "content": ".card-description"
  }
]
```

**Tabs**

```json
[
  {
    "name": "Tab",
    "selector": ".tab-panel",
    "group": { "selector": ".tabs", "wrapper": "Tabs" },
    "props": { "title": { "attr": "data-title" } }
  }
]
```

## Script Hooks

For cases where config options aren't enough, you can inject custom JavaScript scripts into the scrape pipeline at two points.

```json
"scrape": {
  "scripts": {
    "pre":  "./scripts/pre.js",
    "post": ["./scripts/normalize.js", "./scripts/fix-links.js"]
  }
}
```

Both `pre` and `post` accept a single path string or an array of paths. Paths are resolved relative to your working directory. Scripts run in order when multiple are provided.

Scripts are standard ES module files (`.js`). Load failures (file not found, syntax errors) stop the scrape immediately — silent failures would mask misconfiguration. Runtime errors on a specific page fail that page and let others continue, matching the behavior of HTTP errors.

---

### Pre-process scripts

Runs **after** unwanted elements are removed, **before** Turndown converts the DOM to Markdown. The Cheerio instance is fully live — you can read, add, remove, or restructure any element.

**Signature:**

```js
export default function($, pageUrl, config, { pm }) { ... }
// or async:
export default async function($, pageUrl, config, { pm }) { ... }
```

| Argument | Type | Description |
| -------- | ---- | ----------- |
| `$` | Cheerio instance | The scoped content DOM — mutate it directly |
| `pageUrl` | string | URL of the page being scraped |
| `config` | object | Full `scrape` config section from `config.json` |
| `{ pm }` | object | Context — contains the `PlaceholderManager` (see below) |

**DOM cleanup example** — remove elements, fix attributes:

```js
// scripts/pre.js
export default function($, pageUrl) {
  // strip navigation and feedback widgets
  $(".page-nav, .feedback-widget, .last-updated").remove();

  // fix relative links that will break after migration
  $("a[href^='/old-docs']").each((_, el) => {
    $(el).attr("href", $(el).attr("href").replace("/old-docs", "/docs"));
  });
}
```

#### Custom MDX conversions with the PlaceholderManager

If you want to convert an HTML pattern into an MDX component that the built-in config can't express, use the `pm` (PlaceholderManager) passed in the fourth argument. Storing content as a placeholder makes it invisible to Turndown — it gets restored exactly as written after conversion is complete.

```js
export default function($, pageUrl, config, { pm }) {
  // convert <div class="steps"> into Mintlify <Steps> / <Step> components
  $("div.steps").each((_, el) => {
    const $el = $(el);

    const steps = $el.find(".step").map((_, step) => {
      const $step = $(step);
      const title = $step.find(".step-title").text().trim();
      const body  = $step.find(".step-body").html() || "";
      return `<Step title="${title}">\n${body.trim()}\n</Step>`;
    }).get().join("\n\n");

    const mdx = `<Steps>\n${steps}\n</Steps>`;
    $el.replaceWith(pm.store(mdx, "CUSTOM")); // survives Turndown unchanged
  });
}
```

**How it works:** `pm.store(content, label)` returns an opaque token like `||CUSTOM|0|a1b2c3d4||`. Turndown treats it as plain text and passes it through. After all conversion steps finish, `pm.restore()` swaps every token back for its stored content — so the MDX you wrote ends up verbatim in the output file.

This means you can implement any MDX structure — `<Steps>`, `<Tooltip>`, multi-level wrappers, anything — purely in a script, with no changes to the CLI itself.

---

### Post-process scripts

Runs **after** Turndown, component replacement, HTML restoration, and all built-in cleanup. The input is the final Markdown string. You must return the (modified) string.

**Signature:**

```js
export default function(markdown, pageUrl, config) { return markdown; }
// or async:
export default async function(markdown, pageUrl, config) { return markdown; }
```

| Argument | Type | Description |
| -------- | ---- | ----------- |
| `markdown` | string | Fully converted Markdown/MDX content (no frontmatter) |
| `pageUrl` | string | URL of the page being scraped |
| `config` | object | Full `scrape` config section from `config.json` |

If a script returns a non-string value, a warning is printed and the original markdown is kept.

**Pattern replacement example:**

```js
// scripts/post.js
export default function(markdown, pageUrl) {
  // replace legacy shortcodes leftover from conversion
  markdown = markdown.replace(/\{\{%\s*note\s*%\}\}/g, "<Note>");
  markdown = markdown.replace(/\{\{%\s*endnote\s*%\}\}/g, "</Note>");
  return markdown;
}
```

**Per-page logic based on URL:**

```js
export default function(markdown, pageUrl) {
  if (pageUrl.includes("/api-reference/")) {
    // strip the auto-generated intro paragraph on API pages
    markdown = markdown.replace(/^> This page.*?\n\n/m, "");
  }
  return markdown;
}
```

## Frontmatter Output

Each scraped page produces a frontmatter block with:

- **`title`** — extracted from `title_selector` or the `<title>` tag. Suffixes like `" | Site Name"` are stripped automatically (e.g. `"Page Title | Docs"` → `"Page Title"`).
- **`permalink`** — the original URL of the page, added automatically.
- **`og:title`**, **`og:description`**, **`og:image`** — included when present in the page's meta tags.

```yaml
---
title: "Getting Started"
permalink: "https://docs.example.com/getting-started"
og:description: "A quick overview of the platform"
---
```

## HTML Cleanup

The following cleanup steps run automatically on all scraped output:

- **`<colgroup>` removal** — stripped from preserved tables (column width definitions don't translate to MDX).
- **`<br>` self-closing** — all `<br>` variants (`<br>`, `<br >`, `<br class="...">`) are normalized to `<br/>` throughout the output including inside tables.

## Authenticated Scraping

For sites behind a login page, use `wc session` to capture your authenticated session once, then reference the saved file in `playwright_config.storage_state`.

See [wc session](./session.md) for the full workflow.

## Image Download Failures

If any images fail to download, a report is written to `<output>/image_download.json`:

```json
[
  {
    "url": "https://cdn.example.com/broken-image.png",
    "savePath": "images/assets/broken-image.png",
    "error": "HTTP 404",
    "page": "https://docs.example.com/guide"
  }
]
```
