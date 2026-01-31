# Publishing Quick Guide

Quick reference for publishing new versions of @writechoice/mint-cli to npm.

## Prerequisites

```bash
# Login to npm
npm login

# Verify you're logged in
npm whoami
```

## First-Time Publication

```bash
# 1. Test locally
npm install
npm link
writechoice --version

# 2. Check what will be published
npm pack --dry-run

# 3. Publish (first time requires --access public)
npm publish --access public
```

## Publishing New Versions

### Quick Workflow

```bash
# 1. Make changes and commit
git add .
git commit -m "Add new feature"

# 2. Update version (auto-creates git tag)
npm version patch    # For bug fixes (1.0.0 → 1.0.1)
npm version minor    # For new features (1.0.0 → 1.1.0)
npm version major    # For breaking changes (1.0.0 → 2.0.0)

# 3. Push to git
git push origin main --tags

# 4. Publish to npm
npm publish

# 5. Verify
npm view @writechoice/mint-cli
```

## Version Types

- **Patch** (`npm version patch`): Bug fixes only
- **Minor** (`npm version minor`): New features, backwards compatible
- **Major** (`npm version major`): Breaking changes

## Pre-release (Beta) Versions

```bash
# Create and publish beta
npm version 1.1.0-beta.1
npm publish --tag beta

# Install beta
npm install -g @writechoice/mint-cli@beta
```

## Common Commands

```bash
# Check current version
npm version

# View published versions
npm view @writechoice/mint-cli versions

# Deprecate old version
npm deprecate @writechoice/mint-cli@1.0.0 "Please upgrade to 1.0.1"
```

## Troubleshooting

### Not logged in
```bash
npm login
```

### Version already exists
```bash
npm version patch  # Increment again
```

### Permission denied
Contact the package owner to add you as a collaborator.

## Detailed Guide

For comprehensive publishing documentation, see [docs/publishing.md](docs/publishing.md).

This includes:
- Complete setup instructions
- Changelog management
- GitHub Actions automation
- Best practices
- Advanced scenarios
