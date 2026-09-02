---
sidebar_position: 13
title: Fix Dollar Signs
---

# Fix Dollar Signs Command

Escapes a bare `$` immediately before a digit in prose (e.g. `$60` → `\$60`), which some downstream renderers otherwise treat as the start of KaTeX/LaTeX math.

## Usage

```bash
writechoice fix dollar-signs [options]
```

## Options

| Option          | Alias | Description                           | Default |
| --------------- | ----- | ------------------------------------- | ------- |
| `--file <path>` | `-f`  | Fix a single MDX file                 | -       |
| `--dir <path>`  | `-d`  | Fix MDX files in a specific directory | -       |
| `--dry-run`     | -     | Preview changes without writing files | `false` |
| `--quiet`       | -     | Suppress terminal output              | `false` |

## Why This Is Needed

A raw `$` before a number in MDX prose (e.g. "costs $60") can be misread as the opening delimiter of inline math by KaTeX-aware renderers. Escaping it (`\$60`) keeps it as a literal dollar sign.

## What Gets Converted

Any bare `$` immediately followed by a digit, outside of code and outside anything that looks like real LaTeX math:

```mdx
{/* Before */}
It costs $60 or $70 depending on plan.

{/* After */}
It costs \$60 or \$70 depending on plan.
```

## What Is Left Unchanged

- `$` not immediately followed by a digit (e.g. `$x`, `$variable`)
- Already-escaped `\$`
- Anything inside a fenced code block (` ``` ` or `~~~`)
- Anything inside an inline `code span`
- A `$...$` or `$$...$$` span that looks like real LaTeX math — see below

### LaTeX awareness

A `$...$` span is treated as math (and left completely untouched, even if it starts with a digit) when its content contains a LaTeX marker: a backslash (`\`), caret (`^`), underscore (`_`), or curly brace (`{`/`}`). For example `$5 \times 10^{3}$` is left alone.

This is a heuristic, not a full LaTeX parser — matching this repo's convention of pure string transforms without AST parsing. It deliberately does **not** treat every `$...$` pair as protected, since ordinary prose with two dollar amounts on one line (e.g. "It costs $60 or $70") would otherwise be silently skipped. Only pairs containing an actual math-looking marker are protected; both amounts in a plain two-price sentence still get escaped.

## Examples

```bash
# Preview what would change
writechoice fix dollar-signs --dry-run

# Fix all MDX files in the current directory
writechoice fix dollar-signs

# Fix a specific directory
writechoice fix dollar-signs -d pages/pricing

# Fix a single file
writechoice fix dollar-signs -f pages/pricing/plans.mdx
```

## Config File

```json
{
  "dollar-signs": {
    "dir": "pages",
    "dry-run": false,
    "quiet": false
  }
}
```

## Safety

- Skips code fences, inline code, and LaTeX-looking `$...$`/`$$...$$` spans
- Idempotent: an already-escaped `\$` is never re-escaped
- Use `--dry-run` to preview before writing
- Revert with `git checkout .` if needed
