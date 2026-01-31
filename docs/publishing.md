# Publishing Guide

Detailed guide for publishing and managing versions of the WriteChoice Mint CLI package.

## Prerequisites

### 1. npm Account Setup

- Create an account at [npmjs.com](https://www.npmjs.com/signup)
- Verify your email address
- Enable two-factor authentication (recommended)

### 2. npm CLI Authentication

```bash
npm login
```

Enter your credentials:
- Username
- Password
- Email
- (If 2FA is enabled) One-time password

Verify authentication:
```bash
npm whoami
```

## Initial Publication

### Step 1: Prepare the Package

1. **Verify package.json metadata**:
   ```json
   {
     "name": "@writechoice/mint-cli",
     "version": "1.0.0",
     "description": "CLI tool for Mintlify documentation validation and utilities",
     "author": "WriteChoice",
     "license": "MIT",
     "repository": {
       "type": "git",
       "url": "https://github.com/writechoice/mint-cli.git"
     }
   }
   ```

2. **Test the package locally**:
   ```bash
   npm install
   npx playwright install chromium
   node bin/cli.js check links --help
   npm link
   writechoice --version
   ```

3. **Check what will be published**:
   ```bash
   npm pack --dry-run
   ```

   Ensure:
   - Source files included (`src/`, `bin/`)
   - Test files excluded
   - `node_modules/` excluded
   - `README.md`, `LICENSE`, `package.json` included

### Step 2: Publish

```bash
npm publish --access public
```

The `--access public` flag is required for scoped packages the first time.

### Step 3: Verify

- Check on npm: https://www.npmjs.com/package/@writechoice/mint-cli
- Test installation:
  ```bash
  npm install -g @writechoice/mint-cli
  writechoice --version
  ```

## Publishing New Versions

### Semantic Versioning

Follow [SemVer](https://semver.org/):
- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features, backwards compatible
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, backwards compatible

### Version Update Workflow

#### 1. Make Changes

```bash
git checkout -b feature/new-feature
# ... make changes ...
git add .
git commit -m "Add new feature"
```

#### 2. Update Version

Use npm's version command (updates package.json and creates git tag):

```bash
# Patch (bug fixes)
npm version patch  # 1.0.0 → 1.0.1

# Minor (new features)
npm version minor  # 1.0.0 → 1.1.0

# Major (breaking changes)
npm version major  # 1.0.0 → 2.0.0

# Or specify exact version
npm version 1.2.3
```

This command:
1. Updates `package.json` version
2. Creates a git commit with the version change
3. Creates a git tag (e.g., `v1.0.1`)

#### 3. Update Changelog (Recommended)

Create or update `CHANGELOG.md`:

```markdown
# Changelog

## [1.1.0] - 2024-01-20

### Added
- New MDX parsing validation command
- CI/CD integration examples

### Fixed
- Fixed anchor parsing for special characters
- Improved error messages

### Changed
- Updated default concurrency to 30

## [1.0.0] - 2024-01-15

### Initial Release
- Link validation for MDX files
- Auto-fix for incorrect anchors
- Browser automation with Playwright
```

#### 4. Test

```bash
npm link
writechoice --version
npm test

# Test with real documentation
writechoice check parse
writechoice check links docs.example.com --dry-run
```

#### 5. Push Changes

```bash
git push origin main
git push origin --tags
```

#### 6. Publish

```bash
npm publish
```

No need for `--access public` after first publication.

#### 7. Verify

```bash
npm view @writechoice/mint-cli
npm install -g @writechoice/mint-cli@latest
writechoice --version
```

## Pre-release Versions

For testing before stable release:

### Create Beta Version

```bash
npm version 1.1.0-beta.1
npm publish --tag beta
```

### Install Beta

```bash
# Specific beta version
npm install -g @writechoice/mint-cli@1.1.0-beta.1

# Latest beta
npm install -g @writechoice/mint-cli@beta
```

### Promote to Stable

```bash
npm version 1.1.0
npm publish
```

## npm Commands Reference

```bash
# Check current version
npm version

# View package info
npm view @writechoice/mint-cli

# View all published versions
npm view @writechoice/mint-cli versions

# Deprecate a version (recommended over unpublish)
npm deprecate @writechoice/mint-cli@1.0.0 "Please upgrade to 1.0.1"

# Add dist-tag
npm dist-tag add @writechoice/mint-cli@1.1.0-beta.1 beta

# Publish with tag
npm publish --tag beta

# Unpublish (within 72 hours, use carefully!)
npm unpublish @writechoice/mint-cli@1.0.1
```

## GitHub Actions Automation

Automate releases with GitHub Actions:

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
- Or request ownership of abandoned package

### "Version already exists"

```bash
# Increment version again
npm version patch

# Or specify new version
npm version 1.0.2
```

## Best Practices

1. **Always test before publishing**
   - Link locally with `npm link`
   - Test all CLI commands
   - Check included files with `npm pack --dry-run`

2. **Follow semantic versioning**
   - Breaking changes = major version
   - New features = minor version
   - Bug fixes = patch version

3. **Maintain a changelog**
   - Document all changes
   - Make it easy for users to see what's new

4. **Use git tags**
   - Tag each release with `v{version}`
   - `npm version` does this automatically

5. **Test installations**
   - Install the published package globally
   - Verify it works as expected

6. **Use prerelease versions**
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
