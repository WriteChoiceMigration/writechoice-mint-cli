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

The tab title is appended to the opening code fence: ` ```lang Title `.

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
