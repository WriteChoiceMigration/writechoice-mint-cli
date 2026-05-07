# Configuration File Reference

# Configuration File

WriteChoice Mint CLI supports an optional `config.json` file for setting default values and avoiding repetitive CLI arguments.

## Quick Start

### Generate Config File

The easiest way to create a `config.json` is using the config command:

```bash
writechoice config
```

This creates a template file with all available options. Then edit the placeholder values:

```json
{
  "source": "https://docs.example.com",
  "target": "http://localhost:3000"
}
```

### Manual Creation

Alternatively, create `config.json` manually in your project root:

```json
{
  "source": "https://docs.example.com",
  "target": "http://localhost:3000"
}
```

Now you can run commands without arguments:

```bash
writechoice check links
writechoice check parse
writechoice fix links
```

## Configuration Priority

Configuration values are merged with this priority (highest to lowest):

1. **CLI arguments** — Values passed directly to the command
2. **Command-specific config** — Settings in `links`, `parse`, etc.
3. **Global config** — Top-level settings in `config.json`
4. **Built-in defaults** — Hardcoded fallback values

## Global Settings

| Field | Type | Description | Used By |
|---|---|---|---|
| `source` | string | Base URL for production documentation | `check links`, `metadata` |
| `target` | string | Base URL for validation environment | `check links` |
| `preview` | string | Shared default base URL for live checkers | `check pages`, `check images`, `check katex` |

## Command Settings

### `links` — Check Links

```json
{
  "links": {
    "file": null,
    "dir": null,
    "output": "links_report",
    "dry-run": false,
    "quiet": false,
    "concurrency": 25,
    "headless": true
  }
}
```

### `parse` — Check Parse

```json
{
  "parse": {
    "file": null,
    "dir": null,
    "quiet": false
  }
}
```

### `pages` — Check Pages

```json
{
  "pages": {
    "url": null,
    "docs": "docs.json",
    "output": "pages_report.json",
    "concurrency": 50,
    "quiet": false
  }
}
```

### `imageCheck` — Check Images

```json
{
  "imageCheck": {
    "url": null,
    "docs": "docs.json",
    "output": "images_report.json",
    "concurrency": 10,
    "quiet": false
  }
}
```

### `katex` — Check KaTeX

```json
{
  "katex": {
    "url": null,
    "reportFile": "katex_errors.json",
    "docs": "docs.json",
    "output": "katex_errors.json",
    "concurrency": 50,
    "quiet": false
  }
}
```

### `codeblocks` — Fix Codeblocks

```json
{
  "codeblocks": {
    "file": null,
    "dir": null,
    "dry-run": false,
    "quiet": false,
    "threshold": 15,
    "expandable": true,
    "lines": null,
    "wrap": null
  }
}
```

`lines` and `wrap` accept `"add"`, `"remove"`, or `null`.

### `images` — Fix Images

```json
{
  "images": {
    "file": null,
    "dir": null,
    "download": false,
    "dry-run": false,
    "quiet": false
  }
}
```

### `inlineimages` — Fix Inline Images

```json
{
  "inlineimages": {
    "file": null,
    "dir": null,
    "dry-run": false,
    "quiet": false
  }
}
```

### `h1` — Fix H1

```json
{
  "h1": {
    "file": null,
    "dir": null,
    "dry-run": false,
    "quiet": false
  }
}
```

### `metadata` — Metadata

```json
{
  "metadata": {
    "file": null,
    "dir": null,
    "concurrency": 15,
    "dry-run": false,
    "quiet": false
  }
}
```

### `nav` — Nav Commands

```json
{
  "nav": {
    "folders": {
      "docs": "docs.json",
      "base": "docs",
      "skip_levels": [],
      "rename": false,
      "dry-run": false,
      "quiet": false
    },
    "root": {
      "docs": "docs.json",
      "dry-run": false,
      "quiet": false
    },
    "redirects": {
      "docs": "docs.json",
      "dir": ".",
      "dry-run": false,
      "quiet": false
    }
  }
}
```

### `scrape` — Scrape

```json
{
  "scrape": {
    "urls_file": "urls.json",
    "output": "output",
    "concurrency": 3,
    "playwright": false,
    "content_selector": "main",
    "title_selector": "h1",
    "elements_to_remove": [],
    "html_preserve_elements": ["table", "iframe"],
    "images": {
      "strategy": "keep_remote"
    },
    "playwright_config": {
      "headless": true,
      "storage_state": null
    }
  }
}
```

## Complete Example

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "description": "Configuration file for WriteChoice Mint CLI",

  "source": "https://docs.example.com",
  "target": "http://localhost:3000",
  "preview": "https://preview.docs.example.com",

  "links": {
    "output": "links_report",
    "concurrency": 25,
    "headless": true
  },

  "parse": {
    "quiet": false
  },

  "pages": {
    "concurrency": 50
  },

  "imageCheck": {
    "concurrency": 10
  },

  "codeblocks": {
    "threshold": 15,
    "lines": "add"
  }
}
```

## Best Practices

1. **Add `config.json` to `.gitignore`** if it contains environment-specific URLs; commit `config.example.json` instead.
2. **Add report files to `.gitignore`**:
   ```
   links_report.json
   links_report.md
   mdx_errors_report.json
   pages_report.json
   images_report.json
   katex_errors.json
   ```
3. **Use `quiet: true` in CI** to keep logs clean while still generating report files.
4. **Use `preview`** when all your live checkers point to the same deployment.

## Schema Support

Add `$schema` for IDE autocompletion and inline validation:

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#"
}
```
