# Docusaurus Slugify Command

Renames and moves converted MDX files so their paths match the `slug` (or `id`) in their frontmatter. Also updates any matching page paths in `docs.json`.

Run this after [`wc docusaurus convert`](/commands/docusaurus/convert.md) to ensure each file lives at the URL its frontmatter declares.

## Usage[​](#usage "Direct link to Usage")

```
wc docusaurus slugify <folder> [options]
```

## Arguments[​](#arguments "Direct link to Arguments")

| Argument   | Description                                     |
| ---------- | ----------------------------------------------- |
| `<folder>` | The converted output folder (e.g. `./mintlify`) |

## Options[​](#options "Direct link to Options")

| Option          | Description                           | Default     |
| --------------- | ------------------------------------- | ----------- |
| `--docs <file>` | Path to `docs.json` to update         | `docs.json` |
| `--dry-run`     | Preview renames without writing files | `false`     |
| `--quiet`       | Suppress terminal output              | `false`     |

## How It Works[​](#how-it-works "Direct link to How It Works")

1. Walks all `.md` / `.mdx` files in `<folder>`.
2. Reads each file's frontmatter and looks for a `slug` field. Falls back to `id` if `slug` is absent.
3. Computes the target path from the slug: strips the leading `/`, removes the extension, appends `.mdx`.
4. If the current path already matches the target, skips the file.
5. Moves the file to the new path, creating directories as needed.
6. Updates any matching string entries in `docs.json`.

### Frontmatter lookup order[​](#frontmatter-lookup-order "Direct link to Frontmatter lookup order")

| Frontmatter field | Notes                                                                |
| ----------------- | -------------------------------------------------------------------- |
| `slug`            | Used first; may be an absolute path like `/cloud/manage/cloud-tiers` |
| `id`              | Used as fallback if `slug` is absent                                 |

Files with neither field are left in place.

## Example[​](#example "Direct link to Example")

Given a converted file:

```
mintlify/cloud/features/01_cloud_tiers.mdx
```

With frontmatter:

```
---

slug: /cloud/manage/cloud-tiers

---
```

Running `wc docusaurus slugify ./mintlify` moves it to:

```
mintlify/cloud/manage/cloud-tiers.mdx
```

And updates any reference in `docs.json`:

```
// Before

"mintlify/cloud/features/01_cloud_tiers"



// After

"mintlify/cloud/manage/cloud-tiers"
```

## Examples[​](#examples "Direct link to Examples")

```
# Rename files in the default output folder

wc docusaurus slugify ./mintlify



# Preview without writing

wc docusaurus slugify ./mintlify --dry-run



# Specify a different docs.json path

wc docusaurus slugify ./mintlify --docs path/to/docs.json
```

## Typical Workflow[​](#typical-workflow "Direct link to Typical Workflow")

```
# 1. Convert all files

wc docusaurus convert ./my-docusaurus-site



# 2. Rename files to match their frontmatter slug/id

wc docusaurus slugify ./mintlify



# 3. Generate Mintlify navigation from sidebars.js

wc docusaurus nav ./my-docusaurus-site/sidebars.js --prefix mintlify
```

## Notes[​](#notes "Direct link to Notes")

* If a target path already exists on disk, the rename is skipped with a warning.
* Directories are created automatically when moving a file into a new location.
* The command only modifies file paths — it does not change file contents.
