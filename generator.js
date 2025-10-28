// generator.js
// Generates Playwright tests from a custom Markdown plan

import fs from 'fs';
import path from 'path';

// Paths
const PLAN = path.join(process.cwd(), 'resources', 'testplan.md');
const OUT_DIR = path.join(process.cwd(), 'tests', 'generated');

// Helper: sanitize filenames (optional)
function sanitizeFilename(s) {
  return s.replace(/[^a-z0-9\-]/gi, '_').toLowerCase().slice(0, 60);
}

// Build the test file content from candidate actions
function buildTestFile(baseUrl, candidateLines) {
  const steps = candidateLines.map((line, index) => {
    const m = line.match(/- Action \d+: (.*) -> (.*)/);
    if (!m) return '';
    const desc = m[1].trim();
    const href = m[2].trim();

    return `
    // Action ${index + 1}: ${desc}
    const el${index} = page.locator('text=/${desc}/i');
    await expect(el${index}).toHaveCount(1);
    await el${index}.click();
    await page.waitForLoadState('networkidle');

    ${href && href !== '/' ? `expect(page.url()).toBe('${baseUrl.replace(/\/$/, '')}${href}');` : ''}
    `;
  }).join('\n');

  return `import { test, expect } from '@playwright/test';
import { acceptCookieBanner } from './utils/cookieHelper.js';

const BASE = process.env.BASE_URL || '${baseUrl}';

test.describe('Custom Journey - generated', () => {
  test('should execute custom actions', async ({ page }) => {
    await page.goto(BASE);
    await acceptCookieBanner(page);

    ${steps}
  });
});
`;
}

// Main generator function
function main() {
  if (!fs.existsSync(PLAN)) {
    console.error('Plan not found at', PLAN, '\nRun: npm run plan -- --baseUrl=<your url>');
    process.exit(1);
  }

  const md = fs.readFileSync(PLAN, 'utf8');

  // Get base URL from plan
  const startUrlMatch = md.match(/- URL: (.*)/);
  const baseUrl = startUrlMatch ? startUrlMatch[1].trim() : process.env.BASE_URL || '';

  const lines = md.split('\n');
  const startIndex = lines.findIndex(l => l.includes(baseUrl));
  const candidateLines = [];

  // Collect actions under base URL
  for (let i = startIndex; i < Math.min(lines.length, startIndex + 200); i++) {
    const ln = lines[i];
    if (/^- Action \d+:/.test(ln) || /->/.test(ln)) candidateLines.push(ln.trim());
    if (/^## /.test(lines[i + 1] || '')) break;
  }

  // Ensure output folder exists
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const content = buildTestFile(baseUrl, candidateLines);
  const filename = 'journey_apply_demo.spec.js';
  fs.writeFileSync(path.join(OUT_DIR, filename), content, 'utf8');
  console.log('Generator: created', filename);
}

main();
