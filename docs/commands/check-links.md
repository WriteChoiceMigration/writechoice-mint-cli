# Check Links Command

Validates internal links and anchors in MDX documentation files using browser automation.

## Usage

```bash
writechoice check links <baseUrl> [validationBaseUrl] [options]
```

## Arguments

- `<baseUrl>` (required): Base URL for the documentation site (production)
- `[validationBaseUrl]` (optional): Base URL for validation environment (default: `http://localhost:3000`)

## Options

| Option                   | Alias | Description                                     | Default             |
| ------------------------ | ----- | ----------------------------------------------- | ------------------- |
| `--file <path>`          | `-f`  | Validate links in a single MDX file             | -                   |
| `--dir <path>`           | `-d`  | Validate links in a specific directory          | -                   |
| `--output <path>`        | `-o`  | Base name for report files (without extension)  | `links_report`      |
| `--dry-run`              | -     | Extract and show links without validating       | `false`             |
| `--quiet`                | -     | Suppress terminal output (only generate report) | `false`             |
| `--concurrency <number>` | `-c`  | Number of concurrent browser tabs               | `25`                |
| `--headless`             | -     | Run browser in headless mode                    | `true`              |
| `--no-headless`          | -     | Show browser window (for debugging)             | -                   |

## How It Works

### Two-Step Validation Process

For anchor links, the tool performs smart validation:

1. **Find Target Heading** (Production): Navigates to your production docs (baseUrl) with the anchor to identify which heading it points to and its position (handles duplicate headings)

2. **Get Generated Anchor** (Validation): Navigates to your validation environment (validationBaseUrl, e.g., localhost:3000), finds the same heading by text and position, clicks it to trigger anchor generation, and extracts the generated anchor

3. **Compare**: Compares the generated anchor with the expected anchor from the MDX file

This is useful because:
- Link text in MDX files may differ from actual heading text
- Handles pages with duplicate headings correctly by matching position
- Validates against your local development environment before deploying

### Link Extraction

Extracts internal links from these formats:

1. **Markdown links**: `[Link Text](./path/to/page#anchor)`
2. **HTML anchors**: `<a href="/path/to/page#anchor">Link Text</a>`
3. **JSX Card components**: `<Card href="/path/to/page" title="Card Title" />`
4. **JSX Button components**: `<Button href="/path/to/page#anchor">Button Text</Button>`

Images are automatically ignored:
- Markdown images: `![Alt Text](./image.png)`
- HTML images: `<img src="./image.png" />`

### Validation Process

1. **Local Validation** (Fast): First checks if the target MDX file exists locally
   - For normal links: Verifies the file exists in the repository
   - For anchor links: Checks if the heading exists in the MDX file with matching kebab-case format

2. **Online Validation** (Comprehensive): If local check fails, performs two-step validation
   - For normal links: Navigates to the validation base URL and verifies the page loads
   - For anchor links: Uses the two-step process described above

## Examples

### Basic Validation

```bash
# Validate all links with default localhost:3000 validation
writechoice check links https://docs.example.com

# Use custom validation URL
writechoice check links docs.example.com http://localhost:3000

# Use staging environment for validation
writechoice check links docs.example.com https://staging.example.com
```

### Filtering

```bash
# Validate links in a specific file
writechoice check links docs.example.com -f path/to/file.mdx

# Validate links in a specific directory
writechoice check links docs.example.com -d path/to/docs
```

### Dry Run

```bash
# Extract links without validating
writechoice check links docs.example.com --dry-run
```

### Output Control

```bash
# Quiet mode (suppress terminal output)
writechoice check links docs.example.com --quiet

# Custom output base name (generates validation-report.json and validation-report.md)
writechoice check links docs.example.com -o validation-report
```

### Performance Tuning

```bash
# Set concurrency level
writechoice check links docs.example.com -c 50

# Show browser window (for debugging)
writechoice check links docs.example.com --no-headless
```

## Report Formats

The tool automatically generates reports in **both JSON and Markdown formats**:

- **JSON** (`links_report.json`): Structured data used by the fix command
- **Markdown** (`links_report.md`): Human-readable report for easy review

### JSON Report Structure

The JSON report contains detailed validation results:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "configuration": {
    "base_url": "https://docs.example.com",
    "scanned_directories": ["."],
    "excluded_directories": ["snippets"],
    "concurrency": 25,
    "execution_time_seconds": 45.23
  },
  "summary": {
    "total_links": 250,
    "success": 240,
    "failure": 8,
    "error": 2
  },
  "results_by_file": {
    "docs/getting-started.mdx": [
      {
        "source": {
          "filePath": "docs/getting-started.mdx",
          "sourceUrl": "https://docs.example.com/docs/getting-started",
          "targetUrl": "http://localhost:3000/docs/getting-started",
          "lineNumber": 42,
          "linkText": "Installation Guide",
          "rawHref": "./installation#setup",
          "linkType": "markdown"
        },
        "sourceUrl": "https://docs.example.com/docs/installation#setup",
        "targetUrl": "http://localhost:3000/docs/installation#setup-process",
        "status": "failure",
        "errorMessage": "Expected anchor \"#setup\" but page heading \"Setup Process\" should use \"#setup-process\""
      }
    ]
  }
}
```

### Markdown Report

The Markdown report provides a human-readable summary with:
- Validation summary and statistics
- Configuration details
- Failed links grouped by file with line numbers
- Links with errors

## Recommended Workflow

1. **Run validation**:
   ```bash
   writechoice check links docs.example.com
   ```
   This generates both `links_report.json` and `links_report.md`

2. **Review the Markdown report**:
   Open `links_report.md` to see a human-readable summary of all issues

3. **Apply fixes**:
   ```bash
   writechoice fix links
   ```
   This reads `links_report.json` and automatically fixes broken anchor links

4. **Re-validate**:
   Run validation again to verify all fixes worked correctly

For more details on fixing links, see the [Fix Links Command](./fix-links.md) documentation.

## Performance Considerations

### Default Concurrency

The default concurrency is set to 25 concurrent browser tabs. Adjust based on your system resources:

- **Lower values** (5-10): Slower but less resource-intensive
- **Higher values** (50-100): Faster but requires more memory and CPU

### Memory Issues

If you encounter memory issues with high concurrency:

```bash
writechoice check links docs.example.com -c 10
```

## Troubleshooting

### Browser Launch Failed

If the browser fails to launch in headless mode:

```bash
writechoice check links docs.example.com --no-headless
```

### Playwright Not Installed

If you get an error about Playwright not being installed:

```bash
npx playwright install chromium
```
