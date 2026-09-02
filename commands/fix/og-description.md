# Fix OG Description

# Fix OG Description Command

Renames the frontmatter `description` key to `og:description`, keeping its original position in the frontmatter block.

## Usage

```bash
writechoice fix og-description [options]
```

## Options

| Option          | Alias | Description                           | Default |
| --------------- | ----- | ------------------------------------- | ------- |
| `--file <path>` | `-f`  | Fix a single MDX file                 | -       |
| `--dir <path>`  | `-d`  | Fix MDX files in a specific directory | -       |
| `--dry-run`     | -     | Preview changes without writing files | `false` |
| `--quiet`       | -     | Suppress terminal output              | `false` |

## Why This Is Needed

Mintlify uses `og:description` (not `description`) as the frontmatter key for the page's Open Graph description meta tag. Content converted from other formats commonly carries a plain `description` key instead.

## What Gets Converted

```mdx
{/* Before */}
---
title: "Getting Started"
description: "Everything you need to get up and running."
icon: "rocket"
---

{/* After */}
---
title: "Getting Started"
og:description: "Everything you need to get up and running."
icon: "rocket"
---
```

The value moves as-is, including multi-line block scalar values (`description: >` / `description: |`), and the key stays in its original position rather than moving to the end of the frontmatter block.

If the frontmatter already has *both* `description` and a pre-existing `og:description`, the old `og:description` is dropped and `description`'s value wins — a warning is printed for that file so you can review it.

## What Is Left Unchanged

- Files with no `description` frontmatter key
- Files with no frontmatter block at all
- Everything in the page body

## Examples

```bash
# Preview what would change
writechoice fix og-description --dry-run

# Fix all MDX files in the current directory
writechoice fix og-description

# Fix a specific directory
writechoice fix og-description -d pages/docs

# Fix a single file
writechoice fix og-description -f pages/docs/quickstart.mdx
```

## Config File

```json
{
  "og-description": {
    "dir": "pages",
    "dry-run": false,
    "quiet": false
  }
}
```

## Safety

- Only touches the frontmatter block — page body content is never modified
- Idempotent: running again on already-renamed files produces no changes
- Use `--dry-run` to preview before writing
- Revert with `git checkout .` if needed
