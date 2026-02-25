# Fix Codeblocks Command

Automatically adds or removes code block flags (`expandable`, `lines`, `wrap`) in MDX documentation files.

## Usage

```bash
writechoice fix codeblocks [options]
```

## Options

| Option                   | Alias | Description                                              | Default |
| ------------------------ | ----- | -------------------------------------------------------- | ------- |
| `--file <path>`          | `-f`  | Fix a single MDX file directly                           | -       |
| `--dir <path>`           | `-d`  | Fix MDX files in a specific directory                    | -       |
| `--threshold <number>`   | `-t`  | Line count threshold for `expandable`                    | `15`    |
| `--no-expandable`        | -     | Skip `expandable` threshold processing                   | -       |
| `--lines`                | -     | Add `lines` to all code blocks that lack it              | -       |
| `--remove-lines`         | -     | Remove `lines` from all code blocks that have it         | -       |
| `--wrap`                 | -     | Add `wrap` to all code blocks that lack it               | -       |
| `--remove-wrap`          | -     | Remove `wrap` from all code blocks that have it          | -       |
| `--dry-run`              | -     | Preview changes without writing files                    | `false` |
| `--quiet`                | -     | Suppress terminal output                                 | `false` |

## How It Works

The command scans MDX files for fenced code blocks and modifies their info strings (the text after the opening triple backtick). Each flag is handled independently so you can combine them freely.

### expandable

Controlled by the `--threshold` value (default: `15`). The command automatically adds or removes `expandable` based on the number of lines in each code block body:

- Block has `expandable` **and** line count **< threshold** → remove `expandable`
- Block lacks `expandable` **and** line count **> threshold** → add `expandable`
- Block is exactly at the threshold → no change

Use `--no-expandable` to skip this processing entirely.

### lines

Add or remove the `lines` flag, which shows line numbers in the rendered code block.

- `--lines` — adds `lines` to every block that doesn't already have it
- `--remove-lines` — removes `lines` from every block that has it
- Omit both flags — `lines` is not touched

### wrap

Add or remove the `wrap` flag, which enables word wrapping in the rendered code block.

- `--wrap` — adds `wrap` to every block that doesn't already have it
- `--remove-wrap` — removes `wrap` from every block that has it
- Omit both flags — `wrap` is not touched

## Examples

### Preview changes without writing

```bash
writechoice fix codeblocks --dry-run
```

### Add `lines` and `wrap` to all code blocks

```bash
writechoice fix codeblocks --lines --wrap
```

### Use a custom expandable threshold

```bash
# Add expandable to blocks with more than 20 lines
writechoice fix codeblocks --threshold 20
```

### Remove `lines` from all code blocks

```bash
writechoice fix codeblocks --remove-lines
```

### Fix only a specific directory

```bash
writechoice fix codeblocks -d docs/api --lines
```

### Fix a single file

```bash
writechoice fix codeblocks -f docs/getting-started.mdx --wrap
```

### Skip expandable and only manage `lines`

```bash
writechoice fix codeblocks --no-expandable --lines
```

## Before and After

### expandable (threshold: 15)

**Before** — 20-line block without `expandable`, 3-line block with `expandable`:

````mdx
```python
# ... 20 lines of code
```

```bash expandable
echo "hello"
echo "world"
```
````

**After:**

````mdx
```python expandable
# ... 20 lines of code
```

```bash
echo "hello"
echo "world"
```
````

### lines and wrap

**Before:**

````mdx
```javascript
const x = 1;
```
````

**After** (`--lines --wrap`):

````mdx
```javascript lines wrap
const x = 1;
```
````

## Output Format

```
🔧 Code Block Fixer

Found 12 MDX file(s) to process

docs/api/reference.mdx: 3 change(s)
  line 14: added 'expandable' (22 lines > 15)
  line 14: added 'lines'
  line 40: removed 'expandable' (5 lines < 15)

docs/getting-started.mdx: 2 change(s)
  line 7: added 'lines'
  line 7: added 'wrap'

✓ Made 5 change(s) in 2 file(s)
```

### Dry Run Output

```
🔧 Code Block Fixer

Found 12 MDX file(s) to process

Dry run — no files will be written

docs/api/reference.mdx: 3 change(s)
  line 14: added 'expandable' (22 lines > 15)
  ...

✓ Would make 5 change(s) in 2 file(s)
```

### No Changes Needed

```
🔧 Code Block Fixer

Found 12 MDX file(s) to process

⚠️  No changes needed.
```

## Configuration File

You can set defaults in `config.json` to avoid repeating flags:

```json
{
  "codeblocks": {
    "threshold": 20,
    "lines": "add",
    "wrap": null,
    "expandable": true
  }
}
```

| Field        | Type              | Description                                        | Default |
| ------------ | ----------------- | -------------------------------------------------- | ------- |
| `file`       | string            | Fix a single MDX file                              | `null`  |
| `dir`        | string            | Fix MDX files in a specific directory              | `null`  |
| `dry-run`    | boolean           | Preview without writing                            | `false` |
| `quiet`      | boolean           | Suppress terminal output                           | `false` |
| `threshold`  | number            | Line count threshold for `expandable`              | `15`    |
| `expandable` | boolean           | Enable expandable threshold processing             | `true`  |
| `lines`      | `"add"` \| `"remove"` \| `null` | Add or remove `lines` from all blocks | `null`  |
| `wrap`       | `"add"` \| `"remove"` \| `null` | Add or remove `wrap` from all blocks  | `null`  |

CLI flags always take precedence over config.json values.

## Safety Features

### Dry Run First

Always preview changes before writing:

```bash
writechoice fix codeblocks --lines --wrap --dry-run
```

### Non-Destructive

- Only modifies code block info strings — never touches code block content
- Changes are idempotent — running the command twice produces the same result
- Files with no applicable changes are left untouched

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

- `snippets/`
- `node_modules/`
- `.git/`

## See Also

- [Fix Parse Command](./parse.md) — Fix MDX parsing errors
- [Fix Links Command](./links.md) — Fix broken anchor links
- [Configuration File](../../config-file.md) — Configure default settings
