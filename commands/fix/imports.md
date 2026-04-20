# Fix Imports Command

Scans MDX files for custom JSX component usage, validates import statements, and automatically adds missing imports when the component file is found in the `snippets/` folder.

## Usage[​](#usage "Direct link to Usage")

```
writechoice fix imports [options]
```

## Options[​](#options "Direct link to Options")

| Option              | Alias | Description                             | Default    |
| ------------------- | ----- | --------------------------------------- | ---------- |
| `--file <path>`     | `-f`  | Check a single MDX file                 | -          |
| `--dir <path>`      | `-d`  | Check MDX files in a specific directory | -          |
| `--snippets <path>` | -     | Path to the snippets folder             | `snippets` |
| `--dry-run`         | -     | Preview changes without writing files   | `false`    |
| `--quiet`           | -     | Suppress terminal output                | `false`    |

## How It Works[​](#how-it-works "Direct link to How It Works")

1. **Scan** — Finds all PascalCase JSX components used in each MDX file (skips code blocks and inline code)
2. **Filter** — Ignores Mintlify built-in components that require no import
3. **Check imports** — For each custom component, verifies import paths exist on disk
4. **Fix** — Adds missing imports when a matching file is found in `snippets/`; inserted after frontmatter alongside existing imports

Exit code `1` is returned when invalid import paths or unresolved components are found.

## Mintlify Built-ins (ignored)[​](#mintlify-built-ins-ignored "Direct link to Mintlify Built-ins (ignored)")

These require no import and are always skipped:

`Note` `Warning` `Info` `Tip` `Card` `CardGroup` `Tabs` `Tab` `Steps` `Step` `Accordion` `AccordionGroup` `Frame` `Tooltip` `Check` `CodeGroup` `Icon` `Snippet` `Update` `ResponseField` `Expandable` `ParamField` `Columns` `Badge`

## Snippet File Matching[​](#snippet-file-matching "Direct link to Snippet File Matching")

For a component like `MyButton`, the following file variants are tried inside `snippets/` (recursively):

* `MyButton.mdx`, `my-button.mdx`, `mybutton.mdx`
* Same names with `.jsx`, `.tsx`, `.js`, `.ts`

## Import Format[​](#import-format "Direct link to Import Format")

| Snippet file type               | Generated import                                    |
| ------------------------------- | --------------------------------------------------- |
| `.mdx`                          | `import MyButton from '/snippets/my-button.mdx'`    |
| `.js` / `.ts` / `.jsx` / `.tsx` | `import { MyButton } from '/snippets/my-button.js'` |

## Examples[​](#examples "Direct link to Examples")

```
# Check all MDX files and fix missing imports

writechoice fix imports



# Preview without writing

writechoice fix imports --dry-run



# Check a single file

writechoice fix imports -f docs/getting-started.mdx



# Use a non-default snippets folder

writechoice fix imports --snippets src/components
```

## Safety[​](#safety "Direct link to Safety")

* Only adds imports — never removes or modifies existing ones
* Idempotent: already-imported components are not duplicated
* Use `--dry-run` to preview before writing
* Revert with `git checkout .` if needed
