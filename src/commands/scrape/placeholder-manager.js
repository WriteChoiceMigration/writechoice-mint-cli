/**
 * Placeholder Manager
 *
 * Manages two types of placeholders used to preserve content through
 * the HTML→Markdown conversion pipeline:
 *
 * 1. Generic placeholders: ||PREFIX|N|UUID||
 *    - Used for HTML preservation (tables, iframes, images)
 *    - Stored in a Map and restored via restore()
 *
 * 2. Component placeholders: TYPE|OPEN|props|\ncontent\nTYPE|CLOSE
 *    - Used for Mintlify components (callouts, accordions, etc.)
 *    - Replaced with MDX tags via replaceComponentPlaceholders()
 */

import { randomBytes } from "crypto";

export class PlaceholderManager {
  constructor() {
    this._store = new Map(); // placeholder → original content
    this._counter = 0;
  }

  /**
   * Stores content behind a placeholder string.
   * @param {string} content - HTML or text to preserve
   * @param {string} prefix - Prefix label (e.g. "TABLE", "IFRAME", "IMAGE")
   * @returns {string} Placeholder string
   */
  store(content, prefix) {
    const id = this._counter++;
    const uuid = randomBytes(4).toString("hex");
    const placeholder = `||${prefix}|${id}|${uuid}||`;
    this._store.set(placeholder, content);
    return placeholder;
  }

  /**
   * Restores all stored placeholders in the text.
   * @param {string} text
   * @returns {string}
   */
  restore(text) {
    let result = text;
    for (const [placeholder, content] of this._store) {
      result = result.split(placeholder).join(content);
    }
    return result;
  }

  /**
   * Creates a structured component placeholder.
   * @param {string} type - Component type (e.g. "INFO", "ACCORDION")
   * @param {string} content - Inner content
   * @param {Object} props - Key/value props (e.g. { title: "My Title" })
   * @returns {string} Component placeholder string
   */
  createComponentPlaceholder(type, content, props = {}) {
    const propStr = Object.entries(props)
      .map(([k, v]) => `${k}="${v}"`)
      .join(" ");
    return `${type}|OPEN|${propStr}|\n${content}\n${type}|CLOSE`;
  }

  /**
   * Replaces all structured component placeholders with MDX tags.
   * Handles both simple callouts and complex grouped components.
   * @param {string} text
   * @returns {string}
   */
  replaceComponentPlaceholders(text) {
    // Map of placeholder type → MDX component name
    const typeMap = {
      NOTE: "Note",
      WARNING: "Warning",
      TIP: "Tip",
      INFO: "Info",
      CHECK: "Check",
      DANGER: "Danger",
      ACCORDION: "Accordion",
      CARD: "Card",
      TAB: "Tab",
      CODEGROUP: "CodeGroup",
    };

    const pattern = /(\w+)\|OPEN\|(.*?)\|\s*([\s\S]*?)\s*\1\|CLOSE/g;

    return text.replace(pattern, (match, type, propsStr, content) => {
      const componentName = typeMap[type] || type;

      // Build props string for JSX
      let jsxProps = "";
      if (propsStr.trim()) {
        jsxProps = " " + propsStr.trim();
      }

      // For callouts, handle CALLOUTTITLE: prefix
      let innerContent = content.trim();
      const titleMatch = innerContent.match(/^CALLOUTTITLE:(.*?)\|TITLEBREAK\|([\s\S]*)/);
      if (titleMatch) {
        const title = titleMatch[1].trim();
        const rest = titleMatch[2] ? titleMatch[2].trim() : "";
        innerContent = `**${title}**${rest ? "\n\n" + rest : ""}`;
      }

      return `<${componentName}${jsxProps}>\n${innerContent}\n</${componentName}>`;
    });
  }

  /**
   * Escapes bare < and > characters in text, but not inside code blocks,
   * already-existing HTML tags, or placeholder strings.
   * @param {string} text
   * @returns {string}
   */
  escapeHtmlEntities(text) {
    const lines = text.split("\n");
    let inCodeBlock = false;
    const result = [];

    for (const line of lines) {
      if (line.startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        result.push(line);
        continue;
      }

      if (inCodeBlock) {
        result.push(line);
        continue;
      }

      // Skip lines that are placeholders
      if (/^\|\|[A-Z]+\|\d+\|[a-f0-9]+\|\|$/.test(line.trim())) {
        result.push(line);
        continue;
      }

      // Escape bare < and > that are not part of HTML tags or JSX components
      // Pattern: angle brackets not followed by valid tag chars or /
      const escaped = line
        .replace(/<(?![a-zA-Z/!?])/g, "&lt;")
        .replace(/(?<![a-zA-Z"'=\w])>/g, "&gt;");

      result.push(escaped);
    }

    return result.join("\n");
  }
}
