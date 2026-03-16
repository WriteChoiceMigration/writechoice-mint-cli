/**
 * Session Capture
 *
 * Opens a visible Playwright browser so the user can log in manually,
 * then saves the authenticated session (cookies + localStorage) to a file.
 * The saved file can be passed as `playwright_config.storage_state` in config.json.
 */

/**
 * Opens a browser at the given URL, waits for the user to log in,
 * then saves the Playwright storage state to a file.
 * @param {string} url - URL to open (should be the login page or protected page)
 * @param {Object} options
 * @param {string} options.output - Path to save the session file (default: session.json)
 */
export async function captureSession(url, options = {}) {
  const { chromium } = await import("playwright");
  const { writeFileSync } = await import("fs");

  const outputFile = options.output || "session.json";

  console.log(`\nOpening browser at: ${url}`);
  console.log("\nLog in to the site in the browser window.");
  console.log("When you're done, press Enter here to save the session.\n");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url);

  await waitForEnter();

  await context.storageState({ path: outputFile });
  await browser.close();

  console.log(`\nSession saved to: ${outputFile}`);
  console.log(`\nAdd to your config.json under scrape.playwright_config:`);
  console.log(`  "storage_state": "${outputFile}"`);
}

function waitForEnter() {
  return new Promise((resolve) => {
    process.stdout.write("Press Enter to save session... ");
    process.stdin.setEncoding("utf8");
    process.stdin.resume();
    process.stdin.once("data", () => {
      process.stdin.pause();
      resolve();
    });
  });
}
