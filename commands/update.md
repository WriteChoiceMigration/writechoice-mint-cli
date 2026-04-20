# Update Command

Updates the CLI to the latest version from npm.

## Usage[​](#usage "Direct link to Usage")

```
writechoice update
```

## How It Works[​](#how-it-works "Direct link to How It Works")

1. Checks npm for the latest published version
2. Compares it with your currently installed version
3. If a newer version is available, installs it globally
4. Displays the new version number

## Examples[​](#examples "Direct link to Examples")

```
$ writechoice update

Checking for updates...



Update available: 0.0.7 → 0.0.8



Updating @writechoice/mint-cli...



✓ Successfully updated to version 0.0.8
```

**Already up to date:**

```
$ writechoice update

Checking for updates...

✓ You're already on the latest version (0.0.8)
```

## Automatic Update Notifications[​](#automatic-update-notifications "Direct link to Automatic Update Notifications")

When you run any command, the CLI automatically checks for updates in the background and shows a notice if a newer version is available:

```
┌─────────────────────────────────────────────────┐

│  Update available: 0.0.7 → 0.0.8               │

│  Run: writechoice update                        │

└─────────────────────────────────────────────────┘
```

## Manual Update (Alternative)[​](#manual-update-alternative "Direct link to Manual Update (Alternative)")

```
npm install -g @writechoice/mint-cli@latest
```

## Troubleshooting[​](#troubleshooting "Direct link to Troubleshooting")

**Permission errors on Linux/macOS:**

```
sudo npm install -g @writechoice/mint-cli@latest
```

Or use [nvm](https://github.com/nvm-sh/nvm) to avoid needing `sudo`.

**Check available versions:**

```
npm view @writechoice/mint-cli versions
```
