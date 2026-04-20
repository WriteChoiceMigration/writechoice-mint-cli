# Config Command

Generates a `config.json` template file with all available configuration options.

## Usage[​](#usage "Direct link to Usage")

```
writechoice config [options]
```

## Options[​](#options "Direct link to Options")

| Option    | Description                    | Default |
| --------- | ------------------------------ | ------- |
| `--force` | Overwrite existing config.json | `false` |
| `--quiet` | Suppress terminal output       | `false` |

## How It Works[​](#how-it-works "Direct link to How It Works")

Creates a `config.json` file in your current working directory with all available configuration options, placeholder values for required fields, and default values for optional fields.

## Examples[​](#examples "Direct link to Examples")

```
# Create config.json in current directory

writechoice config



# Overwrite existing config.json

writechoice config --force



# Create config.json without terminal output

writechoice config --quiet
```

## Generated Template[​](#generated-template "Direct link to Generated Template")

```
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

## Next Steps[​](#next-steps "Direct link to Next Steps")

1. Edit `config.json` and set your `source` and `target` URLs.
2. Run any command without arguments — they'll use the config values automatically.

See the [Configuration File](/configuration/config-file.md) reference for all available options and their descriptions.

## Error Handling[​](#error-handling "Direct link to Error Handling")

**File already exists:**

```
✗ Error: config.json already exists in the current directory.

Use --force to overwrite the existing file:

  writechoice config --force
```
