# Publishing Guide

This guide covers how to publish the `@writechoice/mint-cli` package to npm and manage new versions.

## Prerequisites

### 1. npm Account
- Create an account at [npmjs.com](https://www.npmjs.com/signup)
- Verify your email address
- (Optional but recommended) Enable two-factor authentication

### 2. npm CLI Login
```bash
npm login
```

Enter your credentials when prompted:
- Username
- Password
- Email
- (If 2FA is enabled) One-time password

Verify you're logged in:
```bash
npm whoami
```

## Initial Publication

### Step 1: Prepare the Package

1. **Update package.json metadata**:
   ```json
   {
     "name": "@writechoice/mint-cli",
     "version": "1.0.0",
     "description": "CLI tool for Mintlify documentation validation and utilities",
     "author": "Your Name <your.email@example.com>",
     "license": "MIT",
     "repository": {
       "type": "git",
       "url": "https://github.com/yourusername/writechoice-mint-cli.git"
     },
     "bugs": {
       "url": "https://github.com/yourusername/writechoice-mint-cli/issues"
     },
     "homepage": "https://github.com/yourusername/writechoice-mint-cli#readme",
     "keywords": [
       "mintlify",
       "documentation",
       "validation",
       "cli",
       "mdx",
       "links"
     ]
   }
   ```

2. **Test the package locally**:
   ```bash
   # Install dependencies
   npm install

   # Install Playwright browsers
   npx playwright install chromium

   # Test the CLI
   node bin/cli.js check links --help

   # Link globally for testing
   npm link
   writechoice check links --help
   ```

3. **Check what will be published**:
   ```bash
   npm pack --dry-run
   ```

   This shows which files will be included. Make sure:
   - Source files are included (`src/`, `bin/`)
   - Test files are excluded
   - `node_modules/` is excluded (via `.gitignore`)
   - `README.md`, `LICENSE`, and `package.json` are included

### Step 2: Publish to npm

1. **Publish as a public scoped package**:
   ```bash
   npm publish --access public
   ```

   The `--access public` flag is required for scoped packages (@writechoice/...) the first time.

2. **Verify the publication**:
   - Check on npm: https://www.npmjs.com/package/@writechoice/mint-cli
   - Test installation:
     ```bash
     npm install -g @writechoice/mint-cli
     writechoice check links --help
     ```

## Publishing New Versions

### Semantic Versioning

Follow [Semantic Versioning](https://semver.org/) (SemVer):
- **MAJOR** version (1.0.0 → 2.0.0): Breaking changes
- **MINOR** version (1.0.0 → 1.1.0): New features, backwards compatible
- **PATCH** version (1.0.0 → 1.0.1): Bug fixes, backwards compatible

### Update Workflow

#### 1. Make Your Changes
```bash
# Create a feature branch
git checkout -b feature/new-validation-type

# Make your changes
# ... edit files ...

# Commit changes
git add .
git commit -m "Add new validation type for images"
```

#### 2. Update Version Number

Use npm's version command (automatically updates package.json and creates a git tag):

**For a patch (bug fixes):**
```bash
npm version patch
# 1.0.0 → 1.0.1
```

**For a minor release (new features):**
```bash
npm version minor
# 1.0.0 → 1.1.0
```

**For a major release (breaking changes):**
```bash
npm version major
# 1.0.0 → 2.0.0
```

Or specify the exact version:
```bash
npm version 1.2.3
```

This command will:
1. Update `package.json` version
2. Create a git commit with the version change
3. Create a git tag (e.g., `v1.0.1`)

#### 3. Update Changelog (Optional but Recommended)

Create or update `CHANGELOG.md`:
```markdown
# Changelog

## [1.1.0] - 2024-01-20

### Added
- New image validation feature
- Support for SVG files

### Fixed
- Fixed anchor parsing for special characters
- Improved error messages for 404s

### Changed
- Updated default concurrency to 30

## [1.0.0] - 2024-01-15

### Initial Release
- Link validation for MDX files
- Auto-fix for incorrect anchors
- Browser automation with Playwright
```

#### 4. Test the New Version

```bash
# Link locally and test
npm link
writechoice check links docs.example.com -v

# Run any tests
npm test

# Test with dry-run on real documentation
writechoice check links docs.example.com --dry-run
```

#### 5. Push Changes and Tags

```bash
# Push commits
git push origin main

# Push tags
git push origin --tags
```

#### 6. Publish to npm

```bash
npm publish
```

No need for `--access public` after the first publication.

#### 7. Verify Publication

```bash
# Check the npm page
npm view @writechoice/mint-cli

# Test installation
npm install -g @writechoice/mint-cli@latest
writechoice --version
```

## Quick Reference

### Common npm Commands

```bash
# Check current version
npm version

# View package info
npm view @writechoice/mint-cli

# View all published versions
npm view @writechoice/mint-cli versions

# Unpublish a version (within 72 hours, use carefully!)
npm unpublish @writechoice/mint-cli@1.0.1

# Deprecate a version (recommended over unpublish)
npm deprecate @writechoice/mint-cli@1.0.0 "Please upgrade to 1.0.1 due to critical bug"

# Add a dist-tag (like 'beta', 'next')
npm dist-tag add @writechoice/mint-cli@1.1.0-beta.1 beta

# Publish a beta version
npm version 1.1.0-beta.1
npm publish --tag beta
```

## Pre-release Versions

For testing before a stable release:

### 1. Create a Beta Version
```bash
# Update to beta version
npm version 1.1.0-beta.1

# Publish with beta tag
npm publish --tag beta
```

### 2. Install Beta Version
```bash
# Install specific beta version
npm install -g @writechoice/mint-cli@1.1.0-beta.1

# Install latest beta
npm install -g @writechoice/mint-cli@beta
```

### 3. Promote Beta to Stable
```bash
# Remove beta suffix
npm version 1.1.0

# Publish as latest
npm publish
```

## Automation with GitHub Actions

Consider automating releases with GitHub Actions:

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

## Troubleshooting

### "You must be logged in to publish packages"
```bash
npm login
```

### "You do not have permission to publish"
- Check if you own the `@writechoice` scope on npm
- Ask the scope owner to add you as a collaborator

### "Package name too similar to existing package"
- Choose a different name or scope
- Or request ownership of the abandoned package

### "Version already exists"
```bash
# Increment version again
npm version patch

# Or specify a new version
npm version 1.0.2
```

## Best Practices

1. **Always test before publishing**
   - Link locally with `npm link`
   - Test all CLI commands
   - Check that files are correctly included with `npm pack --dry-run`

2. **Follow semantic versioning**
   - Breaking changes = major version
   - New features = minor version
   - Bug fixes = patch version

3. **Maintain a changelog**
   - Document all changes
   - Make it easy for users to see what's new

4. **Use git tags**
   - Tag each release with `v{version}` (e.g., `v1.0.0`)
   - `npm version` does this automatically

5. **Test installations**
   - Install the published package globally
   - Verify it works as expected

6. **Consider using prerelease versions**
   - Beta test with `1.0.0-beta.1` before stable release
   - Use tags: `npm publish --tag beta`

7. **Document breaking changes**
   - Clearly indicate breaking changes in changelog
   - Consider migration guides for major versions

8. **Deprecate old versions**
   - Use `npm deprecate` instead of unpublishing
   - Provide upgrade instructions

## Useful Links

- [npm Documentation](https://docs.npmjs.com/)
- [Semantic Versioning](https://semver.org/)
- [npm version command](https://docs.npmjs.com/cli/v10/commands/npm-version)
- [npm publish command](https://docs.npmjs.com/cli/v10/commands/npm-publish)
- [Creating and publishing scoped packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages)
