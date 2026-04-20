# Fix Inline Images Command

Converts images that appear inline within text to `<InlineImage>` components in MDX files, and automatically adds the required import statement.

## Usage[​](#usage "Direct link to Usage")

```
writechoice fix inlineimages [options]
```

## Options[​](#options "Direct link to Options")

| Option          | Alias | Description                           | Default |
| --------------- | ----- | ------------------------------------- | ------- |
| `--file <path>` | `-f`  | Fix a single MDX file                 | -       |
| `--dir <path>`  | `-d`  | Fix MDX files in a specific directory | -       |
| `--dry-run`     | -     | Preview changes without writing files | `false` |
| `--quiet`       | -     | Suppress terminal output              | `false` |

## What Gets Converted[​](#what-gets-converted "Direct link to What Gets Converted")

Images that **share a line with other text**:

```
<!-- Before -->

Click the ![icon](/images/icon.png) button to continue.



<!-- After -->

Click the <InlineImage src="/images/icon.png" alt="icon" /> button to continue.
```

HTML `<img>` tags inline with text are also converted.

### Import Injection[​](#import-injection "Direct link to Import Injection")

The command automatically adds the import after the frontmatter block (or at the top if there's no frontmatter). Already-present imports are not duplicated.

```
---

title: My Page

---



import { InlineImage } from "/snippets/InlineImage.jsx";
```

## What Is Skipped[​](#what-is-skipped "Direct link to What Is Skipped")

| Protected region      | Example                        |
| --------------------- | ------------------------------ |
| Fenced code blocks    | ` ``` ` ... ` ``` `            |
| Inline code spans     | `` `![img](url)` ``            |
| Markdown tables       | `\| ![img](url) \| data \|`    |
| HTML tables           | `<table>...<img />...</table>` |
| `<Frame>` blocks      | `<Frame>![img](url)</Frame>`   |
| Linked images         | `[![img](url)](link)`          |
| **Standalone images** | `![img](url)` alone on a line  |

Use [Fix Images](/commands/fix/images.md) to wrap standalone images in `<Frame>`.

## Examples[​](#examples "Direct link to Examples")

```
# Preview changes before writing

writechoice fix inlineimages --dry-run



# Fix all MDX files in the current directory

writechoice fix inlineimages



# Fix a specific directory

writechoice fix inlineimages -d docs/api
```

## Relationship to Fix Images[​](#relationship-to-fix-images "Direct link to Relationship to Fix Images")

| Command            | What it handles                                                        |
| ------------------ | ---------------------------------------------------------------------- |
| `fix images`       | Standalone images → wraps in `<Frame>`                                 |
| `fix inlineimages` | Inline images (sharing a line with text) → converts to `<InlineImage>` |

Run both to fully handle all images in your documentation:

```
writechoice fix images

writechoice fix inlineimages
```

## Config File[​](#config-file "Direct link to Config File")

```
{

  "inlineimages": {

    "dir": "docs",

    "dry-run": false,

    "quiet": false

  }

}
```

## Safety[​](#safety "Direct link to Safety")

* Never modifies standalone images (those alone on their own line)
* Import is only added once per file, even if re-run
* Idempotent: running on an already-converted file produces no changes
* Revert with `git checkout .` if needed
