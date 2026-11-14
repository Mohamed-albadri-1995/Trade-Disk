// Drive Lab in a real browser against test/e2e/serve.mjs (in-memory database, live
// market data) and report each screen plus every console error, page error and failed
// API call. Usage: node test/e2e/lab.e2e.mjs http://localhost:8799 [screenshot-dir]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const base = process.argv[2] || 'http://localhost:8799', shots = process.argv[3] || null;
const jwt = `x.${Buffer.from(JSON.stringify({ sub: 'e2e-user' })).toString('base64url')}.y`;
const session = { access_token: jwt, refresh_token: 'x', token_type: 'bearer', expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, user: { id: 'e2e-user', email: 'e2e@example.com' } };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
await ctx.addInitScript((s) => localStorage.setItem('td-auth', JSON.stringify(s)), session);
await ctx.route(/supabase\.co/, (r) => r.abort());
const page = await ctx.newPage();
const problems = [];
page.on('console', (m) => { if (m.type() === 'error' && !/supabase|ERR_FAILED|Failed to load resource/.test(m.text())) problems.push('console: ' + m.text().slice(0, 200)); });
page.on('pageerror', (e) => problems.push('pageerror: ' + String(e.message).slice(0, 300)));
page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 400) problems.push(`api ${r.status()} ${r.request().method()} ${r.url().replace(base, '')}`); });
const out = (l, v) => console.log(`\n## ${l}\n${v}`);
const text = async (sel, max = 700) => (await page.locator(sel).first().innerText().catch(() => '(missing)')).replace(/\n+/g, ' | ').slice(0, max);
const shot = async (n) => { if (shots) await page.screenshot({ path: `${shots}/lab-${n}.png` }); };
const step = async (l, fn) => { try { await fn(); } catch (e) { problems.push(`step "${l}": ${String(e.message).split('\n')[0].slice(0, 200)}`); } };

await step('chart', async () => {
  await page.goto(`${base}/lab/`, { waitUntil: 'domcontentloaded' });
  await page.waitForResponse((r) => r.url().includes('/api/lab/preview'), { timeout: 40000 });
  await page.waitForTimeout(1500);
  out('chart · page', await text('body', 1400));
  await shot('1-chart');
});
await step('save strategy', async () => {
  await page.locator('button', { hasText: /^Save/ }).first().click(); await page.waitForTimeout(1500);
  out('save', await text('.toast, .err, body', 200));
});
await step('backtest', async () => {
  await page.locator('.tab', { hasText: 'Backtest' }).click(); await page.waitForTimeout(800);
  out('backtest · form', await text('body', 1200));
  await page.locator('.range', { hasText: 'Symbols' }).first().click().catch(() => {});
  const sym = page.locator('textarea, input[placeholder*="AAPL"], input[placeholder*="symbol" i]').first();
  if (await sym.count()) await sym.fill('AAPL, MSFT, NVDA');
  await page.locator('button', { hasText: 'Run backtest' }).click();
  await page.waitForResponse((r) => r.url().includes('/api/lab/backtest'), { timeout: 90000 });
  await page.waitForTimeout(1500);
  out('backtest · result', await text('body', 1600));
  await shot('2-backtest');
});
await step('register', async () => {
  await page.locator('.tab', { hasText: 'Register' }).click(); await page.waitForTimeout(1500);
  out('register', await text('body', 600));
});
out('PROBLEMS', problems.length ? [...new Set(problems)].join('\n') : 'none');
await browser.close();
