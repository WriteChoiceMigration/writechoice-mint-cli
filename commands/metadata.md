# Metadata

# Metadata Command

Fetches meta tags from your live documentation pages and writes them into the frontmatter of the corresponding MDX source files. Existing frontmatter keys are updated (overwritten); missing keys are appended.

## Usage

```bash
writechoice metadata [baseUrl] [options]
```

## Arguments

| Argument | Description |
|---|---|
| `baseUrl` | Base URL of the live documentation site (optional if set in `config.json` as `source`) |

## Options

| Option | Alias | Description | Default |
|---|---|---|---|
| `--file <path>` | `-f` | Process a single MDX file | - |
| `--dir <path>` | `-d` | Process MDX files in a specific directory | - |
| `--concurrency <number>` | `-c` | Number of parallel HTTP requests | `15` |
| `--dry-run` | - | Preview changes without writing files | `false` |
| `--quiet` | - | Suppress terminal output | `false` |

## How It Works

For each MDX file, the command:

1. **Constructs a URL** by appending the file's path (relative to the scan directory, without `.mdx`) to the base URL
2. **Fetches the live page** using an HTTP request
3. **Extracts meta tags** from the HTML (`og:*`, `twitter:*`)
4. **Updates the frontmatter** — existing keys are overwritten, new keys are appended

### URL Mapping

```
Base URL : https://docs.example.com
File     : docs/api/reference.mdx
→ URL    : https://docs.example.com/api/reference
```

### Meta Tags Fetched

| Tag | Frontmatter key |
|---|---|
| `og:title` | `og:title` |
| `og:description` | `og:description` |
| `og:image` | `og:image` |
| `twitter:title` | `twitter:title` |
| `twitter:description` | `twitter:description` |

## Examples

```bash
# Use source from config.json
writechoice metadata

# Specify base URL directly
writechoice metadata https://docs.example.com

# Process a single file
writechoice metadata https://docs.example.com -f docs/api/reference.mdx

# Preview without writing
writechoice metadata --dry-run

# Process with lower concurrency
writechoice metadata https://docs.example.com -c 5
```

## Config File

```json
{
  "source": "https://docs.example.com",
  "metadata": {
    "concurrency": 15,
    "quiet": false
  }
}
```
