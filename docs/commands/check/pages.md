# Check Pages Command

Validates that every page listed in `docs.json` navigation loads successfully by checking the HTTP response status.

## Usage

```bash
writechoice check pages <baseUrl> [options]
```

## Arguments

- `<baseUrl>` (required): Base URL of the deployed documentation site. Each page path from `docs.json` is appended to this URL.

## Options

| Option                   | Alias | Description                              | Default             |
| ------------------------ | ----- | ---------------------------------------- | ------------------- |
| `--docs <file>`          | -     | Path to docs.json                        | `docs.json`         |
| `--output <path>`        | `-o`  | Output file for the failure report       | `pages_report.json` |
| `--concurrency <number>` | `-c`  | Number of parallel HTTP requests         | `50`                |
| `--quiet`                | -     | Suppress terminal output                 | `false`             |

## How It Works

1. Reads `docs.json` and recursively walks the `navigation` tree, collecting all string entries (page paths) from `pages`, `tabs`, `groups`, `anchors`, `dropdowns`, and `versions` keys. Duplicates are removed.
2. Appends each path to `baseUrl` and sends an HTTP GET request.
3. A response with status `2xx` or `3xx` is considered a **PASS**. Any other status or network error is a **FAIL**.
4. Writes all failures to the output JSON file. Exits with code `1` if any page failed.

## Examples

```bash
# Validate all pages against a deployed site
writechoice check pages https://docs.example.com

# Use URL from config.json
writechoice check pages

# Custom docs.json location
writechoice check pages https://docs.example.com --docs mint/docs.json

# Lower concurrency for rate-limited hosts
writechoice check pages https://docs.example.com -c 10

# Custom report file
writechoice check pages https://docs.example.com -o reports/pages.json
```

## Report Format

Failures are written to `pages_report.json` as an array:

```json
[
  {
    "url": "https://docs.example.com/api/overview",
    "status": 404,
    "error": "Not Found"
  },
  {
    "url": "https://docs.example.com/guides/setup",
    "status": null,
    "error": "Request timed out"
  }
]
```

`status` is `null` when the request never received a response (network error, timeout). Passing pages are not included in the report.

## Exit Codes

| Code | Meaning                              |
| ---- | ------------------------------------ |
| `0`  | All pages loaded successfully        |
| `1`  | One or more pages failed, or a required argument was missing |

## Config File Support

If you run multiple live-checking commands against the same deployment, set the global `preview` key once and all commands will use it as a fallback:

```json
{
  "preview": "https://preview.docs.example.com"
}
```

You can also set a URL specific to this command under `pages.url`, which takes precedence over `preview`:

```json
{
  "pages": {
    "url": "https://docs.example.com",
    "docs": "docs.json",
    "output": "pages_report.json",
    "concurrency": 50,
    "quiet": false
  }
}
```

Run without arguments once configured:

```bash
writechoice check pages
```

See the [Configuration File](../../config-file.md) reference for all available `pages` options.
