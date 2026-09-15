---
sidebar_position: 9
title: Fix Tabs
---

# Fix Tabs Command

Converts `<Tabs>` groups where every `<Tab>` contains a single fenced code block into a `<CodeGroup>`, moving the tab title onto the code block fence.

## Usage

```bash
writechoice fix tabs [options]
```

## Options

| Option          | Alias | Description                           | Default |
| --------------- | ----- | ------------------------------------- | ------- |
| `--file <path>` | `-f`  | Fix a single MDX file                 | -       |
| `--dir <path>`  | `-d`  | Fix MDX files in a specific directory | -       |
| `--dry-run`     | -     | Preview changes without writing files | `false` |
| `--quiet`       | -     | Suppress terminal output              | `false` |

## Why This Is Needed

Mintlify renders `<CodeGroup>` with a built-in tab switcher for code blocks. Using a generic `<Tabs>` component for code-only tabs is more verbose and loses the syntax-highlighted tab bar. This command automates the conversion.

## What Gets Converted

A `<Tabs>` block is converted **only when all of the following are true**:

- Every child element is a `<Tab title="...">...</Tab>`
- Each tab body contains **exactly one** fenced code block and nothing else (no leading text, no trailing prose)
- There is no content between `<Tab>` elements

The tab title is appended to the opening code fence: ` ```lang Title `. Any [Mintlify meta options](https://mintlify.com/docs/create/code) already on the fence — the no-value flags `lines`, `expandable`, `wrap`, `nocopy`, `twoslash`, and the key="value" / key={value} options `icon`, `highlight`, `focus`, `nocopy` — are kept, inserted after the title: ` ```lang Title lines `.

````mdx
{/* Before */}
<Tabs>
  <Tab title="Python">
    ```python
    print("hello")
    ```
  </Tab>
  <Tab title="JavaScript">
    ```js
    console.log("hello")
    ```
  </Tab>
</Tabs>

{/* After */}
<CodeGroup>
```python Python
print("hello")
```
```js JavaScript
console.log("hello")
```
</CodeGroup>
````

## What Is Left Unchanged

- Tabs with prose, images, or any content other than a single code block
- Mixed `<Tabs>` blocks where some tabs have code and others have text
- Any content between `<Tab>` elements
- Everything outside `<Tabs>` blocks
- A fence that **already has a title** — either `title="..."` or bare title words before the flags (e.g. ` ```sh title="docker run litellm" lines ` or ` ```python Expandable example expandable `, where "Expandable example" is the title and `expandable` is the flag). Appending the Tab's own title on top would conflict with it, so the whole `<Tabs>` block is left untouched.
- A fence with an attribute this command doesn't recognize as a valid Mintlify meta option — skipped defensively rather than guessed at

## Examples

```bash
# Preview what would change
writechoice fix tabs --dry-run

# Fix all MDX files in the current directory
writechoice fix tabs

# Fix a specific directory
writechoice fix tabs -d docs/api

# Fix a single file
writechoice fix tabs -f docs/quickstart.mdx
```

## Config File

```json
{
  "tabs": {
    "dir": "docs",
    "dry-run": false,
    "quiet": false
  }
}
```

## Safety

- Only converts a `<Tabs>` block when all tabs qualify — partial matches are left untouched
- Idempotent: running again on already-converted files produces no changes
- Use `--dry-run` to preview before writing
- Revert with `git checkout .` if needed
