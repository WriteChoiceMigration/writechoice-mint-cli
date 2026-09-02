# Commands

# Commands Reference

All commands are invoked as `writechoice <command>` (or the shorter `wcc <command>`). Use this page as a quick reference — click any command to go to its full documentation.

---

## Scrape

| Command | Description |
|---|---|
| [`writechoice scrape`](./scrape/index.mdx) | Scrapes documentation URLs and converts each page into an MDX file ready for Mintlify |

---

## Check

| Command | Description |
|---|---|
| [`writechoice check links`](./check/links.md) | Validates internal links and anchors in MDX documentation files using browser automation |
| [`writechoice check parse`](./check/parse.md) | Validates MDX files for parsing errors using the official `@mdx-js/mdx` compiler |
| [`writechoice check images`](./check/images.md) | Validates that all images on your deployed documentation pages load successfully |
| [`writechoice check pages`](./check/pages.md) | Validates that every page listed in `docs.json` navigation loads successfully |
| [`writechoice check katex`](./check/katex.md) | Finds pages with KaTeX render errors by scanning for `.katex-error` elements in the live HTML |

---

## Fix

| Command | Description |
|---|---|
| [`writechoice fix links`](./fix/links.md) | Automatically fixes broken anchor links in MDX files based on `check links` reports |
| [`writechoice fix parse`](./fix/parse.md) | Automatically fixes common MDX parsing errors in documentation files |
| [`writechoice fix images`](./fix/images.md) | Wraps standalone images in `<Frame>` components in MDX files |
| [`writechoice fix inlineimages`](./fix/inlineimages.md) | Converts images inline within text to `<InlineImage>` components |
| [`writechoice fix h1`](./fix/h1.md) | Removes duplicate H1 headings that repeat the frontmatter `title` field |
| [`writechoice fix imports`](./fix/imports.md) | Validates and adds missing import statements for JSX components used in MDX files |
| [`writechoice fix redirects`](./fix/redirects.md) | Replaces stale source paths with destination paths inside MDX files based on `docs.json` redirects |
| [`writechoice fix tabs`](./fix/tabs.md) | Converts code-only `<Tabs>` groups into `<CodeGroup>` components |
| [`writechoice fix codeblocks`](./fix/codeblocks.md) | Adjusts code block flags (expandable, lines, wrap) in MDX files |
| [`writechoice fix void-tags`](./fix/void-tags.md) | Self-closes HTML void tags (`img`, `br`, `hr`, ...) so MDX compiles as valid JSX |
| [`writechoice fix accordions`](./fix/accordions.md) | Wraps runs of 2+ sibling `<Accordion>` blocks in `<AccordionGroup>` |
| [`writechoice fix og-description`](./fix/og-description.md) | Renames frontmatter `description` to `og:description` |
| [`writechoice fix dollar-signs`](./fix/dollar-signs.md) | Escapes a bare `$` before a digit in prose, skipping code and LaTeX math |

---

## Find

| Command | Description |
|---|---|
| [`writechoice find redirects`](./find/redirects.md) | Probes broken links for HTTP redirects and writes a redirects JSON file |

---

## Readme

| Command | Description |
|---|---|
| [`writechoice readme convert`](./readme/convert.md) | Converts readme.com markdown exports to Mintlify MDX |
| [`writechoice readme recipes`](./readme/recipes.md) | Converts legacy recipe `.md` files into `<RequestExample>`/`<ResponseExample>`/`<Steps>` MDX |
| [`writechoice readme openapi`](./readme/openapi.md) | Extracts inline `# OpenAPI definition` blocks into Mintlify `openapi` frontmatter |
| [`writechoice readme openapi-dedupe`](./readme/openapi-dedupe.md) | Comments out page bodies that duplicate their OpenAPI operation's description |
| [`writechoice readme nav`](./readme/nav.md) | Scrapes a readme.io sidebar and converts it to Mintlify navigation JSON |

---

## Nav

| Command | Description |
|---|---|
| [`writechoice nav folders`](./nav/folders.md) | Restructures MDX files on disk to match the navigation hierarchy defined in `docs.json` |
| [`writechoice nav root`](./nav/root.md) | Promotes matching group index pages to a `root` key in `docs.json` |

---

## Docusaurus

| Command | Description |
|---|---|
| [`writechoice docusaurus convert`](./docusaurus/convert.md) | Converts a Docusaurus docs folder to Mintlify-ready MDX files |
| [`writechoice docusaurus slugify`](./docusaurus/slugify.md) | Renames files so their paths match the `slug` or `id` in their frontmatter |
| [`writechoice docusaurus nav`](./docusaurus/nav.md) | Converts a Docusaurus `sidebars.js` file into Mintlify navigation JSON |

---

## Other

| Command | Description |
|---|---|
| [`writechoice metadata`](./metadata.md) | Fetches meta tags from live documentation pages and writes them into MDX frontmatter |
| [`writechoice session`](./session.md) | Captures an authenticated browser session for use with `writechoice scrape` |
| [`writechoice config`](./config.md) | Generates a `config.json` template file with all available configuration options |
| [`writechoice update`](./update.md) | Updates the CLI to the latest version from npm |
