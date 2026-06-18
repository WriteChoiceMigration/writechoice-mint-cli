# Find Redirects

# Find Redirects Command

Reads a Mintlify broken-links report, probes each broken path against the live site (without following redirects), and writes any discovered `3xx` redirects to a JSON file.

The output is compatible with Mintlify's `redirects.json` format and can be fed directly into [`wcc fix redirects`](/docs/commands/fix/redirects).

## Usage

```bash
wcc find redirects [base] [options]
```

The `base` URL argument is optional if `find.redirects.base` or `source` is set in `config.json`.

## Arguments

| Argument | Description |
|---|---|
| `[base]` | Base URL of the live site to probe (e.g. `https://docs.example.com`) |

## Options

| Option | Description | Default |
|---|---|---|
| `--input <file>` | Broken-links report file to parse | `br.txt` |
| `-o, --output <file>` | JSON file to write discovered redirects to | `br_redirects.json` |
| `--delay <ms>` | Pause between requests in ms (raise if rate-limited) | `500` |
| `--quiet` | Suppress terminal output | `false` |

## Input format

The command parses any file that contains lines with the `⎿` separator — the format produced by Mintlify's broken-links output. Only paths that start with `/` are probed; fragment identifiers (`#…`) are stripped and duplicates are deduplicated.

Example `br.txt` line:

```
  ⎿ /docs/old-page#section
```

## Output format

A JSON array of redirect objects:

```json
[
  { "source": "/docs/old-page", "destination": "/docs/new-page" },
  { "source": "/api/v1/endpoint", "destination": "/api/v2/endpoint" }
]
```

## Retry behaviour

- On `429 Too Many Requests`: waits 3 seconds and retries up to 3 times.
- On network errors: logs a warning and moves on.
- A `--delay` pause is inserted between every request regardless.

## Config file

```json
{
  "find": {
    "redirects": {
      "base": "https://docs.example.com",
      "input": "br.txt",
      "output": "br_redirects.json",
      "delay": 500,
      "quiet": false
    }
  }
}
```

The `source` top-level key is used as a fallback base URL if `find.redirects.base` is not set.
