# Installation

## Requirements[​](#requirements "Direct link to Requirements")

* **Node.js** 18 or later
* **npm** (bundled with Node.js)

## Install the CLI[​](#install-the-cli "Direct link to Install the CLI")

```
npm install -g @writechoice/mint-cli
```

This installs two equivalent commands: `writechoice` and `wcc`.

## Install Playwright browsers[​](#install-playwright-browsers "Direct link to Install Playwright browsers")

Several commands (`check links`, `check images`, `check katex`, `check pages`) use browser automation. Install the Chromium browser once after installing the CLI:

```
npx playwright install chromium
```

## Verify[​](#verify "Direct link to Verify")

```
wcc --version
```

## Troubleshooting[​](#troubleshooting "Direct link to Troubleshooting")

**Permission error on install (Linux/macOS):**

```
sudo npm install -g @writechoice/mint-cli
```

Or use [nvm](https://github.com/nvm-sh/nvm) to avoid needing `sudo`:

```
nvm install --lts

npm install -g @writechoice/mint-cli
```

**Playwright browsers missing:**

```
npx playwright install chromium
```

## Updating[​](#updating "Direct link to Updating")

```
wcc update
```

Or manually via npm:

```
npm install -g @writechoice/mint-cli@latest
```
