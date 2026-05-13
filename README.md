# WriteChoice Mint CLI

CLI tool for Mintlify documentation validation and utilities.

## Installation

```bash
npm install -g @writechoice/mint-cli
npx playwright install chromium
```

Both `writechoice` and `wcc` are available as the command name.

## Quick Start

```bash
# Generate a config.json with all available options
writechoice config

# Edit config.json — at minimum set your source URL
# "source": "https://docs.example.com"

# Then run any command without arguments
writechoice check parse
writechoice check links
writechoice scrape
```

## Commands

### Check

| Command | Description |
|---|---|
| `writechoice check parse` | Validate MDX files for parsing errors |
| `writechoice check links [baseUrl]` | Validate internal links and anchors |
| `writechoice check pages [baseUrl]` | Validate every page in `docs.json` loads successfully |
| `writechoice check images [baseUrl]` | Validate that all images on docs pages load |
| `writechoice check katex [baseUrl]` | Check for KaTeX render errors across all pages |

### Fix

| Command | Description |
|---|---|
| `writechoice fix parse` | Fix void tags and stray angle brackets |
| `writechoice fix links` | Fix broken anchor links from a validation report |
| `writechoice fix redirects` | Replace stale redirect sources with destinations in MDX files |
| `writechoice fix codeblocks` | Add/remove `expandable`, `lines`, `wrap` on code blocks |
| `writechoice fix images` | Wrap standalone images in `<Frame>` |
| `writechoice fix inlineimages` | Convert inline images to `<InlineImage>` |
| `writechoice fix h1` | Remove H1 headings that duplicate the frontmatter title |
| `writechoice fix imports` | Add missing component imports from the snippets folder |

### Scrape

| Command | Description |
|---|---|
| `writechoice scrape [urls...]` | Scrape documentation pages and convert them to MDX |
| `writechoice session <url>` | Open a browser to log in and save a session for authenticated scraping |

### Nav

| Command | Description |
|---|---|
| `writechoice nav folders` | Restructure MDX files to match the `docs.json` navigation hierarchy |
| `writechoice nav root` | Promote matching first pages as root entries in nested nav groups |

### Docusaurus

| Command | Description |
|---|---|
| `writechoice docusaurus convert <folder>` | Convert a Docusaurus docs folder to Mintlify MDX |
| `writechoice docusaurus slugify <folder>` | Rename converted MDX files to match their frontmatter slug |
| `writechoice docusaurus nav <file>` | Convert a `sidebars.js` to Mintlify navigation JSON |

### Other

| Command | Description |
|---|---|
| `writechoice metadata [baseUrl]` | Fetch meta tags from live pages and write them into frontmatter |
| `writechoice config` | Generate a `config.json` template |
| `writechoice update` | Update to the latest version |

All commands support `--file <path>`, `--dir <path>`, `--dry-run`, and `--quiet` where applicable.

## Scrape

Converts live documentation pages to MDX files.

```bash
writechoice scrape https://docs.example.com/page
writechoice scrape --urls-file urls.json --output output/
writechoice scrape --playwright  # for JS-rendered pages
```

### Table conversion

By default, HTML tables are converted to GFM markdown tables automatically. The original HTML is kept as a JSX comment directly above the markdown table so you can review or restore it:

```mdx
{/*
<table>...</table>
*/}

| Column A | Column B |
| --- | --- |
| value | value |
```

Tables that contain lists, code blocks, `div`s, or nested tables are too complex to convert cleanly and are kept as raw HTML.

To preserve **all** tables as raw HTML instead, add `"table"` to `html_preserve_elements` in `config.json`:

```json
"html_preserve_elements": ["table", "iframe"]
```

### Authenticated scraping

```bash
# Save a session from your browser login
writechoice session https://docs.example.com/login

# Then reference it in config.json
"playwright_config": { "storage_state": "session.json" }
```

### API mode

For documentation platforms that expose a JSON API:

```json
"api": {
  "content": "article.body",
  "filepath": "article.html_url",
  "title": "article.title"
}
```

## Configuration

Create a `config.json` in your project root to set defaults and avoid repeating arguments:

```json
{
  "source": "https://docs.example.com",
  "target": "http://localhost:3000"
}
```

Run `writechoice config` to generate a full template with all options and inline comments.

## Documentation

Full command documentation is in [docs/commands/](docs/commands/).

## Troubleshooting

**Playwright not installed:**
```bash
npx playwright install chromium
```

**Too many concurrent requests:**
```bash
writechoice check links -c 10
```

**Permission error on install:**
```bash
sudo npm install -g @writechoice/mint-cli
# or use nvm: https://github.com/nvm-sh/nvm
```

## License

MIT — [GitHub](https://github.com/writechoice/mint-cli) · [npm](https://www.npmjs.com/package/@writechoice/mint-cli) · [Issues](https://github.com/writechoice/mint-cli/issues)
