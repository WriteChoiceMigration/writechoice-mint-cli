// Re-export scoping-related types from shared
export type {
  ScopingSite,
  ScopingSiteStatus,
  ScopingCategory,
  ScopingPageAnalysis,
  ScopingReport,
  TypeformSummary,
  ComponentReviewDecision,
  MigrationComplexity,
  MigrationComplexityFactor,
  ApiToolType,
  ApiDocumentationDetails,
  DetectedApiSpec,
  ApiEndpointInfo,
  ComponentSample,
  InteractiveWidget,
  EnhancedContentComponent,
  ContentComponentCategory,
} from "../../src/shared/types.js";

/**
 * CLI-specific options parsed from command-line arguments.
 */
export interface CliOptions {
  /** URLs to scope (variadic positional argument) */
  urls: string[];
  /** Maximum concurrent pages to analyze */
  concurrency: number;
  /** Maximum pages to analyze per site */
  maxPages: number;
  /** Output file path */
  output: string;
  /** Output format: json or text */
  format: "json" | "text";
  /** CSS selector for main content area */
  contentSelector?: string;
  /** URL prefix to limit crawl scope */
  scopePrefix?: string;
  /** Authentication credentials (user:pass) */
  auth?: string;
  /** Run browser in headless mode (default true) */
  headless: boolean;
  /** Verbose logging */
  verbose: boolean;
  /** Quiet mode - minimal output */
  quiet: boolean;
}
