/**
 * Config File Generator
 *
 * Generates a config.json template file with all available options.
 */

import { writeFileSync, existsSync } from "fs";
import { join } from "path";
import chalk from "chalk";

/**
 * Generates a config.json template file
 * @param {Object} options - CLI options
 */
export async function generateConfig(options) {
  const configPath = join(process.cwd(), "config.json");

  // Check if config.json already exists
  if (existsSync(configPath) && !options.force) {
    console.error(chalk.red("\n✗ Error: config.json already exists in the current directory."));
    console.log(chalk.yellow("\nUse --force to overwrite the existing file:"));
    console.log(chalk.gray("  writechoice config --force"));
    process.exit(1);
  }

  // Create the config template
  const configTemplate = {
    $schema: "https://json-schema.org/draft-07/schema#",
    description: "Configuration file for WriteChoice Mint CLI",

    source: "https://docs.example.com",
    target: "http://localhost:3000",
    preview: null,

    pages: {
      url: null,
      docs: "docs.json",
      output: "pages_report.json",
      concurrency: 20,
      quiet: false,
    },

    imageCheck: {
      url: null,
      docs: "docs.json",
      output: "images_report.json",
      concurrency: 10,
      quiet: false,
    },

    katex: {
      url: null,
      reportFile: "katex_errors.json",
      docs: "docs.json",
      output: "katex_errors.json",
      concurrency: 50,
      quiet: false,
    },

    links: {
      file: null,
      dir: null,
      output: "links_report",
      "dry-run": false,
      quiet: false,
      concurrency: 25,
      headless: true,
    },

    parse: {
      file: null,
      dir: null,
      quiet: false,
    },

    codeblocks: {
      file: null,
      dir: null,
      "dry-run": false,
      quiet: false,
      threshold: 15,
      expandable: true,
      lines: null,
      wrap: null,
    },

    images: {
      file: null,
      dir: null,
      "dry-run": false,
      quiet: false,
      download: false,
    },

    inlineimages: {
      file: null,
      dir: null,
      "dry-run": false,
      quiet: false,
    },

    h1: {
      file: null,
      dir: null,
      "dry-run": false,
      quiet: false,
    },

    imports: {
      file: null,
      dir: null,
      snippets: "snippets",
      "dry-run": false,
      quiet: false,
    },

    tabs: {
      file: null,
      dir: null,
      "dry-run": false,
      quiet: false,
    },

    find: {
      redirects: {
        base: null,
        input: "br.txt",
        output: "br_redirects.json",
        delay: 500,
        quiet: false,
      },
    },

    readme: {
      convert: {
        from: "readme/docs",
        "urls-file": null,
        output: "pages",
        "images-dir": "images/docs",
        "no-images": false,
        "dry-run": false,
        quiet: false,
      },
      url: null,
      output: "nav.json",
      "links-dir": "links",
      "no-links": false,
      quiet: false,
    },

    metadata: {
      file: null,
      dir: null,
      concurrency: 15,
      tags: [
        "og:title",
        "og:description",
        "og:image",
        "og:url",
        "twitter:title",
        "twitter:description",
        "twitter:image",
      ],
      "dry-run": false,
      quiet: false,
    },

    nav: {
      folders: {
        docs: "docs.json",
        base: true,
        skip_levels: [],
        rename: false,
        "dry-run": false,
        quiet: false,
      },
      root: {
        docs: "docs.json",
        "dry-run": false,
        quiet: false,
      },
    },

    fix: {
      redirects: {
        docs: "docs.json",
        dir: null,
        "dry-run": false,
        quiet: false,
      },
    },

    docusaurus: {
      output: null,
      headingAnchors: false,
      "dry-run": false,
      quiet: false,
    },

    scrape: {
      urls_file: "urls.json",
      output: "output",
      concurrency: 3,
      playwright: false,
      playwright_config: {
        headless: true,
        stealth: true,
        wait_for_selector: null,
        wait_time: 3,
        page_load_timeout: 30,
        storage_state: null,
      },
      "dry-run": false,
      quiet: false,
      content_selector: "body",
      title_selector: "h1",
      elements_to_remove: [],
      html_preserve_elements: ["iframe"],
      html_preserve_custom: [],
      images: {
        strategy: "keep_remote",
        folder: "images",
      },
      components: [
        {
          name: "Note",
          selector: ".admonition.note",
          props: {
            title: { selector: ".admonition-title", child: true },
          },
          content: ".admonition-body",
        },
        {
          name: "Warning",
          selector: ".admonition.warning",
          props: {
            title: { selector: ".admonition-title", child: true },
          },
          content: ".admonition-body",
        },
        {
          name: "Accordion",
          selector: ".faq-item",
          group: {
            selector: ".faq-group",
            wrapper: "AccordionGroup",
          },
          props: {
            title: ".faq-question",
          },
          content: ".faq-answer",
        },
        {
          name: "Card",
          selector: "a.card",
          group: {
            wrapper: "CardGroup",
          },
          props: {
            title: ".card-title",
            icon: { attr: "data-icon" },
            href: { attr: "href" },
          },
          content: ".card-body",
        },
        {
          name: "Tab",
          selector: ".tab-panel",
          group: {
            selector: ".tabs",
            wrapper: "Tabs",
          },
          props: {
            title: { attr: "data-title" },
          },
        },
      ],
      codeblock: {
        language_class_patterns: ["language-", "lang-", "highlight-"],
      },
      scripts: {
        pre: null,
        post: null,
      },
      api: {
        content: "article.body",
        filepath: "article.html_url",
        title: "article.title",
        fm: ["article.created_at", "article.updated_at"],
        headers: {},
      },
    },
  };

  try {
    writeFileSync(configPath, JSON.stringify(configTemplate, null, 2), "utf-8");

    if (!options.quiet) {
      console.log(chalk.green("\n✓ Successfully created config.json\n"));
      console.log(chalk.bold("Next steps:\n"));
      console.log("1. Edit config.json and update the placeholder values:");
      console.log(chalk.cyan("   - source:") + " Your production documentation URL");
      console.log(chalk.cyan("   - target:") + " Your validation environment URL (e.g., localhost:3000)");
      console.log(chalk.cyan("   - scrape.content_selector:") + " CSS selector for the main content area");
      console.log("\n2. Run commands without arguments:");
      console.log(chalk.gray("   wc scrape"));
      console.log(chalk.gray("   wc check links"));
      console.log(chalk.gray("   wc check parse"));
      console.log("\n3. For more details, see:");
      console.log(chalk.gray("   docs/config-file.md"));
      console.log(chalk.gray("   docs/commands/scrape.md"));
    }
  } catch (error) {
    console.error(chalk.red(`\n✗ Error creating config.json: ${error.message}`));
    process.exit(1);
  }
}
