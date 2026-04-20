# WriteChoice Mint CLI

**`wcc`** is a CLI tool for validating, fixing, and managing [Mintlify](https://mintlify.com) documentation projects.

## What it does[​](#what-it-does "Direct link to What it does")

| Category     | Commands                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------- |
| **Check**    | Validate links, MDX parsing, images, pages, and KaTeX                                    |
| **Fix**      | Auto-repair broken links, parse errors, code blocks, images, H1s, imports, and redirects |
| **Nav**      | Restructure navigation folders and promote root pages                                    |
| **Scrape**   | Convert live documentation sites into Mintlify-ready MDX files                           |
| **Metadata** | Sync meta tags from live pages into MDX frontmatter                                      |

## Install[​](#install "Direct link to Install")

```
npm install -g @writechoice/mint-cli

npx playwright install chromium
```

## Quick example[​](#quick-example "Direct link to Quick example")

```
# Generate a config.json

wcc config



# Validate MDX syntax across the project

wcc check parse



# Validate all internal links against your live site

wcc check links



# Fix broken anchor links found in the validation report

wcc fix links
```

See [Installation](/getting-started/installation.md) to get set up, or jump straight to a command reference in the sidebar.
