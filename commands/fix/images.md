# Fix Images Command

Automatically wraps standalone images in `<Frame>` components in MDX documentation files.

## Usage[​](#usage "Direct link to Usage")

```
writechoice fix images [options]
```

## Options[​](#options "Direct link to Options")

| Option             | Alias | Description                                                        | Default |
| ------------------ | ----- | ------------------------------------------------------------------ | ------- |
| `--file <path>`    | `-f`  | Fix a single MDX file                                              | -       |
| `--dir <path>`     | `-d`  | Fix MDX files in a specific directory                              | -       |
| `--download [url]` | -     | Download missing local images (uses `source` from config or a URL) | -       |
| `--dry-run`        | -     | Preview changes without writing files                              | `false` |
| `--quiet`          | -     | Suppress terminal output                                           | `false` |

## What Gets Wrapped[​](#what-gets-wrapped "Direct link to What Gets Wrapped")

**Markdown images** on their own line:

```
![Alt text](https://example.com/image.png)
```

**HTML `<img>` tags** on their own line:

```
<img src="https://example.com/image.png" alt="Alt text" />
```

Both become:

```
<Frame>

![Alt text](https://example.com/image.png)

</Frame>
```

## What Is Skipped[​](#what-is-skipped "Direct link to What Is Skipped")

| Protected region          | Example                               |
| ------------------------- | ------------------------------------- |
| Existing `<Frame>` blocks | `<Frame>![img](url)</Frame>`          |
| Fenced code blocks        | ` ``` ` ... ` ``` `                   |
| Markdown tables           | `\| ![img](url) \| data \|`           |
| HTML tables               | `<table><tr><td><img /></td></table>` |

Images that are part of inline text (not alone on a line) are also left unchanged — use [Fix Inline Images](/commands/fix/inlineimages.md) for those.

## Examples[​](#examples "Direct link to Examples")

```
# Preview changes before writing

writechoice fix images --dry-run



# Fix all MDX files in the current directory

writechoice fix images



# Fix a specific directory

writechoice fix images -d docs/api



# Download missing images using source from config.json

writechoice fix images --download



# Download missing images from a specific URL

writechoice fix images --download https://docs.example.com
```

## Downloading Missing Images[​](#downloading-missing-images "Direct link to Downloading Missing Images")

When `--download` is used:

* Root-relative paths (e.g. `/images/logo.png`) are downloaded from the provided or configured base URL
* External URLs are skipped
* Files already on disk are not re-downloaded
* Failures are written to `image_download.json`

## Config File[​](#config-file "Direct link to Config File")

```
{

  "images": {

    "dir": "docs",

    "download": false,

    "dry-run": false,

    "quiet": false

  }

}
```

## Safety[​](#safety "Direct link to Safety")

* Never removes or modifies image attributes
* Images already in `<Frame>` are never touched
* Idempotent: running twice produces the same result
* Use `--dry-run` before writing
* Revert with `git checkout .` if needed
