# Advanced Configuration

# Advanced Configuration

This page covers advanced configuration patterns for the WriteChoice Mint CLI — CI/CD integration, performance tuning, environment-specific setups, and report customization.

## Environment-Specific Configuration

### Development

For local development validation:

```json
{
  "source": "https://docs.example.com",
  "target": "http://localhost:3000",
  "links": {
    "headless": false,
    "concurrency": 5
  }
}
```

### Staging

For staging environment validation:

```json
{
  "source": "https://docs.example.com",
  "target": "https://staging.example.com",
  "links": {
    "quiet": true,
    "concurrency": 25
  }
}
```

### Production

For validating the live site:

```json
{
  "source": "https://docs.example.com",
  "target": "https://docs.example.com",
  "links": {
    "quiet": true,
    "concurrency": 10
  }
}
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Validate Documentation

on: [push, pull_request]

jobs:
  validate-docs:
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

## Excluded Directories

The following directories are excluded from scanning by default:

- `snippets/`
- `node_modules/`
- `.git/`

## Performance Tuning

### Link Validation Concurrency

Adjust concurrency based on your system resources:

| System | RAM | Recommended `-c` |
|---|---|---|
| Low-end | 4 GB, 2 cores | 5–10 |
| Mid-range | 8 GB, 4 cores | 25 |
| High-end | 16+ GB, 8+ cores | 50–100 |

```bash
writechoice check links docs.example.com -c 10
```

### Memory Management

If you encounter out-of-memory errors:

```bash
NODE_OPTIONS="--max-old-space-size=4096" writechoice check links docs.example.com
```

Or validate in smaller batches:

```bash
writechoice check links docs.example.com -d docs/api
writechoice check links docs.example.com -d docs/guides
```

## Report Customization

### Custom Output Paths

```bash
# Link validation report
writechoice check links docs.example.com -o custom_links

# After parse — rename the output
writechoice check parse && mv mdx_errors_report.json custom_mdx.json
```

### Consuming Reports in Scripts

Reports are JSON and can be processed with any script:

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
```

## File Patterns

### MDX File Detection

The CLI automatically detects `.mdx` files in the current directory and subdirectories.

### Link Patterns Recognized

| Format | Example |
|---|---|
| Markdown links | `[text](url)` |
| HTML anchors | `<a href="url">text</a>` |
| JSX Cards | `<Card href="url" />` |
| JSX Buttons | `<Button href="url">text</Button>` |

Images are automatically excluded from link validation.
