# Check KaTeX

# Check KaTeX Command

Finds pages with KaTeX render errors by scanning for `.katex-error` elements in the live HTML.

## Usage

```bash
writechoice check katex <baseUrl> [options]
writechoice check katex --file <report.json> [options]
```

## Arguments

- `<baseUrl>` (required for scan mode): Base URL of the deployed documentation site.

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

Reads `docs.json`, fetches each page at `baseUrl/<page-path>`, and checks for `.katex-error` spans.

```bash
writechoice check katex https://docs.example.com
```

### Recheck Mode

Reads a previous `katex_errors.json` and re-fetches only the URLs it contains. Use this after fixing to confirm resolution.

```bash
writechoice check katex --file katex_errors.json
```

## How It Works

1. Recursively walks `docs.json` navigation to collect all page paths.
2. Fetches each page URL with HTTP GET (no browser required), concurrently.
3. Scans the raw HTML for spans matching `.katex-error` and captures the error title and expression.
4. Writes results to the output JSON file.

## Examples

```bash
# Full scan
writechoice check katex https://docs.example.com

# Recheck after fixes
writechoice check katex --file katex_errors.json

# Custom docs.json location
writechoice check katex https://docs.example.com --docs mint/docs.json

# Lower concurrency
writechoice check katex https://docs.example.com -c 10
```

## Report Format

```json
[
  {
    "url": "https://docs.example.com/math/equations",
    "katex_errors": [
      {
        "title": "KaTeX parse error: Expected 'EOF', got '\\right' at position 12",
        "content": "\\frac{1}{2} \\right"
      }
    ]
  }
]
```

## Recommended Workflow

1. Run the full scan after deploying.
2. Review `katex_errors.json` to find broken math expressions.
3. Fix the KaTeX in the source MDX files.
4. Re-deploy, then recheck:
   ```bash
   writechoice check katex --file katex_errors.json
   ```
5. Repeat until the report is empty.

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | No KaTeX errors found |
| `1` | One or more pages had KaTeX errors |

## Config File Support

```json
{
  "katex": {
    "url": "https://docs.example.com",
    "reportFile": "katex_errors.json"
  }
}
```
