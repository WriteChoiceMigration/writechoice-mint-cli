/**
 * Link Fix Tool
 *
 * Fixes broken anchor links in MDX files based on validation reports.
 * Reads a report from check links command and applies corrections.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import chalk from "chalk";

/**
 * Fixes links from a JSON report file
 * @param {string} reportPath - Path to the report file
 * @param {string} repoRoot - Repository root directory
 * @param {boolean} verbose - Show detailed output
 * @returns {Object} Map of filePath -> number of fixes applied
 */
function fixLinksFromReport(reportPath, repoRoot, verbose = false) {
  if (!existsSync(reportPath)) {
    console.error(`Error: Report file not found: ${reportPath}`);
    return {};
  }

  let reportData;
  try {
    reportData = JSON.parse(readFileSync(reportPath, "utf-8"));
  } catch (error) {
    console.error(`Error reading report file: ${error.message}`);
    return {};
  }

  const resultsByFile = reportData.results_by_file || {};

  if (Object.keys(resultsByFile).length === 0) {
    if (verbose) {
      console.log("No failures found in report.");
    }
    return {};
  }

  const fixesApplied = {};

  for (const [filePath, failures] of Object.entries(resultsByFile)) {
    const fullPath = join(repoRoot, filePath);

    if (!existsSync(fullPath)) {
      if (verbose) {
        console.log(`Warning: File not found: ${filePath}`);
      }
      continue;
    }

    const fixableFailures = failures.filter(
      (f) => f.status === "failure" && f.actualHeadingAnchor && f.anchor
    );

    if (fixableFailures.length === 0) continue;

    try {
      const content = readFileSync(fullPath, "utf-8");
      let lines = content.split("\n");
      let modified = false;
      let fixesCount = 0;

      // Sort by line number descending to avoid line number shifting
      fixableFailures.sort((a, b) => b.source.lineNumber - a.source.lineNumber);

      for (const failure of fixableFailures) {
        const lineNum = failure.source.lineNumber - 1;

        if (lineNum >= lines.length) {
          if (verbose) {
            console.log(`Warning: Line ${failure.source.lineNumber} not found in ${filePath}`);
          }
          continue;
        }

        let line = lines[lineNum];
        const oldHref = failure.source.rawHref;
        const newAnchor = failure.actualHeadingAnchor;
        const linkType = failure.source.linkType;

        const pathPart = oldHref.includes("#") ? oldHref.split("#")[0] : oldHref;
        const newHref = pathPart ? `${pathPart}#${newAnchor}` : `#${newAnchor}`;

        if (oldHref === newHref) {
          if (verbose) {
            console.log(`Skipping ${filePath}:${failure.source.lineNumber} (no change needed)`);
          }
          continue;
        }

        let replaced = false;

        if (linkType === "markdown") {
          const oldPattern = `(${oldHref})`;
          const newPattern = `(${newHref})`;
          if (line.includes(oldPattern)) {
            line = line.replace(oldPattern, newPattern);
            replaced = true;
          }
        } else if (linkType === "html" || linkType === "jsx") {
          for (const quote of ['"', "'"]) {
            const oldPattern = `href=${quote}${oldHref}${quote}`;
            const newPattern = `href=${quote}${newHref}${quote}`;
            if (line.includes(oldPattern)) {
              line = line.replace(oldPattern, newPattern);
              replaced = true;
              break;
            }
          }
        }

        if (replaced) {
          lines[lineNum] = line;
          modified = true;
          fixesCount++;

          if (verbose) {
            console.log(`Fixed ${filePath}:${failure.source.lineNumber}`);
            console.log(`  Old: ${oldHref}`);
            console.log(`  New: ${newHref}`);
          }
        } else if (verbose) {
          console.log(
            `Warning: Could not find href '${oldHref}' on line ${failure.source.lineNumber} in ${filePath}`
          );
        }
      }

      if (modified) {
        const newContent = lines.join("\n");
        writeFileSync(fullPath, newContent, "utf-8");
        fixesApplied[filePath] = fixesCount;

        if (verbose) {
          console.log(`Saved ${fixesCount} fix(es) to ${filePath}`);
        }
      }
    } catch (error) {
      if (verbose) {
        console.log(`Error fixing ${filePath}: ${error.message}`);
      }
    }
  }

  return fixesApplied;
}

/**
 * Main CLI function for fixing links
 * @param {Object} options - CLI options
 */
export async function fixLinks(options) {
  const repoRoot = process.cwd();

  // Determine report path
  const reportPath = options.report || "links_report.json";

  // Validate that the report file exists and is JSON
  if (!existsSync(reportPath)) {
    console.error(chalk.red(`\n✗ Error: Report file not found: ${reportPath}`));

    // Check if user might have provided a .md file instead
    if (reportPath.endsWith('.md')) {
      const jsonPath = reportPath.replace(/\.md$/, '.json');
      console.error(chalk.yellow(`\n⚠️  The fix command requires a JSON report file.`));
      console.error(chalk.yellow(`Try using: ${chalk.cyan(jsonPath)}`));
    } else {
      console.error(chalk.yellow(`\n⚠️  Make sure to run the validation command first:`));
      console.error(chalk.gray(`  writechoice check links <baseUrl>`));
    }

    process.exit(1);
  }

  // Check if it's a JSON file
  if (!reportPath.endsWith('.json')) {
    console.error(chalk.red(`\n✗ Error: The fix command requires a JSON report file.`));
    console.error(chalk.yellow(`\nProvided file: ${reportPath}`));

    if (reportPath.endsWith('.md')) {
      const jsonPath = reportPath.replace(/\.md$/, '.json');
      console.error(chalk.yellow(`\nThe markdown (.md) report is for human readability only.`));
      console.error(chalk.yellow(`Please use the JSON report instead: ${chalk.cyan(jsonPath)}`));
    }

    process.exit(1);
  }

  if (!options.quiet) {
    console.log(chalk.bold("\n🔧 Link Fixer\n"));
    console.log(`Reading report: ${chalk.cyan(reportPath)}`);
  }

  const fixesApplied = fixLinksFromReport(reportPath, repoRoot, options.verbose && !options.quiet);

  if (!options.quiet) {
    if (Object.keys(fixesApplied).length > 0) {
      const totalFixes = Object.values(fixesApplied).reduce((a, b) => a + b, 0);
      console.log(chalk.green(`\n✓ Fixed ${totalFixes} link(s) in ${Object.keys(fixesApplied).length} file(s):`));
      for (const [filePath, count] of Object.entries(fixesApplied)) {
        console.log(`  ${chalk.cyan(filePath)}: ${count} fix(es)`);
      }
      console.log(chalk.yellow("\n⚠️  Run validation again to verify the fixes:"));
      console.log(chalk.gray("  writechoice check links <baseUrl>"));
    } else {
      console.log(chalk.yellow("\n⚠️  No fixable issues found in report."));
    }
  }
}
