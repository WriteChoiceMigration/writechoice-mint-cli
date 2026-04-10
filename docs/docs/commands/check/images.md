---
sidebar_position: 3
title: Check Images
---

# Check Images Command

Validates that all images on your deployed documentation pages load successfully.

The command runs in two phases: it first fetches every page listed in `docs.json` to collect image URLs, then validates each unique image URL.

## Usage

```bash
writechoice check images <baseUrl> [options]
```

## Arguments

- `<baseUrl>` (required): Base URL of the deployed documentation site.

## Options

| Option                   | Alias | Description                                              | Default              |
| ------------------------ | ----- | -------------------------------------------------------- | -------------------- |
| `--docs <file>`          | -     | Path to docs.json                                        | `docs.json`          |
| `--output <path>`        | `-o`  | Output file for the failure report                       | `images_report.json` |
| `--concurrency <number>` | `-c`  | Parallel requests per phase                              | `10`                 |
| `--quiet`                | -     | Suppress terminal output                                 | `false`              |

## How It Works

### Phase 1 — Page fetch and image collection

1. Reads `docs.json` and recursively walks the navigation tree to collect all page paths.
2. Fetches each page's HTML concurrently.
3. Extracts `<img src="...">` elements from within `div.mdx-content` (ignoring UI chrome).
4. Resolves all `src` values to absolute URLs (`data:` URIs are skipped).
5. Deduplicates across all pages, building a map of `imageUrl → pages that reference it`.

### Phase 2 — Image validation

6. Sends a HEAD request to each unique image URL (falls back to GET on `405 Method Not Allowed`).
7. `2xx` or `3xx` = **PASS**. Anything else = **FAIL**.
8. Writes all failures to the output JSON file.

## Examples

```bash
# Validate all images against a deployed site
writechoice check images https://docs.example.com

# Custom docs.json location
writechoice check images https://docs.example.com --docs mint/docs.json

# Lower concurrency to reduce load on the server
writechoice check images https://docs.example.com -c 5

# Custom report file
writechoice check images https://docs.example.com -o reports/images.json
```

## Report Format

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
    "referencedBy": ["architecture/overview"]
  }
]
```

`status` is `null` when no HTTP response was received. `referencedBy` lists the `docs.json` page paths that contain the broken image.

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | All images loaded successfully |
| `1` | One or more images failed, or a required argument was missing |

## Config File Support

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
