# Fix Redirects

# Fix Redirects Command

Reads the `redirects` array from `docs.json` and replaces stale source paths with their destination paths inside MDX files. Fixes internal links that still point to old URLs after a navigation restructure.

## Usage

```bash
wc fix redirects
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

Only **exact** path matches are replaced — `/docs/foo` will not replace `/docs/foo-bar`.

## Typical Workflow

Run after `nav folders` to fix any internal links that referenced the old paths:

```bash
wc nav folders
wc fix redirects
```

## Examples

```bash
# Preview all replacements without writing
wc fix redirects --dry-run

# Scope the scan to a specific folder
wc fix redirects --dir docs/api

# Use a custom docs.json
wc fix redirects --docs path/to/docs.json
```

## Config File

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

## Safety

- Only replaces exact path matches in link contexts — no partial matches
- Idempotent: already-updated links are not re-replaced
- Use `--dry-run` to preview before writing
- Revert with `git checkout .` if needed
