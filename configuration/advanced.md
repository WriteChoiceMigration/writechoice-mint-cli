# Advanced Configuration

This page covers advanced configuration patterns for the WriteChoice Mint CLI — CI/CD integration, performance tuning, environment-specific setups, and report customization.

## Environment-Specific Configuration[​](#environment-specific-configuration "Direct link to Environment-Specific Configuration")

### Development[​](#development "Direct link to Development")

For local development validation:

```
{

  "source": "https://docs.example.com",

  "target": "http://localhost:3000",

  "links": {

    "headless": false,

    "concurrency": 5

  }

}
```

### Staging[​](#staging "Direct link to Staging")

For staging environment validation:

```
{

  "source": "https://docs.example.com",

  "target": "https://staging.example.com",

  "links": {

    "quiet": true,

    "concurrency": 25

  }

}
```

### Production[​](#production "Direct link to Production")

For validating the live site:

```
{

  "source": "https://docs.example.com",

  "target": "https://docs.example.com",

  "links": {

    "quiet": true,

    "concurrency": 10

  }

}
```

## CI/CD Integration[​](#cicd-integration "Direct link to CI/CD Integration")

### GitHub Actions[​](#github-actions "Direct link to GitHub Actions")

```
name: Validate Documentation



on: [push, pull_request]



jobs:

  validate-docs:

    runs-on: ubuntu-latest

    steps:

      - uses: actions/checkout@v3



      - uses: actions/setup-node@v3

        with:

          node-version: '18'



      - name: Install CLI

        run: npm install -g @writechoice/mint-cli



      - name: Install Playwright

        run: npx playwright install chromium



      - name: Validate MDX Parsing

        run: writechoice check parse



      - name: Validate Links

        run: writechoice check links https://docs.example.com --quiet



      - name: Upload Reports

        if: always()

        uses: actions/upload-artifact@v3

        with:

          name: validation-reports

          path: |

            links_report.json

            mdx_errors_report.json
```

### GitLab CI[​](#gitlab-ci "Direct link to GitLab CI")

```
validate-docs:

  stage: test

  image: node:18

  script:

    - npm install -g @writechoice/mint-cli

    - npx playwright install chromium

    - writechoice check parse

    - writechoice check links https://docs.example.com --quiet

  artifacts:

    when: always

    paths:

      - links_report.json

      - mdx_errors_report.json
```

## Excluded Directories[​](#excluded-directories "Direct link to Excluded Directories")

The following directories are excluded from scanning by default:

* `snippets/`
* `node_modules/`
* `.git/`

## Performance Tuning[​](#performance-tuning "Direct link to Performance Tuning")

### Link Validation Concurrency[​](#link-validation-concurrency "Direct link to Link Validation Concurrency")

Adjust concurrency based on your system resources:

| System    | RAM              | Recommended `-c` |
| --------- | ---------------- | ---------------- |
| Low-end   | 4 GB, 2 cores    | 5–10             |
| Mid-range | 8 GB, 4 cores    | 25               |
| High-end  | 16+ GB, 8+ cores | 50–100           |

```
writechoice check links docs.example.com -c 10
```

### Memory Management[​](#memory-management "Direct link to Memory Management")

If you encounter out-of-memory errors:

```
NODE_OPTIONS="--max-old-space-size=4096" writechoice check links docs.example.com
```

Or validate in smaller batches:

```
writechoice check links docs.example.com -d docs/api

writechoice check links docs.example.com -d docs/guides
```

## Report Customization[​](#report-customization "Direct link to Report Customization")

### Custom Output Paths[​](#custom-output-paths "Direct link to Custom Output Paths")

```
# Link validation report

writechoice check links docs.example.com -o custom_links



# After parse — rename the output

writechoice check parse && mv mdx_errors_report.json custom_mdx.json
```

### Consuming Reports in Scripts[​](#consuming-reports-in-scripts "Direct link to Consuming Reports in Scripts")

Reports are JSON and can be processed with any script:

```
import json



with open('links_report.json') as f:

    report = json.load(f)



failed_links = [

    result for file_results in report['results_by_file'].values()

    for result in file_results

    if result['status'] == 'failure'

]



print(f"Found {len(failed_links)} failed links")

for link in failed_links:

    print(f"  {link['source']['filePath']}:{link['source']['lineNumber']}")
```

## File Patterns[​](#file-patterns "Direct link to File Patterns")

### MDX File Detection[​](#mdx-file-detection "Direct link to MDX File Detection")

The CLI automatically detects `.mdx` files in the current directory and subdirectories.

### Link Patterns Recognized[​](#link-patterns-recognized "Direct link to Link Patterns Recognized")

| Format         | Example                            |
| -------------- | ---------------------------------- |
| Markdown links | `[text](url)`                      |
| HTML anchors   | `<a href="url">text</a>`           |
| JSX Cards      | `<Card href="url" />`              |
| JSX Buttons    | `<Button href="url">text</Button>` |

Images are automatically excluded from link validation.
