---
sidebar_position: 1
title: Installation
---

# Installation

## Requirements

- **Node.js** 18 or later
- **npm** (bundled with Node.js)

## Install the CLI

```bash
npm install -g @writechoice/mint-cli
```

This installs two equivalent commands: `writechoice` and `wcc`.

## Install Playwright browsers

Several commands (`check links`, `check images`, `check katex`, `check pages`) use browser automation. Install the Chromium browser once after installing the CLI:

```bash
npx playwright install chromium
```

## Verify

```bash
wcc --version
```

## Troubleshooting

**Permission error on install (Linux/macOS):**

```bash
sudo npm install -g @writechoice/mint-cli
```

Or use [nvm](https://github.com/nvm-sh/nvm) to avoid needing `sudo`:

```bash
nvm install --lts
npm install -g @writechoice/mint-cli
```

**Playwright browsers missing:**

```bash
npx playwright install chromium
```

## Updating

```bash
wcc update
```

Or manually via npm:

```bash
npm install -g @writechoice/mint-cli@latest
```
