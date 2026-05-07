# Check Parse

# Check Parse Command

Validates MDX files for parsing errors using the official `@mdx-js/mdx` compiler.

## Usage

```bash
writechoice check parse [options]
```

## Options

| Option          | Alias | Description                                     | Default  |
| --------------- | ----- | ----------------------------------------------- | -------- |
| `--file <path>` | `-f`  | Validate a single MDX file                      | -        |
| `--dir <path>`  | `-d`  | Validate MDX files in a specific directory      | -        |
| `--quiet`       | -     | Suppress terminal output (only generate report) | `false`  |

## What It Detects

- **Invalid JSX syntax**: Mismatched or improperly closed JSX tags
- **JavaScript expression errors**: Invalid JavaScript in curly braces `{}`
- **MDX-specific errors**: Syntax that breaks MDX compilation
- **Parsing failures**: Any content that prevents successful MDX parsing

## Examples

```bash
# Validate all MDX files in current directory
writechoice check parse

# Validate a single file
writechoice check parse --file path/to/file.mdx

# Validate files in a specific directory
writechoice check parse --dir docs

# Suppress terminal output, only generate reports
writechoice check parse --quiet
```

## Report Formats

Generates reports in **both JSON and Markdown formats**:

- **JSON** (`mdx_errors_report.json`): Structured data for programmatic use
- **Markdown** (`mdx_errors_report.md`): Human-readable report for easy review

### JSON Format

```json
{
  "summary": {
    "total": 42,
    "valid": 40,
    "errors": 2
  },
  "errors": [
    {
      "filePath": "docs/getting-started.mdx",
      "error": {
        "message": "Could not parse expression with acorn",
        "line": 15,
        "column": 23
      }
    }
  ],
  "valid": ["docs/introduction.mdx", "docs/installation.mdx"],
  "timestamp": "2026-01-31T19:30:00.000Z"
}
```

## Common Errors

### Mismatched JSX Tags

```mdx
// ❌ Problem
<div>
  <p>Content here
</div>

// ✅ Fix
<div>
  <p>Content here</p>
</div>
```

### Unclosed Curly Braces

```mdx
// ❌ Problem
Here is some code: {someVar

// ✅ Fix
Here is some code: {someVar}
```

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | All MDX files are valid |
| `1` | One or more files have parsing errors |

## CI/CD Integration

```yaml
name: Validate MDX Files
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install -g @writechoice/mint-cli
      - run: writechoice check parse
```

## Performance

Runs locally without browser automation — typically **~100 files per second** on modern hardware.
