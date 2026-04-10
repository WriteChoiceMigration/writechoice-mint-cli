---
sidebar_position: 2
title: Quick Start
---

# Quick Start

This guide walks you through setting up the CLI and running your first validation in under five minutes.

## 1. Install

```bash
npm install -g @writechoice/mint-cli
npx playwright install chromium
```

## 2. Create a config file

Run this in the root of your Mintlify project (the folder that contains `docs.json`):

```bash
wcc config
```

This creates a `config.json` file. Edit the placeholder values:

```json
{
  "source": "https://docs.your-site.com",
  "target": "http://localhost:3000"
}
```

- **`source`** — your live documentation URL (used for link validation and metadata)
- **`target`** — your local preview server (used when validating against a local build)

## 3. Validate MDX parsing

Check all MDX files in the project for syntax errors:

```bash
wcc check parse
```

Errors are written to `mdx_errors_report.json`. Fix them automatically with:

```bash
wcc fix parse
```

## 4. Validate links

Check internal links and anchors against your live site:

```bash
wcc check links
```

Results are saved to `links_report.json`. Fix broken anchors automatically:

```bash
wcc fix links
```

## 5. Explore other commands

| Command | What it does |
|---|---|
| `wcc check images` | Verify all images load on live pages |
| `wcc check pages` | Verify all pages in `docs.json` return 200 |
| `wcc fix codeblocks` | Add/remove flags on code blocks |
| `wcc fix images` | Wrap standalone images in `<Frame>` |
| `wcc nav folders` | Restructure files to match your `docs.json` nav |
| `wcc metadata` | Pull meta tags from live pages into frontmatter |
| `wcc scrape` | Scrape a site and convert pages to MDX |

See the **Commands** section in the sidebar for full documentation on each command.
