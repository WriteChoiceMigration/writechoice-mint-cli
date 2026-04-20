import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/',
    component: ComponentCreator('/', '32e'),
    routes: [
      {
        path: '/',
        component: ComponentCreator('/', '58b'),
        routes: [
          {
            path: '/',
            component: ComponentCreator('/', '454'),
            routes: [
              {
                path: '/commands/check/images',
                component: ComponentCreator('/commands/check/images', '735'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/commands/check/katex',
                component: ComponentCreator('/commands/check/katex', 'bfd'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/commands/check/links',
                component: ComponentCreator('/commands/check/links', '830'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/commands/check/pages',
                component: ComponentCreator('/commands/check/pages', 'f67'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/commands/check/parse',
                component: ComponentCreator('/commands/check/parse', '9b5'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/commands/config',
                component: ComponentCreator('/commands/config', '86e'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/commands/docusaurus/convert',
                component: ComponentCreator('/commands/docusaurus/convert', '4d1'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/commands/docusaurus/nav',
                component: ComponentCreator('/commands/docusaurus/nav', '76b'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/commands/docusaurus/slugify',
                component: ComponentCreator('/commands/docusaurus/slugify', 'f73'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/commands/fix/codeblocks',
                component: ComponentCreator('/commands/fix/codeblocks', '5c5'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/commands/fix/h1',
                component: ComponentCreator('/commands/fix/h1', '1a4'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/commands/fix/images',
                component: ComponentCreator('/commands/fix/images', 'b52'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/commands/fix/imports',
                component: ComponentCreator('/commands/fix/imports', '29a'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/commands/fix/inlineimages',
                component: ComponentCreator('/commands/fix/inlineimages', 'c47'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/commands/fix/links',
                component: ComponentCreator('/commands/fix/links', 'c0f'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/commands/fix/parse',
                component: ComponentCreator('/commands/fix/parse', '4aa'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/commands/fix/redirects',
                component: ComponentCreator('/commands/fix/redirects', '89d'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/commands/metadata',
                component: ComponentCreator('/commands/metadata', '513'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/commands/nav/folders',
                component: ComponentCreator('/commands/nav/folders', '602'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/commands/nav/root',
                component: ComponentCreator('/commands/nav/root', 'e8e'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/commands/scrape',
                component: ComponentCreator('/commands/scrape', '388'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/commands/session',
                component: ComponentCreator('/commands/session', '295'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/commands/update',
                component: ComponentCreator('/commands/update', '1cf'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/configuration/advanced',
                component: ComponentCreator('/configuration/advanced', '37f'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/configuration/config-file',
                component: ComponentCreator('/configuration/config-file', 'c77'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/configuration/publishing',
                component: ComponentCreator('/configuration/publishing', '7aa'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/getting-started/installation',
                component: ComponentCreator('/getting-started/installation', 'e0c'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/getting-started/quick-start',
                component: ComponentCreator('/getting-started/quick-start', '5eb'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/',
                component: ComponentCreator('/', '7da'),
                exact: true,
                sidebar: "docs"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
