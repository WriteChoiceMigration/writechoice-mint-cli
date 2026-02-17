# WriteChoice Mint CLI

CLI tool for Mintlify documentation validation and utilities.

## Installation

```bash
npm install -g @writechoice/mint-cli
npx playwright install chromium
```

## Quick Start

```bash
# Generate a config.json with your docs URL
writechoice config

# Edit config.json and set your source URL
# "source": "https://docs.example.com"

# Then run any command without arguments
writechoice check parse
writechoice check links
writechoice metadata
```

## Commands

### Validate

| Command | Description |
|---|---|
| `writechoice check parse` | Validate MDX files for parsing errors |
| `writechoice check links [baseUrl]` | Validate internal links and anchors using Playwright |

### Fix

| Command | Description |
|---|---|
| `writechoice fix parse` | Fix void tags and stray angle brackets |
| `writechoice fix links` | Fix broken anchor links from a validation report |
| `writechoice fix codeblocks` | Add/remove `expandable`, `lines`, `wrap` on code blocks |
| `writechoice fix images` | Wrap standalone images in `<Frame>` |
| `writechoice fix inlineimages` | Convert inline images to `<InlineImage>` |
| `writechoice fix h1` | Remove H1 headings that duplicate the frontmatter title |

### Other

| Command | Description |
|---|---|
| `writechoice metadata` | Fetch meta tags from live pages and write to frontmatter |
| `writechoice config` | Generate a `config.json` template |
| `writechoice update` | Update to the latest version |

All commands support `--file <path>`, `--dir <path>`, `--dry-run`, and `--quiet` where applicable.

## Configuration

Create a `config.json` in your project root to set defaults and avoid repeating arguments:

```json
{
  "source": "https://docs.example.com",
  "target": "http://localhost:3000"
}
```

Run `writechoice config` to generate a full template with all options.

See [docs/config-file.md](docs/config-file.md) for the complete reference.

## Documentation

Full command documentation is in [docs/commands/](docs/commands/):

- [check-links](docs/commands/check-links.md)
- [check-parse](docs/commands/check-parse.md)
- [fix-links](docs/commands/fix-links.md)
- [fix-parse](docs/commands/fix-parse.md)
- [fix-codeblocks](docs/commands/fix-codeblocks.md)
- [fix-images](docs/commands/fix-images.md)
- [fix-inlineimages](docs/commands/fix-inlineimages.md)
- [fix-h1](docs/commands/fix-h1.md)
- [metadata](docs/commands/metadata.md)

## Troubleshooting

**Playwright not installed:**
```bash
npx playwright install chromium
```

**Too many concurrent requests:**
```bash
writechoice check links -c 10
```

**Permission error on install:**
```bash
sudo npm install -g @writechoice/mint-cli
# or use nvm: https://github.com/nvm-sh/nvm
```

## License

MIT — [GitHub](https://github.com/writechoice/mint-cli) · [npm](https://www.npmjs.com/package/@writechoice/mint-cli) · [Issues](https://github.com/writechoice/mint-cli/issues)
