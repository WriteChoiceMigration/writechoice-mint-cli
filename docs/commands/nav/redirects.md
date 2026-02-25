# wc nav redirects

Reads the `redirects` array from `docs.json` and replaces stale source paths with their destination paths inside MDX files. Fixes internal links that still point to old URLs after a nav restructure.

## Usage

```bash
wc nav redirects
```

## Options

| Option | Description | Default |
|---|---|---|
| `--docs <file>` | Path to docs.json | `docs.json` |
| `-d, --dir <path>` | Directory to scan for MDX files | cwd |
| `--dry-run` | Preview replacements without writing files | `false` |
| `--quiet` | Suppress terminal output | `false` |

## How It Works

For each `{ source, destination }` entry in `docs.json`'s `redirects` array, the command searches all `.mdx` files for the source path used in link contexts and replaces it with the destination path.

### Matched Link Contexts

| Pattern | Example |
|---|---|
| Markdown link | `[text](/old/path)` |
| Markdown link with anchor | `[text](/old/path#section)` |
| JSX href (double quotes) | `href="/old/path"` |
| JSX href (single quotes) | `href='/old/path'` |
| JSX href with anchor | `href="/old/path#section"` |

Only **exact** path matches are replaced — `/docs/foo` will not replace `/docs/foo-bar`.

### Output

For each changed file, the command reports the filename and number of replacements:

```
docs/integrate-pos-device/marshall/guides/overview.mdx — 3 replacements
docs/integrate-pos-device/marshall/methods/api.mdx — 1 replacement

  ✓ Updated 2 files (4 replacements)
```

## Typical Workflow

Run after `nav folders` to fix any internal links that referenced the old paths:

```bash
wc nav folders
wc nav redirects
```

## Configuration

```json
{
  "nav": {
    "redirects": {
      "docs": "docs.json",
      "dir": "docs",
      "dry-run": false,
      "quiet": false
    }
  }
}
```

## Examples

Preview all replacements without writing:

```bash
wc nav redirects --dry-run
```

Scope the scan to a specific folder:

```bash
wc nav redirects --dir docs/integrate-pos-device
```
