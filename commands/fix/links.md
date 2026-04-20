# Fix Links Command

Automatically fixes broken anchor links in MDX files based on validation reports.

## Usage[​](#usage "Direct link to Usage")

```
writechoice fix links [options]
```

## Options[​](#options "Direct link to Options")

| Option            | Alias | Description                       | Default               |
| ----------------- | ----- | --------------------------------- | --------------------- |
| `--report <path>` | `-r`  | Path to JSON validation report    | `links_report.json`   |
| `--quiet`         | -     | Suppress terminal output          | `false`               |
| `--verbose`       | -     | Show detailed output for each fix | `true` (if not quiet) |

## How It Works[​](#how-it-works "Direct link to How It Works")

Reads the JSON report from `check links` and corrects broken anchor links in your MDX files.

### What Gets Fixed[​](#what-gets-fixed "Direct link to What Gets Fixed")

* Anchor links where the target heading exists but uses a different slug
* The report must contain both the incorrect anchor and the correct one

### What Doesn't Get Fixed[​](#what-doesnt-get-fixed "Direct link to What Doesn't Get Fixed")

* Links to non-existent pages or headings
* Links with network errors or timeouts
* External links

### Fix Process[​](#fix-process "Direct link to Fix Process")

1. Parses the JSON report to find all fixable failures
2. Locates each broken link in the source MDX file by line number
3. Replaces the incorrect anchor with the correct one
4. Preserves the original link format (markdown, HTML, or JSX)
5. Saves the updated file

## Examples[​](#examples "Direct link to Examples")

```
# Fix links using default report file

writechoice fix links



# Fix links from custom report file

writechoice fix links -r custom_report.json



# Quiet mode (useful for CI/CD)

writechoice fix links --quiet
```

## Example Fix[​](#example-fix "Direct link to Example Fix")

```
<!-- Before (incorrect anchor) -->

[Installation Guide](./installation#setup)



<!-- After (corrected anchor) -->

[Installation Guide](./installation#setup-process)
```

## Recommended Workflow[​](#recommended-workflow "Direct link to Recommended Workflow")

1. Run validation:
   <!-- -->
   ```
   writechoice check links https://docs.example.com
   ```
2. Review `links_report.md` for a readable summary.
3. Apply fixes:
   <!-- -->
   ```
   writechoice fix links
   ```
4. Review with `git diff`.
5. Re-validate to confirm.

## Safety[​](#safety "Direct link to Safety")

* Only modifies the anchor portion of links, not paths
* Preserves link format (markdown/HTML/JSX)
* Idempotent: running twice produces the same result
* Revert with `git checkout .` if needed

## Troubleshooting[​](#troubleshooting "Direct link to Troubleshooting")

**Report file not found:**

```
# Generate the report first

writechoice check links https://docs.example.com
```

**Note:** The fix command requires the JSON report file (`links_report.json`), not the Markdown one.
