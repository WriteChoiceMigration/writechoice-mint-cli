# Metadata Command

Fetches meta tags from your live documentation pages and writes them into the frontmatter of the corresponding MDX source files. Existing frontmatter keys are updated (overwritten); missing keys are appended.

## Usage

```bash
writechoice metadata [baseUrl] [options]
```

## Arguments

| Argument  | Description                                                  |
| --------- | ------------------------------------------------------------ |
| `baseUrl` | Base URL of the live documentation site (optional if set in config.json as `source`) |

## Options

| Option                   | Alias | Description                                       | Default |
| ------------------------ | ----- | ------------------------------------------------- | ------- |
| `--file <path>`          | `-f`  | Process a single MDX file                         | -       |
| `--dir <path>`           | `-d`  | Process MDX files in a specific directory         | -       |
| `--concurrency <number>` | `-c`  | Number of parallel HTTP requests                  | `15`    |
| `--dry-run`              | -     | Preview changes without writing files             | `false` |
| `--quiet`                | -     | Suppress terminal output                          | `false` |

## How It Works

For each MDX file, the command:

1. **Constructs a URL** by appending the file's path (relative to the scan directory, without `.mdx`) to the base URL
2. **Fetches the live page** using an HTTP request
3. **Extracts meta tags** from the HTML (`og:*`, `twitter:*`)
4. **Updates the frontmatter** — existing keys are overwritten, new keys are appended

### URL Mapping

```
Base URL : https://docs.example.com
Scan dir : docs/
File     : docs/api/reference.mdx
→ URL    : https://docs.example.com/api/reference
```

If no `--dir` is specified, paths are calculated relative to the current working directory:

```
Base URL : https://docs.example.com
File     : getting-started.mdx
→ URL    : https://docs.example.com/getting-started
```

### Meta Tags Fetched

By default, these tags are extracted:

| Tag                   | Frontmatter key         |
| --------------------- | ----------------------- |
| `og:title`            | `"og:title"`            |
| `og:description`      | `"og:description"`      |
| `og:image`            | `"og:image"`            |
| `og:url`              | `"og:url"`              |
| `twitter:title`       | `"twitter:title"`       |
| `twitter:description` | `"twitter:description"` |
| `twitter:image`       | `"twitter:image"`       |

The default tag list can be customized via [`config.json`](#configuration-file).

### Frontmatter Update

**Before:**

```mdx
---
title: API Reference
---
```

**After:**

```mdx
---
title: API Reference
"og:title": "API Reference | Docs"
"og:description": "Complete reference for the API endpoints."
"og:image": "https://docs.example.com/images/og-default.png"
"og:url": "https://docs.example.com/api/reference"
"twitter:title": "API Reference | Docs"
"twitter:description": "Complete reference for the API endpoints."
"twitter:image": "https://docs.example.com/images/og-default.png"
---
```

Keys containing colons (`:`) are automatically quoted in YAML.

If a key already exists in the frontmatter, it is **updated** with the latest value from the live page:

**Before:**

```mdx
---
title: API Reference
"og:title": "Old Title"
---
```

**After:**

```mdx
---
title: API Reference
"og:title": "API Reference | Docs"
---
```

## Examples

### Using base URL from config.json

```bash
writechoice metadata
```

Uses `source` from `config.json` — no argument needed.

### Passing the base URL directly

```bash
writechoice metadata https://docs.example.com
```

### Scan a specific directory

```bash
writechoice metadata https://docs.example.com -d docs/api
```

### Preview changes before writing

```bash
writechoice metadata --dry-run
```

### Process a single file

```bash
writechoice metadata -f docs/getting-started.mdx
```

### Lower concurrency for slower connections

```bash
writechoice metadata -c 5
```

## Output Format

```
🏷️  Metadata Fetcher

Base URL  : https://docs.example.com
Tags      : og:title, og:description, og:image, og:url, twitter:title, twitter:description, twitter:image
Files     : 24 MDX file(s)
Concurrency: 15

✓ docs/getting-started.mdx — added: og:title, og:description | added: 5 tag(s)
✓ docs/api/reference.mdx — updated: og:title | added: og:description, og:image
– docs/changelog.mdx — no meta tags found

✓ Updated 2 file(s)
  docs/getting-started.mdx — added: 7 tag(s)
  docs/api/reference.mdx — updated: 1 | added: 2 tag(s)
```

### Dry Run Output

```
🏷️  Metadata Fetcher

...

Dry run — no files will be written

✓ Would update 2 file(s)
```

### Fetch Error

```
✗ docs/missing-page.mdx — HTTP 404
```

Files with fetch errors are reported but do not cause the command to exit early.

## Configuration File

You can set defaults in `config.json`. The base URL is taken from the top-level `source` field (shared with other commands):

```json
{
  "source": "https://docs.example.com",

  "metadata": {
    "dir": "docs",
    "concurrency": 10,
    "tags": [
      "og:title",
      "og:description",
      "og:image"
    ],
    "dry-run": false,
    "quiet": false
  }
}
```

| Field         | Type     | Description                                       | Default      |
| ------------- | -------- | ------------------------------------------------- | ------------ |
| `file`        | string   | Process a single MDX file                         | `null`       |
| `dir`         | string   | Process MDX files in a specific directory         | `null`       |
| `concurrency` | number   | Number of parallel HTTP requests                  | `15`         |
| `tags`        | string[] | Meta tags to fetch (overrides default list)       | *(see above)*|
| `dry-run`     | boolean  | Preview changes without writing files             | `false`      |
| `quiet`       | boolean  | Suppress terminal output                          | `false`      |

CLI flags always take precedence over config.json values.

## Safety Features

### Dry Run First

Preview all changes before writing:

```bash
writechoice metadata --dry-run
```

### Non-Destructive

- Only modifies frontmatter keys, never body content
- Files with no frontmatter are skipped (not modified)
- Files where the fetched page returns no meta tags are skipped
- Changes are idempotent — re-running updates values to match the current live page

### Reversibility

All changes can be reverted with git:

```bash
git checkout .
```

## Excluded Directories

The following directories are skipped automatically:

- `node_modules/`
- `.git/`

## See Also

- [Fix H1 Command](./fix/h1.md) — Remove duplicate H1 headings
- [Fix Images Command](./fix/images.md) — Wrap standalone images in `<Frame>`
- [Configuration File](../config-file.md) — Configure default settings
