# Fix Parse Command

Automatically fixes common MDX parsing errors in documentation files.

## Usage[​](#usage "Direct link to Usage")

```
writechoice fix parse [options]
```

## Options[​](#options "Direct link to Options")

| Option            | Alias | Description                           | Default                  |
| ----------------- | ----- | ------------------------------------- | ------------------------ |
| `--report <path>` | `-r`  | Path to JSON parse validation report  | `mdx_errors_report.json` |
| `--file <path>`   | `-f`  | Fix a single MDX file directly        | -                        |
| `--dir <path>`    | `-d`  | Fix MDX files in a specific directory | -                        |
| `--quiet`         | -     | Suppress terminal output              | `false`                  |
| `--verbose`       | -     | Show detailed output for each fix     | `true` (if not quiet)    |

## What Gets Fixed[​](#what-gets-fixed "Direct link to What Gets Fixed")

### 1. Void HTML Tags Not Self-Closed[​](#1-void-html-tags-not-self-closed "Direct link to 1. Void HTML Tags Not Self-Closed")

HTML void elements must be self-closing in JSX/MDX.

| Before                             | After                                |
| ---------------------------------- | ------------------------------------ |
| `<br>`                             | `<br />`                             |
| `<hr>`                             | `<hr />`                             |
| `<img src="/logo.png" alt="Logo">` | `<img src="/logo.png" alt="Logo" />` |
| `<input type="text">`              | `<input type="text" />`              |
| `<meta charset="utf-8">`           | `<meta charset="utf-8" />`           |

### 2. Stray Angle Brackets in Text[​](#2-stray-angle-brackets-in-text "Direct link to 2. Stray Angle Brackets in Text")

Bare `<` and `>` in text content are escaped to HTML entities.

| Before       | After           |
| ------------ | --------------- |
| `if x < 10`  | `if x &lt; 10`  |
| `when a > b` | `when a &gt; b` |

Content inside fenced code blocks and inline code is never modified.

## What Doesn't Get Fixed[​](#what-doesnt-get-fixed "Direct link to What Doesn't Get Fixed")

* Mismatched or unclosed JSX tags
* Invalid JavaScript expressions inside `{}`
* Unclosed curly braces
* Malformed frontmatter

## Input Modes[​](#input-modes "Direct link to Input Modes")

### Report Mode (default)[​](#report-mode-default "Direct link to Report Mode (default)")

Reads a JSON report from `check parse` and fixes only the files listed.

```
writechoice fix parse              # uses mdx_errors_report.json

writechoice fix parse -r custom_report.json
```

### Direct Mode[​](#direct-mode "Direct link to Direct Mode")

Scans and fixes files directly without a report.

```
writechoice fix parse -f path/to/file.mdx

writechoice fix parse -d docs
```

## Recommended Workflow[​](#recommended-workflow "Direct link to Recommended Workflow")

1. Run validation:
   <!-- -->
   ```
   writechoice check parse
   ```
2. Review `mdx_errors_report.md`.
3. Apply fixes:
   <!-- -->
   ```
   writechoice fix parse
   ```
4. Review with `git diff`.
5. Re-validate — remaining errors need manual attention.

## Safety[​](#safety "Direct link to Safety")

* Never modifies content inside code blocks or inline code
* Idempotent: running twice produces the same result
* Revert with `git checkout .` if needed
