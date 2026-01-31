/**
 * Report Generation Utilities
 *
 * Shared utilities for generating validation reports in different formats (JSON, Markdown).
 * Used by both links and parse validation commands.
 */

import { writeFileSync } from "fs";
import { join } from "path";

/**
 * Writes a report to a file in the specified format
 * @param {Object} reportData - The report data object
 * @param {string} format - Output format: 'json' or 'md'
 * @param {string} baseFileName - Base name for the report file (without extension)
 * @param {string} repoRoot - Repository root directory
 * @returns {string} Path to the written file
 */
export function writeReport(reportData, format, baseFileName, repoRoot) {
  let content;
  let extension;

  if (format === "md" || format === "markdown") {
    content = reportData.markdownContent || generateMarkdownFromJson(reportData);
    extension = ".md";
  } else {
    content = JSON.stringify(reportData, null, 2);
    extension = ".json";
  }

  const outputPath = join(repoRoot, `${baseFileName}${extension}`);
  writeFileSync(outputPath, content, "utf-8");

  return outputPath;
}

/**
 * Fallback: Generates basic markdown from JSON structure
 * @param {Object} data - Report data
 * @returns {string} Markdown content
 */
function generateMarkdownFromJson(data) {
  let markdown = "# Validation Report\n\n";
  markdown += "```json\n";
  markdown += JSON.stringify(data, null, 2);
  markdown += "\n```\n";
  return markdown;
}

/**
 * Generates markdown report for MDX parsing validation
 * @param {Object} report - Report object with summary, errors, valid, timestamp
 * @returns {string} Markdown content
 */
export function generateMdxParseMarkdown(report) {
  let markdown = "# MDX Validation Report\n\n";

  // Summary
  markdown += `## Summary\n\n`;
  markdown += `- **Total files**: ${report.summary.total}\n`;
  markdown += `- **Valid files**: ${report.summary.valid}\n`;
  markdown += `- **Files with errors**: ${report.summary.errors}\n`;
  markdown += `- **Generated**: ${report.timestamp}\n\n`;

  // Files with errors
  if (report.errors.length > 0) {
    markdown += `## Files with Errors\n\n`;

    report.errors.forEach((err) => {
      markdown += `### [${err.filePath}](${err.filePath})\n\n`;
      markdown += `- **Line ${err.error.line || "unknown"}**: ${err.error.message}\n`;

      if (err.error.column) {
        markdown += `  - Column: ${err.error.column}\n`;
      }

      markdown += `\n`;
    });
  }

  return markdown;
}

/**
 * Generates markdown report for links validation
 * @param {Object} report - Report object with summary, configuration, results_by_file, timestamp
 * @returns {string} Markdown content
 */
export function generateLinksMarkdown(report) {
  let markdown = "# Links Validation Report\n\n";

  // Summary
  markdown += `## Summary\n\n`;
  markdown += `- **Total links**: ${report.summary.total_links}\n`;
  markdown += `- **Success**: ${report.summary.success}\n`;
  markdown += `- **Failure**: ${report.summary.failure}\n`;
  markdown += `- **Error**: ${report.summary.error}\n`;
  markdown += `- **Generated**: ${report.timestamp}\n`;
  markdown += `- **Execution time**: ${report.configuration.execution_time_seconds}s\n\n`;

  // Configuration
  markdown += `## Configuration\n\n`;
  markdown += `- **Base URL**: ${report.configuration.base_url}\n`;
  markdown += `- **Concurrency**: ${report.configuration.concurrency}\n`;
  markdown += `- **Scanned directories**: ${report.configuration.scanned_directories.join(", ")}\n`;
  markdown += `- **Excluded directories**: ${report.configuration.excluded_directories.join(", ")}\n\n`;

  // Results by file
  const failedResults = [];
  const errorResults = [];

  Object.entries(report.results_by_file).forEach(([filePath, results]) => {
    results.forEach((result) => {
      if (result.status === "failure") {
        failedResults.push({ filePath, result });
      } else if (result.status === "error") {
        errorResults.push({ filePath, result });
      }
    });
  });

  // Failed links
  if (failedResults.length > 0) {
    markdown += `## Failed Links\n\n`;

    failedResults.forEach(({ filePath, result }) => {
      markdown += `### [${filePath}:${result.source.lineNumber}](${filePath}#L${result.source.lineNumber})\n\n`;
      markdown += `- **Link text**: "${result.source.linkText}"\n`;
      markdown += `- **Raw href**: \`${result.source.rawHref}\`\n`;
      markdown += `- **Source URL**: ${result.sourceUrl}\n`;
      markdown += `- **Target URL**: ${result.targetUrl}\n`;
      markdown += `- **Error**: ${result.errorMessage}\n\n`;
    });
  }

  // Error links
  if (errorResults.length > 0) {
    markdown += `## Links with Errors\n\n`;

    errorResults.forEach(({ filePath, result }) => {
      markdown += `### [${filePath}:${result.source.lineNumber}](${filePath}#L${result.source.lineNumber})\n\n`;
      markdown += `- **Link text**: "${result.source.linkText}"\n`;
      markdown += `- **Raw href**: \`${result.source.rawHref}\`\n`;
      markdown += `- **Target URL**: ${result.targetUrl}\n`;
      markdown += `- **Error**: ${result.errorMessage}\n\n`;
    });
  }

  // Success message
  if (failedResults.length === 0 && errorResults.length === 0) {
    markdown += `## ✓ All Links Valid\n\n`;
    markdown += `All ${report.summary.total_links} links validated successfully!\n`;
  }

  return markdown;
}

/**
 * Writes a report in both JSON and Markdown formats
 * Always generates both files regardless of user preference
 * @param {Object} reportData - The report data object
 * @param {string} baseFileName - Base name for the report file (without extension)
 * @param {string} repoRoot - Repository root directory
 * @returns {Object} Object with jsonPath and mdPath
 */
export function writeBothFormats(reportData, baseFileName, repoRoot) {
  const jsonPath = writeReport(reportData, "json", baseFileName, repoRoot);
  const mdPath = writeReport(reportData, "md", baseFileName, repoRoot);

  return { jsonPath, mdPath };
}

/**
 * Normalizes format string to lowercase and handles variations
 * @param {string|undefined} format - Format string
 * @returns {string} Normalized format ('json' or 'md')
 */
export function normalizeFormat(format) {
  if (!format) return "json";
  const normalized = format.toLowerCase();
  return normalized === "markdown" ? "md" : normalized;
}
