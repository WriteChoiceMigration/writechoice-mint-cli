# Config

# Config Command

Generates a `config.json` template file with all available configuration options.

## Usage

```bash
writechoice config [options]
```

## Options

| Option | Description | Default |
|---|---|---|
| `--force` | Overwrite existing config.json | `false` |
| `--quiet` | Suppress terminal output | `false` |

## How It Works

Creates a `config.json` file in your current working directory with all available configuration options, placeholder values for required fields, and default values for optional fields.

## Examples

```bash
# Create config.json in current directory
writechoice config

# Overwrite existing config.json
writechoice config --force

# Create config.json without terminal output
writechoice config --quiet
```

## Generated Template

The generated `config.json` includes a section for every command that supports configuration — `links`, `parse`, `pages`, `imageCheck`, `katex`, every `fix` subcommand, `find.redirects`, `nav.folders`/`nav.root`, `readme.*`, `docusaurus`, `metadata`, and the full `scrape` pipeline — each pre-filled with that command's actual defaults.

For the exact, always-current shape, see `config.example.jsonc` in the repo root (every key is commented) or the [Configuration File](../configuration/config-file.md) reference.

## Next Steps

1. Edit `config.json` and set your `source` and `target` URLs.
2. Run any command without arguments — they'll use the config values automatically.

See the [Configuration File](../configuration/config-file.md) reference for all available options and their descriptions.

## Error Handling

**File already exists:**

```
✗ Error: config.json already exists in the current directory.
Use --force to overwrite the existing file:
  writechoice config --force
```
