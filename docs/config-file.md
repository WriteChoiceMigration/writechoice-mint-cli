# Configuration File

WriteChoice Mint CLI supports an optional `config.json` file for setting default values and avoiding repetitive CLI arguments.

## Quick Start

### Generate Config File

The easiest way to create a config.json is using the config command:

```bash
writechoice config
```

This creates a template file with all available options. Then edit the placeholder values:

```bash
# Edit config.json and update:
# - source: Your production documentation URL
# - target: Your validation environment URL
```

### Manual Creation

Alternatively, create a `config.json` file manually in your project root:

```json
{
  "source": "https://docs.example.com",
  "target": "http://localhost:3000"
}
```

Now you can run commands without arguments:

```bash
# Uses source from config.json
writechoice check links

# Uses source and target from config.json
writechoice check links
```

## Configuration Priority

Configuration values are merged with the following priority (highest to lowest):

1. **CLI arguments** - Values passed directly to the command
2. **Command-specific config** - Settings in `links`, `parse`, etc.
3. **Global config** - Top-level settings in config.json
4. **Built-in defaults** - Hardcoded fallback values

### Example

```json
{
  "source": "https://docs.example.com",
  "links": {
    "concurrency": 50
  }
}
```

```bash
# Uses source from config, concurrency: 50 from links config
writechoice check links

# Uses concurrency: 100 from CLI (overrides config's 50)
writechoice check links -c 100
```

## Complete Configuration Reference

### Global Settings

Settings that apply to all commands:

```json
{
  "source": "https://docs.example.com",
  "target": "http://localhost:3000"
}
```

| Field    | Type   | Description                              | Used By       |
| -------- | ------ | ---------------------------------------- | ------------- |
| `source` | string | Base URL for production documentation   | `check links` |
| `target` | string | Base URL for validation environment     | `check links` |

### Links Command Configuration

Settings specific to `writechoice check links`:

```json
{
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

| Field         | Type    | Description                                      | Default        |
| ------------- | ------- | ------------------------------------------------ | -------------- |
| `file`        | string  | Validate links in a single MDX file              | `null`         |
| `dir`         | string  | Validate links in a specific directory           | `null`         |
| `output`      | string  | Base name for report files (without extension)   | `links_report` |
| `dry-run`     | boolean | Extract and show links without validating        | `false`        |
| `quiet`       | boolean | Suppress terminal output                         | `false`        |
| `concurrency` | number  | Number of concurrent browser tabs                | `25`           |
| `headless`    | boolean | Run browser in headless mode                     | `true`         |

### Parse Command Configuration

Settings specific to `writechoice check parse`:

```json
{
  "parse": {
    "file": null,
    "dir": null,
    "quiet": false
  }
}
```

| Field   | Type    | Description                              | Default |
| ------- | ------- | ---------------------------------------- | ------- |
| `file`  | string  | Validate a single MDX file               | `null`  |
| `dir`   | string  | Validate MDX files in specific directory | `null`  |
| `quiet` | boolean | Suppress terminal output                 | `false` |

### KaTeX Command Configuration

Settings specific to `writechoice check katex`:

```json
{
  "katex": {
    "url": null,
    "reportFile": "katex_errors.json"
  }
}
```

| Field        | Type   | Description                                                   | Default              |
| ------------ | ------ | ------------------------------------------------------------- | -------------------- |
| `url`        | string | Base URL for scan mode (appended with each docs.json path)    | `null`               |
| `reportFile` | string | Report file read by recheck mode (`--file`)                   | `katex_errors.json`  |
| `docs`       | string | Path to docs.json                                             | `docs.json`          |
| `output`     | string | Output file for the error report                              | `katex_errors.json`  |
| `concurrency`| number | Number of parallel HTTP requests                              | `50`                 |
| `quiet`      | boolean| Suppress terminal output                                      | `false`              |

### Codeblocks Command Configuration

Settings specific to `writechoice fix codeblocks`:

```json
{
  "codeblocks": {
    "file": null,
    "dir": null,
    "dry-run": false,
    "quiet": false,
    "threshold": 15,
    "expandable": true,
    "lines": null,
    "wrap": null
  }
}
```

| Field        | Type                            | Description                                        | Default |
| ------------ | ------------------------------- | -------------------------------------------------- | ------- |
| `file`       | string                          | Fix a single MDX file                              | `null`  |
| `dir`        | string                          | Fix MDX files in a specific directory              | `null`  |
| `dry-run`    | boolean                         | Preview changes without writing files              | `false` |
| `quiet`      | boolean                         | Suppress terminal output                           | `false` |
| `threshold`  | number                          | Line count threshold for `expandable`              | `15`    |
| `expandable` | boolean                         | Enable expandable threshold processing             | `true`  |
| `lines`      | `"add"` \| `"remove"` \| `null` | Add or remove `lines` from all code blocks         | `null`  |
| `wrap`       | `"add"` \| `"remove"` \| `null` | Add or remove `wrap` from all code blocks          | `null`  |

### Images Command Configuration

Settings specific to `writechoice fix images`:

```json
{
  "images": {
    "file": null,
    "dir": null,
    "dry-run": false,
    "quiet": false
  }
}
```

| Field     | Type    | Description                           | Default |
| --------- | ------- | ------------------------------------- | ------- |
| `file`    | string  | Fix a single MDX file                 | `null`  |
| `dir`     | string  | Fix MDX files in a specific directory | `null`  |
| `dry-run` | boolean | Preview changes without writing files | `false` |
| `quiet`   | boolean | Suppress terminal output              | `false` |

### Inline Images Command Configuration

Settings specific to `writechoice fix inlineimages`:

```json
{
  "inlineimages": {
    "file": null,
    "dir": null,
    "dry-run": false,
    "quiet": false
  }
}
```

| Field     | Type    | Description                           | Default |
| --------- | ------- | ------------------------------------- | ------- |
| `file`    | string  | Fix a single MDX file                 | `null`  |
| `dir`     | string  | Fix MDX files in a specific directory | `null`  |
| `dry-run` | boolean | Preview changes without writing files | `false` |
| `quiet`   | boolean | Suppress terminal output              | `false` |

### H1 Command Configuration

Settings specific to `writechoice fix h1`:

```json
{
  "h1": {
    "file": null,
    "dir": null,
    "dry-run": false,
    "quiet": false
  }
}
```

| Field     | Type    | Description                           | Default |
| --------- | ------- | ------------------------------------- | ------- |
| `file`    | string  | Fix a single MDX file                 | `null`  |
| `dir`     | string  | Fix MDX files in a specific directory | `null`  |
| `dry-run` | boolean | Preview changes without writing files | `false` |
| `quiet`   | boolean | Suppress terminal output              | `false` |

### Metadata Command Configuration

Settings specific to `writechoice metadata`. The base URL is read from the top-level `source` field:

```json
{
  "metadata": {
    "file": null,
    "dir": null,
    "concurrency": 15,
    "tags": [
      "og:title",
      "og:description",
      "og:image",
      "og:url",
      "twitter:title",
      "twitter:description",
      "twitter:image"
    ],
    "dry-run": false,
    "quiet": false
  }
}
```

| Field         | Type     | Description                                 | Default        |
| ------------- | -------- | ------------------------------------------- | -------------- |
| `file`        | string   | Process a single MDX file                   | `null`         |
| `dir`         | string   | Process MDX files in a specific directory   | `null`         |
| `concurrency` | number   | Number of parallel HTTP requests            | `15`           |
| `tags`        | string[] | Meta tags to fetch (overrides default list) | *(7 defaults)* |
| `dry-run`     | boolean  | Preview changes without writing files       | `false`        |
| `quiet`       | boolean  | Suppress terminal output                    | `false`        |

## Complete Example

Here's a full example showing all available options:

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "description": "Configuration file for WriteChoice Mint CLI",

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
  },

  "parse": {
    "file": null,
    "dir": null,
    "quiet": false
  },

  "katex": {
    "url": null,
    "reportFile": "katex_errors.json"
  },

  "codeblocks": {
    "file": null,
    "dir": null,
    "dry-run": false,
    "quiet": false,
    "threshold": 15,
    "expandable": true,
    "lines": null,
    "wrap": null
  },

  "images": {
    "file": null,
    "dir": null,
    "dry-run": false,
    "quiet": false
  },

  "inlineimages": {
    "file": null,
    "dir": null,
    "dry-run": false,
    "quiet": false
  },

  "h1": {
    "file": null,
    "dir": null,
    "dry-run": false,
    "quiet": false
  },

  "metadata": {
    "file": null,
    "dir": null,
    "concurrency": 15,
    "tags": [
      "og:title",
      "og:description",
      "og:image",
      "og:url",
      "twitter:title",
      "twitter:description",
      "twitter:image"
    ],
    "dry-run": false,
    "quiet": false
  }
}
```

## Common Configurations

### Production Environment

For validating against production:

```json
{
  "source": "https://docs.example.com",
  "target": "https://docs.example.com",
  "links": {
    "concurrency": 10,
    "quiet": true
  }
}
```

Usage:
```bash
# Validates against production for both source and target
writechoice check links
```

### Local Development

For local validation during development:

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

Usage:
```bash
# Shows browser window and uses lower concurrency
writechoice check links
```

### CI/CD Pipeline

For continuous integration:

```json
{
  "source": "https://docs.example.com",
  "target": "https://staging.example.com",
  "links": {
    "quiet": true,
    "concurrency": 50
  },
  "parse": {
    "quiet": true
  }
}
```

Usage:
```bash
# Quiet mode with high concurrency for faster CI runs
writechoice check links
writechoice check parse
```

### Specific Directory Validation

For validating only specific parts of your docs:

```json
{
  "source": "https://docs.example.com",
  "target": "http://localhost:3000",
  "links": {
    "dir": "docs/api"
  },
  "parse": {
    "dir": "docs/api"
  }
}
```

Usage:
```bash
# Only validates files in docs/api directory
writechoice check links
writechoice check parse
```

## Validation and Fixing Workflow

```json
{
  "source": "https://docs.example.com",
  "target": "http://localhost:3000",
  "links": {
    "output": "links_report"
  }
}
```

Usage:
```bash
# 1. Run validation (generates links_report.json and links_report.md)
writechoice check links

# 2. Review the markdown report
cat links_report.md

# 3. Fix broken links automatically
writechoice fix links

# 4. Re-validate to confirm fixes
writechoice check links
```

For more details on fixing links, see the [Fix Links Command](./commands/fix-links.md) documentation.

## Environment-Specific Configs

You can maintain different config files for different environments:

```bash
# Development
cp config.dev.json config.json
writechoice check links

# Staging
cp config.staging.json config.json
writechoice check links

# Production
cp config.prod.json config.json
writechoice check links
```

Or use different config files based on environment variables:

```bash
# Using config based on NODE_ENV
if [ "$NODE_ENV" = "production" ]; then
  cp config.prod.json config.json
else
  cp config.dev.json config.json
fi
writechoice check links
```

## Configuration Validation

The CLI will validate your configuration and show helpful errors:

### Missing Required Fields

```json
{
  "target": "http://localhost:3000"
}
```

```bash
$ writechoice check links
✗ Error: Missing required configuration: baseUrl must be provided either
via CLI argument or in config.json (as "source")

Usage:
  CLI:        check links <baseUrl>
  config.json: { "source": "https://docs.example.com" }
```

### Invalid Values

If you provide invalid configuration values, the CLI will use sensible defaults and may show warnings.

## File Location

The `config.json` file must be in the **current working directory** where you run the command.

```bash
# Looks for ./config.json
cd /path/to/your/docs
writechoice check links

# Won't find config.json in parent directory
cd /path/to/your/docs/subdirectory
writechoice check links  # No config.json found here
```

## Schema Support

The config file supports JSON schema for IDE autocompletion and validation:

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "description": "Configuration file for WriteChoice Mint CLI",
  "source": "https://docs.example.com"
}
```

In VS Code and other editors, this enables:
- Autocompletion of field names
- Inline documentation
- Type validation
- Error highlighting

## Best Practices

### 1. Use Config for Defaults, CLI for Overrides

Set common defaults in config.json:
```json
{
  "source": "https://docs.example.com",
  "target": "http://localhost:3000",
  "links": {
    "concurrency": 25
  }
}
```

Override when needed:
```bash
# Use staging for validation
writechoice check links https://docs.example.com https://staging.example.com

# Use higher concurrency for this run
writechoice check links -c 50
```

### 2. Keep Config in Version Control

Add `config.json` or `config.example.json` to git:
```bash
git add config.example.json
git commit -m "Add WriteChoice CLI configuration template"
```

But add reports to `.gitignore`:
```
# .gitignore
config.json
links_report.json
links_report.md
mdx_errors_report.json
mdx_errors_report.md
katex_errors.json
```

### 3. Document Your Config

Add comments using the description field:
```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "description": "WriteChoice CLI config for MyProject documentation",
  "source": "https://docs.myproject.com",
  "target": "http://localhost:3000"
}
```

### 4. Use Quiet Mode in CI

```json
{
  "links": {
    "quiet": true
  },
  "parse": {
    "quiet": true
  }
}
```

This generates reports without cluttering CI logs.

### 5. Optimize Concurrency

Test different concurrency values for your system:

```bash
# Try different values
writechoice check links -c 10
writechoice check links -c 25
writechoice check links -c 50
writechoice check links -c 100
```

Find the sweet spot and set it in config.json.

## Troubleshooting

### Config Not Being Used

**Problem**: CLI doesn't seem to use config.json values

**Solutions**:
1. Verify config.json is in current working directory (`pwd`)
2. Check for JSON syntax errors (use a JSON validator)
3. Ensure field names match exactly (case-sensitive)
4. Check that you're not passing CLI args that override config

### Invalid JSON

**Problem**: JSON parsing errors

**Solution**: Validate your JSON:
```bash
# Using Node.js
node -e "JSON.parse(require('fs').readFileSync('config.json'))"

# Using Python
python -m json.tool config.json

# Using jq
jq . config.json
```

### Unexpected Behavior

**Problem**: CLI behaves differently than expected

**Solution**: Use `--help` to see current defaults:
```bash
writechoice check links --help
```

Check which config values are being used by reviewing the report configuration section.

## See Also

- [Check Links Command](./commands/check-links.md)
- [Check Parse Command](./commands/check-parse.md)
- [Fix Links Command](./commands/fix-links.md)
- [Fix Codeblocks Command](./commands/fix-codeblocks.md)
- [Fix Images Command](./commands/fix-images.md)
- [Fix Inline Images Command](./commands/fix-inlineimages.md)
- [Fix H1 Command](./commands/fix-h1.md)
- [Metadata Command](./commands/metadata.md)
- [Publishing Guide](./publishing.md)
