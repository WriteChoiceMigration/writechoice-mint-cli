import ora, { type Ora } from "ora";
import chalk from "chalk";

export interface ProgressState {
  phase: "discovering" | "analyzing" | "reporting";
  currentSite: string;
  currentUrl?: string;
  pagesDiscovered: number;
  pagesAnalyzed: number;
  totalPages: number;
  errors: number;
}

/**
 * Manages CLI progress display using ora spinners and chalk colors.
 */
export class ProgressReporter {
  private spinner: Ora;
  private verbose: boolean;
  private quiet: boolean;

  constructor(opts: { verbose?: boolean; quiet?: boolean } = {}) {
    this.verbose = opts.verbose ?? false;
    this.quiet = opts.quiet ?? false;
    this.spinner = ora({ isSilent: this.quiet });
  }

  start(text: string): void {
    this.spinner.start(text);
  }

  update(state: ProgressState): void {
    const { phase, currentSite, currentUrl, pagesAnalyzed, totalPages, errors } = state;

    let text: string;
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

    this.spinner.text = text;
  }

  succeed(text: string): void {
    this.spinner.succeed(text);
  }

  fail(text: string): void {
    this.spinner.fail(text);
  }

  warn(text: string): void {
    this.spinner.warn(text);
  }

  log(message: string): void {
    if (!this.quiet) {
      console.log(message);
    }
  }

  debug(message: string): void {
    if (this.verbose && !this.quiet) {
      console.log(chalk.dim(`  [debug] ${message}`));
    }
  }

  stop(): void {
    this.spinner.stop();
  }

  /**
   * Print a summary table of scoping results.
   */
  printSummary(stats: {
    sites: number;
    totalPages: number;
    totalComponents: number;
    duration: number;
  }): void {
    if (this.quiet) return;

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
