// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docs: [
    {
      type: "doc",
      id: "intro",
      label: "Introduction",
    },
    {
      type: "category",
      label: "Getting Started",
      collapsed: false,
      items: ["getting-started/installation", "getting-started/quick-start"],
    },
    {
      type: "category",
      label: "Commands",
      collapsed: false,
      items: [
        {
          type: "category",
          label: "Scrape",
          link: { type: "doc", id: "commands/scrape/index" },
          items: ["commands/scrape/script-hooks", "commands/scrape/config-reference"],
        },
        {
          type: "category",
          label: "Check",
          items: [
            "commands/check/links",
            "commands/check/parse",
            "commands/check/images",
            "commands/check/pages",
            "commands/check/katex",
          ],
        },
        {
          type: "category",
          label: "Fix",
          items: [
            "commands/fix/links",
            "commands/fix/parse",
            "commands/fix/codeblocks",
            "commands/fix/images",
            "commands/fix/inlineimages",
            "commands/fix/h1",
            "commands/fix/imports",
            "commands/fix/redirects",
          ],
        },
        {
          type: "category",
          label: "Nav",
          items: ["commands/nav/folders", "commands/nav/root"],
        },
        {
          type: "category",
          label: "Docusaurus",
          items: ["commands/docusaurus/convert", "commands/docusaurus/slugify", "commands/docusaurus/nav"],
        },
        "commands/metadata",

        "commands/session",
        "commands/config",
        "commands/update",
      ],
    },
    {
      type: "category",
      label: "Configuration",
      items: ["configuration/config-file", "configuration/advanced", "configuration/publishing"],
    },
  ],
};

module.exports = sidebars;
