---
sidebar_position: 2
title: Nav Root
---

# Nav Root Command

For each group nested inside another group, checks whether the group's first page has a frontmatter `title` that matches the group name. If it matches, that page is moved out of `pages` and into a `"root"` key on the group object, and `docs.json` is updated in place.

## Usage

```bash
wc nav root
```

## Options

| Option | Description | Default |
|---|---|---|
| `--docs <file>` | Path to docs.json | `docs.json` |
| `--dry-run` | Preview changes without writing files | `false` |
| `--quiet` | Suppress terminal output | `false` |

## How It Works

The command walks the `docs.json` navigation tree and applies a promotion check to every group that is **nested inside another group's `pages` array**. Top-level groups (direct children of `tabs`, `menu`, `anchors`, `dropdowns`, `versions`, `languages`, or `products`) are never touched.

For each eligible nested group:

1. Look at `pages[0]` — if it is not a string (it's a sub-group), skip.
2. Find the file on disk. Falls back to searching for the filename anywhere in the project if the path doesn't resolve.
3. Read the file's frontmatter `title`.
4. Slugify both the title and the group name and compare them.
5. If they match, move `pages[0]` to `"root"` and remove it from `pages`.

## Example

**Before:**

```json
{
  "group": "General",
  "pages": [
    "docs/methods/general/info",
    "docs/methods/general/status"
  ]
}
```

**After** (when `docs/methods/general/info.mdx` has `title: "General"`):

```json
{
  "group": "General",
  "root": "docs/methods/general/info",
  "pages": [
    "docs/methods/general/status"
  ]
}
```

## Which Groups Are Processed

| Level | Example | Processed? |
|---|---|---|
| Direct child of `tabs` / `menu` / `anchors` | `Getting Started`, `Methods` | No |
| Nested inside another group's `pages` | `General`, `Payment` inside `Methods` | Yes |

## Examples

```bash
# Preview which pages would be promoted
wc nav root --dry-run

# Run against a custom docs.json
wc nav root --docs path/to/docs.json
```

## Config File

```json
{
  "nav": {
    "root": {
      "docs": "docs.json",
      "dry-run": false,
      "quiet": false
    }
  }
}
```
