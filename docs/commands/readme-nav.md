# wc readme nav

Restructures MDX files on disk to match the navigation hierarchy defined in `docs.json`. Also updates `docs.json` page references to the new paths and generates `redirects.json` for all moved files.

## Usage

```bash
wc readme nav
```

## Options

| Option | Description | Default |
|---|---|---|
| `--docs <file>` | Path to docs.json | `docs.json` |
| `--base <dir>` | Base directory for all output paths | `docs` |
| `--skip-level <n>` | Skip a navigation level (repeatable) | — |
| `--dry-run` | Preview moves without writing files | `false` |
| `--quiet` | Suppress terminal output | `false` |

## How It Works

For every page string in `docs.json` navigation, the command computes a new path based on the hierarchy of containers above it (tabs, anchors, menu items, groups, dropdowns, etc.), then moves the file to that path.

### Supported Navigation Container Types

The command handles all Mintlify navigation organizational structures:

- `tabs` / `tab`
- `anchors` / `anchor`
- `menu` / `item`
- `groups` / `group`
- `dropdowns` / `dropdown`
- `versions` / `version`
- `languages` / `language`
- `products` / `product`

### Path Construction

Each container in the path hierarchy becomes a folder, slugified to lowercase with hyphens:

```
Tab: "Integrate POS Device"    →  integrate-pos-device/
  Item: "Marshall"             →  marshall/
    Group: "Guides"            →  guides/
      Page: "docs/marshall-sdk"  →  marshall-sdk.mdx
```

**Result:** `docs/integrate-pos-device/marshall/guides/marshall-sdk.mdx`

### index.mdx Rule

If a page's filename (slugified) matches the **last folder** in its generated path, the file is named `index.mdx` instead:

```
Group: "Guides"
  Page: "docs/guides"     →  docs/.../guides/index.mdx
```

## Skip Levels

Navigation levels are numbered 1-based by their position in the path:

| Level | Typically corresponds to |
|---|---|
| 1 | Tab (or first container under navigation) |
| 2 | Menu item / anchor |
| 3 | Group |
| 4 | Nested group |

Use `--skip-level` to omit specific levels from the folder structure:

```bash
# Skip tab folders (level 1)
wc readme nav --skip-level 1

# Skip tabs and menu items
wc readme nav --skip-level 1 --skip-level 2
```

## Output Files

After running, the command writes:

**`docs.json`** — updated in place with the new page paths.

**`redirects.json`** — one entry per moved file:

```json
[
  {
    "source": "/docs/marshall-sdk",
    "destination": "/docs/integrate-pos-device/marshall/guides/marshall-sdk"
  }
]
```

## Configuration

```json
{
  "readme": {
    "nav": {
      "docs": "docs.json",
      "base": "docs",
      "skip_levels": [1],
      "dry-run": false,
      "quiet": false
    }
  }
}
```

## Examples

Preview changes without moving anything:

```bash
wc readme nav --dry-run
```

Use a custom docs.json path and skip tab-level folders:

```bash
wc readme nav --docs mintlify/docs.json --base pages --skip-level 1
```
