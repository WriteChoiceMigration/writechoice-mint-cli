# Update Command

Updates the CLI to the latest version from npm.

## Usage

```bash
writechoice update
```

## How It Works

The update command:
1. Checks npm for the latest published version
2. Compares it with your currently installed version
3. If a newer version is available, installs it globally
4. Displays the new version number

## Examples

### Basic Update

```bash
$ writechoice update
Checking for updates...

Update available: 0.0.7 → 0.0.8

Updating @writechoice/mint-cli...

✓ Successfully updated to version 0.0.8
```

### Already Up-to-Date

```bash
$ writechoice update
Checking for updates...
✓ You're already on the latest version (0.0.8)
```

## Automatic Update Notifications

The CLI automatically checks for updates when you run any command and displays a notification if a newer version is available:

```
┌─────────────────────────────────────────────────┐
│  Update available: 0.0.7 → 0.0.8                │
│  Run: writechoice update                        │
└─────────────────────────────────────────────────┘
```

This check runs in the background and won't interrupt your workflow. It has a 2-second timeout to avoid blocking command execution.

## Manual Update (Alternative)

You can also update using npm directly:

```bash
npm install -g @writechoice/mint-cli@latest
```

## Troubleshooting

### Permission Errors

If you get permission errors on Linux/macOS:

```bash
sudo npm install -g @writechoice/mint-cli@latest
```

Or use a node version manager like [nvm](https://github.com/nvm-sh/nvm) to avoid needing sudo.

### Network Issues

If the update check fails due to network issues, you can manually check the latest version:

```bash
npm view @writechoice/mint-cli version
```

Then install it:

```bash
npm install -g @writechoice/mint-cli@0.0.8
```

## Version History

To see all available versions:

```bash
npm view @writechoice/mint-cli versions
```

To install a specific version:

```bash
npm install -g @writechoice/mint-cli@0.0.7
```
