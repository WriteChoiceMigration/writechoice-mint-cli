/**
 * Re-export script generators from the shared renderer utils.
 * These generate JavaScript strings to be injected into Puppeteer pages.
 */
export {
  generateNavExpansionScript,
  generateCategoryDiscoveryScript,
  generatePageAnalysisScript,
} from "../../../src/renderer/utils/scopingScripts.js";
