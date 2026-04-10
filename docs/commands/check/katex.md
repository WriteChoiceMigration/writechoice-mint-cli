# Check KaTeX Command

Finds pages with KaTeX render errors by scanning for `.katex-error` elements in the live HTML.

## Usage

```bash
writechoice check katex <baseUrl> [options]
writechoice check katex --file <report.json> [options]
```

## Arguments

- `<baseUrl>` (required for scan mode): Base URL of the deployed documentation site. All page paths from `docs.json` navigation are appended to this URL.

## Options

| Option                   | Alias | Description                                              | Default              |
| ------------------------ | ----- | -------------------------------------------------------- | -------------------- |
| `--file <path>`          | `-f`  | Re-check only pages listed in a previous error report    | -                    |
| `--docs <file>`          | -     | Path to docs.json                                        | `docs.json`          |
| `--output <path>`        | `-o`  | Output file for the error report                         | `katex_errors.json`  |
| `--concurrency <number>` | `-c`  | Number of parallel HTTP requests                         | `50`                 |
| `--quiet`                | -     | Suppress terminal output                                 | `false`              |

## Modes

### Scan Mode

Reads `docs.json`, extracts every page path from the navigation tree, fetches each page at `baseUrl/<page-path>`, and checks for `.katex-error` spans in the returned HTML.

```bash
writechoice check katex https://docs.example.com
```

On completion, writes all pages that had errors to `katex_errors.json`.

### Recheck Mode

Reads a previous `katex_errors.json` report and re-fetches only the URLs it contains. Use this after fixing KaTeX issues to confirm they are resolved.

```bash
writechoice check katex --file katex_errors.json
```

Overwrites the report file in place, removing any pages that are now clean.

## How It Works

1. **Page discovery** (scan mode only): Recursively walks the `navigation` tree in `docs.json`, collecting all string entries (page paths) from `pages`, `tabs`, `groups`, `anchors`, `dropdowns`, and `versions` keys.
2. **Fetching**: Each page URL is fetched with a plain HTTP GET (no browser required). Requests run concurrently up to the `--concurrency` limit.
3. **Error detection**: The raw HTML is scanned for spans matching:
   ```
   <span class="katex-error" title="...">...</span>
   ```
   Both the `title` attribute (the KaTeX error message) and the span content (the offending expression) are captured.
4. **Reporting**: Results are printed to the terminal and written to the output JSON file.

## Examples

### Full scan using a config URL

```bash
# Uses katex.url from config.json
writechoice check katex
```

### Scan a specific deployment

```bash
writechoice check katex https://staging-docs.example.com
```

### Recheck after fixes

```bash
# After fixing KaTeX issues, verify they are resolved
writechoice check katex --file katex_errors.json
```

### Custom docs.json location

```bash
writechoice check katex https://docs.example.com --docs mint/docs.json
```

### Custom output file

```bash
writechoice check katex https://docs.example.com -o reports/katex.json
```

### Lower concurrency for rate-limited hosts

```bash
writechoice check katex https://docs.example.com -c 10
```

## Report Format

The output JSON is an array of pages that had KaTeX errors:

```json
[
  {
    "url": "https://docs.example.com/math/equations",
    "katex_errors": [
      {
        "title": "KaTeX parse error: Expected 'EOF', got '\\right' at position 12: ...",
        "content": "\\frac{1}{2} \\right"
      }
    ]
  }
]
```

Pages without errors are not included. If no errors are found the file is written as an empty array `[]`.

## Recommended Workflow

1. **Run the full scan** after deploying:
   ```bash
   writechoice check katex https://docs.example.com
   ```

2. **Review** `katex_errors.json` to find the source MDX files with broken math expressions.

3. **Fix** the KaTeX expressions in the relevant MDX files.

4. **Re-deploy** and re-check:
   ```bash
   writechoice check katex --file katex_errors.json
   ```
   This only re-fetches the pages that had errors, making it much faster than a full scan.

5. **Repeat** until `katex_errors.json` is empty.

## Exit Codes

| Code | Meaning                          |
| ---- | -------------------------------- |
| `0`  | No KaTeX errors found            |
| `1`  | One or more pages had KaTeX errors, or a required argument was missing |

## Config File Support

If you run multiple live-checking commands against the same deployment, set the global `preview` key once and all commands will use it as a fallback:

```json
{
  "preview": "https://preview.docs.example.com"
}
```

You can also set a URL specific to this command under `katex.url`, which takes precedence over `preview`:

```json
{
  "katex": {
    "url": "https://docs.example.com",
    "reportFile": "katex_errors.json"
  }
}
```

Then run without arguments:

```bash
writechoice check katex          # scan mode
writechoice check katex --file   # recheck mode using katex.reportFile
```

See the [Configuration File](../../config-file.md) reference for all available `katex` options.
