---
sidebar_position: 5
title: Readme Recipes
---

# Readme Recipes Command

Converts legacy recipe `.md` files (fenced request/response code blocks followed by `# Step Heading` sections) into Mintlify recipe MDX, using `<RequestExample>`, `<ResponseExample>`, and `<Steps>`/`<Step>` components.

This is a focused, format-specific converter — not the general readme.com markdown pipeline used by [`wcc readme convert`](/commands/readme/convert). Recipe pages are structured around fenced code and step headings rather than prose, so this command expects that specific shape.

## Usage

```bash
wcc readme recipes [options]
```

## Options

| Option | Description | Default |
|---|---|---|
| `--from <dir>` | Source directory containing recipe `.md` files | `readme/recipes` |
| `-o, --output <dir>` | Output directory for the converted `.mdx` files | `pages/recipes` |
| `--dry-run` | Preview output without writing files | `false` |
| `--quiet` | Suppress terminal output | `false` |

Unlike some legacy conversion scripts, this command never deletes the source `.md` files — it only writes `.mdx` into `--output`.

## Input shape

```md
---
frontmatter
---
```lang Title
...code...
```
```json Response Example
...json...
```

# Step Heading
<!-- lang@1-11 -->

Step description text.

# Another Step Heading
<!-- lang@12-20 -->

More description text.
```

## Output shape

````mdx
---
frontmatter
---

<RequestExample>
```lang Title
...code...
```
</RequestExample>

<ResponseExample>
```json Response Example
...json...
```
</ResponseExample>

<Steps>

<Step title="Step Heading">

Step description text.
</Step>

<Step title="Another Step Heading">

More description text.
</Step>
</Steps>
````

## How it works

1. Splits the file into frontmatter (kept verbatim) and body.
2. Every fenced code block before the first `# Heading` becomes an example: blocks whose fence header line mentions "response" (case-insensitive) go in `<ResponseExample>`; everything else goes in `<RequestExample>`. Either group is omitted if empty.
3. Every `# Heading` from that point on becomes a `<Step title="...">`. The first HTML comment line inside a step (e.g. a `<!-- lang@1-11 -->` line-highlight marker) is stripped, since it has no equivalent in the Mintlify `<Step>` layout.
4. `# Heading`-looking lines inside fenced code blocks (e.g. a Python comment `# Example: ...`) are correctly not mistaken for step headings.

A file with no frontmatter block is skipped with a warning rather than aborting the whole batch.

## Config file

Set defaults in `config.json` to run `wcc readme recipes` without arguments:

```json
{
  "readme": {
    "recipes": {
      "from": "readme/recipes",
      "output": "pages/recipes",
      "dry-run": false,
      "quiet": false
    }
  }
}
```
