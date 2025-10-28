// healer.js
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const RETRIES = 2; // number of automatic retries

function runTests(retries = RETRIES) {
  console.log(`Healer: running tests with retries = ${retries}`);
  try {
    execSync(`npx playwright test --retries=${retries} --reporter=json`, { stdio: 'inherit' });
    console.log('Healer: tests passed or retried successfully.');
    return true;
  } catch (e) {
    console.log('Healer: some tests failed after retries.');
    return false;
  }
}

function analyzeFailures() {
  const reportDir = path.join(process.cwd(), 'playwright-report');
  if (!fs.existsSync(reportDir)) {
    console.log('Healer: No Playwright HTML report found. Run tests with --reporter=html or --reporter=json.');
    return;
  }

  console.log('\nHealer: analyzing failures...');
  console.log('- Open the HTML report in', reportDir);
  console.log('- Suggestions:');
  console.log('  * Use stable selectors: getByRole(), getByLabel(), or data-test attributes');
  console.log('  * Use page.waitForSelector() for dynamic elements');
  console.log('  * Review the generated test file for outdated locators');
}

function main() {
  // Step 1: Run tests with retries
  const passed = runTests(RETRIES);

  // Step 2: If failed, suggest fixes and run a final test to generate fresh artifacts
  if (!passed) {
    analyzeFailures();
    console.log('\nHealer: re-running tests with --retries=0 to generate fresh artifacts...');
    try {
      execSync('npx playwright test --retries=0', { stdio: 'inherit' });
    } catch (e) {
      console.log('Healer: final test run completed (may have failures).');
    }
  }
}

main();
