/**
 * Component Processor
 *
 * Transforms HTML elements into Mintlify MDX component placeholders
 * before markdown conversion. Processing order matters:
 *   callouts → accordions → cards → tabs → code groups
 *
 * All placeholders are created via PlaceholderManager and restored
 * after markdown conversion.
 */

/**
 * Processes all configured components in the correct order.
 * @param {Object} $ - Cheerio instance
 * @param {Object} componentsConfig - scrape.components from config
 * @param {import('./placeholder-manager.js').PlaceholderManager} pm
 */
export function processAllComponents($, componentsConfig = {}, pm) {
  if (componentsConfig.callouts?.length) {
    processCallouts($, componentsConfig.callouts, pm);
  }
  if (componentsConfig.accordion) {
    processAccordions($, componentsConfig.accordion, pm);
  }
  if (componentsConfig.card) {
    processCards($, componentsConfig.card, pm);
  }
  if (componentsConfig.tabs) {
    processTabs($, componentsConfig.tabs, pm);
  }
  if (componentsConfig.codegroup) {
    processCodeGroups($, componentsConfig.codegroup, pm);
  }
}

/**
 * Processes callout elements (Note, Info, Warning, Tip, Check, Danger).
 * @param {Object} $ - Cheerio instance
 * @param {Array} calloutsConfig - Array of callout config objects
 * @param {import('./placeholder-manager.js').PlaceholderManager} pm
 */
export function processCallouts($, calloutsConfig, pm) {
  const typeMap = {
    Note: "NOTE",
    Info: "INFO",
    Warning: "WARNING",
    Tip: "TIP",
    Check: "CHECK",
    Danger: "DANGER",
  };

  for (const config of calloutsConfig) {
    const placeholderType = typeMap[config.type] || config.type.toUpperCase();

    $(config.selector).each((_, el) => {
      const $el = $(el);

      // Extract title
      let title = "";
      if (config.title_selector) {
        const $title = $el.find(config.title_selector).first();
        if ($title.length) {
          title = $title.text().trim();
          $title.remove();
        }
      }

      // Extract content
      let contentHtml;
      if (config.content_selector) {
        const $content = $el.find(config.content_selector).first();
        contentHtml = $content.length ? $content.html() || "" : $el.html() || "";
      } else {
        contentHtml = $el.html() || "";
      }

      // Build content string with optional title
      let content = contentHtml.trim();
      if (title) {
        content = `CALLOUTTITLE:${title}\n\n${content}`;
      }

      const placeholder = pm.createComponentPlaceholder(placeholderType, content, {});
      $el.replaceWith(placeholder);
    });
  }
}

/**
 * Processes accordion groups.
 * @param {Object} $ - Cheerio instance
 * @param {Object} config - accordion config
 * @param {import('./placeholder-manager.js').PlaceholderManager} pm
 */
export function processAccordions($, config, pm) {
  $(config.group_selector).each((_, group) => {
    const $group = $(group);
    const itemPlaceholders = [];

    $group.find(config.item_selector).each((_, item) => {
      const $item = $(item);

      const title = $item.find(config.title_selector).first().text().trim();

      let contentHtml;
      if (config.content_selector) {
        const $content = $item.find(config.content_selector).first();
        contentHtml = $content.length ? $content.html() || "" : $item.html() || "";
      } else {
        // Remove title from content
        $item.find(config.title_selector).remove();
        contentHtml = $item.html() || "";
      }

      const placeholder = pm.createComponentPlaceholder("ACCORDION", contentHtml.trim(), { title });
      itemPlaceholders.push(placeholder);
    });

    if (itemPlaceholders.length) {
      const groupContent = itemPlaceholders.join("\n\n");
      $group.replaceWith(`<AccordionGroup>\n${groupContent}\n</AccordionGroup>`);
    }
  });
}

/**
 * Processes card groups.
 * @param {Object} $ - Cheerio instance
 * @param {Object} config - card config
 * @param {import('./placeholder-manager.js').PlaceholderManager} pm
 */
export function processCards($, config, pm) {
  $(config.group_selector).each((_, group) => {
    const $group = $(group);
    const cardPlaceholders = [];

    $group.find(config.item_selector).each((_, item) => {
      const $item = $(item);

      const props = {};

      if (config.title_attr) {
        const title = $item.attr(config.title_attr) || $item.find("[data-title]").attr("data-title") || "";
        if (title) props.title = title;
      }

      if (config.icon_attr) {
        const icon = $item.attr(config.icon_attr) || "";
        if (icon) props.icon = icon;
      }

      if (config.href_attr) {
        const href = $item.attr(config.href_attr) || $item.attr("href") || "";
        if (href) props.href = href;
      }

      let contentHtml;
      if (config.content_selector) {
        const $content = $item.find(config.content_selector).first();
        contentHtml = $content.length ? $content.html() || "" : "";
      } else {
        contentHtml = $item.html() || "";
      }

      const placeholder = pm.createComponentPlaceholder("CARD", contentHtml.trim(), props);
      cardPlaceholders.push(placeholder);
    });

    if (cardPlaceholders.length) {
      const groupContent = cardPlaceholders.join("\n\n");
      $group.replaceWith(`<Columns>\n${groupContent}\n</Columns>`);
    }
  });
}

/**
 * Processes tab groups.
 * @param {Object} $ - Cheerio instance
 * @param {Object} config - tabs config
 * @param {import('./placeholder-manager.js').PlaceholderManager} pm
 */
export function processTabs($, config, pm) {
  $(config.group_selector).each((_, group) => {
    const $group = $(group);
    const tabPlaceholders = [];

    $group.find(config.item_selector).each((_, item) => {
      const $item = $(item);

      const title = config.title_attr
        ? ($item.attr(config.title_attr) || "Tab")
        : $item.find(config.title_selector || "[data-tab-title]").first().text().trim() || "Tab";

      const contentHtml = $item.html() || "";

      const placeholder = pm.createComponentPlaceholder("TAB", contentHtml.trim(), { title });
      tabPlaceholders.push(placeholder);
    });

    if (tabPlaceholders.length) {
      const groupContent = tabPlaceholders.join("\n\n");
      $group.replaceWith(`<Tabs>\n${groupContent}\n</Tabs>`);
    }
  });
}

/**
 * Processes code group containers — wraps multiple code blocks in <CodeGroup>.
 * @param {Object} $ - Cheerio instance
 * @param {Object} config - codegroup config
 * @param {import('./placeholder-manager.js').PlaceholderManager} pm
 */
export function processCodeGroups($, config, pm) {
  const itemSelector = config.item_selector || "pre";

  $(config.group_selector).each((_, group) => {
    const $group = $(group);
    const items = $group.find(itemSelector);

    if (items.length > 1) {
      const content = $group.html() || "";
      const placeholder = pm.createComponentPlaceholder("CODEGROUP", content.trim(), {});
      $group.replaceWith(placeholder);
    }
  });
}
