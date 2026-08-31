---
sidebar_position: 3
title: Readme OpenAPI
---

# Readme OpenAPI Command

readme.io API reference pages (converted from `/reference/...` URLs) embed their full OpenAPI spec fragment inline in the page body:

````mdx
# OpenAPI definition

```json
{ ...full OpenAPI spec fragment... }
```
````

Mintlify instead expects a single shared spec file referenced from frontmatter. `wcc readme openapi` finds these inline blocks, extracts the spec into a shared file, and rewrites the page to reference it — deduplicating across pages that document the same endpoint.

## Usage

```bash
wcc readme openapi [options]
```

Typically run right after `wcc readme convert`:

```bash
wcc readme convert
wcc readme openapi
```

## Options

| Option | Description | Default |
|---|---|---|
| `-f, --file <path>` | Fix a single MDX file directly | — |
| `-d, --dir <path>` | Fix MDX files in a specific directory | `pages/reference` |
| `--openapi-dir <dir>` | Directory for extracted OpenAPI spec files | `openapi` |
| `--dry-run` | Preview changes without writing files | `false` |
| `--quiet` | Suppress terminal output | `false` |

## How it works

For each `.mdx` file containing a `# OpenAPI definition` heading followed by a fenced JSON block:

1. Parses the embedded JSON and finds its single path + method (a spec with more than one path, or more than one method for that path, is skipped with a warning).
2. Looks for a spec file already under `--openapi-dir` that defines that same path + method.
   - **Found** — adds `openapi: "/openapi/<file> METHOD /path"` to the page's frontmatter and removes the heading + code block from the body.
   - **Not found** — writes the embedded spec verbatim to a new file under `--openapi-dir` (named after the `operationId`, or `method-path` when there is none), then points the frontmatter at that new file the same way.

Specs are deduplicated across the whole run: if two pages in the same `wcc readme openapi` invocation embed the same endpoint, only the first creates a new spec file — the second reuses it.

````md
{/* Before */}
---
title: "Get User"
---

# OpenAPI definition

```json
{"paths": {"/users/{id}": {"get": {"operationId": "getUser"}}}}
```

{/* After */}
---
title: "Get User"
openapi: "/openapi/getuser.json GET /users/{id}"
---
````

## Config file

Set defaults in `config.json` to run `wcc readme openapi` without arguments:

```json
{
  "readme": {
    "openapi": {
      "file": null,
      "dir": null,
      "openapi-dir": "openapi",
      "dry-run": false,
      "quiet": false
    }
  }
}
```
