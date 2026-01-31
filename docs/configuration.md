# Configuration

Advanced configuration options for the WriteChoice Mint CLI.

## Configuration File (config.json)

You can create an optional `config.json` file in your project root to define default configurations. This eliminates the need to specify command-line arguments repeatedly.

### Creating config.json

Create a `config.json` file in your project root:

```json
{
  "source": "https://docs.example.com",
  "target": "http://localhost:3000",
  "links": {
    "concurrency": 25,
    "output": "links_report",
    "quiet": false
  },
  "parse": {
    "quiet": false
  }
}
```

### Configuration Priority

Configuration values are applied in this order (highest priority first):

1. **Command-line arguments** - Explicitly provided CLI flags
2. **config.json** - Values from the configuration file
3. **Defaults** - Built-in default values

### Links Configuration

Available options in the `links` section:

```json
{
  "source": "https://docs.example.com",
  "target": "http://localhost:3000",
  "links": {
    "file": null,
    "dir": null,
    "output": "links_report",
    "dry-run": false,
    "quiet": false,
    "concurrency": 25,
    "headless": true
  }
}
```

**Field descriptions:**
- `source`: Base URL for production documentation (same as CLI `<baseUrl>`)
- `target`: Base URL for validation environment (same as CLI `[validationBaseUrl]`)
- `file`: Validate a single MDX file
- `dir`: Validate a specific directory
- `output`: Base name for report files (without extension)
- `dry-run`: Extract links without validating
- `quiet`: Suppress terminal output
- `concurrency`: Number of concurrent browser tabs
- `headless`: Run browser in headless mode

### Parse Configuration

Available options in the `parse` section:

```json
{
  "parse": {
    "file": null,
    "dir": null,
    "quiet": false
  }
}
```

**Field descriptions:**
- `file`: Validate a single MDX file
- `dir`: Validate a specific directory
- `quiet`: Suppress terminal output

### Usage Examples

With `config.json` in your project root:

```bash
# Uses source and target from config.json
writechoice check links

# Override source from CLI, uses target from config
writechoice check links https://staging.example.com

# Override both source and target
writechoice check links https://staging.example.com http://localhost:4000

# Use config.json for parse command
writechoice check parse

# Override quiet setting from CLI
writechoice check parse --quiet
```

### Example Configurations

**Development environment:**
```json
{
  "source": "https://docs.example.com",
  "target": "http://localhost:3000",
  "links": {
    "concurrency": 10,
    "headless": false
  }
}
```

**CI/CD environment:**
```json
{
  "source": "https://docs.example.com",
  "target": "https://staging.example.com",
  "links": {
    "quiet": true,
    "concurrency": 50,
    "output": "reports/links_report.json"
  },
  "parse": {
    "quiet": true
  }
}
```

**Pre-deployment validation:**
```json
{
  "source": "https://docs.example.com",
  "target": "https://docs.example.com",
  "links": {
    "fix-from-report": "production_issues.json"
  }
}
```

## Excluded Directories

By default, certain directories are excluded from scanning:

- `snippets/`
- `node_modules/`
- `.git/`

### Customizing Excluded Directories

To modify excluded directories, edit the source code at:
- Link validation: [src/commands/validate/links.js](../src/commands/validate/links.js)
- MDX parsing: [src/commands/validate/mdx.js](../src/commands/validate/mdx.js)

Look for the `EXCLUDED_DIRS` constant:

```javascript
const EXCLUDED_DIRS = ["snippets", "node_modules", ".git"];
```

## Default Settings

### Link Validation

| Setting                | Default Value           | Description                          |
| ---------------------- | ----------------------- | ------------------------------------ |
| Concurrency            | 25                      | Number of concurrent browser tabs    |
| Timeout                | 30000ms (30s)           | Page load timeout                    |
| Headless Mode          | true                    | Run browser without UI               |
| Validation Base URL    | http://localhost:3000   | URL for online validation            |
| Output File            | links_report.json       | Report output path                   |

### MDX Parsing

| Setting                | Default Value           | Description                          |
| ---------------------- | ----------------------- | ------------------------------------ |
| Output File            | mdx_errors_report.json  | Report output path                   |

## Environment-Specific Configuration

### Development Environment

For local development validation:

```bash
writechoice check links docs.example.com http://localhost:3000
```

### Staging Environment

For staging environment validation:

```bash
writechoice check links docs.example.com https://staging.example.com
```

### Production Environment

For production-only validation (no local server):

```bash
writechoice check links https://docs.example.com https://docs.example.com
```

This validates both production and validation against the same URL.

## Performance Tuning

### Concurrency Settings

Adjust based on your system resources:

```bash
# Low-end systems (4GB RAM, 2 cores)
writechoice check links docs.example.com -c 5

# Mid-range systems (8GB RAM, 4 cores)
writechoice check links docs.example.com -c 25

# High-end systems (16GB+ RAM, 8+ cores)
writechoice check links docs.example.com -c 50
```

### Memory Management

If you encounter out-of-memory errors:

1. Reduce concurrency: `-c 10`
2. Validate in smaller batches using `-d` option
3. Increase Node.js memory limit:

```bash
NODE_OPTIONS="--max-old-space-size=4096" writechoice check links docs.example.com
```

## CI/CD Configuration

### GitHub Actions

```yaml
name: Validate Documentation

on: [push, pull_request]

jobs:
  validate-links:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install CLI
        run: npm install -g @writechoice/mint-cli

      - name: Install Playwright
        run: npx playwright install chromium

      - name: Validate MDX Parsing
        run: writechoice check parse

      - name: Validate Links
        run: writechoice check links https://docs.example.com --quiet

      - name: Upload Reports
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: validation-reports
          path: |
            links_report.json
            mdx_errors_report.json
```

### GitLab CI

```yaml
validate-docs:
  stage: test
  image: node:18
  script:
    - npm install -g @writechoice/mint-cli
    - npx playwright install chromium
    - writechoice check parse
    - writechoice check links https://docs.example.com --quiet
  artifacts:
    when: always
    paths:
      - links_report.json
      - mdx_errors_report.json
```

## File Patterns

### MDX File Detection

The CLI automatically detects files with the `.mdx` extension in the current directory and subdirectories.

### Link Patterns

The following link formats are recognized:

1. **Markdown links**: `[text](url)`
2. **HTML anchors**: `<a href="url">text</a>`
3. **JSX Cards**: `<Card href="url" title="text" />`
4. **JSX Buttons**: `<Button href="url">text</Button>`

### Image Exclusion

Images are automatically excluded from link validation:

- `![alt](image.png)`
- `<img src="image.png" />`

## Report Customization

### Custom Output Paths

```bash
# Link validation report
writechoice check links docs.example.com -o custom_links.json

# MDX parsing always outputs to mdx_errors_report.json
# To customize, move or rename after generation:
writechoice check parse && mv mdx_errors_report.json custom_mdx.json
```

### Report Consumption

Reports are in JSON format and can be consumed by:
- CI/CD pipelines
- Custom reporting tools
- Documentation dashboards
- Monitoring systems

Example Python script to parse reports:

```python
import json

with open('links_report.json') as f:
    report = json.load(f)

failed_links = [
    result for file_results in report['results_by_file'].values()
    for result in file_results
    if result['status'] == 'failure'
]

print(f"Found {len(failed_links)} failed links")
for link in failed_links:
    print(f"  {link['source']['filePath']}:{link['source']['lineNumber']}")
    print(f"    {link['errorMessage']}")
```
