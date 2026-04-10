// @ts-check
import { themes as prismThemes } from "prism-react-renderer";

/** @type {import('@docusaurus/types').Config} */
const config = {
  future: {
    faster: true,
    v4: true,
  },
  title: "WriteChoice Mint CLI",
  tagline: "Validate, fix, and manage Mintlify documentation with confidence.",
  favicon: "img/favicon.ico",

  url: "https://writechoicemigration.github.io",
  baseUrl: "/writechoice-mint-cli/",

  organizationName: "WriteChoiceMigration",
  projectName: "writechoice-mint-cli",

  onBrokenLinks: "warn",
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: "./sidebars.js",
          routeBasePath: "/",
          editUrl: "https://github.com/WriteChoiceMigration/writechoice-mint-cli/edit/main/docs/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: "WriteChoice Mint CLI",
        items: [
          {
            type: "docSidebar",
            sidebarId: "docs",
            position: "left",
            label: "Docs",
          },
          {
            href: "https://github.com/WriteChoiceMigration/writechoice-mint-cli",
            label: "GitHub",
            position: "right",
          },
          {
            href: "https://www.npmjs.com/package/@writechoice/mint-cli",
            label: "npm",
            position: "right",
          },
        ],
      },
      footer: {
        style: "dark",
        links: [
          {
            title: "Docs",
            items: [
              { label: "Introduction", to: "/" },
              { label: "Installation", to: "/getting-started/installation" },
              { label: "Configuration", to: "/configuration/config-file" },
            ],
          },
          {
            title: "Commands",
            items: [
              { label: "Check", to: "/commands/check/links" },
              { label: "Fix", to: "/commands/fix/links" },
              { label: "Nav", to: "/commands/nav/folders" },
            ],
          },
          {
            title: "More",
            items: [
              { label: "GitHub", href: "https://github.com/WriteChoiceMigration/writechoice-mint-cli" },
              { label: "npm", href: "https://www.npmjs.com/package/@writechoice/mint-cli" },
              { label: "Issues", href: "https://github.com/WriteChoiceMigration/writechoice-mint-cli/issues" },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} WriteChoice. Built with Docusaurus.`,
      },
      prism: {
        theme: prismThemes.vsLight,
        darkTheme: prismThemes.vsDark,
        additionalLanguages: ["ruby", "csharp", "php", "java", "powershell", "json", "bash", "yaml"],
      },
      colorMode: {
        defaultMode: "light",
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
    }),
};

module.exports = config;
