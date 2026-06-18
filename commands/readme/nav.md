# Readme Nav

# Readme Nav Command

Scrapes a readme.io documentation site, expands all collapsed sidebar sections, and converts the sidebar into Mintlify navigation JSON ready to paste into `docs.json`.

## Usage

```bash
wcc readme nav [url] [options]
```

The `url` argument is optional if `readme.url` (or `source`) is set in `config.json`.

## Arguments

| Argument | Description |
|---|---|
| `[url]` | URL of the readme.io docs page (e.g. `https://docs.example.com/docs`) |

## Options

| Option | Description | Default |
|---|---|---|
| `-o, --output <file>` | Output file for the navigation JSON | `nav.json` |
| `--links-dir <dir>` | Directory for external link stub files | `links` |
| `--no-links` | Skip writing stub files for external sidebar links | `false` |
| `--quiet` | Suppress terminal output | `false` |

## How it works

1. Opens the URL in a headless Chromium browser using Playwright.
2. Clicks every collapsed sidebar button until all sections are expanded.
3. Parses the fully-expanded `nav.rm-Sidebar` element.
4. Converts each `rm-Sidebar-section` into a Mintlify navigation group.
5. Writes the result as a JSON array to `--output`.

External links (those with `target="_blank"`) are written as stub `.mdx` files under `--links-dir`, each containing a `url` frontmatter field that Mintlify can use as an external link entry.

## Output format

The command writes a JSON array of navigation groups:

```json
[
  {
    "group": "Getting Started",
    "pages": [
      "docs/quickstart",
      {
        "group": "Guides",
        "root": "docs/guides",
        "pages": ["docs/guides/first-steps", "docs/guides/advanced"]
      }
    ]
  }
]
```

Paste this array as the value of `navigation.groups` (or a tab's `pages`) in your `docs.json`.

## Config file

Set defaults in `config.json` so you can run `wcc readme nav` without arguments:

```json
{
  "readme": {
    "url": "https://docs.example.com/docs",
    "output": "nav.json",
    "links-dir": "links",
    "no-links": false,
    "quiet": false
  }
}
```

The `source` top-level key is also used as a fallback URL if `readme.url` is not set.
