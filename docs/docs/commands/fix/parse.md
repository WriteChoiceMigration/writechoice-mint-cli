---
sidebar_position: 2
title: Fix Parse
---

# Fix Parse Command

Automatically fixes common MDX parsing errors in documentation files.

## Usage

```bash
writechoice fix parse [options]
```

## Options

| Option            | Alias | Description                           | Default                    |
| ----------------- | ----- | ------------------------------------- | -------------------------- |
| `--report <path>` | `-r`  | Path to JSON parse validation report  | `mdx_errors_report.json`   |
| `--file <path>`   | `-f`  | Fix a single MDX file directly        | -                          |
| `--dir <path>`    | `-d`  | Fix MDX files in a specific directory | -                          |
| `--quiet`         | -     | Suppress terminal output              | `false`                    |
| `--verbose`       | -     | Show detailed output for each fix     | `true` (if not quiet)      |

## What Gets Fixed

### 1. Void HTML Tags Not Self-Closed

HTML void elements must be self-closing in JSX/MDX.

| Before | After |
|---|---|
| `<br>` | `<br />` |
| `<hr>` | `<hr />` |
| `<img src="/logo.png" alt="Logo">` | `<img src="/logo.png" alt="Logo" />` |
| `<input type="text">` | `<input type="text" />` |
| `<meta charset="utf-8">` | `<meta charset="utf-8" />` |

### 2. Stray Angle Brackets in Text

Bare `<` and `>` in text content are escaped to HTML entities.

| Before | After |
|---|---|
| `if x < 10` | `if x &lt; 10` |
| `when a > b` | `when a &gt; b` |

Content inside fenced code blocks and inline code is never modified.

## What Doesn't Get Fixed

- Mismatched or unclosed JSX tags
- Invalid JavaScript expressions inside `{}`
- Unclosed curly braces
- Malformed frontmatter

## Input Modes

### Report Mode (default)

Reads a JSON report from `check parse` and fixes only the files listed.

```bash
writechoice fix parse              # uses mdx_errors_report.json
writechoice fix parse -r custom_report.json
```

### Direct Mode

Scans and fixes files directly without a report.

```bash
writechoice fix parse -f path/to/file.mdx
writechoice fix parse -d docs
```

## Recommended Workflow

1. Run validation:
   ```bash
   writechoice check parse
   ```
2. Review `mdx_errors_report.md`.
3. Apply fixes:
   ```bash
   writechoice fix parse
   ```
4. Review with `git diff`.
5. Re-validate — remaining errors need manual attention.

## Safety

- Never modifies content inside code blocks or inline code
- Idempotent: running twice produces the same result
- Revert with `git checkout .` if needed
