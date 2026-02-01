# WriteChoice Mint CLI

CLI tool for Mintlify documentation validation and utilities.

## Quick Start

### Installation

```bash
npm install -g @writechoice/mint-cli
npx playwright install chromium
```

### Usage

```bash
# Check version
writechoice --version

# Update to latest
writechoice update

# Validate MDX parsing
writechoice check parse

# Validate links
writechoice check links https://docs.example.com

# Validate with local development server
writechoice check links docs.example.com http://localhost:3000

# Fix broken anchor links
writechoice fix links

# Fix MDX parsing errors (void tags, stray angle brackets)
writechoice fix parse

# Generate config.json template
writechoice config
```

## Commands

### `config`

Generates a config.json template file with all available options.

```bash
writechoice config                         # Create config.json
writechoice config --force                 # Overwrite existing config.json
```

**Output:** Creates `config.json` in the current directory with placeholder values.

### `check parse`

Validates MDX files for parsing errors.

```bash
writechoice check parse                    # All files
writechoice check parse -f file.mdx        # Single file
writechoice check parse -d docs            # Specific directory
```

**Output:** Both `mdx_errors_report.json` and `mdx_errors_report.md`

### `check links`

Validates internal links and anchors using browser automation.

```bash
writechoice check links <baseUrl> [validationBaseUrl]
```

**Common options:**
- `-f, --file <path>` - Validate single file
- `-d, --dir <path>` - Validate specific directory
- `-o, --output <path>` - Base name for reports (default: `links_report`)
- `-c, --concurrency <number>` - Concurrent browser tabs (default: 25)
- `--quiet` - Suppress output
- `--dry-run` - Extract links without validating

**Output:** Both `links_report.json` and `links_report.md`

### `fix links`

Automatically fixes broken anchor links based on validation reports.

```bash
writechoice fix links                      # Use default report
writechoice fix links -r custom_report.json  # Use custom report
```

**Common options:**
- `-r, --report <path>` - Path to JSON report (default: `links_report.json`)
- `--quiet` - Suppress output

**Note:** Requires JSON report from `check links` command.

### `fix parse`

Automatically fixes common MDX parsing errors: void HTML tags not self-closed and stray angle brackets in text.

```bash
writechoice fix parse                        # Fix from check parse report
writechoice fix parse -f file.mdx            # Fix a single file directly
writechoice fix parse -d docs                # Fix files in a directory
writechoice fix parse -r custom_report.json  # Use custom report
```

**Common options:**
- `-r, --report <path>` - Path to JSON report (default: `mdx_errors_report.json`)
- `-f, --file <path>` - Fix a single MDX file directly
- `-d, --dir <path>` - Fix MDX files in a directory
- `--quiet` - Suppress output

**What it fixes:**
- Void tags: `<br>` → `<br />`, `<img src="x">` → `<img src="x" />`
- Stray brackets: `x < 10` → `x &lt; 10`, `y > 5` → `y &gt; 5`

Content inside code blocks and inline code is never modified.

### `update`

Update CLI to latest version.

```bash
writechoice update
```

## Features

- **MDX Parsing Validation** - Catch syntax errors before deployment
- **Link Validation** - Test links against live websites with Playwright
- **Two-Step Anchor Validation** - Compare production vs development anchors
- **Auto-Fix Links** - Automatically correct broken anchor links
- **Auto-Fix Parsing** - Automatically fix void tags and stray angle brackets
- **Dual Report Formats** - Generates both JSON (for automation) and Markdown (for humans)
- **Configuration File** - Optional config.json for default settings
- **CI/CD Ready** - Exit codes for pipeline integration

## How Two-Step Validation Works

For anchor links, the tool:

1. **Finds the target** (Production): Navigates to production docs to identify which heading the anchor points to
2. **Gets the anchor** (Validation): Navigates to your dev server (localhost:3000), clicks the heading, and extracts the generated anchor
3. **Compares**: Checks if anchors match

This ensures your local development environment matches production behavior.

## Configuration File

Create an optional `config.json` in your project root to set default values:

```json
{
  "source": "https://docs.example.com",
  "target": "http://localhost:3000",
  "links": {
    "concurrency": 25,
    "quiet": false
  },
  "parse": {
    "quiet": false
  }
}
```

With config.json, you can run commands without arguments:

```bash
# Uses source and target from config.json
writechoice check links

# CLI args override config.json values
writechoice check links https://staging.example.com
```

See [config.example.json](config.example.json) for all available options.

## Examples

```bash
# Validate all MDX files for parsing errors
writechoice check parse

# Validate all links (uses localhost:3000 by default)
writechoice check links https://docs.example.com

# Validate with staging environment
writechoice check links docs.example.com https://staging.example.com

# Validate specific directory only
writechoice check links docs.example.com -d api

# Run quietly (only generate reports)
writechoice check links docs.example.com --quiet

# Fix broken anchor links
writechoice fix links

# Fix from custom report
writechoice fix links -r custom_report.json

# Fix MDX parsing errors
writechoice fix parse

# Fix a single file directly
writechoice fix parse -f docs/getting-started.mdx

# Full workflow: validate -> fix -> re-validate
writechoice check links docs.example.com
writechoice fix links
writechoice check links docs.example.com

# Full parse workflow: validate -> fix -> re-validate
writechoice check parse
writechoice fix parse
writechoice check parse
```

## Documentation

Detailed documentation is available in the [docs/](docs/) folder:

- **Commands**
  - [config](docs/commands/config.md) - Generate config.json template
  - [check links](docs/commands/check-links.md) - Link validation
  - [check parse](docs/commands/check-parse.md) - MDX parsing validation
  - [fix links](docs/commands/fix-links.md) - Auto-fix broken links
  - [fix parse](docs/commands/fix-parse.md) - Auto-fix MDX parsing errors
  - [update](docs/commands/update.md) - Update command
- **Guides**
  - [Configuration File](docs/config-file.md) - Using config.json
  - [Configuration](docs/configuration.md) - Advanced configuration
  - [Publishing](docs/publishing.md) - How to publish new versions

## Development

### Local Setup

```bash
git clone <repository-url>
cd writechoice-mint-cli
npm install
npx playwright install chromium
chmod +x bin/cli.js
npm link
```

### Project Structure

```
writechoice-mint-cli/
├── bin/
│   └── cli.js                 # CLI entry point
├── src/
│   ├── commands/
│   │   ├── validate/
│   │   │   ├── links.js       # Link validation
│   │   │   └── mdx.js         # MDX parsing validation
│   │   └── fix/
│   │       ├── links.js       # Link fixing
│   │       └── parse.js       # Parse error fixing
│   └── utils/
│       ├── helpers.js         # Utility functions
│       └── reports.js         # Report generation
├── docs/                      # Detailed documentation
├── package.json
└── README.md
```

## Troubleshooting

### Playwright Not Installed

```bash
npx playwright install chromium
```

### Memory Issues

```bash
writechoice check links docs.example.com -c 10
```

### Permission Errors

```bash
sudo npm install -g @writechoice/mint-cli
```

Or use a node version manager like [nvm](https://github.com/nvm-sh/nvm).

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Links

- [npm package](https://www.npmjs.com/package/@writechoice/mint-cli)
- [GitHub repository](https://github.com/writechoice/mint-cli)
- [Issue tracker](https://github.com/writechoice/mint-cli/issues)
