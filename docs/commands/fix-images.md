# Fix Images Command

Automatically wraps standalone images in `<Frame>` components in MDX documentation files.

## Usage

```bash
writechoice fix images [options]
```

## Options

| Option              | Alias | Description                                                          | Default |
| ------------------- | ----- | -------------------------------------------------------------------- | ------- |
| `--file <path>`     | `-f`  | Fix a single MDX file directly                                       | -       |
| `--dir <path>`      | `-d`  | Fix MDX files in a specific directory                                | -       |
| `--download [url]`  | -     | Download missing local images; uses `source` from config or a URL   | -       |
| `--dry-run`         | -     | Preview changes without writing files                                | `false` |
| `--quiet`           | -     | Suppress terminal output                                             | `false` |

## How It Works

The command scans MDX files for standalone images that are not already wrapped in a `<Frame>` component, then wraps each one.

### What Gets Wrapped

**Markdown images** on their own line:

```mdx
![Alt text](https://example.com/image.png)
```

**HTML `<img>` tags** on their own line:

```mdx
<img src="https://example.com/image.png" alt="Alt text" />
```

Both are wrapped as:

```mdx
<Frame>
![Alt text](https://example.com/image.png)
</Frame>
```

### What Is Skipped

The command never modifies images inside:

| Protected region         | Example                                      |
| ------------------------ | -------------------------------------------- |
| Existing `<Frame>` blocks | `<Frame>![img](url)</Frame>`                |
| Fenced code blocks       | ` ``` ` ... ` ``` `                         |
| Markdown tables          | `\| ![img](url) \| data \|`                 |
| HTML tables              | `<table><tr><td><img src="..." /></td>...`   |

Images that are part of inline text (not on a line by themselves) are also left unchanged.

## Examples

### Preview changes before writing

```bash
writechoice fix images --dry-run
```

### Fix all MDX files in the current directory

```bash
writechoice fix images
```

### Fix a specific directory

```bash
writechoice fix images -d docs/api
```

### Fix a single file

```bash
writechoice fix images -f docs/getting-started.mdx
```

### Download missing images (using source from config.json)

```bash
writechoice fix images --download
```

### Download missing images from a specific URL

```bash
writechoice fix images --download https://docs.example.com
```

## Downloading Missing Images

Use `--download` to fetch images that are referenced in MDX files but not found locally.

```bash
writechoice fix images --download
writechoice fix images --download https://docs.example.com
```

- Without a URL, the `source` field from `config.json` is used as the base.
- Only root-relative paths (e.g. `/images/logo.png`) are attempted — external URLs are skipped.
- If a file already exists locally it is not re-downloaded.
- Downloaded files are saved to the same path under the repo root (directories are created if needed).
- If any downloads fail, an `image_download.json` report is written listing each failure with its reason.

### image_download.json format

```json
{
  "downloaded": [
    { "src": "/images/logo.png", "url": "https://docs.example.com/images/logo.png" }
  ],
  "failed": [
    { "src": "/images/missing.png", "url": "https://docs.example.com/images/missing.png", "reason": "HTTP 404" }
  ]
}
```

The report is only written when there are failures. Use `--dry-run` to check what would be downloaded without saving anything.

## Before and After

### Markdown image

**Before:**

```mdx
Here is a screenshot of the dashboard.

![Dashboard overview](https://example.com/dashboard.png)

Follow the steps below to continue.
```

**After:**

```mdx
Here is a screenshot of the dashboard.

<Frame>
![Dashboard overview](https://example.com/dashboard.png)
</Frame>

Follow the steps below to continue.
```

### HTML img tag

**Before:**

```mdx
<img src="https://example.com/logo.svg" alt="Company logo" />
```

**After:**

```mdx
<Frame>
<img src="https://example.com/logo.svg" alt="Company logo" />
</Frame>
```

### Already wrapped — unchanged

```mdx
<Frame>
![Already framed](https://example.com/image.png)
</Frame>
```

### Inside a code block — unchanged

````mdx
```mdx
![This is example code](url)
<img src="url" />
```
````

### Inside a markdown table — unchanged

```mdx
| Screenshot | Description |
| ---------- | ----------- |
| ![Step 1](step1.png) | Click the button |
```

### Inside an HTML table — unchanged

```mdx
<table>
  <tr>
    <td><img src="step1.png" alt="Step 1" /></td>
    <td>Click the button</td>
  </tr>
</table>
```

## Output Format

```
🖼️  Image Frame Fixer

Found 24 MDX file(s) to process

docs/getting-started.mdx: wrapped 2 image(s)
docs/api/reference.mdx: wrapped 1 image(s)

✓ Wrapped 3 image(s) in 2 file(s)
```

### Dry Run Output

```
🖼️  Image Frame Fixer

Found 24 MDX file(s) to process

Dry run — no files will be written

docs/getting-started.mdx: wrapped 2 image(s)
docs/api/reference.mdx: wrapped 1 image(s)

✓ Would wrap 3 image(s) in 2 file(s)
```

### No Changes Needed

```
🖼️  Image Frame Fixer

Found 24 MDX file(s) to process

⚠️  No unwrapped images found.
```

## Configuration File

You can set defaults in `config.json`:

```json
{
  "images": {
    "dir": "docs",
    "download": false,
    "dry-run": false,
    "quiet": false
  }
}
```

| Field      | Type            | Description                                                        | Default |
| ---------- | --------------- | ------------------------------------------------------------------ | ------- |
| `file`     | string          | Fix a single MDX file                                              | `null`  |
| `dir`      | string          | Fix MDX files in a specific directory                              | `null`  |
| `download` | boolean\|string | `true` to use `source` from config, or a URL string               | `false` |
| `dry-run`  | boolean         | Preview changes without writing files                              | `false` |
| `quiet`    | boolean         | Suppress terminal output                                           | `false` |

CLI flags always take precedence over config.json values.

## Safety Features

### Dry Run First

Always preview before writing to confirm only intended images are affected:

```bash
writechoice fix images --dry-run
```

### Non-Destructive

- Only adds `<Frame>` wrappers — never removes or modifies image attributes
- Images already inside `<Frame>` blocks are never touched
- Changes are idempotent — running the command twice produces the same result

### Reversibility

All changes can be reverted with git:

```bash
# Undo all changes
git checkout .

# Undo changes to a specific file
git checkout docs/getting-started.mdx
```

## Excluded Directories

The following directories are skipped automatically:

- `node_modules/`
- `.git/`

## See Also

- [Fix Codeblocks Command](./fix-codeblocks.md) — Fix code block flags
- [Fix Parse Command](./fix-parse.md) — Fix MDX parsing errors
- [Configuration File](../config-file.md) — Configure default settings
