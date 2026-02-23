# Test Coverage Tracker

Tests use Node.js built-in `node:test` + `node:assert/strict` (no extra deps).

Run all tests:
```bash
npm test
```

Run a single file:
```bash
node --test test/fix-h1.test.js
```

---

## Fix Commands (pure string processing)

| Command | Test file | Status | Tests |
|---|---|---|---|
| `fix h1` | `test/fix-h1.test.js` | ✅ done | 20 |
| `fix inlineimages` | `test/fix-inlineimages.test.js` | ✅ done | 19 |
| `fix images` | `test/fix-images.test.js` | ✅ done | 18 |
| `fix codeblocks` | `test/fix-codeblocks.test.js` | ✅ done | 19 |
| `fix parse` | `test/fix-parse.test.js` | ✅ done | 14 |
| `fix imports` | `test/fix-imports.test.js` | ✅ done | 30 |
| `fix links` | `test/fix-links.test.js` | ⬜ todo — needs report fixture |

## Other Commands

| Command | Test file | Notes |
|---|---|---|
| `metadata` | `test/metadata.test.js` | ✅ done — 22 tests (no network, pure logic) |
| `check parse` | — | ⬜ todo — integration test |
| `check links` | — | ⬜ todo — requires Playwright |
| `config` | `test/config.test.js` | ⬜ todo — filesystem |

---

## Exported functions available for testing

| Command | Exported functions |
|---|---|
| `fix/h1.js` | `extractFrontmatterTitle`, `removeDuplicateH1` |
| `fix/inlineimages.js` | `processContent`, `ensureImport` |
| `fix/images.js` | `processContent`, `extractImageSrcs` |
| `fix/codeblocks.js` | `processContent`, `processInfoTokens` |
| `fix/parse.js` | `segmentContent`, `fixVoidTags`, `fixStrayAngleBrackets` |
| `metadata.js` | `extractMetaTags`, `applyMetaToContent`, `fileToUrl`, `yamlValue`, `DEFAULT_META_TAGS` |
| `fix/imports.js` | `extractComponentNames`, `extractImports`, `buildImportLine`, `insertImportLines`, `MINTLIFY_COMPONENTS` |
