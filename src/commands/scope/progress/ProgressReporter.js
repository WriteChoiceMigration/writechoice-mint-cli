/**
 * CLI progress display using ora spinners and chalk colors.
 */

import ora from "ora";
import chalk from "chalk";

export class ProgressReporter {
  #spinner;
  #verbose;
  #quiet;

  constructor(opts = {}) {
    this.#verbose = opts.verbose ?? false;
    this.#quiet = opts.quiet ?? false;
    this.#spinner = ora({ isSilent: this.#quiet });
  }

  start(text) {
    this.#spinner.start(text);
  }

  update(state) {
    const { phase, currentSite, currentUrl, pagesAnalyzed, totalPages, errors } = state;

    let text;
    switch (phase) {
      case "discovering":
        text = `${chalk.blue("Discovering")} pages on ${chalk.bold(currentSite)}... (${state.pagesDiscovered} found)`;
        break;
      case "analyzing":
        text = `${chalk.yellow("Analyzing")} ${chalk.bold(currentSite)} [${pagesAnalyzed}/${totalPages}]`;
        if (currentUrl) {
          text += ` ${chalk.dim(currentUrl)}`;
        }
        break;
      case "reporting":
        text = `${chalk.green("Generating")} report...`;
        break;
    }

    if (errors > 0) {
      text += chalk.red(` (${errors} errors)`);
    }

    this.#spinner.text = text;
  }

  succeed(text) {
    this.#spinner.succeed(text);
  }

  fail(text) {
    this.#spinner.fail(text);
  }

  warn(text) {
    this.#spinner.warn(text);
  }

  log(message) {
    if (!this.#quiet) {
      console.log(message);
    }
  }

  debug(message) {
    if (this.#verbose && !this.#quiet) {
      console.log(chalk.dim(`  [debug] ${message}`));
    }
  }

  stop() {
    this.#spinner.stop();
  }

  printSummary(stats) {
    if (this.#quiet) return;

    console.log("");
    console.log(chalk.bold("Scoping Summary"));
    console.log(chalk.dim("─".repeat(40)));
    console.log(`  Sites analyzed:    ${chalk.cyan(String(stats.sites))}`);
    console.log(`  Pages analyzed:    ${chalk.cyan(String(stats.totalPages))}`);
    console.log(`  Components found:  ${chalk.cyan(String(stats.totalComponents))}`);
    console.log(`  Duration:          ${chalk.cyan(`${(stats.duration / 1000).toFixed(1)}s`)}`);
    console.log(chalk.dim("─".repeat(40)));
  }
}
