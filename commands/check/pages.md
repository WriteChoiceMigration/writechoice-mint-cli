# Check Pages

# Check Pages Command

Validates that every page listed in `docs.json` navigation loads successfully.

Two modes:

- **Default (HTTP)**: checks that each page returns a `2xx`/`3xx` HTTP status.
- **`--local` (Playwright)**: loads each page in a headless browser and inspects `div.mdx-content` for a parsing-error banner or empty content — needed for a local dev server, and required for `--verify-content`.

## Usage

```bash
writechoice check pages <baseUrl> [options]
```

## Arguments

- `<baseUrl>` (required): Base URL of the documentation site (deployed, or a local dev server for `--local`).

## Options

| Option                   | Alias | Description                                                                    | Default              |
| ------------------------ | ----- | -------------------------------------------------------------------------------| --------------------- |
| `--docs <file>`          | -     | Path to docs.json                                                              | `docs.json`           |
| `--output <path>`        | `-o`  | Output file for the failure report                                             | `pages_report.json`   |
| `--concurrency <number>` | `-c`  | Number of parallel requests per phase                                          | `20` (`3` for `--local`) |
| `--batch-size <number>`  | `-b`  | Pages per batch (pauses between batches)                                       | `100`                 |
| `--batch-pause <ms>`     | -     | Pause in ms between batches                                                    | `5000`                |
| `--local`                | -     | Use a headless browser to check `div.mdx-content` instead of a plain HTTP request | `false`             |
| `--include-orphans`      | -     | Also check `.mdx`/`.md` files not listed in docs.json's navigation             | `false`                |
| `--verify-content`       | -     | `--local` only: verify a phrase from the source file appears in the rendered page | `false`             |
| `--quiet`                | -     | Suppress terminal output                                                       | `false`                |

## How It Works

1. Reads `docs.json` and recursively walks the navigation tree, collecting all page paths. With `--include-orphans`, also walks the repo for every `.mdx`/`.md` file (skipping `node_modules`, `.git`, `snippets`, `openapi`, `.mintlify`) and adds any not already found in the nav.
2. **Default mode**: sends an HTTP GET to each page. `2xx`/`3xx` = **PASS**. Anything else, or a network error, = **FAIL**.
3. **`--local` mode**: loads each page in a headless browser and polls `div.mdx-content` until it's stable. The Mintlify parsing-error banner, or content that goes empty after having rendered, = **FAIL**.
4. **`--verify-content`** (local mode only): once content is stable and non-empty, pulls a short distinctive phrase from the page's own source file (skipping frontmatter, code fences, JSX comments, headings, images, and pure-divider lines) and confirms it appears in the rendered text. Catches a page that renders as a shell with no actual article content — stronger than just checking for "not empty". A page with no extractable phrase (e.g. all short lines) skips this check.
5. Writes all failures to the output JSON file and exits with code `1` if any page failed. Progress is saved incrementally (`<output>.progress.json`) so a re-run skips pages that already passed.

## Examples

```bash
# Validate all pages against a deployed site
writechoice check pages https://docs.example.com

# Local dev server, using a real browser to catch parsing errors
writechoice check pages http://localhost:3000 --local

# Local dev server, also verifying rendered content and catching orphan pages
writechoice check pages http://localhost:3000 --local --include-orphans --verify-content

# Custom docs.json location
writechoice check pages https://docs.example.com --docs mint/docs.json

# Lower concurrency for rate-limited hosts
writechoice check pages https://docs.example.com -c 10

# Custom report file
writechoice check pages https://docs.example.com -o reports/pages.json
```

## Report Format

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

`status` is always `null` in `--local` mode (no HTTP status is involved). `error` in that mode describes what went wrong: `"Parsing error displayed on page"`, `"Content is empty after load"`, `"expected phrase not found: ..."` (with `--verify-content`), or a timeout message.

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | All pages loaded successfully |
| `1` | One or more pages failed |

## Config File Support

```json
{
  "pages": {
    "url": "https://docs.example.com",
    "docs": "docs.json",
    "output": "pages_report.json",
    "concurrency": null,
    "batchSize": 100,
    "batchPause": 5000,
    "local": false,
    "include-orphans": false,
    "verify-content": false,
    "quiet": false
  }
}
```
