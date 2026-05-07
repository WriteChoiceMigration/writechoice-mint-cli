# Session

# Session Command

Captures an authenticated browser session so `wc scrape` can access pages behind a login.

## Usage

```bash
wc session <url>
wc session <url> --output my-session.json
```

## Options

| Option | Description | Default |
|---|---|---|
| `<url>` | URL to open (login page or any protected page) | — |
| `-o, --output <file>` | Path to save the session file | `session.json` |

## How It Works

1. Opens a **visible** browser window at the given URL
2. You log in manually in the browser
3. Press **Enter** in the terminal when done
4. The session (cookies + localStorage) is saved to the output file

```bash
wc session https://docs.example.com/login
# → browser opens, you log in, press Enter
# → session saved to session.json
```

## Using the Session with Scrape

Set `storage_state` in `config.json` under `scrape.playwright_config`:

```json
{
  "scrape": {
    "playwright_config": {
      "storage_state": "session.json"
    }
  }
}
```

### With Playwright (`playwright: true`)

The session is loaded into the Playwright browser context — use this when the site requires JavaScript rendering in addition to authentication.

### Without Playwright (`playwright: false`)

Cookies from the session file are extracted and injected as a `Cookie` header into native `fetch` requests. This is faster (no browser overhead) and works when only the auth cookie is needed.

```json
{
  "scrape": {
    "playwright": false,
    "playwright_config": {
      "storage_state": "session.json"
    }
  }
}
```

## Refreshing a Session

Sessions expire when the site's cookies expire. Re-run the command to capture a fresh one:

```bash
wc session https://docs.example.com/login
```
