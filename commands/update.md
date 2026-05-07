# Update

# Update Command

Updates the CLI to the latest version from npm.

## Usage

```bash
writechoice update
```

## How It Works

1. Checks npm for the latest published version
2. Compares it with your currently installed version
3. If a newer version is available, installs it globally
4. Displays the new version number

## Examples

```bash
$ writechoice update
Checking for updates...

Update available: 0.0.7 → 0.0.8

Updating @writechoice/mint-cli...

✓ Successfully updated to version 0.0.8
```

**Already up to date:**

```bash
$ writechoice update
Checking for updates...
✓ You're already on the latest version (0.0.8)
```

## Automatic Update Notifications

When you run any command, the CLI automatically checks for updates in the background and shows a notice if a newer version is available:

```
┌─────────────────────────────────────────────────┐
│  Update available: 0.0.7 → 0.0.8               │
│  Run: writechoice update                        │
└─────────────────────────────────────────────────┘
```

## Manual Update (Alternative)

```bash
npm install -g @writechoice/mint-cli@latest
```

## Troubleshooting

**Permission errors on Linux/macOS:**

```bash
sudo npm install -g @writechoice/mint-cli@latest
```

Or use [nvm](https://github.com/nvm-sh/nvm) to avoid needing `sudo`.

**Check available versions:**

```bash
npm view @writechoice/mint-cli versions
```
