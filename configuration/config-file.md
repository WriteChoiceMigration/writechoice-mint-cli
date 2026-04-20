# Configuration File

WriteChoice Mint CLI supports an optional `config.json` file for setting default values and avoiding repetitive CLI arguments.

## Quick Start[​](#quick-start "Direct link to Quick Start")

### Generate Config File[​](#generate-config-file "Direct link to Generate Config File")

The easiest way to create a `config.json` is using the config command:

```
writechoice config
```

This creates a template file with all available options. Then edit the placeholder values:

```
{

  "source": "https://docs.example.com",

  "target": "http://localhost:3000"

}
```

### Manual Creation[​](#manual-creation "Direct link to Manual Creation")

Alternatively, create `config.json` manually in your project root:

```
{

  "source": "https://docs.example.com",

  "target": "http://localhost:3000"

}
```

Now you can run commands without arguments:

```
writechoice check links

writechoice check parse

writechoice fix links
```

## Configuration Priority[​](#configuration-priority "Direct link to Configuration Priority")

Configuration values are merged with this priority (highest to lowest):

1. **CLI arguments** — Values passed directly to the command
2. **Command-specific config** — Settings in `links`, `parse`, etc.
3. **Global config** — Top-level settings in `config.json`
4. **Built-in defaults** — Hardcoded fallback values

## Global Settings[​](#global-settings "Direct link to Global Settings")

| Field     | Type   | Description                               | Used By                                      |
| --------- | ------ | ----------------------------------------- | -------------------------------------------- |
| `source`  | string | Base URL for production documentation     | `check links`, `metadata`                    |
| `target`  | string | Base URL for validation environment       | `check links`                                |
| `preview` | string | Shared default base URL for live checkers | `check pages`, `check images`, `check katex` |

## Command Settings[​](#command-settings "Direct link to Command Settings")

### `links` — Check Links[​](#links--check-links "Direct link to links--check-links")

```
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

### `parse` — Check Parse[​](#parse--check-parse "Direct link to parse--check-parse")

```
{

  "parse": {

    "file": null,

    "dir": null,

    "quiet": false

  }

}
```

### `pages` — Check Pages[​](#pages--check-pages "Direct link to pages--check-pages")

```
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

### `imageCheck` — Check Images[​](#imagecheck--check-images "Direct link to imagecheck--check-images")

```
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

### `katex` — Check KaTeX[​](#katex--check-katex "Direct link to katex--check-katex")

```
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

### `codeblocks` — Fix Codeblocks[​](#codeblocks--fix-codeblocks "Direct link to codeblocks--fix-codeblocks")

```
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

### `images` — Fix Images[​](#images--fix-images "Direct link to images--fix-images")

```
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

### `inlineimages` — Fix Inline Images[​](#inlineimages--fix-inline-images "Direct link to inlineimages--fix-inline-images")

```
{

  "inlineimages": {

    "file": null,

    "dir": null,

    "dry-run": false,

    "quiet": false

  }

}
```

### `h1` — Fix H1[​](#h1--fix-h1 "Direct link to h1--fix-h1")

```
{

  "h1": {

    "file": null,

    "dir": null,

    "dry-run": false,

    "quiet": false

  }

}
```

### `metadata` — Metadata[​](#metadata--metadata "Direct link to metadata--metadata")

```
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

### `nav` — Nav Commands[​](#nav--nav-commands "Direct link to nav--nav-commands")

```
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

### `scrape` — Scrape[​](#scrape--scrape "Direct link to scrape--scrape")

```
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

## Complete Example[​](#complete-example "Direct link to Complete Example")

```
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

## Best Practices[​](#best-practices "Direct link to Best Practices")

1. **Add `config.json` to `.gitignore`** if it contains environment-specific URLs; commit `config.example.json` instead.
2. **Add report files to `.gitignore`**:
   <!-- -->
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

## Schema Support[​](#schema-support "Direct link to Schema Support")

Add `$schema` for IDE autocompletion and inline validation:

```
{

  "$schema": "https://json-schema.org/draft-07/schema#"

}
```
