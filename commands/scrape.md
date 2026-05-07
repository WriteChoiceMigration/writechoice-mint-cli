# Scrape

# Scrape Command

Scrapes documentation URLs and converts each page into an MDX file ready for Mintlify.

## Usage

```bash
wc scrape                          # reads urls.json by default
wc scrape --urls-file custom.json
wc scrape https://docs.example.com/page
```

## Options

| Option | Description | Default |
| --- | --- | --- |
| `[urls...]` | One or more URLs to scrape | — |
| `--urls-file <file>` | JSON file with an array of URLs | `urls.json` |
| `-o, --output <dir>` | Output directory for MDX files | `output` |
| `--playwright` | Use Playwright for JavaScript-rendered pages | `false` |
| `-c, --concurrency <n>` | Number of parallel requests | `3` |
| `--dry-run` | Preview output without writing files | `false` |
| `--quiet` | Suppress terminal output | `false` |

## Examples

```bash
# Scrape a single page
wc scrape https://docs.example.com/getting-started

# Scrape multiple URLs
wc scrape https://docs.example.com/overview https://docs.example.com/api

# Scrape from a JSON file
wc scrape --urls-file urls.json --output my-docs

# Use Playwright for a JavaScript-rendered site
wc scrape --playwright --urls-file urls.json
```

## URL File Format

`urls.json` should be a JSON array of strings:

```json
[
  "https://docs.example.com/getting-started",
  "https://docs.example.com/installation",
  "https://docs.example.com/api-reference/overview"
]
```

## URL → File Mapping

| URL | Output file |
| --- | --- |
| `https://example.com/docs/overview` | `output/docs/overview.mdx` |
| `https://example.com/api/v2/intro` | `output/api/v2/intro.mdx` |
| `https://example.com/` | `output/index.mdx` |

## Frontmatter Output

Each scraped page produces frontmatter with:

- **`title`** — extracted from `title_selector` or `<title>` tag; site name suffixes are stripped
- **`permalink`** — the original URL of the page
- **`og:title`**, **`og:description`**, **`og:image`** — when present in meta tags

## Configuration

Add a `scrape` section to `config.json` for advanced control. See the [Config Reference](./config-reference) for the full list of options with descriptions.

### Content Selectors

| Key | Description | Default |
| --- | --- | --- |
| `content_selector` | CSS selector for the main content area | `body` |
| `title_selector` | CSS selector for the page title | `h1` |
| `elements_to_remove` | CSS selectors of elements to strip | `[]` |
| `html_preserve_elements` | HTML tags to keep as raw HTML | `["table", "iframe"]` |
| `html_preserve_custom` | Additional CSS selectors to preserve as raw HTML | `[]` |

### Image Strategies

| Strategy | Behavior |
| --- | --- |
| `keep_remote` | Keep original remote URLs unchanged (default) |
| `download_by_url` | Download images; save using the image URL's path |
| `download_by_page` | Download images; save under the page's slug directory |

### Component Mappings

`scrape.components` is an **array** of component definitions. Each entry tells the scraper how to find an HTML pattern and convert it into a Mintlify MDX component. The `name` you provide becomes the JSX tag — so `"name": "Note"` produces `<Note>`, `"name": "Accordion"` produces `<Accordion>`, and so on.

Native `<details>`/`<summary>` elements are always converted to `<Accordion>` automatically, regardless of config.

#### Component Definition

| Key | Type | Description |
| --- | --- | --- |
| `name` | string | MDX component name — becomes the JSX tag |
| `selector` | string | CSS selector matching each component element |
| `props` | object | Map of prop name → extraction rule (see below) |
| `content` | string | CSS selector for inner content (defaults to full innerHTML) |
| `group` | object | Optional grouping config (see below) |

#### Extracting Props

| Form | Example | Behavior |
| --- | --- | --- |
| String | `"title": ".callout-title"` | Finds the child element, uses its text; element removed from content |
| Object with `selector` | `"title": { "selector": ".callout-title" }` | Same as string shorthand |
| Object with `selector` + `attr` | `"icon": { "selector": "img", "attr": "src" }` | Reads an attribute from the child element |
| Object with `attr` only | `"href": { "attr": "href" }` | Reads an attribute from the matched element itself |
| Add `"image": true` | `"img": { "attr": "data-src", "image": true }` | Image URL — downloaded and resolved per your `images` strategy |
| Add `"child": true` | `"title": { "selector": ".title", "child": true }` | Renders as `**bold text**` inside the component body instead of a JSX prop |

#### Grouping

| Form | Behavior |
| --- | --- |
| `"group": { "selector": ".container", "wrapper": "AccordionGroup" }` | Finds each container, collects items inside, wraps in `wrapper` |
| `"group": { "wrapper": "AccordionGroup" }` | Auto-groups consecutive sibling matches into one `wrapper` |
| No `group` key | Each match is converted independently |

#### Examples

**Callouts** (`<Note>`, `<Warning>`, `<Tip>`, …)

Mintlify callout titles are children, not props — use `"child": true` so the title renders as `**bold text**` inside the component:

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

For components that accept `title` as a JSX prop (e.g. `<Accordion>`), omit `"child": true`.

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
      "img": { "selector": "img.card-thumb", "attr": "src", "image": true }
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
    "props": { "title": { "attr": "data-tab-title" } }
  }
]
```

### Playwright Config

| Key | Description | Default |
| --- | --- | --- |
| `headless` | Run browser in headless mode | `true` |
| `wait_for_selector` | Wait for this CSS selector before capturing | `null` |
| `wait_time` | Seconds to wait for JS to settle | `3` |
| `page_load_timeout` | Max seconds to wait for page load | `30` |
| `storage_state` | Path to a session file from `wc session` | `null` |

### Script Hooks

For cases where config options aren't enough, inject custom JavaScript at two points in the pipeline — before HTML-to-Markdown conversion (pre) or after (post). See the [Script Hooks guide](./script-hooks) for details and examples.

## Authenticated Scraping

For sites behind a login, use [wc session](../session.md) to capture your authenticated session, then reference it in `playwright_config.storage_state`.
