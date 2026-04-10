---
sidebar_position: 3
title: Publishing
---

# Publishing Guide

Detailed guide for publishing and managing versions of the WriteChoice Mint CLI package.

## Prerequisites

### npm Account Setup

- Create an account at [npmjs.com](https://www.npmjs.com/signup)
- Verify your email address
- Enable two-factor authentication (recommended)

### npm CLI Authentication

```bash
npm login
npm whoami  # verify authentication
```

## Initial Publication

### 1. Prepare the Package

Verify `package.json` metadata:

```json
{
  "name": "@writechoice/mint-cli",
  "version": "1.0.0",
  "description": "CLI tool for Mintlify documentation validation and utilities",
  "author": "WriteChoice",
  "license": "MIT"
}
```

Test the package locally:

```bash
npm install
npx playwright install chromium
node bin/cli.js check links --help
npm link
writechoice --version
```

Check what will be published:

```bash
npm pack --dry-run
```

Verify that:
- Source files are included (`src/`, `bin/`)
- Test files are excluded
- `node_modules/` is excluded
- `README.md`, `LICENSE`, `package.json` are included

### 2. Publish

```bash
npm publish --access public
```

The `--access public` flag is required for scoped packages on first publication.

### 3. Verify

```bash
npm view @writechoice/mint-cli
npm install -g @writechoice/mint-cli
writechoice --version
```

## Publishing New Versions

### Semantic Versioning

Follow [SemVer](https://semver.org/):

| Change type | Version bump | Example |
|---|---|---|
| Breaking changes | MAJOR | 1.0.0 → 2.0.0 |
| New features (backwards compatible) | MINOR | 1.0.0 → 1.1.0 |
| Bug fixes | PATCH | 1.0.0 → 1.0.1 |

### Version Update Workflow

#### 1. Update Version

```bash
npm version patch   # 1.0.0 → 1.0.1
npm version minor   # 1.0.0 → 1.1.0
npm version major   # 1.0.0 → 2.0.0
```

This updates `package.json`, creates a git commit, and creates a git tag.

#### 2. Push Changes

```bash
git push origin main
git push origin --tags
```

#### 3. Publish

```bash
npm publish
```

No need for `--access public` after first publication.

#### 4. Verify

```bash
npm view @writechoice/mint-cli
npm install -g @writechoice/mint-cli@latest
writechoice --version
```

## Pre-release Versions

```bash
# Create a beta version
npm version 1.1.0-beta.1
npm publish --tag beta

# Install the beta
npm install -g @writechoice/mint-cli@beta

# Promote to stable when ready
npm version 1.1.0
npm publish
```

## npm Commands Reference

```bash
npm version                          # check current version
npm view @writechoice/mint-cli       # view package info
npm view @writechoice/mint-cli versions  # see all published versions
npm dist-tag add @writechoice/mint-cli@1.1.0-beta.1 beta  # add dist-tag
npm deprecate @writechoice/mint-cli@1.0.0 "Please upgrade to 1.0.1"
```

## GitHub Actions Automation

```yaml
# .github/workflows/publish.yml
name: Publish to npm

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci
      - run: npm test
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Best Practices

1. **Always test before publishing** — use `npm link` and test all CLI commands
2. **Check included files** — run `npm pack --dry-run` before every publish
3. **Follow semantic versioning** — breaking changes = major, features = minor, fixes = patch
4. **Maintain a changelog** — document all changes in `CHANGELOG.md`
5. **Use git tags** — `npm version` does this automatically
6. **Use pre-release versions** for beta testing before stable release
7. **Deprecate instead of unpublish** — use `npm deprecate` to preserve version history

## Troubleshooting

**"You must be logged in to publish packages":**

```bash
npm login
```

**"You do not have permission to publish":**

Check if you own the `@writechoice` scope on npm, or ask the scope owner to add you as a collaborator.

**"Version already exists":**

```bash
npm version patch  # increment version
```
