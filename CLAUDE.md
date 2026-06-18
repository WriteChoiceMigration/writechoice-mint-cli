# Development Rules

Follow these steps in order for every new feature or bug fix.

## 1. Implement

Write the code. Keep changes focused — no refactors, cleanup, or extra abstractions beyond what the task requires.

## 2. Backwards Compatibility

New options must not change existing behavior when absent. Use safe defaults:

- New config keys must default to `null`, `false`, or their previous implicit value
- New function parameters must default so all existing call sites still work
- New scrape pipeline steps must be gated on the new config being present
- Run the existing test suite after implementing to catch regressions: `npm test`

## 3. Tests

Add tests for the new feature or bug fix in `test/`. Use Node's built-in test runner (`node:test`). Run the full suite and confirm 0 failures:

```bash
npm test
```

Tests live in `test/*.test.js`. Look at existing test files for the pattern.

## 4. Documentation

Add or update docs in `docs/docs/`. The Docusaurus project lives in `docs/`.

- New scrape sub-features → add a page under `docs/docs/commands/scrape/` and register it in `docs/sidebars.js`
- New top-level commands → add a page under `docs/docs/commands/` and register it in `docs/sidebars.js`
- New config options on an existing feature → update the relevant existing page AND `docs/docs/commands/scrape/config-reference.mdx`
- Bug fixes with user-visible behavior changes → update the relevant page

## 5. config.example.json

Update `config.example.jsonc` with every new option. Add an inline `//` comment explaining what it does. Keep it in sync with `docs/docs/commands/scrape/config-reference.mdx`.

## 6. config command

Any change to the config structure (new option, renamed key, removed key, changed default) must also update `src/commands/config.js` so the generated template stays in sync with `config.example.json`. Also update `docs/docs/commands/config.md` and `docs/docs/commands/index.md` (or the relevant config docs page) to reflect the change.
