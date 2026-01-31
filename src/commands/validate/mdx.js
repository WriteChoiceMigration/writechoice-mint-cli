/**
 * MDX File Validation Tool
 *
 * Validates MDX files for parsing errors using the official @mdx-js/mdx compiler.
 * Catches syntax errors, invalid JSX, mismatched tags, and other MDX parsing issues.
 */

import { existsSync, readdirSync, statSync, readFileSync } from "fs";
import { join, relative, resolve } from "path";
import { compile } from "@mdx-js/mdx";
import chalk from "chalk";
import { writeBothFormats, generateMdxParseMarkdown } from "../../utils/reports.js";

// Configuration
const EXCLUDED_DIRS = ["snippets", "node_modules", ".git"];
const MDX_DIRS = ["."];

// Data Structures
class ValidationResult {
  constructor(filePath, status, error = null) {
    this.filePath = filePath;
    this.status = status; // "valid" or "error"
    this.error = error ? {
      message: error.message,
      line: error.line || null,
      column: error.column || null,
      position: error.position || null,
      reason: error.reason || null,
    } : null;
  }
}

// Utility Functions

function findMdxFiles(repoRoot, directory = null, file = null) {
  if (file) {
    const fullPath = resolve(repoRoot, file);
    return existsSync(fullPath) ? [fullPath] : [];
  }

  const searchDirs = directory ? [resolve(repoRoot, directory)] : MDX_DIRS.map((d) => join(repoRoot, d));

  const mdxFiles = [];

  function walkDirectory(dir) {
    const dirName = dir.split("/").pop();
    if (EXCLUDED_DIRS.includes(dirName)) {
      return;
    }

    try {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          walkDirectory(fullPath);
        } else if (stat.isFile() && entry.endsWith(".mdx")) {
          mdxFiles.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}: ${error.message}`);
    }
  }

  for (const dir of searchDirs) {
    if (existsSync(dir)) {
      walkDirectory(dir);
    }
  }

  return mdxFiles.sort();
}

async function validateMdxFile(filePath, verbose = false) {
  try {
    const content = readFileSync(filePath, "utf-8");

    if (verbose) {
      console.log(`  Validating: ${filePath}`);
    }

    // Attempt to compile the MDX file
    await compile(content, {
      development: false,
    });

    return new ValidationResult(filePath, "valid");
  } catch (error) {
    if (verbose) {
      console.log(chalk.red(`  ✗ Error in: ${filePath}`));
      console.log(chalk.red(`    ${error.message}`));
    }

    return new ValidationResult(filePath, "error", error);
  }
}

async function validateAllMdxFiles(files, verbose = false) {
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const progress = `[${i + 1}/${files.length}]`;

    if (verbose) {
      console.log(`${progress} Validating ${file}...`);
    }

    const result = await validateMdxFile(file, verbose);
    results.push(result);
  }

  return results;
}

function generateReport(results, repoRoot) {
  const summary = {
    total: results.length,
    valid: results.filter((r) => r.status === "valid").length,
    errors: results.filter((r) => r.status === "error").length,
  };

  const errors = results
    .filter((r) => r.status === "error")
    .map((r) => ({
      filePath: relative(repoRoot, r.filePath),
      error: r.error,
    }));

  const valid = results
    .filter((r) => r.status === "valid")
    .map((r) => relative(repoRoot, r.filePath));

  return {
    summary,
    errors,
    valid,
    timestamp: new Date().toISOString(),
  };
}

// Main CLI Function

export async function validateMdxFiles(options) {
  const repoRoot = process.cwd();

  if (!options.quiet) {
    console.log(chalk.bold("\n📝 MDX File Validation\n"));
  }

  if (options.verbose && !options.quiet) {
    console.log("Finding MDX files...");
  }

  const mdxFiles = findMdxFiles(repoRoot, options.dir, options.file);

  if (mdxFiles.length === 0) {
    console.error("No MDX files found.");
    process.exit(1);
  }

  if (!options.quiet) {
    console.log(`Found ${mdxFiles.length} MDX files\n`);
  }

  if (options.verbose && !options.quiet) {
    console.log("Validating MDX files...\n");
  }

  const startTime = Date.now();
  const results = await validateAllMdxFiles(mdxFiles, options.verbose);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // Generate report
  const report = generateReport(results, repoRoot);

  // Always generate markdown content for the MD report
  report.markdownContent = generateMdxParseMarkdown(report);

  // Write both JSON and MD reports
  const { jsonPath, mdPath } = writeBothFormats(report, "mdx_errors_report", repoRoot);

  // Display summary
  if (!options.quiet) {
    console.log(chalk.bold(`\n✓ Validation complete in ${duration}s\n`));
    console.log(chalk.bold("Summary:"));
    console.log(`  Total files:  ${report.summary.total}`);
    console.log(chalk.green(`  Valid files:  ${report.summary.valid}`));
    console.log(chalk.red(`  Files with errors: ${report.summary.errors}`));
    console.log(`\nReports saved to:`);
    console.log(`  JSON: ${chalk.cyan(jsonPath)}`);
    console.log(`  MD:   ${chalk.cyan(mdPath)}`);

    if (report.summary.errors > 0) {
      console.log(chalk.yellow(`\n⚠️  Found ${report.summary.errors} file(s) with parsing errors`));
      console.log("\nFiles with errors:");
      report.errors.forEach((err) => {
        console.log(chalk.red(`  ✗ ${err.filePath}`));
        console.log(`    ${err.error.message}`);
        if (err.error.line) {
          console.log(`    Line ${err.error.line}${err.error.column ? `, Column ${err.error.column}` : ''}`);
        }
      });
      process.exit(1);
    } else {
      console.log(chalk.green("\n✓ All MDX files are valid!"));
    }
  }
}
