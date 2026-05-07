/**
 * Component Processor
 *
 * Transforms HTML elements into Mintlify MDX component placeholders
 * before markdown conversion.
 *
 * Supports two config formats:
 *
 * Generic (new) — scrape.components is an array:
 *   Each entry defines a component by name, selector, props, and optional grouping.
 *
 * Legacy (old) — scrape.components is an object with specific keys:
 *   callouts, accordion, card, tabs, codegroup, numberedList
 *
 * All placeholders are created via PlaceholderManager and restored
 * after markdown conversion.
 */

/**
 * Dispatches to generic or legacy processor based on config shape.
 * @param {Object} $ - Cheerio instance
 * @param {Array|Object} componentsConfig - scrape.components from config
 * @param {import('./placeholder-manager.js').PlaceholderManager} pm
 */
export function processAllComponents($, componentsConfig = {}, pm, imgProcessor = null) {
  if (Array.isArray(componentsConfig)) {
    processGenericComponents($, componentsConfig, pm, imgProcessor);
    return;
  }
  // Legacy format
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

// ─── Generic Component Processor ─────────────────────────────────────────────

/**
 * Processes an array of generic component definitions.
 *
 * Each definition:
 *   {
 *     name: "Accordion",           // MDX component name (becomes the JSX tag)
 *     selector: ".faq-item",       // CSS selector for matching elements
 *     group: {                     // Optional grouping
 *       selector: ".faq-group",    //   explicit container selector, OR
 *       wrapper: "AccordionGroup"  //   MDX wrapper tag (auto-groups consecutive siblings)
 *     },
 *     props: {
 *       title: ".faq-question",                        // string → child text
 *       href:  { attr: "href" },                       // attr on matched element
 *       icon:  { selector: ".icon", attr: "data-id" }, // attr on child
 *       img:   { selector: "img", attr: "src", image: true } // resolved image src
 *     },
 *     content: ".faq-answer"        // inner content selector (optional, defaults to full innerHTML)
 *   }
 *
 * @param {Object} $ - Cheerio instance
 * @param {Array} componentsConfig - Array of component definition objects
 * @param {import('./placeholder-manager.js').PlaceholderManager} pm
 */
export function processGenericComponents($, componentsConfig, pm, imgProcessor = null) {
  // Always convert native <details>/<summary>
  processDetailsElements($, pm);

  if (!Array.isArray(componentsConfig) || !componentsConfig.length) return;

  for (const def of componentsConfig) {
    if (!def.name || !def.selector) continue;
    _processOneGenericComponent($, def, pm, imgProcessor);
  }
}

function _processOneGenericComponent($, def, pm, imgProcessor) {
  const { name, selector, group, props: propsConfig = {}, content: contentSelector } = def;

  if (group?.selector) {
    // Explicit container: find items inside group.selector, wrap in group.wrapper
    $(group.selector).each((_, groupEl) => {
      const $group = $(groupEl);
      const placeholders = [];

      $group.find(selector).each((_, item) => {
        placeholders.push(_buildGenericPlaceholder($(item), name, propsConfig, contentSelector, pm, imgProcessor));
      });

      if (placeholders.length) {
        const wrapper = group.wrapper || `${name}Group`;
        $group.replaceWith(`<${wrapper}>\n${placeholders.join("\n\n")}\n</${wrapper}>`);
      }
    });
  } else if (group?.wrapper) {
    // Auto-group: collect consecutive sibling matches into one wrapper
    const processed = new Set();

    $(selector).each((_, el) => {
      if (processed.has(el)) return;

      const batch = [el];
      processed.add(el);

      let $curr = $(el);
      let $next = $curr.next();
      while ($next.length && !processed.has($next[0]) && $next.is(selector)) {
        batch.push($next[0]);
        processed.add($next[0]);
        $curr = $next;
        $next = $curr.next();
      }

      const placeholders = batch.map((item) =>
        _buildGenericPlaceholder($(item), name, propsConfig, contentSelector, pm, imgProcessor)
      );
      $(batch[0]).replaceWith(`<${group.wrapper}>\n${placeholders.join("\n\n")}\n</${group.wrapper}>`);
      for (let i = 1; i < batch.length; i++) $(batch[i]).remove();
    });
  } else {
    // No grouping: replace each match independently
    $(selector).each((_, el) => {
      const placeholder = _buildGenericPlaceholder($(el), name, propsConfig, contentSelector, pm, imgProcessor);
      $(el).replaceWith(placeholder);
    });
  }
}

function _buildGenericPlaceholder($item, name, propsConfig, contentSelector, pm, imgProcessor) {
  const props = {};
  const childLines = []; // values rendered as bold text inside the component body

  for (const [propName, propDef] of Object.entries(propsConfig)) {
    const isChild = typeof propDef === "object" && propDef !== null && propDef.child === true;
    const value = _extractProp($item, propDef, imgProcessor);
    if (value == null) continue;

    if (isChild) {
      childLines.push(`**${value}**`);
    } else {
      props[propName] = value;
    }
  }

  let contentHtml;
  if (contentSelector) {
    const $content = $item.find(contentSelector).first();
    contentHtml = $content.length ? $content.html() || "" : $item.html() || "";
  } else {
    contentHtml = $item.html() || "";
  }

  const prefix = childLines.join("\n\n");
  const fullContent = prefix ? `${prefix}\n\n${contentHtml.trim()}` : contentHtml.trim();

  return pm.createComponentPlaceholder(name, fullContent, props);
}

/**
 * Extracts a single prop value from a matched element.
 *
 * propDef forms:
 *   ".selector"                           — child element text (child removed from DOM)
 *   { selector: ".x" }                   — child element text (child removed)
 *   { selector: ".x", attr: "data-v" }   — child element attribute (child removed)
 *   { attr: "href" }                      — attribute on the matched element itself
 *   { selector: "img", attr: "src", image: true } — image src, resolved via imgProcessor
 */
function _extractProp($item, propDef, imgProcessor) {
  if (typeof propDef === "string") {
    const $el = $item.find(propDef).first();
    if (!$el.length) return null;
    const value = $el.text().trim();
    $el.remove();
    return value || null;
  }

  if (typeof propDef !== "object" || propDef === null) return null;

  const { selector, attr, image } = propDef;

  if (selector) {
    const $el = $item.find(selector).first();
    if (!$el.length) return null;
    let value = attr ? ($el.attr(attr) || null) : $el.text().trim();
    $el.remove();
    if (!value) return null;
    if (image && imgProcessor) value = imgProcessor.resolveUrl(value);
    return value;
  }

  // No selector: read attribute from the matched element itself (no DOM removal)
  if (attr) {
    let value = $item.attr(attr) || null;
    if (value && image && imgProcessor) value = imgProcessor.resolveUrl(value);
    return value;
  }

  return null;
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
