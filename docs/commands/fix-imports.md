# Fix Imports Command

Scans MDX files for custom JSX component usage, validates import statements, and automatically adds missing imports when the component file is found in the `snippets/` folder.

## Usage

```bash
writechoice fix imports [options]
```

## Options

| Option              | Alias | Description                                         | Default      |
| ------------------- | ----- | --------------------------------------------------- | ------------ |
| `--file <path>`     | `-f`  | Check a single MDX file                             | -            |
| `--dir <path>`      | `-d`  | Check MDX files in a specific directory             | -            |
| `--snippets <path>` | -     | Path to the snippets folder                         | `snippets`   |
| `--dry-run`         | -     | Preview changes without writing files               | `false`      |
| `--quiet`           | -     | Suppress terminal output                            | `false`      |

## How It Works

1. **Scan** — Finds all PascalCase JSX components used in each MDX file (skips code blocks and inline code)
2. **Filter** — Ignores Mintlify built-in components that require no import
3. **Check imports** — For each custom component:
   - If an import exists, resolves the path and verifies the file exists
   - If no import exists, searches the `snippets/` folder for a matching file
4. **Fix** — Adds missing imports when a snippet file is found; inserts after frontmatter alongside existing imports

Exit code `1` is returned when invalid import paths or unresolved components are found.

## Mintlify Built-in Components (ignored)

These components are provided by Mintlify and do not require an import:

`Note` `Warning` `Info` `Tip` `Card` `CardGroup` `CardBody` `Tabs` `Tab` `Steps` `Step` `Accordion` `AccordionGroup` `Frame` `Tooltip` `Check` `CodeGroup` `Icon` `Snippet` `Update` `ResponseField` `Expandable` `ParamField` `RequestExample` `ResponseExample` `Columns` `Badge`

## Snippet File Matching

When searching for a component file, the following name variants are tried (in order) across all files inside `snippets/`:

| Component name | Variants tried |
| -------------- | --------------- |
| `MyButton`     | `MyButton.mdx`, `my-button.mdx`, `mybutton.mdx` (and `.jsx`, `.tsx`, `.js`, `.ts`) |

The `snippets/` folder is searched recursively.

## Import Format

| Snippet file type | Generated import |
| ----------------- | ---------------- |
| `.mdx`            | `import MyButton from '/snippets/my-button.mdx'` |
| `.js` / `.ts`     | `import { MyButton } from '/snippets/my-button.js'` |

## Examples

### Check all MDX files

```bash
writechoice fix imports
```

### Preview without writing

```bash
writechoice fix imports --dry-run
```

### Check a single file

```bash
writechoice fix imports -f docs/getting-started.mdx
```

### Use a non-default snippets folder

```bash
writechoice fix imports --snippets src/components
```

## Output Format

```
🧩  Component Import Checker

Found 12 MDX file(s) to check

docs/guides/setup.mdx
  + MyButton — added import from snippets/my-button.mdx
  ✗ OldWidget — import path not found: /snippets/old-widget

docs/api/reference.mdx
  ⚠ CustomTable — no snippet found in snippets/

✓ Added 1 missing import(s)
✗ 1 import(s) point to non-existent files
⚠  1 component(s) have no snippet file in snippets/
```

### Status symbols

| Symbol | Meaning |
| ------ | ------- |
| `+`    | Import added (or would be added in dry-run) |
| `✗`    | Import path exists in file but the file it points to does not exist |
| `⚠`    | Component used but no snippet file found — manual action required |

## Configuration File

```json
{
  "components": {
    "dir": "docs",
    "snippets": "snippets",
    "dry-run": false,
    "quiet": false
  }
}
```

| Field      | Type    | Description                           | Default      |
| ---------- | ------- | ------------------------------------- | ------------ |
| `file`     | string  | Check a single MDX file               | `null`       |
| `dir`      | string  | Check MDX files in a directory        | `null`       |
| `snippets` | string  | Path to snippets folder               | `"snippets"` |
| `dry-run`  | boolean | Preview without writing               | `false`      |
| `quiet`    | boolean | Suppress terminal output              | `false`      |

## See Also

- [Fix Parse Command](./fix-parse.md) — Fix MDX parsing errors
- [Fix Images Command](./fix-images.md) — Wrap images in Frame components
- [Configuration File](../config-file.md) — Configure default settings
