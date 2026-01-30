# WriteChoice Mint CLI

CLI tool for Mintlify documentation validation and utilities.

## Features

- **Link Validation**: Validates internal links and anchors in MDX documentation files
- **Browser Automation**: Uses Playwright to test links against live websites
- **Auto-Fix**: Automatically fixes incorrect anchor links
- **Detailed Reporting**: Generates JSON reports with validation results
- **Concurrent Processing**: Validates multiple links simultaneously for better performance

## Installation

### Global Installation

```bash
npm install -g @writechoice/mint-cli
```

### Local Development

```bash
# Clone the repository
git clone <repository-url>
cd writechoice-mint-cli

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Make CLI executable
chmod +x bin/cli.js

# Link for local development
npm link
```

## Usage

### Check Version

Check the installed version:

```bash
writechoice --version
# or
writechoice -v
```

### Update to Latest Version

Update to the latest version from npm:

```bash
writechoice update
```

The CLI also automatically checks for updates and displays a notification when a new version is available.

### Validate Links

Validate all internal links and anchors in your MDX documentation:

```bash
writechoice check links https://docs.example.com
```

You can also omit the `https://` prefix:

```bash
writechoice check links docs.example.com
```

**Using a Validation Base URL**

When validating anchor links online, the tool can use a different base URL (e.g., a local development server or staging environment) to click on headings and extract the generated anchors:

```bash
# Use localhost:3000 for validation (default)
writechoice check links docs.example.com

# Use a custom validation URL
writechoice check links docs.example.com http://localhost:3000

# Use a staging environment
writechoice check links docs.example.com https://staging.example.com
```

The validation base URL is only used for online checks. Local file validation remains unchanged for optimal performance.

**How the two-step validation works:**

For anchor links, the tool performs a smart validation:

1. Navigates to your production docs (base URL) to find the actual heading the anchor points to
2. Then navigates to your local dev server (validation URL) and clicks the same heading to see what anchor it generates
3. Compares the two anchors to detect mismatches

This is useful because:

- Link text in MDX files may differ from actual heading text
- Handles pages with duplicate headings correctly by matching position
- Validates against your local development environment before deploying

### Common Options

```bash
# Validate links in a specific file
writechoice check links docs.example.com -f path/to/file.mdx

# Validate links in a specific directory
writechoice check links docs.example.com -d path/to/docs

# Dry run (extract links without validating)
writechoice check links docs.example.com --dry-run

# Quiet mode (suppress terminal output, only generate report)
writechoice check links docs.example.com --quiet

# Custom output path for report
writechoice check links docs.example.com -o validation-report.json

# Set concurrency level
writechoice check links docs.example.com -c 50

# Show browser window (for debugging)
writechoice check links docs.example.com --no-headless

# Auto-fix incorrect anchor links
writechoice check links docs.example.com --fix

# Fix links from the default report file (links_report.json)
writechoice check links docs.example.com --fix-from-report

# Fix links from a custom report file
writechoice check links docs.example.com --fix-from-report custom_report.json
```

### Complete Options

| Option                     | Alias | Description                                                               | Default                 |
| -------------------------- | ----- | ------------------------------------------------------------------------- | ----------------------- |
| `<baseUrl>`                | -     | Base URL for the documentation site (required, with or without https://)  | -                       |
| `[validationBaseUrl]`      | -     | Base URL for online validation (optional, clicks headings to get anchors) | `http://localhost:3000` |
| `--file <path>`            | `-f`  | Validate links in a single MDX file                                       | -                       |
| `--dir <path>`             | `-d`  | Validate links in a specific directory                                    | -                       |
| `--output <path>`          | `-o`  | Output path for JSON report                                               | `links_report.json`     |
| `--dry-run`                | -     | Extract and show links without validating                                 | `false`                 |
| `--quiet`                  | -     | Suppress terminal output (only generate report)                           | `false`                 |
| `--concurrency <number>`   | `-c`  | Number of concurrent browser tabs                                         | `25`                    |
| `--headless`               | -     | Run browser in headless mode                                              | `true`                  |
| `--no-headless`            | -     | Show browser window (for debugging)                                       | -                       |
| `--fix`                    | -     | Automatically fix anchor links in MDX files                               | `false`                 |
| `--fix-from-report [path]` | -     | Fix anchor links from report file (optional path)                         | `links_report.json`     |

**Note:** Detailed progress output is shown by default. Use `--quiet` to suppress terminal output.

## How It Works

### Link Extraction

The tool extracts internal links from MDX files in the following formats:

1. **Markdown links**: `[Link Text](./path/to/page#anchor)`
2. **HTML anchors**: `<a href="/path/to/page#anchor">Link Text</a>`
3. **JSX Card components**: `<Card href="/path/to/page" title="Card Title" />`
4. **JSX Button components**: `<Button href="/path/to/page#anchor">Button Text</Button>`

**Images are automatically ignored:**

- Markdown images: `![Alt Text](./image.png)`
- HTML images: `<img src="./image.png" />`

### Validation Process

1. **Local Validation**: First checks if the target MDX file exists locally
   - For normal links: Verifies the file exists in the repository
   - For anchor links: Checks if the heading exists in the MDX file with matching kebab-case format
2. **Online Validation**: If local check fails, performs a two-step validation process
   - For normal links: Navigates to the validation base URL and verifies the page loads successfully
   - For anchor links (two-step process):
     1. **Step 1 - Find the target heading**: Navigates to the base URL (production docs) with the anchor to identify which heading the anchor points to and its position (handles duplicate headings)
     2. **Step 2 - Get generated anchor**: Navigates to the validation base URL (e.g., localhost:3000), finds the same heading (by text and position), clicks it to trigger anchor generation, and extracts the generated anchor from the URL
     3. Compares the generated anchor with the expected anchor from the MDX file
3. **Validation Base URL**: By default uses `http://localhost:3000` for online validation, or you can specify a custom URL (e.g., staging environment). This allows testing against a local development server or staging environment while validating links meant for production.
4. **Auto-Fix**: When issues are found, can automatically update MDX files with the correct anchors

### Report Format

The tool generates a JSON report with the following structure:

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
        "targetUrl": "https://docs.example.com/docs/installation#setup",
        "status": "failure",
        "errorMessage": "Expected anchor \"#setup\" but page heading \"Setup Process\" should use \"#setup-process\""
      }
    ]
  }
}
```

## Auto-Fix Feature

The `--fix` option automatically corrects anchor links that don't match the heading text:

**Before:**

```markdown
[Installation Guide](./installation#setup)
```

**After:**

```markdown
[Installation Guide](./installation#setup-process)
```

### Fix Workflow

1. **Run validation**: `writechoice check links docs.example.com`
2. **Review report**: Check the generated `links_report.json` for issues
3. **Apply fixes**: `writechoice check links docs.example.com --fix-from-report`
4. **Re-validate**: Run validation again to verify fixes

Or use a custom report file:

```bash
# Generate custom report
writechoice check links docs.example.com -o my_report.json

# Fix from custom report
writechoice check links docs.example.com --fix-from-report my_report.json
```

## Updates

The CLI automatically checks for new versions and displays a notification when an update is available:

```
┌─────────────────────────────────────────────────┐
│  Update available: 0.0.2 → 0.0.3                │
│  Run: writechoice update                        │
└─────────────────────────────────────────────────┘
```

To update manually:

```bash
# Using the built-in update command (recommended)
writechoice update

# Or using npm directly
npm install -g @writechoice/mint-cli@latest
```

## Configuration

### Excluded Directories

By default, the following directories are excluded from scanning:

- `snippets/`

You can modify this in the source code at [src/commands/validate/links.js](src/commands/validate/links.js).

### Default Concurrency

The default concurrency is set to 25 concurrent browser tabs. Adjust this based on your system resources:

- **Lower values** (5-10): Slower but less resource-intensive
- **Higher values** (50-100): Faster but requires more memory and CPU

## Examples

### Validate all links (with progress output)

```bash
writechoice check links docs.example.com
```

### Validate quietly (suppress terminal output)

```bash
writechoice check links docs.example.com --quiet
```

### Validate and fix issues in one command

```bash
writechoice check links docs.example.com --fix
```

### Two-step fix workflow

```bash
# Step 1: Generate report
writechoice check links docs.example.com -o issues.json

# Step 2: Review and apply fixes
writechoice check links docs.example.com --fix-from-report issues.json

# Or fix from default report (links_report.json)
writechoice check links docs.example.com --fix-from-report
```

### Validate specific directory

```bash
writechoice check links docs.example.com -d docs/api
```

## Troubleshooting

### Playwright Not Installed

If you get an error about Playwright not being installed:

```bash
npx playwright install chromium
```

### Memory Issues

If you encounter memory issues with high concurrency:

```bash
writechoice check links docs.example.com -c 10
```

### Browser Launch Failed

If the browser fails to launch in headless mode:

```bash
writechoice check links docs.example.com --no-headless
```

## Development

### Project Structure

```
writechoice-mint-cli/
├── bin/
│   └── cli.js              # CLI entry point
├── src/
│   ├── commands/
│   │   └── validate/
│   │       └── links.js    # Link validation logic
│   └── utils/
│       └── helpers.js      # Helper functions
├── package.json
└── README.md
```

### Running Tests

```bash
npm test
```

### Adding New Commands

1. Create a new command file in `src/commands/`
2. Add the command to `bin/cli.js`
3. Update this README with usage instructions

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
