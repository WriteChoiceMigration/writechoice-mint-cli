# Fix Parse Command

Automatically fixes common MDX parsing errors in documentation files.

## Usage

```bash
writechoice fix parse [options]
```

## Options

| Option            | Alias | Description                          | Default                    |
| ----------------- | ----- | ------------------------------------ | -------------------------- |
| `--report <path>` | `-r`  | Path to JSON parse validation report | `mdx_errors_report.json`  |
| `--file <path>`   | `-f`  | Fix a single MDX file directly       | -                          |
| `--dir <path>`    | `-d`  | Fix MDX files in a specific directory| -                          |
| `--quiet`         | -     | Suppress terminal output             | `false`                    |
| `--verbose`       | -     | Show detailed output for each fix    | `true` (if not quiet)      |

## How It Works

The fix command scans MDX files and applies safe, deterministic corrections for two categories of parsing errors.

### What Gets Fixed

#### 1. Void HTML Tags Not Self-Closed

HTML void elements must be self-closing in JSX/MDX. The command detects and fixes these automatically.

**Supported void elements:** `area`, `base`, `br`, `col`, `embed`, `hr`, `img`, `input`, `link`, `meta`, `source`, `track`, `wbr`

| Before | After |
|---|---|
| `<br>` | `<br />` |
| `<hr>` | `<hr />` |
| `<img src="/logo.png" alt="Logo">` | `<img src="/logo.png" alt="Logo" />` |
| `<input type="text" name="email">` | `<input type="text" name="email" />` |
| `<meta charset="utf-8">` | `<meta charset="utf-8" />` |

Tags that are already self-closed (`<br />`, `<img src="x" />`) are left unchanged.

#### 2. Stray Angle Brackets in Text

Bare `<` and `>` characters in text content are interpreted as JSX tag boundaries by the MDX compiler, causing parse errors. The command escapes them to HTML entities.

| Before | After |
|---|---|
| `if x < 10` | `if x &lt; 10` |
| `when a > b` | `when a &gt; b` |
| `use < and > operators` | `use &lt; and &gt; operators` |

The command distinguishes stray angle brackets from valid tags by checking whether `<` is followed by a valid tag-start character (letter, `/`, or `!`). Only angle brackets that are clearly not part of tags are escaped.

### What Doesn't Get Fixed

- Mismatched or unclosed JSX tags (e.g., `<div>` without `</div>`)
- Invalid JavaScript expressions inside `{}`
- Unclosed curly braces
- Malformed frontmatter
- Any error that requires understanding the author's intent

### Protected Content

The command **never modifies** content inside:
- **Fenced code blocks** (` ``` `)
- **Inline code** (`` ` `` backtick spans)

This means `<br>` and `x < 5` inside code examples are preserved exactly as written.

## Input Modes

The command supports two input modes:

### Report Mode (default)

Reads a JSON report from `check parse` to identify which files have errors, then applies fixes only to those files.

```bash
# Uses default report path
writechoice fix parse

# Uses custom report path
writechoice fix parse -r custom_report.json
```

This requires running `writechoice check parse` first to generate the report.

### Direct Mode

Scans and fixes files directly without needing a report.

```bash
# Fix a single file
writechoice fix parse -f path/to/file.mdx

# Fix all MDX files in a directory
writechoice fix parse -d docs

# Fix all MDX files in the current directory
writechoice fix parse -d .
```

## Examples

### Basic Usage

```bash
# Fix files listed in the default report
writechoice fix parse

# Fix files from a custom report
writechoice fix parse -r custom_report.json
```

### Direct File Fixing

```bash
# Fix a single file
writechoice fix parse -f docs/getting-started.mdx

# Fix all files in a directory
writechoice fix parse -d docs
```

### Quiet Mode

```bash
# Suppress output (useful for CI/CD)
writechoice fix parse --quiet
```

## Example Fixes

### Void Tags

**Before:**
```mdx
This has a line break<br>here.

<img src="/screenshot.png" alt="Screenshot">

<hr>
```

**After:**
```mdx
This has a line break<br />here.

<img src="/screenshot.png" alt="Screenshot" />

<hr />
```

### Stray Angle Brackets

**Before:**
```mdx
Set the value to x < 100 and y > 50.

The condition a < b is evaluated first.
```

**After:**
```mdx
Set the value to x &lt; 100 and y &gt; 50.

The condition a &lt; b is evaluated first.
```

### Code Blocks Are Preserved

The following content is **not modified**:

````mdx
```python
if x < 10:
    print("<br>")
```

Use `<br>` for line breaks and `x < y` for comparisons.
````

## Output Format

### Success Output

```
🔧 MDX Parse Fixer

Reading report: mdx_errors_report.json
Found 3 file(s) with errors

Fixed docs/getting-started.mdx: 2 void tag(s), 1 stray bracket(s)
Fixed api/reference.mdx: 0 void tag(s), 3 stray bracket(s)

✓ Fixed 6 issue(s) in 2 file(s):

  docs/getting-started.mdx: 2 void tag(s), 1 stray bracket(s)
  api/reference.mdx: 3 stray bracket(s)

⚠️  Run validation again to verify the fixes:
  writechoice check parse
```

### No Fixes Available

```
🔧 MDX Parse Fixer

Reading report: mdx_errors_report.json
Found 2 file(s) with errors

⚠️  No fixable issues found.
```

This can happen if:
- The errors are not in the two fixable categories (void tags, stray brackets)
- The files have already been fixed
- The errors require manual intervention (mismatched tags, invalid expressions)

## Recommended Workflow

1. **Run validation**:
   ```bash
   writechoice check parse
   ```
   This generates `mdx_errors_report.json` and `mdx_errors_report.md`

2. **Review the report**:
   ```bash
   cat mdx_errors_report.md
   ```
   Check which errors can be auto-fixed

3. **Apply fixes**:
   ```bash
   writechoice fix parse
   ```
   This fixes void tags and stray angle brackets

4. **Review changes**:
   ```bash
   git diff
   ```
   Verify the changes look correct

5. **Re-validate**:
   ```bash
   writechoice check parse
   ```
   Check if any remaining errors need manual attention

## Report Requirements

When using report mode, the fix command **requires a JSON report file**. If you provide a Markdown report, you'll get an error:

```
✗ Error: The fix command requires a JSON report file.

The markdown (.md) report is for human readability only.
Please use the JSON report instead: mdx_errors_report.json
```

## Safety Features

### Non-Destructive

The fix command:
- Only modifies files that have fixable issues
- Never touches content inside code blocks or inline code
- Preserves all other formatting and content
- Is idempotent — running it twice produces the same result

### Verification

After running fixes:
1. Use `git diff` to review all changes
2. Run `writechoice check parse` to confirm fixes and check for remaining errors
3. Test your documentation locally before deploying

### Reversibility

All changes can be reverted using git:
```bash
# Undo all fixes
git checkout .

# Undo changes to specific file
git checkout path/to/file.mdx
```

## Troubleshooting

### Report File Not Found

```
✗ Error: Report file not found: mdx_errors_report.json

⚠️  Make sure to run the validation command first:
  writechoice check parse
```

**Solution**: Run `writechoice check parse` to generate the report, or use `--file`/`--dir` to fix files directly.

### Fixes Applied but Errors Remain

After running `fix parse`, some errors may still exist. These are errors outside the two fixable categories:
- Mismatched JSX tags need manual correction
- Invalid JavaScript expressions need manual correction
- Unclosed braces need manual correction

Review the remaining errors in the re-validation report and fix them manually.

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Fix MDX Parsing Errors
on:
  workflow_dispatch:

jobs:
  fix-parse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install -g @writechoice/mint-cli

      - name: Validate MDX files
        run: writechoice check parse
        continue-on-error: true

      - name: Fix parse errors
        run: writechoice fix parse

      - name: Create Pull Request
        uses: peter-evans/create-pull-request@v5
        with:
          title: 'Fix MDX parsing errors'
          commit-message: 'fix: auto-fix void tags and stray angle brackets'
          branch: fix/mdx-parse-errors
```

## See Also

- [Check Parse Command](./check-parse.md) - Generate parse validation reports
- [Fix Links Command](./fix-links.md) - Auto-fix broken anchor links
- [Configuration File](../config-file.md) - Configure default settings
