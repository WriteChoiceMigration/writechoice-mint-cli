# Fix Codeblocks Command

Automatically adds or removes code block flags (`expandable`, `lines`, `wrap`) in MDX documentation files.

## Usage[​](#usage "Direct link to Usage")

```
writechoice fix codeblocks [options]
```

## Options[​](#options "Direct link to Options")

| Option                 | Alias | Description                                      | Default |
| ---------------------- | ----- | ------------------------------------------------ | ------- |
| `--file <path>`        | `-f`  | Fix a single MDX file                            | -       |
| `--dir <path>`         | `-d`  | Fix MDX files in a specific directory            | -       |
| `--threshold <number>` | `-t`  | Line count threshold for `expandable`            | `15`    |
| `--no-expandable`      | -     | Skip `expandable` threshold processing           | -       |
| `--lines`              | -     | Add `lines` to all code blocks that lack it      | -       |
| `--remove-lines`       | -     | Remove `lines` from all code blocks that have it | -       |
| `--wrap`               | -     | Add `wrap` to all code blocks that lack it       | -       |
| `--remove-wrap`        | -     | Remove `wrap` from all code blocks that have it  | -       |
| `--dry-run`            | -     | Preview changes without writing files            | `false` |
| `--quiet`              | -     | Suppress terminal output                         | `false` |

## How It Works[​](#how-it-works "Direct link to How It Works")

Scans MDX files for fenced code blocks and modifies their info strings (the text after the opening triple backtick). Each flag is handled independently.

### `expandable`[​](#expandable "Direct link to expandable")

Controlled by `--threshold` (default: 15). Automatically adds or removes `expandable` based on line count:

* Has `expandable` **and** lines **< threshold** → remove it
* Lacks `expandable` **and** lines **> threshold** → add it
* Use `--no-expandable` to skip this flag entirely

### `lines`[​](#lines "Direct link to lines")

Shows line numbers in the rendered code block.

* `--lines` — adds `lines` to every block that lacks it
* `--remove-lines` — removes `lines` from every block that has it

### `wrap`[​](#wrap "Direct link to wrap")

Enables word wrapping in the rendered code block.

* `--wrap` — adds `wrap` to every block that lacks it
* `--remove-wrap` — removes `wrap` from every block that has it

## Examples[​](#examples "Direct link to Examples")

```
# Preview changes without writing

writechoice fix codeblocks --dry-run



# Add lines and wrap to all code blocks

writechoice fix codeblocks --lines --wrap



# Use a custom expandable threshold

writechoice fix codeblocks --threshold 20



# Remove lines from all code blocks

writechoice fix codeblocks --remove-lines



# Fix only a specific directory

writechoice fix codeblocks -d docs/api --lines



# Skip expandable and only manage lines

writechoice fix codeblocks --no-expandable --lines
```

## Config File[​](#config-file "Direct link to Config File")

```
{

  "codeblocks": {

    "threshold": 20,

    "lines": "add",

    "wrap": null,

    "expandable": true

  }

}
```

| Field        | Type                            | Description                            | Default |
| ------------ | ------------------------------- | -------------------------------------- | ------- |
| `threshold`  | number                          | Line count threshold for `expandable`  | `15`    |
| `expandable` | boolean                         | Enable expandable threshold processing | `true`  |
| `lines`      | `"add"` \| `"remove"` \| `null` | Manage `lines` flag                    | `null`  |
| `wrap`       | `"add"` \| `"remove"` \| `null` | Manage `wrap` flag                     | `null`  |

CLI flags always take precedence over config values.

## Safety[​](#safety "Direct link to Safety")

* Only modifies code block info strings — never the code content
* Idempotent: running twice produces the same result
* Use `--dry-run` to preview before writing
* Revert with `git checkout .` if needed
