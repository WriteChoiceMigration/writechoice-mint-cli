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
export function processAllComponents($, componentsConfig = {}, pm, imgProcessor = null) {
  if (componentsConfig.callouts?.length) {
    processCallouts($, componentsConfig.callouts, pm);
  }
  if (componentsConfig.accordion) {
    const configs = Array.isArray(componentsConfig.accordion)
      ? componentsConfig.accordion
      : [componentsConfig.accordion];
    for (const cfg of configs) {
      processAccordions($, cfg, pm);
    }
  }
  // Always convert native <details>/<summary> elements to Accordion
  processDetailsElements($, pm);
  if (componentsConfig.card) {
    const configs = Array.isArray(componentsConfig.card)
      ? componentsConfig.card
      : [componentsConfig.card];
    for (const cfg of configs) {
      processCards($, cfg, pm, imgProcessor);
    }
  }
  if (componentsConfig.tabs) {
    processTabs($, componentsConfig.tabs, pm);
  }
  if (componentsConfig.codegroup) {
    processCodeGroups($, componentsConfig.codegroup, pm);
  }
  if (componentsConfig.numberedList) {
    const configs = Array.isArray(componentsConfig.numberedList)
      ? componentsConfig.numberedList
      : [componentsConfig.numberedList];
    for (const cfg of configs) {
      processNumberedLists($, cfg);
    }
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
        content = `CALLOUTTITLE:${title}|TITLEBREAK|${content}`;
      }

      const placeholder = pm.createComponentPlaceholder(placeholderType, content, {});
      $el.replaceWith(placeholder);
    });
  }
}

/**
 * Always-on: converts native <details>/<summary> elements to Accordion components.
 * Groups consecutive sibling <details> elements into a single AccordionGroup.
 * @param {Object} $ - Cheerio instance
 * @param {import('./placeholder-manager.js').PlaceholderManager} pm
 */
export function processDetailsElements($, pm) {
  const processed = new Set();

  $("details").each((_, el) => {
    if (processed.has(el)) return;

    // Collect consecutive <details> element siblings
    const group = [el];
    processed.add(el);

    let $curr = $(el);
    let $next = $curr.next();
    while ($next.length && $next[0].name === "details" && !processed.has($next[0])) {
      group.push($next[0]);
      processed.add($next[0]);
      $curr = $next;
      $next = $curr.next();
    }

    const itemPlaceholders = group.map((detailsEl) => {
      const $item = $(detailsEl);
      const $summary = $item.find("> summary").first();
      const title = $summary.text().trim() || "Details";
      $summary.remove();
      const contentHtml = $item.html() || "";
      return pm.createComponentPlaceholder("ACCORDION", contentHtml.trim(), { title });
    });

    const groupContent = itemPlaceholders.join("\n\n");
    $(group[0]).replaceWith(`<AccordionGroup>\n${groupContent}\n</AccordionGroup>`);
    for (let i = 1; i < group.length; i++) {
      $(group[i]).remove();
    }
  });
}

/**
 * Processes accordion groups.
 * @param {Object} $ - Cheerio instance
 * @param {Object} config - accordion config
 * @param {import('./placeholder-manager.js').PlaceholderManager} pm
 */
export function processAccordions($, config, pm) {
  if (config.group_selector) {
    $(config.group_selector).each((_, group) => {
      const $group = $(group);
      const itemPlaceholders = [];

      $group.find(config.item_selector).each((_, item) => {
        const placeholder = buildAccordionItemPlaceholder($(item), config, pm);
        itemPlaceholders.push(placeholder);
      });

      if (itemPlaceholders.length) {
        const groupContent = itemPlaceholders.join("\n\n");
        $group.replaceWith(`<AccordionGroup>\n${groupContent}\n</AccordionGroup>`);
      }
    });
  } else {
    // No group_selector: collect all matching items and wrap them in one AccordionGroup
    const $items = $(config.item_selector);
    if (!$items.length) return;

    const itemPlaceholders = [];
    $items.each((_, item) => {
      const placeholder = buildAccordionItemPlaceholder($(item), config, pm);
      itemPlaceholders.push(placeholder);
    });

    if (itemPlaceholders.length) {
      const groupContent = itemPlaceholders.join("\n\n");
      $items.first().replaceWith(`<AccordionGroup>\n${groupContent}\n</AccordionGroup>`);
      $items.slice(1).remove();
    }
  }
}

/**
 * Extracts title + content from a single accordion item and returns a placeholder string.
 * @param {Object} $item - Cheerio element for the item
 * @param {Object} config - accordion config
 * @param {import('./placeholder-manager.js').PlaceholderManager} pm
 * @returns {string}
 */
function buildAccordionItemPlaceholder($item, config, pm) {
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

  return pm.createComponentPlaceholder("ACCORDION", contentHtml.trim(), { title });
}

/**
 * Processes card groups.
 * @param {Object} $ - Cheerio instance
 * @param {Object} config - card config
 * @param {import('./placeholder-manager.js').PlaceholderManager} pm
 */
export function processCards($, config, pm, imgProcessor = null) {
  const cols = config.cols || 2;

  if (config.group_selector) {
    $(config.group_selector).each((_, group) => {
      const $group = $(group);
      const cardPlaceholders = [];

      $group.find(config.item_selector).each((_, item) => {
        cardPlaceholders.push(buildCardPlaceholder($(item), config, pm, imgProcessor));
      });

      if (cardPlaceholders.length) {
        $group.replaceWith(`<Columns cols={${cols}}>\n${cardPlaceholders.join("\n\n")}\n</Columns>`);
      }
    });
  } else {
    // No group_selector: group consecutive sibling items into separate Columns
    const processed = new Set();

    $(config.item_selector).each((_, el) => {
      if (processed.has(el)) return;

      const group = [el];
      processed.add(el);

      let $curr = $(el);
      let $next = $curr.next();
      while ($next.length && !processed.has($next[0]) && $next.is(config.item_selector)) {
        group.push($next[0]);
        processed.add($next[0]);
        $curr = $next;
        $next = $curr.next();
      }

      const cardPlaceholders = group.map((cardEl) => buildCardPlaceholder($(cardEl), config, pm, imgProcessor));
      $(group[0]).replaceWith(`<Columns cols={${cols}}>\n${cardPlaceholders.join("\n\n")}\n</Columns>`);
      for (let i = 1; i < group.length; i++) {
        $(group[i]).remove();
      }
    });
  }
}

/**
 * Extracts props and content from a single card element and returns a placeholder string.
 * @param {Object} $item - Cheerio element for the card
 * @param {Object} config - card config
 * @param {import('./placeholder-manager.js').PlaceholderManager} pm
 * @returns {string}
 */
function buildCardPlaceholder($item, config, pm, imgProcessor = null) {
  const props = {};

  // Title: selector (text) takes priority over attribute
  if (config.title_selector) {
    const $title = $item.find(config.title_selector).first();
    if ($title.length) {
      props.title = $title.text().trim();
      $title.remove();
    }
  } else if (config.title_attr) {
    const title = $item.attr(config.title_attr) || "";
    if (title) props.title = title;
  }

  // Icon
  if (config.icon_attr) {
    const icon = $item.attr(config.icon_attr) || "";
    if (icon) props.icon = icon;
  }

  // Image (img prop — takes priority over icon if both configured)
  if (config.img_attr) {
    const img = $item.attr(config.img_attr) || "";
    if (img) props.img = imgProcessor ? imgProcessor.resolveUrl(img) : img;
  } else if (config.img_selector) {
    const $img = $item.find(config.img_selector).first();
    if ($img.length) {
      const img = $img.attr("src") || $img.attr("data-src") || "";
      if (img) props.img = imgProcessor ? imgProcessor.resolveUrl(img) : img;
    }
  }

  // Extra props from selectors
  if (config.prop_selectors) {
    for (const [propName, selector] of Object.entries(config.prop_selectors)) {
      const $el = $item.find(selector).first();
      if ($el.length) {
        props[propName] = $el.text().trim();
        $el.remove();
      }
    }
  }

  // href: explicit attr or item's own href attribute
  if (config.href_attr) {
    const href = $item.attr(config.href_attr) || $item.attr("href") || "";
    if (href) props.href = href;
  } else {
    const href = $item.attr("href") || "";
    if (href) props.href = href;
  }

  // Content
  let contentHtml;
  if (config.content_selector) {
    const $content = $item.find(config.content_selector).first();
    contentHtml = $content.length ? $content.html() || "" : $item.html() || "";
  } else {
    contentHtml = $item.html() || "";
  }

  return pm.createComponentPlaceholder("CARD", contentHtml.trim(), props);
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

/**
 * Converts matching <ul> elements to <ol> so Turndown outputs a numbered list.
 * @param {Object} $ - Cheerio instance
 * @param {Object} config - { selector: string }
 */
export function processNumberedLists($, config) {
  $(config.selector).each((_, el) => {
    const $el = $(el);
    $el.replaceWith(`<ol>${$el.html()}</ol>`);
  });
}
