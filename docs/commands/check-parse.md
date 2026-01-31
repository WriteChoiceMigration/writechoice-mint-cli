# Check Parse Command

Validates MDX files for parsing errors using the official @mdx-js/mdx compiler.

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

## How It Works

The command uses the official `@mdx-js/mdx` compiler to parse each MDX file. When compilation fails, it captures detailed error information including:

- Error message
- Line number
- Column number
- Error reason

### What It Detects

- **Invalid JSX syntax**: Mismatched or improperly closed JSX tags
- **JavaScript expression errors**: Invalid JavaScript in curly braces `{}`
- **MDX-specific errors**: Syntax that breaks MDX compilation
- **Parsing failures**: Any content that prevents successful MDX parsing

## Examples

### Basic Validation

```bash
# Validate all MDX files in current directory
writechoice check parse

# Validate a single file
writechoice check parse --file path/to/file.mdx

# Validate files in a specific directory
writechoice check parse --dir docs
```

### Quiet Mode

```bash
# Suppress terminal output, only generate reports
writechoice check parse --quiet
```

## Report Formats

The command automatically generates reports in **both JSON and Markdown formats**:

- **JSON** (`mdx_errors_report.json`): Structured data for programmatic use
- **Markdown** (`mdx_errors_report.md`): Human-readable report for easy review

### JSON Format

The JSON report (`mdx_errors_report.json`) contains structured error data:

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
        "column": 23,
        "position": null,
        "reason": "Could not parse expression with acorn"
      }
    },
    {
      "filePath": "api/reference.mdx",
      "error": {
        "message": "Unexpected end of file in expression, expected a corresponding closing brace for `{`",
        "line": 89,
        "column": 12,
        "position": null,
        "reason": "Unexpected end of file in expression"
      }
    }
  ],
  "valid": [
    "docs/introduction.mdx",
    "docs/installation.mdx",
    "..."
  ],
  "timestamp": "2026-01-31T19:30:00.000Z"
}
```

### Markdown Format

The Markdown report (`mdx_errors_report.md`) provides a human-readable summary:

```markdown
# MDX Validation Report

## Summary

- **Total files**: 42
- **Valid files**: 40
- **Files with errors**: 2
- **Generated**: 2026-01-31T19:30:00.000Z

## Files with Errors

### [docs/getting-started.mdx](docs/getting-started.mdx)

- **Line 15**: Could not parse expression with acorn
  - Column: 23

### [api/reference.mdx](api/reference.mdx)

- **Line 89**: Unexpected end of file in expression, expected a corresponding closing brace for `{`
  - Column: 12

## Valid Files

- [docs/introduction.mdx](docs/introduction.mdx)
- [docs/installation.mdx](docs/installation.mdx)
```

The markdown format is ideal for:
- Reading in IDEs with markdown preview
- Including in documentation sites
- Quick visual scanning of errors
- Clickable file links in supported editors

## Common Errors

### Mismatched JSX Tags

**Problem:**
```mdx
<div>
  <p>Content here
</div>
```

**Error:**
```
Expected a closing tag for `<p>` (1:3-1:6) before the end of `div`
```

**Fix:**
```mdx
<div>
  <p>Content here</p>
</div>
```

### Invalid JavaScript Expressions

**Problem:**
```mdx
Some text {invalid javascript here}
```

**Error:**
```
Could not parse expression with acorn
```

**Fix:**
```mdx
Some text {validVariable}
```

### Unclosed Curly Braces

**Problem:**
```mdx
Here is some code: {someVar
```

**Error:**
```
Unexpected end of file in expression, expected a corresponding closing brace for `{`
```

**Fix:**
```mdx
Here is some code: {someVar}
```

## Exit Codes

- **0**: All MDX files are valid
- **1**: One or more files have parsing errors

This makes the command perfect for CI/CD pipelines to catch MDX syntax errors before deployment.

## CI/CD Integration

### GitHub Actions Example

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

### Pre-commit Hook

```bash
#!/bin/sh
# .git/hooks/pre-commit

writechoice check parse --quiet
if [ $? -ne 0 ]; then
  echo "MDX parsing errors detected. Commit aborted."
  cat mdx_errors_report.json
  exit 1
fi
```

## Performance

The parsing validation is fast because it:
- Runs locally without browser automation
- Processes files sequentially (no network overhead)
- Only parses, doesn't render or validate links

Typical performance: **~100 files per second** on modern hardware.
