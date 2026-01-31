# Config Command

Generates a `config.json` template file with all available configuration options.

## Usage

```bash
writechoice config [options]
```

## Options

| Option    | Description                       | Default |
| --------- | --------------------------------- | ------- |
| `--force` | Overwrite existing config.json    | `false` |
| `--quiet` | Suppress terminal output          | `false` |

## How It Works

The config command creates a `config.json` file in your current working directory with:

- All available configuration options
- Placeholder values for required fields (source, target)
- Default values for optional fields
- Comments and schema reference for IDE support

## Examples

### Basic Usage

```bash
# Create config.json in current directory
writechoice config
```

**Output:**
```
✓ Successfully created config.json

Next steps:

1. Edit config.json and update the placeholder values:
   - source: Your production documentation URL
   - target: Your validation environment URL (e.g., localhost:3000)

2. Run validation commands without arguments:
   writechoice check links
   writechoice check parse

3. For more details, see:
   docs/config-file.md
```

### Overwrite Existing File

```bash
# Overwrite existing config.json
writechoice config --force
```

### Quiet Mode

```bash
# Create config.json without output
writechoice config --quiet
```

## Generated Config Template

The command generates a `config.json` file with this structure:

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
  }
}
```

## Next Steps

After generating the config file:

1. **Edit the placeholder values:**
   ```json
   {
     "source": "https://your-actual-docs.com",
     "target": "http://localhost:3000"
   }
   ```

2. **Customize optional settings:**
   - Adjust `concurrency` based on your system resources
   - Set `quiet: true` for CI/CD environments
   - Configure `file` or `dir` to validate specific paths by default

3. **Run commands without arguments:**
   ```bash
   writechoice check links
   writechoice check parse
   writechoice fix links
   ```

## Common Scenarios

### Team Setup

```bash
# Each team member runs this once
writechoice config

# Then edits config.json with team-specific URLs
# Add config.json to .gitignore
```

### CI/CD Setup

```bash
# Generate config in CI pipeline
writechoice config --quiet

# Then modify programmatically
cat > config.json <<EOF
{
  "source": "${DOCS_URL}",
  "target": "${STAGING_URL}",
  "links": {
    "quiet": true,
    "concurrency": 50
  }
}
EOF
```

### Multiple Environments

```bash
# Development
writechoice config
mv config.json config.dev.json

# Production
writechoice config --force
mv config.json config.prod.json

# Use as needed
cp config.dev.json config.json
writechoice check links
```

## Error Handling

### File Already Exists

```
✗ Error: config.json already exists in the current directory.

Use --force to overwrite the existing file:
  writechoice config --force
```

**Solution:** Use `--force` flag or delete the existing file.

### Permission Denied

```
✗ Error creating config.json: EACCES: permission denied
```

**Solution:** Check directory permissions or run with appropriate permissions.

## Best Practices

1. **Add to .gitignore (optional):**
   ```
   # .gitignore
   config.json
   ```
   Keep `config.example.json` in version control instead.

2. **Document your setup:**
   Add a README section explaining how to set up config.json:
   ```markdown
   ## Setup

   1. Generate config file:
      ```bash
      writechoice config
      ```

   2. Update source and target URLs in config.json

   3. Run validation:
      ```bash
      writechoice check links
      ```
   ```

3. **Use environment-specific configs:**
   - `config.dev.json` - Local development
   - `config.staging.json` - Staging environment
   - `config.prod.json` - Production validation

4. **Validate your config:**
   After creating config.json, test it:
   ```bash
   writechoice check links --dry-run
   ```

## See Also

- [Configuration File Guide](../config-file.md) - Complete config.json documentation
- [Check Links Command](./check-links.md) - Link validation
- [Check Parse Command](./check-parse.md) - MDX parsing validation
