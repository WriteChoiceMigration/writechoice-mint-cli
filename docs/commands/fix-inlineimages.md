# Fix Inline Images Command

Converts images that appear inline within text to `<InlineImage>` components in MDX documentation files, and automatically adds the required import statement.

## Usage

```bash
writechoice fix inlineimages [options]
```

## Options

| Option          | Alias | Description                           | Default |
| --------------- | ----- | ------------------------------------- | ------- |
| `--file <path>` | `-f`  | Fix a single MDX file directly        | -       |
| `--dir <path>`  | `-d`  | Fix MDX files in a specific directory | -       |
| `--dry-run`     | -     | Preview changes without writing files | `false` |
| `--quiet`       | -     | Suppress terminal output              | `false` |

## How It Works

The command scans MDX files line by line, looking for image syntax that shares a line with other text content. Those images are converted to `<InlineImage>` components. Images that are alone on their own line (standalone) are left unchanged — use [`fix images`](./fix-images.md) for those.

### What Gets Converted

**Markdown image inline with text:**

```mdx
Click the ![icon](/images/icon.png) button to continue.
```

**HTML `<img>` tag inline with text:**

```mdx
Click the <img src="/images/icon.png" alt="icon" /> button to continue.
```

Both are converted to `<InlineImage>`:

```mdx
Click the <InlineImage src="/images/icon.png" alt="icon" /> button to continue.
```

### Attribute Handling

| Source syntax | Result |
|---|---|
| `![alt text](url)` | `<InlineImage src="url" alt="alt text" />` |
| `![](url)` (empty alt) | `<InlineImage src="url" />` — alt omitted |
| `<img src="url" alt="desc" />` | `<InlineImage src="url" alt="desc" />` |
| `<img src="url" alt="desc" width="32" />` | `<InlineImage src="url" alt="desc" width="32" />` — extra props kept |

### Import Injection

The command automatically adds the import statement to every modified file. The import is placed:

- **After frontmatter** (if the file starts with `---`), with an empty line below
- **At the top of the file** if there is no frontmatter

**With frontmatter:**

```mdx
---
title: My Page
---

import { InlineImage } from "/snippets/InlineImage.jsx";

Page content...
```

**Without frontmatter:**

```mdx
import { InlineImage } from "/snippets/InlineImage.jsx";

Page content...
```

If the import is already present in the file, it is not added again.

### What Is Skipped

The command never touches images inside:

| Protected region         | Example                                               |
| ------------------------ | ----------------------------------------------------- |
| Fenced code blocks       | ` ``` ` ... ` ``` `                                  |
| Inline code spans        | `` `![img](url)` ``                                   |
| Markdown tables          | `\| ![img](url) \| data \|`                          |
| HTML tables              | `<table><tr><td><img src="..." /></td>...`            |
| `<Frame>` blocks         | `<Frame>![img](url)</Frame>`                          |
| Linked images            | `[![img](url)](link)` — image inside a markdown link |

**Standalone images** (alone on their own line) are also left unchanged:

```mdx
![standalone image](url)
```

Use [`fix images`](./fix-images.md) to wrap those in `<Frame>`.

## Examples

### Preview changes before writing

```bash
writechoice fix inlineimages --dry-run
```

### Fix all MDX files in the current directory

```bash
writechoice fix inlineimages
```

### Fix a specific directory

```bash
writechoice fix inlineimages -d docs/api
```

### Fix a single file

```bash
writechoice fix inlineimages -f docs/getting-started.mdx
```

## Before and After

### Markdown image inline with text

**Before:**

```mdx
---
title: Getting Started
---

Click the ![help icon](/images/help.png) button for more information.

See the ![warning](/images/warn.png) before proceeding.
```

**After:**

```mdx
---
title: Getting Started
---

import { InlineImage } from "/snippets/InlineImage.jsx";

Click the <InlineImage src="/images/help.png" alt="help icon" /> button for more information.

See the <InlineImage src="/images/warn.png" alt="warning" /> before proceeding.
```

### HTML img tag inline with text

**Before:**

```mdx
Click <img src="/images/icon.png" alt="settings" /> to open settings.
```

**After:**

```mdx
import { InlineImage } from "/snippets/InlineImage.jsx";

Click <InlineImage src="/images/icon.png" alt="settings" /> to open settings.
```

### Standalone image — unchanged

```mdx
![This image is alone on its line](url)
```

This is left as-is. Run `fix images` to wrap it in `<Frame>`.

### Inside a code block — unchanged

````mdx
```mdx
Here is how to write an inline image: ![alt](url)
<img src="url" alt="example" />
```
````

## Output Format

```
🖼️  Inline Image Fixer

Found 18 MDX file(s) to process

docs/getting-started.mdx: converted 3 inline image(s)
docs/api/reference.mdx: converted 1 inline image(s)

✓ Converted 4 inline image(s) in 2 file(s)
```

### Dry Run Output

```
🖼️  Inline Image Fixer

Found 18 MDX file(s) to process

Dry run — no files will be written

docs/getting-started.mdx: converted 3 inline image(s)

✓ Would convert 3 inline image(s) in 1 file(s)
```

### No Changes Needed

```
🖼️  Inline Image Fixer

Found 18 MDX file(s) to process

⚠️  No inline images found.
```

## Configuration File

You can set defaults in `config.json`:

```json
{
  "inlineimages": {
    "dir": "docs",
    "dry-run": false,
    "quiet": false
  }
}
```

| Field     | Type    | Description                           | Default |
| --------- | ------- | ------------------------------------- | ------- |
| `file`    | string  | Fix a single MDX file                 | `null`  |
| `dir`     | string  | Fix MDX files in a specific directory | `null`  |
| `dry-run` | boolean | Preview changes without writing files | `false` |
| `quiet`   | boolean | Suppress terminal output              | `false` |

CLI flags always take precedence over config.json values.

## Safety Features

### Dry Run First

Preview all changes before writing:

```bash
writechoice fix inlineimages --dry-run
```

### Non-Destructive

- Only modifies lines where an inline image is found
- Never touches standalone images, code blocks, or tables
- Import is only added once per file, even if re-run
- Changes are idempotent — running the command on an already-converted file produces no changes

### Reversibility

All changes can be reverted with git:

```bash
# Undo all changes
git checkout .

# Undo changes to a specific file
git checkout docs/getting-started.mdx
```

## Relationship to Fix Images

| Command | What it handles |
|---|---|
| `fix images` | Standalone images (alone on their own line) → wraps in `<Frame>` |
| `fix inlineimages` | Inline images (sharing a line with text) → converts to `<InlineImage>` |

Run both commands to fully handle all images in your documentation:

```bash
writechoice fix images
writechoice fix inlineimages
```

## Excluded Directories

The following directories are skipped automatically:

- `node_modules/`
- `.git/`

## See Also

- [Fix Images Command](./fix-images.md) — Wrap standalone images in `<Frame>`
- [Fix Codeblocks Command](./fix-codeblocks.md) — Fix code block flags
- [Configuration File](../config-file.md) — Configure default settings
