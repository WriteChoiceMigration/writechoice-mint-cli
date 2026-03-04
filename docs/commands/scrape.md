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
    "components": {
      "callouts": [
        {
          "type": "Note",
          "selector": "div.callout.note",
          "title_selector": ".callout-title",
          "content_selector": ".callout-body"
        },
        {
          "type": "Warning",
          "selector": "div.callout.warning",
          "title_selector": ".callout-title",
          "content_selector": null
        }
      ],
      "accordion": {
        "group_selector": ".accordion-group",
        "item_selector": ".accordion-item",
        "title_selector": ".accordion-title",
        "content_selector": ".accordion-content"
      },
      "tabs": {
        "group_selector": ".tabs",
        "item_selector": ".tab-panel",
        "title_attr": "data-tab-label"
      }
    }
  }
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

Each component type maps HTML elements to Mintlify MDX components:

**Callouts** → `<Note>`, `<Info>`, `<Warning>`, `<Tip>`, `<Check>`, `<Danger>`

```json
{
  "type": "Note",
  "selector": "div.note",
  "title_selector": "div.note-title",
  "content_selector": "div.note-body"
}
```

**Accordions** → `<AccordionGroup>` / `<Accordion>`

Native `<details>`/`<summary>` elements are always converted automatically. For custom accordion patterns, configure `accordion` as an object or an array of objects (to handle multiple patterns on the same site).

`group_selector` is optional — if omitted, all matching `item_selector` elements are collected and wrapped in a single `<AccordionGroup>`.

```json
{
  "group_selector": ".accordion",
  "item_selector": ".accordion-item",
  "title_selector": ".accordion-header",
  "content_selector": ".accordion-content"
}
```

Array form (multiple patterns):

```json
[
  { "item_selector": ".accordion-item", "title_selector": ".accordion-header" },
  { "group_selector": ".faq", "item_selector": ".faq-item", "title_selector": ".faq-question" }
]
```

**Cards** → `<Columns>` / `<Card>`

Configure `card` as an object or an array of objects. `group_selector` is optional — if omitted, consecutive sibling matches are grouped into separate `<Columns>` blocks.

| Key               | Description                                               |
| ----------------- | --------------------------------------------------------- |
| `item_selector`   | CSS selector for each card element (required)             |
| `group_selector`  | CSS selector for the card grid container (optional)       |
| `cols`            | Number of columns in `<Columns>` (default: `2`)           |
| `title_selector`  | CSS selector — extracts title from element text           |
| `title_attr`      | HTML attribute on the card element containing the title   |
| `icon_attr`       | HTML attribute containing the icon name                   |
| `img_selector`    | CSS selector for a child `<img>` — uses `src`/`data-src` |
| `img_attr`        | HTML attribute on the card element containing an image URL|
| `href_attr`       | HTML attribute for the card link URL                      |
| `content_selector`| CSS selector for the card body (defaults to full item)    |
| `prop_selectors`  | Map of prop name → CSS selector — adds arbitrary props    |

Images found via `img_selector` or `img_attr` are downloaded using the same strategy as page images.

```json
{
  "group_selector": ".card-grid",
  "item_selector": ".card",
  "cols": 3,
  "title_selector": "h3.card-title",
  "img_selector": "img.card-image",
  "href_attr": "data-href",
  "content_selector": ".card-body"
}
```

Array form (multiple patterns):

```json
[
  { "item_selector": "a.feature-card", "title_selector": "h3", "cols": 3 },
  { "group_selector": ".links-grid", "item_selector": "a", "title_attr": "data-label" }
]
```

**Tabs** → `<Tabs>` / `<Tab>`

```json
{
  "group_selector": ".tab-container",
  "item_selector": ".tab-pane",
  "title_attr": "data-tab-title"
}
```

**Code Groups** → `<CodeGroup>`

```json
{
  "group_selector": ".code-example",
  "item_selector": "pre"
}
```

**Numbered Lists**

Converts matching `<ul>` elements to numbered (ordered) lists. Useful when a site renders ordered lists using `<ul>` with a custom attribute or class.

```json
{ "selector": "ul[data-testid='volt-numbered-list']" }
```

Array form (multiple patterns):

```json
[
  { "selector": "ul[data-testid='volt-numbered-list']" },
  { "selector": "ul.ordered-steps" }
]
```

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
