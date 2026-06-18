# Readme Convert

# Readme Convert Command

Converts readme.com markdown exports to Mintlify MDX format. Supports two modes:

- **Local mode** (default): converts `.md` files already on disk from `--from`.
- **Fetch mode** (`--urls-file`): fetches `<url>.md` for each URL in a JSON file, saves raw markdown to `--from`, then converts.

## Usage

```bash
wcc readme convert [options]
```

## Options

| Option | Description | Default |
|---|---|---|
| `--from <dir>` | Source directory containing `.md` files | `readme/docs` |
| `--urls-file <file>` | JSON file with readme.io URLs to fetch, then convert | — |
| `-o, --output <dir>` | Output directory for `.mdx` files | `pages` |
| `--images-dir <dir>` | Directory to save downloaded images from `files.readme.io` | `images/docs` |
| `--no-images` | Skip downloading and localising images | `false` |
| `--dry-run` | Preview output without writing files | `false` |
| `--quiet` | Suppress terminal output | `false` |

## Conversion pipeline

Each `.md` file goes through these transforms in order:

| Step | What it does |
|---|---|
| Frontmatter | Rewrites `title` + `excerpt` → Mintlify `title` + `description` |
| Callout tags | `<Callout theme="info">` → `<Info>`, etc. |
| Blockquote callouts | `> 👍 Title` → `<Tip>` |
| Links | `doc:slug` → `/docs/slug`, `changelog:slug`, `ref:slug` |
| Code blocks | Normalises language aliases (`curl`→`bash`, `sh`→`bash`, `js`→`javascript`, …) and wraps adjacent blocks in `<CodeGroup>` |
| Horizontal rules | `***` → `---` |
| Table tags | `<Table …>` → `<table>` |
| Inline styles | `style="…"` → `style={{…}}` (React-compatible) |
| Image components | `<Image src="…">` → `<Frame><img /></Frame>` (downloads from `files.readme.io`) |
| Markdown images | `![alt](url)` → `<Frame>![](local)</Frame>` |

## Local mode

Convert all `.md` files in `readme/docs/` to `pages/`:

```bash
wcc readme convert
```

Convert from a custom directory:

```bash
wcc readme convert --from exported/docs --output mint/pages
```

## Fetch mode

Fetch markdown from readme.io URLs and then convert:

```bash
wcc readme convert --urls-file urls.json
```

`urls.json` is an array of page URLs (without `.md`):

```json
[
  "https://docs.example.com/docs/getting-started",
  "https://docs.example.com/docs/api-reference"
]
```

The command appends `.md` to each URL, downloads the raw readme markdown into `--from`, then converts every file to `--output`.

## Config file

Set defaults in `config.json` to run `wcc readme convert` without arguments:

```json
{
  "readme": {
    "convert": {
      "from": "readme/docs",
      "urls-file": "urls.json",
      "output": "pages",
      "images-dir": "images/docs",
      "no-images": false,
      "dry-run": false,
      "quiet": false
    }
  }
}
```
