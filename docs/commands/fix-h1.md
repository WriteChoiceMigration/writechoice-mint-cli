# Fix H1 Command

Removes duplicate H1 headings that repeat the frontmatter `title` field in MDX documentation files.

## Usage

```bash
writechoice fix h1 [options]
```

## Options

| Option          | Alias | Description                           | Default |
| --------------- | ----- | ------------------------------------- | ------- |
| `--file <path>` | `-f`  | Fix a single MDX file directly        | -       |
| `--dir <path>`  | `-d`  | Fix MDX files in a specific directory | -       |
| `--dry-run`     | -     | Preview changes without writing files | `false` |
| `--quiet`       | -     | Suppress terminal output              | `false` |

## How It Works

Mintlify automatically renders the `title` from frontmatter as a visible page heading. If a file also contains a Markdown H1 (`# Title`) immediately after the frontmatter with the same text, the title appears twice on the page.

This command detects and removes that redundant H1.

### What Gets Removed

The command removes the first non-empty line after frontmatter **only if** it is an H1 heading that exactly matches the frontmatter `title` value (case-sensitive, whitespace-trimmed).

It also removes the blank line immediately following the removed H1, if present.

**Before:**

```mdx
---
title: Getting Started
---

# Getting Started

Welcome to the documentation.
```

**After:**

```mdx
---
title: Getting Started
---

Welcome to the documentation.
```

### What Is Left Unchanged

- Files with no frontmatter
- Files where the frontmatter has no `title` field
- Files where the first non-empty line after frontmatter is not an H1
- Files where the H1 text does not exactly match the frontmatter title
- H1 headings that appear anywhere other than the first non-empty line after frontmatter

**Example — H1 does not match title (unchanged):**

```mdx
---
title: Getting Started
---

# Introduction

This H1 text is different from the title, so it is kept.
```

**Example — H1 not first after frontmatter (unchanged):**

```mdx
---
title: Getting Started
---

Some introductory text.

# Getting Started

This H1 is not the first non-empty line, so it is kept.
```

## Examples

### Preview changes before writing

```bash
writechoice fix h1 --dry-run
```

### Fix all MDX files in the current directory

```bash
writechoice fix h1
```

### Fix a specific directory

```bash
writechoice fix h1 -d docs/api
```

### Fix a single file

```bash
writechoice fix h1 -f docs/getting-started.mdx
```

## Before and After

### Duplicate title removed

**Before:**

```mdx
---
title: API Reference
---

# API Reference

Use these endpoints to interact with our API.
```

**After:**

```mdx
---
title: API Reference
---

Use these endpoints to interact with our API.
```

### Title with quotes in frontmatter

Quoted titles are supported:

```mdx
---
title: "Quick Start Guide"
---

# Quick Start Guide

Step-by-step instructions.
```

Becomes:

```mdx
---
title: "Quick Start Guide"
---

Step-by-step instructions.
```

## Output Format

```
# H1 Duplicate Title Fixer

Found 24 MDX file(s) to process

✓ Removed duplicate H1 in 3 file(s)
  docs/getting-started.mdx
  docs/api/reference.mdx
  docs/guides/quickstart.mdx
```

### Dry Run Output

```
# H1 Duplicate Title Fixer

Found 24 MDX file(s) to process

Dry run — no files will be written

✓ Would remove duplicate H1 in 3 file(s)
  docs/getting-started.mdx
  docs/api/reference.mdx
  docs/guides/quickstart.mdx
```

### No Changes Needed

```
# H1 Duplicate Title Fixer

Found 24 MDX file(s) to process

⚠️  No duplicate H1 headings found.
```

## Configuration File

You can set defaults in `config.json`:

```json
{
  "h1": {
    "dir": "docs",
    "dry-run": false,
    "quiet": false
  }
}
```

| Field     | Type    | Description                           | Default |
| --------- | ------- | ------------------------------------- | ------- |
| `file`    | string  | Fix a single MDX file                 | `null`  |
| `dir`     | string  | Fix MDX files in a specific directory | `null`  |
| `dry-run` | boolean | Preview changes without writing files | `false` |
| `quiet`   | boolean | Suppress terminal output              | `false` |

CLI flags always take precedence over config.json values.

## Safety Features

### Dry Run First

Preview all changes before writing:

```bash
writechoice fix h1 --dry-run
```

### Non-Destructive

- Only removes the H1 if it exactly matches the frontmatter title
- Never removes H1s that appear later in the document
- Never modifies files with no frontmatter or no title field
- Changes are idempotent — running the command again produces no changes

### Reversibility

All changes can be reverted with git:

```bash
# Undo all changes
git checkout .

# Undo changes to a specific file
git checkout docs/getting-started.mdx
```

## Excluded Directories

The following directories are skipped automatically:

- `node_modules/`
- `.git/`

## See Also

- [Fix Images Command](./fix-images.md) — Wrap standalone images in `<Frame>`
- [Fix Inline Images Command](./fix-inlineimages.md) — Convert inline images to `<InlineImage>`
- [Fix Codeblocks Command](./fix-codeblocks.md) — Fix code block flags
- [Configuration File](../config-file.md) — Configure default settings
