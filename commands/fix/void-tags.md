# Fix Void Tags

# Fix Void Tags Command

Self-closes HTML void tags (`<img>`, `<br>`, `<hr>`, ...) in MDX files: `<img src="...">` → `<img src="..." />`.

## Usage

```bash
writechoice fix void-tags [options]
```

## Options

| Option          | Alias | Description                           | Default |
| --------------- | ----- | ------------------------------------- | ------- |
| `--file <path>` | `-f`  | Fix a single MDX file                 | -       |
| `--dir <path>`  | `-d`  | Fix MDX files in a specific directory | -       |
| `--dry-run`     | -     | Preview changes without writing files | `false` |
| `--quiet`       | -     | Suppress terminal output              | `false` |

## Why This Is Needed

Raw HTML void elements (`area`, `base`, `br`, `col`, `embed`, `hr`, `img`, `input`, `link`, `meta`, `source`, `track`, `wbr`) are valid unclosed in plain HTML, but MDX compiles as JSX, which requires every void element to be self-closing. A page with an unclosed `<img>` or `<br>` fails to build. This is common in docs converted from other formats or hand-written with raw HTML.

`wcc readme convert` already calls this fixer automatically on every file it writes, so freshly converted `.mdx` files are closed by default. Use this command directly for anything convert doesn't touch — hand-written MDX, files converted before this fix landed, or other conversion pipelines (Docusaurus, scrape, etc.).

## What Gets Converted

Any unclosed void tag outside of code — `<br>` → `<br />`, `<img src="...">` → `<img src="..." />` — including tags with multiple attributes.

## What Is Left Unchanged

- Already self-closed tags (`<img ... />`)
- Non-void tags (`<div>`, `<span>`, ...)
- Void-tag-like text inside fenced code blocks or inline code spans — reuses the same code-fence/inline-code-aware detection as `wcc fix parse`, so an example showing raw `<img>` HTML in a code block isn't corrupted

## Examples

```bash
# Preview what would change
writechoice fix void-tags --dry-run

# Fix all MDX files in the current directory
writechoice fix void-tags

# Fix a specific directory
writechoice fix void-tags -d pages/docs

# Fix a single file
writechoice fix void-tags -f pages/docs/quickstart.mdx
```

## Config File

```json
{
  "void-tags": {
    "dir": "pages",
    "dry-run": false,
    "quiet": false
  }
}
```

## Safety

- Skips tags already self-closed and tags inside code fences or inline code
- Idempotent: running again on already-fixed files produces no changes
- Use `--dry-run` to preview before writing
- Revert with `git checkout .` if needed
