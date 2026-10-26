import pw from '/opt/node-tools/node_modules/playwright/index.js';
const { chromium } = pw;
const OUT = process.argv[2];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const nav = t => page.locator('.sidebar button', { hasText: t }).first().click();

async function gotoReady(url) {
  for (let i = 0; i < 40; i++) { try { await page.goto(url, { waitUntil: 'networkidle', timeout: 2500 }); return; } catch { await page.waitForTimeout(500); } }
  throw new Error('server not ready');
}
await gotoReady('http://localhost:8787/');
await page.waitForSelector('.hero-eq .big', { timeout: 6000 });

// new screens
for (const [t, name] of [['Import', 'r-import'], ['Notes', 'r-notes'], ['Settings', 'r-settings']]) {
  await nav(t); await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/${name}.png` });
}

// trade-detail modal
await nav('Trades'); await page.waitForTimeout(400);
await page.locator('.table tbody tr').first().click();
await page.waitForSelector('.modal'); await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/r-detail.png` });
await page.keyboard.press('Escape'); await page.waitForTimeout(200);

// WRITE: add a trade via the New-trade modal, confirm it persists
await page.locator('.topbar', { hasText: 'New trade' }).getByText('New trade').click();
await page.waitForSelector('.modal');
await page.getByPlaceholder('e.g. NVDA').fill('ZZZZ');
await page.locator('.modal .field', { hasText: 'Quantity' }).locator('input').fill('100');
await page.locator('.modal .field', { hasText: 'Entry price' }).locator('input').fill('50');
await page.locator('.modal .field', { hasText: 'Exit price' }).locator('input').fill('52');
await page.locator('.modal button', { hasText: 'Add trade' }).click();
await page.waitForTimeout(700);
await nav('Trades'); await page.waitForTimeout(400);
await page.getByPlaceholder(/Search symbol/).fill('ZZZZ');
await page.waitForTimeout(500);
const rows = await page.locator('.table tbody tr').count();
console.log('after add — rows matching ZZZZ:', rows);
await page.screenshot({ path: `${OUT}/r-write-added.png` });

// restore demo
await page.evaluate(() => fetch('/api/journal/reset', { method: 'POST' }));
await page.waitForTimeout(400);
console.log('done');
await browser.close();
