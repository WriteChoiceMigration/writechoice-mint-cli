# Nav Folders Command

Restructures MDX files on disk to match the navigation hierarchy defined in `docs.json`. Also updates `docs.json` page references to the new paths and generates `redirects.json` for all moved files.

## Usage[​](#usage "Direct link to Usage")

```
wc nav folders
```

## Options[​](#options "Direct link to Options")

| Option             | Description                                                       | Default     |
| ------------------ | ----------------------------------------------------------------- | ----------- |
| `--docs <file>`    | Path to docs.json                                                 | `docs.json` |
| `--base <dir>`     | Base directory for all output paths                               | `docs`      |
| `--skip-level <n>` | Skip a navigation level (repeatable, 1-based)                     | —           |
| `--rename`         | Rename each file using a kebab-case slug of its frontmatter title | `false`     |
| `--dry-run`        | Preview moves without writing files                               | `false`     |
| `--quiet`          | Suppress terminal output                                          | `false`     |

## How It Works[​](#how-it-works "Direct link to How It Works")

For every page string in `docs.json` navigation, the command computes a new path based on the hierarchy of containers above it (tabs, anchors, menu items, groups, dropdowns, etc.), then moves the file to that path.

### Supported Navigation Container Types[​](#supported-navigation-container-types "Direct link to Supported Navigation Container Types")

* `tabs` / `tab`
* `anchors` / `anchor`
* `menu` / `item`
* `groups` / `group`
* `dropdowns` / `dropdown`
* `versions` / `version`
* `languages` / `language`
* `products` / `product`

### Path Construction[​](#path-construction "Direct link to Path Construction")

Each container in the path hierarchy becomes a folder, slugified to lowercase with hyphens:

```
Tab: "Integrate POS Device"    →  integrate-pos-device/

  Item: "Marshall"             →  marshall/

    Group: "Guides"            →  guides/

      Page: "docs/marshall-sdk"  →  marshall-sdk.mdx
```

Result: `docs/integrate-pos-device/marshall/guides/marshall-sdk.mdx`

### `index.mdx` Rule[​](#indexmdx-rule "Direct link to indexmdx-rule")

If a page's filename (slugified) matches the **last folder** in its generated path, the file is named `index.mdx` instead.

### `--rename`[​](#--rename "Direct link to --rename")

When `--rename` is set, each file is renamed to a kebab-case slug of its frontmatter `title` instead of keeping its original filename.

## Skip Levels[​](#skip-levels "Direct link to Skip Levels")

Navigation levels are numbered 1-based by their position in the path:

| Level | Typically corresponds to |
| ----- | ------------------------ |
| 1     | Tab (or first container) |
| 2     | Menu item / anchor       |
| 3     | Group                    |
| 4     | Nested group             |

```
# Skip tab folders (level 1)

wc nav folders --skip-level 1



# Skip tabs and menu items

wc nav folders --skip-level 1 --skip-level 2
```

## Output Files[​](#output-files "Direct link to Output Files")

**`docs.json`** — updated in place with the new page paths.

**`redirects.json`** — one entry per moved file:

```
[

  {

    "source": "/docs/marshall-sdk",

    "destination": "/docs/integrate-pos-device/marshall/guides/marshall-sdk"

  }

]
```

## Examples[​](#examples "Direct link to Examples")

```
# Preview changes without moving anything

wc nav folders --dry-run



# Rename files from their frontmatter titles

wc nav folders --rename



# Use a custom docs.json and skip tab-level folders

wc nav folders --docs mintlify/docs.json --base pages --skip-level 1
```

## Config File[​](#config-file "Direct link to Config File")

```
{

  "nav": {

    "folders": {

      "docs": "docs.json",

      "base": "docs",

      "skip_levels": [1],

      "rename": false,

      "dry-run": false,

      "quiet": false

    }

  }

}
```
