# Check Links

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

# Custom output base name
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

The tool generates reports in **both JSON and Markdown formats**:

- **JSON** (`links_report.json`): Structured data used by the fix command
- **Markdown** (`links_report.md`): Human-readable report for easy review

### JSON Report Structure

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
          "lineNumber": 42,
          "linkText": "Installation Guide",
          "rawHref": "./installation#setup",
          "linkType": "markdown"
        },
        "status": "failure",
        "errorMessage": "Expected anchor \"#setup\" but page heading uses \"#setup-process\""
      }
    ]
  }
}
```

## Recommended Workflow

1. **Run validation**:
   ```bash
   writechoice check links docs.example.com
   ```
2. **Review the Markdown report** (`links_report.md`) for a readable summary.
3. **Apply fixes** automatically:
   ```bash
   writechoice fix links
   ```
4. **Re-validate** to confirm all fixes.

See [Fix Links](../fix/links.md) for more details on auto-fixing.

## Performance Considerations

The default concurrency is 25 browser tabs. Adjust based on your system:

- **Lower** (5–10): Less resource-intensive
- **Higher** (50–100): Faster, but requires more memory

```bash
writechoice check links docs.example.com -c 10
```

## Troubleshooting

**Browser fails to launch in headless mode:**

```bash
writechoice check links docs.example.com --no-headless
```

**Playwright not installed:**

```bash
npx playwright install chromium
```
