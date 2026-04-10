---
sidebar_position: 1
title: Docusaurus Convert
---

# Docusaurus Convert Command

Converts a Docusaurus docs folder to Mintlify-ready MDX files. Applies all known structural and syntax transformations automatically, and copies non-Markdown files (images, etc.) as-is.

## Usage

```bash
wc docusaurus convert <folder> [options]
```

## Arguments

| Argument | Description |
|---|---|
| `<folder>` | Path to the Docusaurus project root (contains a `docs/` subfolder) or directly to a docs folder |

## Options

| Option | Description | Default |
|---|---|---|
| `-o, --output <dir>` | Output directory for converted files | `mintlify` |
| `--dry-run` | Preview conversions without writing files | `false` |
| `--quiet` | Suppress terminal output | `false` |

## What Gets Converted

### Admonitions → Mintlify callout components

Docusaurus `:::type` blocks are converted to Mintlify JSX components:

| Docusaurus | Mintlify |
|---|---|
| `:::note` | `<Note>` |
| `:::tip` | `<Tip>` |
| `:::info` | `<Info>` |
| `:::warning` | `<Warning>` |
| `:::caution` | `<Warning>` |
| `:::danger` | `<Danger>` |
| `:::success` | `<Check>` |

```mdx
<!-- Before -->
:::note
This is a note.
:::

<!-- After -->
<Note>
This is a note.
</Note>
```

Titled admonitions (`:::note[My Title]`) have the title rendered as bold text inside the component.

### Tabs → Mintlify Tabs

```mdx
<!-- Before -->
<Tabs groupId="os">
  <TabItem value="mac" label="macOS">macOS steps</TabItem>
  <TabItem value="win" label="Windows">Windows steps</TabItem>
</Tabs>

<!-- After -->
<Tabs>
  <Tab title="macOS">macOS steps</Tab>
  <Tab title="Windows">Windows steps</Tab>
</Tabs>
```

### Accordions → Mintlify Accordion

```mdx
<!-- Before -->
<details>
  <summary>Click to expand</summary>
  Hidden content here.
</details>

<!-- After -->
<Accordion title="Click to expand">
  Hidden content here.
</Accordion>
```

### H1 reconciliation with frontmatter

Handles all combinations of H1 heading and `title` frontmatter:

| Situation | Result |
|---|---|
| H1 equals `title` | H1 removed (duplicate) |
| H1 differs from `title` | H1 becomes new `title`; old `title` moves to `sidebarTitle` |
| No `title` in frontmatter | H1 becomes `title`, H1 removed from body |
| No frontmatter at all | Frontmatter created with `title` from H1 |

### Frontmatter key renames

| Docusaurus key | Mintlify key |
|---|---|
| `sidebar_label` | `sidebarTitle` |

All other frontmatter keys are preserved as-is.

### Theme imports removed

```mdx
<!-- Removed automatically -->
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import Admonition from '@docusaurus/Admonition';
```

### Internal links — extensions stripped

```mdx
<!-- Before -->
[See setup](./installation.md)
[API reference](../api/index.mdx#authentication)

<!-- After -->
[See setup](./installation)
[API reference](../api/index#authentication)
```

### Images — paths converted and wrapped in `<Frame>`

- Absolute Docusaurus paths (`/img/foo.png`) → `/static/img/foo.png`
- Relative paths are resolved and converted where possible
- All standalone images are wrapped in `<Frame>`

```mdx
<!-- Before -->
![Dashboard](/img/dashboard.png)

<!-- After -->
<Frame>![Dashboard](/static/img/dashboard.png)</Frame>
```

The `static/` folder from the Docusaurus project root is also copied to `<output>/static/`.

### Snippets — `_`-prefixed files routed to `snippets/`

Files whose names start with `_` or that live inside a `_snippets/` directory are moved into the `snippets/` output folder. Import paths in other files are rewritten to use the Mintlify absolute `/snippets/...` path.

### HTML comments → JSX comments

```mdx
<!-- Before -->
<!-- This is a comment -->

<!-- After -->
{/* This is a comment */}
```

## Examples

```bash
# Convert a Docusaurus project root
wc docusaurus convert ./my-docusaurus-site

# Convert just a docs subfolder
wc docusaurus convert ./my-docusaurus-site/docs

# Preview without writing
wc docusaurus convert ./my-docusaurus-site --dry-run

# Write to a custom output directory
wc docusaurus convert ./my-docusaurus-site --output ./converted
```

## Output Structure

Given a Docusaurus project at `./my-site`:

```
my-site/
├── docs/
│   ├── intro.md
│   ├── tutorial/
│   │   └── basics.mdx
│   └── _shared/
│       └── _note.mdx     ← snippet
└── static/
    └── img/
        └── logo.png
```

Running `wc docusaurus convert ./my-site` produces:

```
mintlify/
├── intro.mdx
├── tutorial/
│   └── basics.mdx
├── snippets/
│   └── _shared/
│       └── _note.mdx
└── static/
    └── img/
        └── logo.png
```

## Typical Workflow

This command is step 1 of a three-step Docusaurus → Mintlify migration:

```bash
# 1. Convert all files
wc docusaurus convert ./my-docusaurus-site

# 2. Rename files to match their frontmatter slug/id
wc docusaurus slugify ./mintlify

# 3. Generate Mintlify navigation from sidebars.js
wc docusaurus nav ./my-docusaurus-site/sidebars.js --prefix mintlify
```

## Config File

```json
{
  "docusaurus": {
    "output": "mintlify",
    "dry-run": false,
    "quiet": false
  }
}
```
