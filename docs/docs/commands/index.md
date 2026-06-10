---
sidebar_position: 0
title: Commands
slug: /commands
---

# Commands Reference

All commands are invoked as `wc <command>`. Use this page as a quick reference — click any command to go to its full documentation.

---

## Scrape

| Command | Description |
|---|---|
| [`wc scrape`](./scrape/index.mdx) | Scrapes documentation URLs and converts each page into an MDX file ready for Mintlify |

---

## Check

| Command | Description |
|---|---|
| [`wc check links`](./check/links.md) | Validates internal links and anchors in MDX documentation files using browser automation |
| [`wc check parse`](./check/parse.md) | Validates MDX files for parsing errors using the official `@mdx-js/mdx` compiler |
| [`wc check images`](./check/images.md) | Validates that all images on your deployed documentation pages load successfully |
| [`wc check pages`](./check/pages.md) | Validates that every page listed in `docs.json` navigation loads successfully |
| [`wc check katex`](./check/katex.md) | Finds pages with KaTeX render errors by scanning for `.katex-error` elements in the live HTML |

---

## Fix

| Command | Description |
|---|---|
| [`wc fix links`](./fix/links.md) | Automatically fixes broken anchor links in MDX files based on `check links` reports |
| [`wc fix parse`](./fix/parse.md) | Automatically fixes common MDX parsing errors in documentation files |
| [`wc fix images`](./fix/images.md) | Wraps standalone images in `<Frame>` components in MDX files |
| [`wc fix inlineimages`](./fix/inlineimages.md) | Converts images inline within text to `<InlineImage>` components |
| [`wc fix h1`](./fix/h1.md) | Removes duplicate H1 headings that repeat the frontmatter `title` field |
| [`wc fix imports`](./fix/imports.md) | Validates and adds missing import statements for JSX components used in MDX files |
| [`wc fix redirects`](./fix/redirects.md) | Replaces stale source paths with destination paths inside MDX files based on `docs.json` redirects |
| [`wc fix tabs`](./fix/tabs.md) | Converts code-only `<Tabs>` groups into `<CodeGroup>` components |

---

## Nav

| Command | Description |
|---|---|
| [`wc nav folders`](./nav/folders.md) | Restructures MDX files on disk to match the navigation hierarchy defined in `docs.json` |
| [`wc nav root`](./nav/root.md) | Promotes matching group index pages to a `root` key in `docs.json` |

---

## Docusaurus

| Command | Description |
|---|---|
| [`wc docusaurus convert`](./docusaurus/convert.md) | Converts a Docusaurus docs folder to Mintlify-ready MDX files |
| [`wc docusaurus slugify`](./docusaurus/slugify.md) | Renames files so their paths match the `slug` or `id` in their frontmatter |
| [`wc docusaurus nav`](./docusaurus/nav.md) | Converts a Docusaurus `sidebars.js` file into Mintlify navigation JSON |

---

## Other

| Command | Description |
|---|---|
| [`wc metadata`](./metadata.md) | Fetches meta tags from live documentation pages and writes them into MDX frontmatter |
| [`wc session`](./session.md) | Captures an authenticated browser session for use with `wc scrape` |
| [`wc config`](./config.md) | Generates a `config.json` template file with all available configuration options |
| [`wc update`](./update.md) | Updates the CLI to the latest version from npm |
