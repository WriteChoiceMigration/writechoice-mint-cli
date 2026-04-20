# Scrape Command

Scrapes documentation URLs and converts each page into an MDX file ready for Mintlify.

## Usage[​](#usage "Direct link to Usage")

```
wc scrape                          # reads urls.json by default

wc scrape --urls-file custom.json

wc scrape https://docs.example.com/page
```

## Options[​](#options "Direct link to Options")

| Option                  | Description                                  | Default     |
| ----------------------- | -------------------------------------------- | ----------- |
| `[urls...]`             | One or more URLs to scrape                   | —           |
| `--urls-file <file>`    | JSON file with an array of URLs              | `urls.json` |
| `-o, --output <dir>`    | Output directory for MDX files               | `output`    |
| `--playwright`          | Use Playwright for JavaScript-rendered pages | `false`     |
| `-c, --concurrency <n>` | Number of parallel requests                  | `3`         |
| `--dry-run`             | Preview output without writing files         | `false`     |
| `--quiet`               | Suppress terminal output                     | `false`     |

## Examples[​](#examples "Direct link to Examples")

```
# Scrape a single page

wc scrape https://docs.example.com/getting-started



# Scrape multiple URLs

wc scrape https://docs.example.com/overview https://docs.example.com/api



# Scrape from a JSON file

wc scrape --urls-file urls.json --output my-docs



# Use Playwright for a JavaScript-rendered site

wc scrape --playwright --urls-file urls.json
```

## URL File Format[​](#url-file-format "Direct link to URL File Format")

`urls.json` should be a JSON array of strings:

```
[

  "https://docs.example.com/getting-started",

  "https://docs.example.com/installation",

  "https://docs.example.com/api-reference/overview"

]
```

## URL → File Mapping[​](#url--file-mapping "Direct link to URL → File Mapping")

| URL                                 | Output file                |
| ----------------------------------- | -------------------------- |
| `https://example.com/docs/overview` | `output/docs/overview.mdx` |
| `https://example.com/api/v2/intro`  | `output/api/v2/intro.mdx`  |
| `https://example.com/`              | `output/index.mdx`         |

## Frontmatter Output[​](#frontmatter-output "Direct link to Frontmatter Output")

Each scraped page produces frontmatter with:

* **`title`** — extracted from `title_selector` or `<title>` tag; site name suffixes are stripped
* **`permalink`** — the original URL of the page
* **`og:title`**, **`og:description`**, **`og:image`** — when present in meta tags

## Configuration[​](#configuration "Direct link to Configuration")

Add a `scrape` section to `config.json` for advanced control over selectors, components, images, and Playwright behavior.

### Content Selectors[​](#content-selectors "Direct link to Content Selectors")

| Key                      | Description                            | Default               |
| ------------------------ | -------------------------------------- | --------------------- |
| `content_selector`       | CSS selector for the main content area | `body`                |
| `title_selector`         | CSS selector for the page title        | `h1`                  |
| `elements_to_remove`     | CSS selectors of elements to strip     | `[]`                  |
| `html_preserve_elements` | HTML tags to keep as raw HTML          | `["table", "iframe"]` |

### Image Strategies[​](#image-strategies "Direct link to Image Strategies")

| Strategy           | Behavior                                              |
| ------------------ | ----------------------------------------------------- |
| `keep_remote`      | Keep original remote URLs unchanged (default)         |
| `download_by_url`  | Download images; save using the image URL's path      |
| `download_by_page` | Download images; save under the page's slug directory |

### Component Mappings[​](#component-mappings "Direct link to Component Mappings")

Map HTML patterns from the source site to Mintlify MDX components. All mappings live under `scrape.components` in `config.json`. Processing always runs in this order: callouts → accordions → cards → tabs → code groups → numbered lists.

***

#### Callouts → `<Note>` / `<Info>` / `<Warning>` / `<Tip>` / `<Check>` / `<Danger>`[​](#callouts--note--info--warning--tip--check--danger "Direct link to callouts--note--info--warning--tip--check--danger")

`components.callouts` is an **array** — one entry per callout pattern on the site.

| Key                | Description                                                                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`             | Mintlify component to emit: `Note`, `Info`, `Warning`, `Tip`, `Check`, or `Danger`                                                                    |
| `selector`         | CSS selector that matches the callout container element                                                                                               |
| `title_selector`   | *(optional)* CSS selector for the title inside the container. The matched element is extracted as bold text and removed before the body is converted. |
| `content_selector` | *(optional)* CSS selector for the body inside the container. If omitted, the full inner HTML of the container is used.                                |

```
{

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

        "title_selector": ".callout-title"

      }

    ]

  }

}
```

Output:

```
<Note>

**My Title**



Body content here.



</Note>
```

***

#### Accordions → `<AccordionGroup>` / `<Accordion>`[​](#accordions--accordiongroup--accordion "Direct link to accordions--accordiongroup--accordion")

**Native `<details>` / `<summary>` elements are always converted automatically**, even without any config. Consecutive `<details>` siblings are automatically grouped into a single `<AccordionGroup>`.

`components.accordion` adds support for **custom accordion patterns**. It accepts an object or an array of objects (for multiple patterns on the same site).

| Key                | Description                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `group_selector`   | *(optional)* CSS selector for the container wrapping all accordion items. If omitted, all matching `item_selector` elements are collected and wrapped in a single `<AccordionGroup>`. |
| `item_selector`    | CSS selector for each individual accordion item (required)                                                                                                                            |
| `title_selector`   | CSS selector for the title inside each item                                                                                                                                           |
| `content_selector` | *(optional)* CSS selector for the body inside each item. If omitted, the title element is removed and the remaining HTML is used as the body.                                         |

```
{

  "components": {

    "accordion": {

      "group_selector": ".accordion",

      "item_selector": ".accordion-item",

      "title_selector": ".accordion-header",

      "content_selector": ".accordion-content"

    }

  }

}
```

Array form (multiple patterns):

```
{

  "components": {

    "accordion": [

      {

        "item_selector": ".accordion-item",

        "title_selector": ".accordion-header"

      },

      {

        "group_selector": ".faq",

        "item_selector": ".faq-item",

        "title_selector": ".faq-question"

      }

    ]

  }

}
```

Output:

```
<AccordionGroup>

  <Accordion title="Question one">Answer content here.</Accordion>

  <Accordion title="Question two">Answer content here.</Accordion>

</AccordionGroup>
```

***

#### Cards → `<Columns>` / `<Card>`[​](#cards--columns--card "Direct link to cards--columns--card")

`components.card` accepts an object or an array of objects.

| Key                | Description                                                                                                                                  | Default |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `item_selector`    | CSS selector for each card element (required)                                                                                                | —       |
| `group_selector`   | *(optional)* CSS selector for the card grid container. If omitted, consecutive sibling matches are grouped into separate `<Columns>` blocks. | —       |
| `cols`             | Number of columns in `<Columns>`                                                                                                             | `2`     |
| `title_selector`   | CSS selector inside the card — extracts title from element text                                                                              | —       |
| `title_attr`       | HTML attribute on the card element containing the title (used when `title_selector` is absent)                                               | —       |
| `icon_attr`        | HTML attribute on the card element containing an icon name                                                                                   | —       |
| `img_selector`     | CSS selector for a child `<img>` — uses `src` or `data-src`                                                                                  | —       |
| `img_attr`         | HTML attribute on the card element containing an image URL                                                                                   | —       |
| `href_attr`        | HTML attribute for the card link URL. Falls back to the element's own `href`.                                                                | —       |
| `content_selector` | CSS selector for the card body. Defaults to the full inner HTML of the item.                                                                 | —       |
| `prop_selectors`   | Map of prop name → CSS selector — extracts arbitrary props from child elements                                                               | —       |

`title_selector` takes priority over `title_attr`. `img_attr` takes priority over `img_selector`.

```
{

  "components": {

    "card": {

      "group_selector": ".card-grid",

      "item_selector": ".card",

      "cols": 3,

      "title_selector": "h3.card-title",

      "img_selector": "img.card-image",

      "href_attr": "data-href",

      "content_selector": ".card-body"

    }

  }

}
```

Array form:

```
{

  "components": {

    "card": [

      { "item_selector": "a.feature-card", "title_selector": "h3", "cols": 3 },

      { "group_selector": ".links-grid", "item_selector": "a", "title_attr": "data-label" }

    ]

  }

}
```

Output:

```
<Columns cols={3}>

  <Card title="Feature One" href="/features/one">

    Description of feature one.

  </Card>

  <Card title="Feature Two" href="/features/two">

    Description of feature two.

  </Card>

</Columns>
```

***

#### Tabs → `<Tabs>` / `<Tab>`[​](#tabs--tabs--tab "Direct link to tabs--tabs--tab")

`components.tabs` accepts a single config object. Unlike accordion and card, it does **not** support array form.

| Key              | Description                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `group_selector` | CSS selector for the tab container (required)                                               |
| `item_selector`  | CSS selector for each tab panel inside the container                                        |
| `title_attr`     | HTML attribute on each item that holds the tab label. Takes priority over `title_selector`. |
| `title_selector` | CSS selector for the title element inside each item (used when `title_attr` is absent)      |

```
{

  "components": {

    "tabs": {

      "group_selector": ".tab-container",

      "item_selector": ".tab-panel",

      "title_attr": "data-tab-title"

    }

  }

}
```

Output:

```
<Tabs>

  <Tab title="macOS">macOS content here.</Tab>

  <Tab title="Windows">Windows content here.</Tab>

</Tabs>
```

***

#### Code Groups → `<CodeGroup>`[​](#code-groups--codegroup "Direct link to code-groups--codegroup")

`components.codegroup` wraps multiple code blocks in a single `<CodeGroup>` when they share a common container. Only applied when the container has **more than one** code block inside it.

| Key              | Description                                             | Default |
| ---------------- | ------------------------------------------------------- | ------- |
| `group_selector` | CSS selector for the container wrapping the code blocks | —       |
| `item_selector`  | CSS selector for each code block inside the container   | `pre`   |

```
{

  "components": {

    "codegroup": {

      "group_selector": ".code-example",

      "item_selector": "pre"

    }

  }

}
```

Output: each `<pre>` inside the container becomes a fenced code block, and the whole group is wrapped in `<CodeGroup>`.

````
<CodeGroup>

  ```bash title="npm" 

  npm install 

  ```

  ```bash title="yarn"

  yarn install

  ```

</CodeGroup>
````

***

#### Numbered Lists[​](#numbered-lists "Direct link to Numbered Lists")

Converts matching `<ul>` elements to `<ol>` so they render as numbered lists. Useful when a site uses `<ul>` with custom styling to represent ordered steps.

`components.numberedList` accepts an object or an **array** of objects.

| Key        | Description                                          |
| ---------- | ---------------------------------------------------- |
| `selector` | CSS selector matching the `<ul>` elements to convert |

```
{

  "components": {

    "numberedList": [{ "selector": "ul[data-testid='ordered-steps']" }, { "selector": "ul.numbered-list" }]

  }

}
```

### Playwright Config[​](#playwright-config "Direct link to Playwright Config")

| Key                 | Description                                 | Default |
| ------------------- | ------------------------------------------- | ------- |
| `headless`          | Run browser in headless mode                | `true`  |
| `wait_for_selector` | Wait for this CSS selector before capturing | `null`  |
| `wait_time`         | Seconds to wait for JS to settle            | `3`     |
| `storage_state`     | Path to a session file from `wc session`    | `null`  |

## Authenticated Scraping[​](#authenticated-scraping "Direct link to Authenticated Scraping")

For sites behind a login, use [wc session](/commands/session.md) to capture your authenticated session, then reference it in `playwright_config.storage_state`.

## Full Config Reference[​](#full-config-reference "Direct link to Full Config Reference")

```
{

  "scrape": {

    "urls_file": "urls.json",

    "output": "output",

    "concurrency": 3,

    "playwright": false,

    "content_selector": "main",

    "title_selector": "h1.page-title",

    "elements_to_remove": [".toc", ".breadcrumbs"],

    "html_preserve_elements": ["table", "iframe"],

    "images": {

      "strategy": "download_by_page",

      "folder": "images"

    },

    "playwright_config": {

      "headless": true,

      "wait_for_selector": "main.content",

      "storage_state": "session.json"

    }

  }

}
```
