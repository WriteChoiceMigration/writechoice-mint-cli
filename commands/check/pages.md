# Check Pages Command

Validates that every page listed in `docs.json` navigation loads successfully by checking HTTP response status.

## Usage[​](#usage "Direct link to Usage")

```
writechoice check pages <baseUrl> [options]
```

## Arguments[​](#arguments "Direct link to Arguments")

* `<baseUrl>` (required): Base URL of the deployed documentation site.

## Options[​](#options "Direct link to Options")

| Option                   | Alias | Description                        | Default             |
| ------------------------ | ----- | ---------------------------------- | ------------------- |
| `--docs <file>`          | -     | Path to docs.json                  | `docs.json`         |
| `--output <path>`        | `-o`  | Output file for the failure report | `pages_report.json` |
| `--concurrency <number>` | `-c`  | Number of parallel HTTP requests   | `50`                |
| `--quiet`                | -     | Suppress terminal output           | `false`             |

## How It Works[​](#how-it-works "Direct link to How It Works")

1. Reads `docs.json` and recursively walks the navigation tree, collecting all page paths.
2. Appends each path to `baseUrl` and sends an HTTP GET request.
3. `2xx` or `3xx` = **PASS**. Any other status or network error = **FAIL**.
4. Writes all failures to the output JSON file and exits with code `1` if any page failed.

## Examples[​](#examples "Direct link to Examples")

```
# Validate all pages against a deployed site

writechoice check pages https://docs.example.com



# Custom docs.json location

writechoice check pages https://docs.example.com --docs mint/docs.json



# Lower concurrency for rate-limited hosts

writechoice check pages https://docs.example.com -c 10



# Custom report file

writechoice check pages https://docs.example.com -o reports/pages.json
```

## Report Format[​](#report-format "Direct link to Report Format")

```
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

`status` is `null` when the request never received a response.

## Exit Codes[​](#exit-codes "Direct link to Exit Codes")

| Code | Meaning                       |
| ---- | ----------------------------- |
| `0`  | All pages loaded successfully |
| `1`  | One or more pages failed      |

## Config File Support[​](#config-file-support "Direct link to Config File Support")

```
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
