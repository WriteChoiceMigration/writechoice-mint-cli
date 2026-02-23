# wc scrape

Scrapes documentation URLs and converts each page into an MDX file ready for Mintlify.

## Usage

```bash
wc scrape                         # reads urls.json by default
wc scrape --urls-file custom.json
wc scrape https://docs.example.com/page
```

## Options

| Option | Description | Default |
|---|---|---|
| `[urls...]` | One or more URLs to scrape | — |
| `--urls-file <file>` | JSON file with an array of URLs | `urls.json` |
| `-o, --output <dir>` | Output directory for MDX files | `output` |
| `--playwright` | Use Playwright for JavaScript-rendered pages | `false` |
| `-c, --concurrency <n>` | Number of parallel requests | `3` |
| `--dry-run` | Preview output without writing files | `false` |
| `--quiet` | Suppress terminal output | `false` |

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

| URL | Output file |
|---|---|
| `https://example.com/docs/overview` | `output/docs/overview.mdx` |
| `https://example.com/api/v2/intro` | `output/api/v2/intro.mdx` |
| `https://example.com/` | `output/index.mdx` |

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

| Key | Description | Default |
|---|---|---|
| `content_selector` | CSS selector for the main content area | `body` |
| `title_selector` | CSS selector for the page title | `h1` |
| `elements_to_remove` | CSS selectors of elements to strip | `[]` |
| `html_preserve_elements` | HTML tags to keep as raw HTML | `["table", "iframe"]` |
| `html_preserve_custom` | Additional CSS selectors to preserve | `[]` |

### Image Strategies

| Strategy | Behavior |
|---|---|
| `keep_remote` | Keep original remote URLs unchanged (default) |
| `download_by_url` | Download images; save using the image URL's path |
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

```json
{
  "group_selector": ".accordion",
  "item_selector": ".accordion-item",
  "title_selector": ".accordion-header",
  "content_selector": ".accordion-content"
}
```

**Cards** → `<Columns>` / `<Card>`

```json
{
  "group_selector": ".card-grid",
  "item_selector": ".card",
  "title_attr": "data-title",
  "icon_attr": "data-icon",
  "content_selector": ".card-body"
}
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
