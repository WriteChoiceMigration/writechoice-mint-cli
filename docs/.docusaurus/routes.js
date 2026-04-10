import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/writechoice-mint-cli/__docusaurus/debug',
    component: ComponentCreator('/writechoice-mint-cli/__docusaurus/debug', 'd64'),
    exact: true
  },
  {
    path: '/writechoice-mint-cli/__docusaurus/debug/config',
    component: ComponentCreator('/writechoice-mint-cli/__docusaurus/debug/config', 'da9'),
    exact: true
  },
  {
    path: '/writechoice-mint-cli/__docusaurus/debug/content',
    component: ComponentCreator('/writechoice-mint-cli/__docusaurus/debug/content', '412'),
    exact: true
  },
  {
    path: '/writechoice-mint-cli/__docusaurus/debug/globalData',
    component: ComponentCreator('/writechoice-mint-cli/__docusaurus/debug/globalData', '199'),
    exact: true
  },
  {
    path: '/writechoice-mint-cli/__docusaurus/debug/metadata',
    component: ComponentCreator('/writechoice-mint-cli/__docusaurus/debug/metadata', '7ed'),
    exact: true
  },
  {
    path: '/writechoice-mint-cli/__docusaurus/debug/registry',
    component: ComponentCreator('/writechoice-mint-cli/__docusaurus/debug/registry', '2f7'),
    exact: true
  },
  {
    path: '/writechoice-mint-cli/__docusaurus/debug/routes',
    component: ComponentCreator('/writechoice-mint-cli/__docusaurus/debug/routes', '77f'),
    exact: true
  },
  {
    path: '/writechoice-mint-cli/',
    component: ComponentCreator('/writechoice-mint-cli/', '783'),
    routes: [
      {
        path: '/writechoice-mint-cli/',
        component: ComponentCreator('/writechoice-mint-cli/', '410'),
        routes: [
          {
            path: '/writechoice-mint-cli/',
            component: ComponentCreator('/writechoice-mint-cli/', '9b7'),
            routes: [
              {
                path: '/writechoice-mint-cli/commands/check/images',
                component: ComponentCreator('/writechoice-mint-cli/commands/check/images', '9c8'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/commands/check/katex',
                component: ComponentCreator('/writechoice-mint-cli/commands/check/katex', 'c3c'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/commands/check/links',
                component: ComponentCreator('/writechoice-mint-cli/commands/check/links', '0e2'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/commands/check/pages',
                component: ComponentCreator('/writechoice-mint-cli/commands/check/pages', '9c4'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/commands/check/parse',
                component: ComponentCreator('/writechoice-mint-cli/commands/check/parse', 'e15'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/commands/config',
                component: ComponentCreator('/writechoice-mint-cli/commands/config', 'd77'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/commands/docusaurus/convert',
                component: ComponentCreator('/writechoice-mint-cli/commands/docusaurus/convert', '77f'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/commands/docusaurus/nav',
                component: ComponentCreator('/writechoice-mint-cli/commands/docusaurus/nav', '200'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/commands/docusaurus/slugify',
                component: ComponentCreator('/writechoice-mint-cli/commands/docusaurus/slugify', 'ecd'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/commands/fix/codeblocks',
                component: ComponentCreator('/writechoice-mint-cli/commands/fix/codeblocks', '70b'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/commands/fix/h1',
                component: ComponentCreator('/writechoice-mint-cli/commands/fix/h1', 'cb9'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/commands/fix/images',
                component: ComponentCreator('/writechoice-mint-cli/commands/fix/images', '2d3'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/commands/fix/imports',
                component: ComponentCreator('/writechoice-mint-cli/commands/fix/imports', '35c'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/commands/fix/inlineimages',
                component: ComponentCreator('/writechoice-mint-cli/commands/fix/inlineimages', 'ca4'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/commands/fix/links',
                component: ComponentCreator('/writechoice-mint-cli/commands/fix/links', 'ca6'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/commands/fix/parse',
                component: ComponentCreator('/writechoice-mint-cli/commands/fix/parse', '47b'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/commands/fix/redirects',
                component: ComponentCreator('/writechoice-mint-cli/commands/fix/redirects', 'c33'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/commands/metadata',
                component: ComponentCreator('/writechoice-mint-cli/commands/metadata', 'eab'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/commands/nav/folders',
                component: ComponentCreator('/writechoice-mint-cli/commands/nav/folders', '51a'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/commands/nav/root',
                component: ComponentCreator('/writechoice-mint-cli/commands/nav/root', 'bfe'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/commands/scrape',
                component: ComponentCreator('/writechoice-mint-cli/commands/scrape', '932'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/commands/session',
                component: ComponentCreator('/writechoice-mint-cli/commands/session', '4e5'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/commands/update',
                component: ComponentCreator('/writechoice-mint-cli/commands/update', 'cd6'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/configuration/advanced',
                component: ComponentCreator('/writechoice-mint-cli/configuration/advanced', 'b05'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/configuration/config-file',
                component: ComponentCreator('/writechoice-mint-cli/configuration/config-file', 'e12'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/configuration/publishing',
                component: ComponentCreator('/writechoice-mint-cli/configuration/publishing', 'ab2'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/getting-started/installation',
                component: ComponentCreator('/writechoice-mint-cli/getting-started/installation', 'cf9'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/getting-started/quick-start',
                component: ComponentCreator('/writechoice-mint-cli/getting-started/quick-start', '3ee'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/writechoice-mint-cli/',
                component: ComponentCreator('/writechoice-mint-cli/', '940'),
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
