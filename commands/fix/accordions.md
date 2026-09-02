# Fix Accordions

# Fix Accordions Command

Wraps runs of 2 or more consecutive sibling `<Accordion>` blocks in a shared `<AccordionGroup>`, as Mintlify expects.

## Usage

```bash
writechoice fix accordions [options]
```

## Options

| Option          | Alias | Description                           | Default |
| --------------- | ----- | ------------------------------------- | ------- |
| `--file <path>` | `-f`  | Fix a single MDX file                 | -       |
| `--dir <path>`  | `-d`  | Fix MDX files in a specific directory | -       |
| `--dry-run`     | -     | Preview changes without writing files | `false` |
| `--quiet`       | -     | Suppress terminal output              | `false` |

## Why This Is Needed

Mintlify renders standalone `<Accordion>` elements individually, but expects related accordions to be grouped under a single `<AccordionGroup>` for the collapsible-list styling to apply correctly. Content converted from other formats often ends up with bare, ungrouped `<Accordion>` siblings.

## What Gets Converted

Two or more `<Accordion>` blocks are wrapped in `<AccordionGroup>` when, and only when:

- They share the same leading indentation on their opening tags
- Nothing but blank lines separates one `</Accordion>` from the next `<Accordion>`

```mdx
{/* Before */}
<Accordion title="One">
  Body one
</Accordion>

<Accordion title="Two">
  Body two
</Accordion>

{/* After */}
<AccordionGroup>
<Accordion title="One">
  Body one
</Accordion>

<Accordion title="Two">
  Body two
</Accordion>
</AccordionGroup>
```

## What Is Left Unchanged

- A lone `<Accordion>` with no adjacent sibling
- Accordions separated by other content (prose, headings, etc.)
- Sibling Accordions at different indentation levels
- Accordions already inside an `<AccordionGroup>` — re-running is a no-op

## Examples

```bash
# Preview what would change
writechoice fix accordions --dry-run

# Fix all MDX files in the current directory
writechoice fix accordions

# Fix a specific directory
writechoice fix accordions -d pages/docs

# Fix a single file
writechoice fix accordions -f pages/docs/faq.mdx
```

## Config File

```json
{
  "accordions": {
    "dir": "pages",
    "dry-run": false,
    "quiet": false
  }
}
```

## Safety

- Only wraps runs of 2+ matching siblings — a lone Accordion is never touched
- Idempotent: running again on already-grouped files produces no changes
- Use `--dry-run` to preview before writing
- Revert with `git checkout .` if needed
