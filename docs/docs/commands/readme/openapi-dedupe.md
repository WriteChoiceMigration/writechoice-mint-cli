---
sidebar_position: 4
title: Readme OpenAPI Dedupe
---

# Readme OpenAPI Dedupe Command

A page whose body is set up for Mintlify's OpenAPI-driven layout (an `openapi: "/openapi/<file> METHOD /path"` frontmatter key, added by [`wcc readme openapi`](/commands/readme/openapi)) already renders that operation's `description` automatically. If the page body just repeats the same description verbatim, it renders twice.

`wcc readme openapi-dedupe` finds pages where this has happened and wraps the body in an MDX comment (`{/* ... */}`) so the source is preserved but nothing renders twice.

## Usage

```bash
wcc readme openapi-dedupe [options]
```

Typically run after `wcc readme openapi`:

```bash
wcc readme convert
wcc readme openapi
wcc readme openapi-dedupe
```

## Options

| Option | Description | Default |
|---|---|---|
| `-f, --file <path>` | Fix a single MDX file directly | — |
| `-d, --dir <path>` | Fix MDX files in a specific directory | `pages/reference` |
| `--openapi-dir <dir>` | Directory of OpenAPI spec files to check page bodies against | `openapi` |
| `--dry-run` | Preview changes without writing files | `false` |
| `--quiet` | Suppress terminal output | `false` |

## How it works

For each `.mdx` file:

1. Reads the frontmatter `openapi` key (`/openapi/<file> METHOD /path`) and looks up that spec file under `--openapi-dir`.
2. Compares the page body (trimmed) to that operation's `description` field in the spec.
3. If they match exactly, wraps the body in `{/* ... */}`.

Files with no `openapi` key, no matching spec, no `description` on that operation, or a body that doesn't match are left untouched — as are bodies already wrapped in a comment (idempotent).

```mdx
{/* Before */}
---
title: "Get User"
openapi: "/openapi/getuser.json GET /users/{id}"
---

Fetches a user by ID.

{/* After */}
---
title: "Get User"
openapi: "/openapi/getuser.json GET /users/{id}"
---

{/*
Fetches a user by ID.
*/}
```

## Config file

Set defaults in `config.json` to run `wcc readme openapi-dedupe` without arguments:

```json
{
  "readme": {
    "openapi-dedupe": {
      "file": null,
      "dir": null,
      "openapi-dir": "openapi",
      "dry-run": false,
      "quiet": false
    }
  }
}
```
