// generator.js
// Dynamic Playwright test generator based on testplan.md
import fs from 'fs';
import path from 'path';

const PLAN = path.join(process.cwd(), 'resources', 'testplan.md');
const OUT_DIR = path.join(process.cwd(), 'tests', 'generated');

function sanitizeFilename(s) {
  return s.replace(/[^a-z0-9\-]/gi, '_').toLowerCase().slice(0, 60);
}

function buildTestFile(baseUrl, candidateLines) {
  // Build test steps dynamically from plan
  const steps = candidateLines.map((line, index) => {
    const m = line.match(/- Action \d+: (.*) -> (.*)/);
    if (!m) return '';

    const desc = m[1].trim();
    const href = m[2].trim();

    // Use optional selector if defined
    let locator = `text=/${desc}/i`;
    const selMatch = line.match(/selector=(.*)$/);
    if (selMatch) locator = selMatch[1].trim();

    return `
    // Action ${index + 1}: ${desc}
    const el${index} = page.locator('${locator}');
    await expect(el${index}).toHaveCount(1);
    await el${index}.click();
    await page.waitForLoadState('networkidle');
    ${href && href !== '/' ? `expect(page.url()).toBe('${href}');` : ''}
    `;
  }).join('\n');

  return `import { test, expect } from '@playwright/test';
import { acceptCookieBanner } from '../utils/cookieHelper.js';

const BASE = process.env.BASE_URL || '${baseUrl}';

test.describe('Custom Journey - generated', () => {
  test('should execute all actions from plan', async ({ page }) => {
    await page.goto(BASE);

    // Accept cookie banner if present
    await acceptCookieBanner(page);

    ${steps}
  });
});
`;
}

function main() {
  if (!fs.existsSync(PLAN)) {
    console.error('Plan not found at', PLAN, '\nRun: npm run plan -- --baseUrl=<your url>');
    process.exit(1);
  }

  const md = fs.readFileSync(PLAN, 'utf8');

  // Get start URL from the first line
  const startUrlMatch = md.match(/- URL: (.*)/);
  const baseUrl = startUrlMatch ? startUrlMatch[1].trim() : process.env.BASE_URL || '';

  const lines = md.split('\n');

  // Collect candidate action lines
  const startIndex = lines.findIndex(l => l.includes(baseUrl));
  const candidateLines = [];
  for (let i = startIndex; i < Math.min(lines.length, startIndex + 200); i++) {
    const ln = lines[i];
    if (/^- Action \d+:/.test(ln)) candidateLines.push(ln.trim());
    if (/^## /.test(lines[i + 1] || '')) break;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const content = buildTestFile(baseUrl, candidateLines);
  const filename = 'journey_generated.spec.js';
  fs.writeFileSync(path.join(OUT_DIR, filename), content, 'utf8');
  console.log('Generator: created', filename);
}

main();
