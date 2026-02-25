/**
 * Re-export report generation functions from the shared renderer utils.
 */
export {
  generateReport,
  formatReportAsText,
  buildTypeformSummary,
  formatTypeformSummaryAsText,
  detectMostCommonPlatform,
  inferContentFormat,
  buildMintlifyCompatibility,
  extractSubpath,
  detectCustomHomepage,
  detectNavigationStructure,
} from "../../../src/renderer/utils/scopingReport.js";

export type { SpecValidation } from "../../../src/renderer/utils/scopingReport.js";
