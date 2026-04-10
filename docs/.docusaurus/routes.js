import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/mint-cli/__docusaurus/debug',
    component: ComponentCreator('/mint-cli/__docusaurus/debug', 'bc7'),
    exact: true
  },
  {
    path: '/mint-cli/__docusaurus/debug/config',
    component: ComponentCreator('/mint-cli/__docusaurus/debug/config', 'e7a'),
    exact: true
  },
  {
    path: '/mint-cli/__docusaurus/debug/content',
    component: ComponentCreator('/mint-cli/__docusaurus/debug/content', '17b'),
    exact: true
  },
  {
    path: '/mint-cli/__docusaurus/debug/globalData',
    component: ComponentCreator('/mint-cli/__docusaurus/debug/globalData', '479'),
    exact: true
  },
  {
    path: '/mint-cli/__docusaurus/debug/metadata',
    component: ComponentCreator('/mint-cli/__docusaurus/debug/metadata', '1f7'),
    exact: true
  },
  {
    path: '/mint-cli/__docusaurus/debug/registry',
    component: ComponentCreator('/mint-cli/__docusaurus/debug/registry', 'e49'),
    exact: true
  },
  {
    path: '/mint-cli/__docusaurus/debug/routes',
    component: ComponentCreator('/mint-cli/__docusaurus/debug/routes', '7a0'),
    exact: true
  },
  {
    path: '/mint-cli/',
    component: ComponentCreator('/mint-cli/', 'f1f'),
    routes: [
      {
        path: '/mint-cli/',
        component: ComponentCreator('/mint-cli/', 'fc8'),
        routes: [
          {
            path: '/mint-cli/',
            component: ComponentCreator('/mint-cli/', '914'),
            routes: [
              {
                path: '/mint-cli/commands/check/images',
                component: ComponentCreator('/mint-cli/commands/check/images', '5e8'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/commands/check/katex',
                component: ComponentCreator('/mint-cli/commands/check/katex', '9f0'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/commands/check/links',
                component: ComponentCreator('/mint-cli/commands/check/links', '27f'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/commands/check/pages',
                component: ComponentCreator('/mint-cli/commands/check/pages', 'e59'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/commands/check/parse',
                component: ComponentCreator('/mint-cli/commands/check/parse', 'f46'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/commands/config',
                component: ComponentCreator('/mint-cli/commands/config', '83f'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/commands/docusaurus/convert',
                component: ComponentCreator('/mint-cli/commands/docusaurus/convert', 'a53'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/commands/docusaurus/nav',
                component: ComponentCreator('/mint-cli/commands/docusaurus/nav', '07a'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/commands/docusaurus/slugify',
                component: ComponentCreator('/mint-cli/commands/docusaurus/slugify', 'b87'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/commands/fix/codeblocks',
                component: ComponentCreator('/mint-cli/commands/fix/codeblocks', 'bec'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/commands/fix/h1',
                component: ComponentCreator('/mint-cli/commands/fix/h1', '78f'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/commands/fix/images',
                component: ComponentCreator('/mint-cli/commands/fix/images', '6c1'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/commands/fix/imports',
                component: ComponentCreator('/mint-cli/commands/fix/imports', '060'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/commands/fix/inlineimages',
                component: ComponentCreator('/mint-cli/commands/fix/inlineimages', '28d'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/commands/fix/links',
                component: ComponentCreator('/mint-cli/commands/fix/links', '134'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/commands/fix/parse',
                component: ComponentCreator('/mint-cli/commands/fix/parse', 'a2d'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/commands/fix/redirects',
                component: ComponentCreator('/mint-cli/commands/fix/redirects', '3d1'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/commands/metadata',
                component: ComponentCreator('/mint-cli/commands/metadata', '74c'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/commands/nav/folders',
                component: ComponentCreator('/mint-cli/commands/nav/folders', '581'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/commands/nav/root',
                component: ComponentCreator('/mint-cli/commands/nav/root', 'db1'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/commands/scrape',
                component: ComponentCreator('/mint-cli/commands/scrape', '19f'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/commands/session',
                component: ComponentCreator('/mint-cli/commands/session', '8d3'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/commands/update',
                component: ComponentCreator('/mint-cli/commands/update', '871'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/configuration/advanced',
                component: ComponentCreator('/mint-cli/configuration/advanced', '293'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/configuration/config-file',
                component: ComponentCreator('/mint-cli/configuration/config-file', '1f5'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/configuration/publishing',
                component: ComponentCreator('/mint-cli/configuration/publishing', '6fe'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/getting-started/installation',
                component: ComponentCreator('/mint-cli/getting-started/installation', '077'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/getting-started/quick-start',
                component: ComponentCreator('/mint-cli/getting-started/quick-start', 'ddd'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/mint-cli/',
                component: ComponentCreator('/mint-cli/', 'a89'),
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
