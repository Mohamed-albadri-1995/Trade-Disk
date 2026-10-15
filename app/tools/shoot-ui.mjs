import pw from '/opt/node-tools/node_modules/playwright/index.js';
const { chromium } = pw;
const OUT = process.argv[2];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

async function gotoReady(url) {
  for (let i = 0; i < 40; i++) {
    try { await page.goto(url, { waitUntil: 'networkidle', timeout: 2500 }); return; }
    catch { await page.waitForTimeout(500); }
  }
  throw new Error('server not ready');
}
await gotoReady('http://localhost:8787/');
await page.waitForSelector('.hero-eq .big', { timeout: 6000 });
await page.waitForTimeout(400);
await page.screenshot({ path: OUT + '/react-01-overview.png' });

const net = await page.locator('.hero-eq .big').first().innerText();
const win = await page.locator('.hero-eq .delta .num').first().innerText();
console.log('React Overview — Net P&L:', net, '| Win rate:', win);
await browser.close();
