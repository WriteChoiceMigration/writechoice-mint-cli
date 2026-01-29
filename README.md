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

### Validate Links

Validate all internal links and anchors in your MDX documentation:

```bash
writechoice check links https://docs.example.com
```

You can also omit the `https://` prefix:

```bash
writechoice check links docs.example.com
```

### Common Options

```bash
# Validate links in a specific file
writechoice check links docs.example.com -f path/to/file.mdx

# Validate links in a specific directory
writechoice check links docs.example.com -d path/to/docs

# Use short aliases for common flags
writechoice check links docs.example.com -v -o my_report.json

# Dry run (extract links without validating)
writechoice check links docs.example.com --dry-run

# Verbose output
writechoice check links docs.example.com -v

# Quiet mode (only generate report)
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

| Option                     | Alias | Description                                                              | Default             |
| -------------------------- | ----- | ------------------------------------------------------------------------ | ------------------- |
| `<baseUrl>`                | -     | Base URL for the documentation site (required, with or without https://) | -                   |
| `--file <path>`            | `-f`  | Validate links in a single MDX file                                      | -                   |
| `--dir <path>`             | `-d`  | Validate links in a specific directory                                   | -                   |
| `--output <path>`          | `-o`  | Output path for JSON report                                              | `links_report.json` |
| `--dry-run`                | -     | Extract and show links without validating                                | `false`             |
| `--verbose`                | `-v`  | Print detailed progress information                                      | `false`             |
| `--quiet`                  | -     | Suppress stdout output (only generate report)                            | `false`             |
| `--concurrency <number>`   | `-c`  | Number of concurrent browser tabs                                        | `25`                |
| `--headless`               | -     | Run browser in headless mode                                             | `true`              |
| `--no-headless`            | -     | Show browser window (for debugging)                                      | -                   |
| `--fix`                    | -     | Automatically fix anchor links in MDX files                              | `false`             |
| `--fix-from-report [path]` | -     | Fix anchor links from report file (optional path)                        | `links_report.json` |

## How It Works

### Link Extraction

The tool extracts internal links from MDX files in the following formats:

1. **Markdown links**: `[Link Text](./path/to/page#anchor)`
2. **HTML anchors**: `<a href="/path/to/page#anchor">Link Text</a>`
3. **JSX Card components**: `<Card href="/path/to/page" title="Card Title" />`
4. **JSX Button components**: `<Button href="/path/to/page#anchor">Button Text</Button>`

### Validation Process

1. **Local Validation**: First checks if the target MDX file exists locally
2. **Online Validation**: If local check fails, uses Playwright to navigate to the live URL
3. **Anchor Validation**: For anchor links, verifies the heading exists and matches the anchor format
4. **Kebab-case Checking**: Ensures anchors follow the correct kebab-case format

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
  "summary_by_file": {
    "docs/getting-started.mdx": {
      "total": 10,
      "success": 9,
      "failure": 1,
      "error": 0
    }
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

### Validate all links with verbose output

```bash
writechoice check links docs.example.com -v
```

### Validate and fix issues in one command

```bash
writechoice check links docs.example.com --fix -v
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
writechoice check links docs.example.com -d docs/api -v
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
