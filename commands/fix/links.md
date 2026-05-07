# Fix Links

# Fix Links Command

Automatically fixes broken anchor links in MDX files based on validation reports.

## Usage

```bash
writechoice fix links [options]
```

## Options

| Option            | Alias | Description                          | Default              |
| ----------------- | ----- | ------------------------------------ | -------------------- |
| `--report <path>` | `-r`  | Path to JSON validation report       | `links_report.json`  |
| `--quiet`         | -     | Suppress terminal output             | `false`              |
| `--verbose`       | -     | Show detailed output for each fix    | `true` (if not quiet)|

## How It Works

Reads the JSON report from `check links` and corrects broken anchor links in your MDX files.

### What Gets Fixed

- Anchor links where the target heading exists but uses a different slug
- The report must contain both the incorrect anchor and the correct one

### What Doesn't Get Fixed

- Links to non-existent pages or headings
- Links with network errors or timeouts
- External links

### Fix Process

1. Parses the JSON report to find all fixable failures
2. Locates each broken link in the source MDX file by line number
3. Replaces the incorrect anchor with the correct one
4. Preserves the original link format (markdown, HTML, or JSX)
5. Saves the updated file

## Examples

```bash
# Fix links using default report file
writechoice fix links

# Fix links from custom report file
writechoice fix links -r custom_report.json

# Quiet mode (useful for CI/CD)
writechoice fix links --quiet
```

## Example Fix

```markdown
<!-- Before (incorrect anchor) -->
[Installation Guide](./installation#setup)

<!-- After (corrected anchor) -->
[Installation Guide](./installation#setup-process)
```

## Recommended Workflow

1. Run validation:
   ```bash
   writechoice check links https://docs.example.com
   ```
2. Review `links_report.md` for a readable summary.
3. Apply fixes:
   ```bash
   writechoice fix links
   ```
4. Review with `git diff`.
5. Re-validate to confirm.

## Safety

- Only modifies the anchor portion of links, not paths
- Preserves link format (markdown/HTML/JSX)
- Idempotent: running twice produces the same result
- Revert with `git checkout .` if needed

## Troubleshooting

**Report file not found:**

```bash
# Generate the report first
writechoice check links https://docs.example.com
```

**Note:** The fix command requires the JSON report file (`links_report.json`), not the Markdown one.
