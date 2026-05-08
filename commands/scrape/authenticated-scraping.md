# Authenticated Scraping

# Authenticated Scraping

Some sites require you to be logged in to view content. The `wc session` command opens a real browser window so you can log in manually, then saves the resulting cookies and localStorage to a file. The scraper can load that file on every subsequent run.

## When you need this

- The site is behind a login page
- Content is gated to registered users or paid plans
- The site uses SSO or OAuth (login happens in an external tab)

If the site is only blocked by Cloudflare's bot detection (but is otherwise public), stealth mode alone is usually enough — see [Playwright Configuration](./playwright).

## Step 1 — Capture the session

Run `wc session` with the URL of the page you want to scrape (or the login page, if the target redirects there):

```bash
wc session https://app.example.com/docs
```

A visible Chrome window opens. Log in normally — including any MFA steps. When you're fully authenticated and the page content is visible, press **Enter** in the terminal.

The session is saved to `session.json` in your current directory. To save it elsewhere:

```bash
wc session https://app.example.com/docs --output ./auth/example-session.json
```

## Step 2 — Add to config

Point `playwright_config.storage_state` at the saved file:

```json
{
  "scrape": {
    "playwright": true,
    "playwright_config": {
      "stealth": true,
      "wait_for_selector": "article.main-content",
      "storage_state": "session.json"
    }
  }
}
```

The path is resolved relative to your working directory (where you run `wc scrape`).

## Step 3 — Scrape

Run `wc scrape` as normal. The saved cookies are injected into every Playwright browser context, so the scraper is already authenticated.

```bash
wc scrape
```

## Session expiry

Sessions expire when the site's authentication cookies expire — typically hours to days depending on the site. If the scraper starts returning login pages or empty content, re-run `wc session` to refresh the file.

## Using a session without Playwright

If the site doesn't require JavaScript rendering, you can skip Playwright entirely and still use the saved session. Set `"playwright": false` (or omit it) and keep `storage_state` in the config — the cookies are injected into native fetch requests instead:

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

This is faster than running a full browser for each page.
