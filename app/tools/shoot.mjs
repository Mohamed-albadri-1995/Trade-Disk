// Screenshot the running app (served by server.mjs) to confirm the view renders
// from the backend and looks unchanged. Uses Playwright's own timers (no shell sleep).
import pw from '/opt/node-tools/node_modules/playwright/index.js';
const { chromium } = pw;

const OUT = process.argv[2];
const BASE = 'http://localhost:8787';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

async function gotoReady(url) {
  for (let i = 0; i < 40; i++) {
    try { await page.goto(url, { waitUntil: 'networkidle', timeout: 2500 }); return; }
    catch { await page.waitForTimeout(500); }
  }
  throw new Error('server not ready at ' + url);
}

await gotoReady(BASE + '/');
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + '/01-station.png' });

// enter the Journal via the Station's visible CTA
await page.locator('.st-cta[data-page="overview"]').first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/02-journal-overview.png` });

const shots = [['calendar', '03-journal-calendar'], ['stats', '04-journal-stats'],
  ['trades', '05-journal-trades'], ['risk', '06-journal-risk']];
for (const [pageId, name] of shots) {
  await page.locator(`[data-page="${pageId}"]:visible`).first().click();
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

// back to Overview and read live values to prove it is backend-driven
await page.locator('[data-page="overview"]:visible').first().click();
await page.waitForTimeout(400);
const net = await page.locator('.hero-eq .big').first().innerText().catch(() => '(n/a)');
const win = await page.locator('.hero-eq .delta .num').first().innerText().catch(() => '(n/a)');
console.log('overview hero — Net P&L:', net, '| Win rate:', win);

await browser.close();
console.log('shots written to', OUT);
