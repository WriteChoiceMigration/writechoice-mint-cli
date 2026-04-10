# Check Images Command

Validates that all images on your deployed documentation pages load successfully.

The command runs in two phases: it first fetches every page listed in `docs.json` navigation to collect image URLs, then validates each unique image URL.

## Usage

```bash
writechoice check images <baseUrl> [options]
```

## Arguments

- `<baseUrl>` (required): Base URL of the deployed documentation site. Each page path from `docs.json` is appended to this URL.

## Options

| Option                   | Alias | Description                                              | Default              |
| ------------------------ | ----- | -------------------------------------------------------- | -------------------- |
| `--docs <file>`          | -     | Path to docs.json                                        | `docs.json`          |
| `--output <path>`        | `-o`  | Output file for the failure report                       | `images_report.json` |
| `--concurrency <number>` | `-c`  | Parallel requests per phase (page fetch and image check) | `10`                 |
| `--quiet`                | -     | Suppress terminal output                                 | `false`              |

## How It Works

### Phase 1 — Page fetch and image collection

1. Reads `docs.json` and recursively walks the `navigation` tree to collect all page paths.
2. Fetches each page's HTML concurrently.
3. Extracts `<img src="...">` elements from within `div.mdx-content` (the rendered content area). Images outside the content area — such as navigation chrome and UI elements — are ignored.
4. Resolves all `src` values to absolute URLs:
   - `data:` URIs are skipped entirely.
   - `http://` / `https://` — used as-is.
   - `//example.com/img.png` — prefixed with `https:`.
   - `/img.png` — prefixed with `baseUrl`.
   - `img.png` (relative) — resolved against the page URL.
5. Deduplicates across all pages, building a map of `imageUrl → pages that reference it`.

### Phase 2 — Image validation

6. Sends a HEAD request to each unique image URL. If the server returns `405 Method Not Allowed`, falls back to a GET request.
7. A `2xx` or `3xx` status is a **PASS**. Anything else is a **FAIL**.
8. Writes all failures to the output JSON file, including which pages reference each broken image.

## Examples

```bash
# Validate all images against a deployed site
writechoice check images https://docs.example.com

# Use URL from config.json
writechoice check images

# Custom docs.json location
writechoice check images https://docs.example.com --docs mint/docs.json

# Lower concurrency to reduce load on the server
writechoice check images https://docs.example.com -c 5

# Custom report file
writechoice check images https://docs.example.com -o reports/images.json
```

## Report Format

Failures are written to `images_report.json`:

```json
[
  {
    "url": "https://cdn.example.com/logo.png",
    "status": 404,
    "error": null,
    "referencedBy": [
      "getting-started/overview",
      "api/authentication"
    ]
  },
  {
    "url": "https://cdn.example.com/diagram.svg",
    "status": null,
    "error": "Request timed out",
    "referencedBy": [
      "architecture/overview"
    ]
  }
]
```

`status` is `null` when no HTTP response was received. `referencedBy` lists the page paths (as they appear in `docs.json`) that contain a reference to the broken image.

## Exit Codes

| Code | Meaning                              |
| ---- | ------------------------------------ |
| `0`  | All images loaded successfully       |
| `1`  | One or more images failed, or a required argument was missing |

## Performance Notes

The default concurrency of `10` applies to **both phases** independently. Phase 1 (fetching full page HTML) is more bandwidth-intensive than Phase 2 (HEAD requests for images), so a lower value than `check pages` is used by default. Increase with `-c` if your server can handle the load.

## Config File Support

If you run multiple live-checking commands against the same deployment, set the global `preview` key once and all commands will use it as a fallback:

```json
{
  "preview": "https://preview.docs.example.com"
}
```

You can also set a URL specific to this command under `imageCheck.url`, which takes precedence over `preview`:

```json
{
  "imageCheck": {
    "url": "https://docs.example.com",
    "docs": "docs.json",
    "output": "images_report.json",
    "concurrency": 10,
    "quiet": false
  }
}
```

Run without arguments once configured:

```bash
writechoice check images
```

See the [Configuration File](../../config-file.md) reference for all available `imageCheck` options.
