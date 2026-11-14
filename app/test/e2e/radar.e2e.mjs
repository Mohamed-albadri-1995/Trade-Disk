// Drive Radar in a real browser against test/e2e/serve.mjs (in-memory database, live
// market data) and report what each screen shows plus every console error, page error
// and failed API call. Usage:
//   node build.mjs            (or: cd ui-radar && npx vite build)
//   node test/e2e/serve.mjs 8799 &
//   node test/e2e/radar.e2e.mjs http://localhost:8799 [screenshot-dir]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');   // resolves a global install too

const base = process.argv[2] || 'http://localhost:8799';
const shots = process.argv[3] || null;
const jwt = `x.${Buffer.from(JSON.stringify({ sub: 'e2e-user' })).toString('base64url')}.y`;
const session = { access_token: jwt, refresh_token: 'x', token_type: 'bearer', expires_in: 3600 * 24, expires_at: Math.floor(Date.now() / 1000) + 3600 * 24, user: { id: 'e2e-user', email: 'e2e@example.com' } };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
await ctx.addInitScript((s) => localStorage.setItem('td-auth', JSON.stringify(s)), session);
await ctx.route(/supabase\.co/, (r) => r.abort());            // never touch the hosted project
const page = await ctx.newPage();
const problems = [];
page.on('console', (m) => { if (m.type() === 'error' && !/supabase|ERR_FAILED|Failed to load resource/.test(m.text())) problems.push('console: ' + m.text().slice(0, 200)); });
page.on('pageerror', (e) => problems.push('pageerror: ' + String(e.message).slice(0, 300)));
page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 400) problems.push(`api ${r.status()} ${r.request().method()} ${r.url().replace(base, '')}`); });

const out = (label, v) => console.log(`\n## ${label}\n${typeof v === 'string' ? v : JSON.stringify(v, null, 1)}`);
const text = async (sel, max = 600) => (await page.locator(sel).first().innerText().catch(() => '(missing)')).replace(/\n+/g, ' | ').slice(0, max);
const go = async (screen) => { await page.evaluate((s) => document.querySelector(`[data-screen="${s}"]`)?.click(), screen); await page.waitForTimeout(600); };
const shot = async (name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };
const step = async (label, fn) => { try { await fn(); } catch (e) { problems.push(`step "${label}": ${String(e.message).split('\n')[0].slice(0, 200)}`); } };

await step('screener', async () => {
  await page.goto(`${base}/radar/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.stockcard, .empty', { timeout: 30000 });
  out('screener · header', await text('.appbar', 300));
  out('screener · results head', await text('.results-top', 300) + ' || ' + await text('.countline', 200));
  out('screener · cards', (await page.locator('.stockcard').count()) + ' cards; first two: ' + (await page.locator('.stockcard').evaluateAll((els) => els.slice(0, 2).map((e) => e.innerText.replace(/\n+/g, ' | ')).join('  ###  '))).slice(0, 700));
  out('screener · preset options', await page.locator('select').first().evaluate((s) => [...s.options].map((o) => o.textContent).join(' / ')).catch(() => '(no select)'));
});

await step('each built-in runs', async () => {
  const sel = page.locator('select').filter({ has: page.locator('option', { hasText: 'Volume Surges' }) }).first();
  const res = [];
  for (const o of await sel.evaluate((s) => [...s.options].map((x) => [x.value, x.textContent]))) {
    await sel.selectOption(o[0]);
    await page.waitForResponse((r) => r.url().includes('/api/radar/scan/'), { timeout: 30000 });
    await page.waitForTimeout(400);
    res.push(`${o[1]}: ${await page.locator('.stockcard').count()} cards`);
  }
  out('screener · every preset', res.join(' ; '));
});

await step('filters', async () => {
  const count = () => page.locator('.stockcard').count();
  const apply = async () => { await page.locator('button', { hasText: 'Apply Filters' }).click(); await page.waitForTimeout(300); };
  const before = await count();
  await page.locator('.check', { hasText: 'Above 20 EMA' }).locator('input').check(); await apply();
  const ema = await count();
  await page.locator('button', { hasText: 'Reset' }).first().click(); await page.waitForTimeout(300);
  const reset = await count();
  await page.locator('#minp').fill('100000'); await apply();
  const pricey = await count();
  await page.locator('button', { hasText: 'Reset' }).first().click(); await page.waitForTimeout(300);
  out('filters', `all ${before} → above 20 EMA ${ema} → reset ${reset} → min price 100000: ${pricey} → reset ${await count()} | sector options: ${await page.locator('#sector option').count()} | still on: ${await text('#presetTitle', 60)}`);
  await shot('1-screener');
});

await step('shortlist', async () => {
  const stars = page.locator('.stockcard .star');
  const n = Math.min(2, await stars.count());
  for (let i = 0; i < n; i++) await stars.nth(i).click();
  await page.waitForTimeout(800);
  await go('shortlist'); await page.waitForTimeout(2500);
  out('shortlist', `${n} starred → ${await page.locator('.screen.active .stockcard, .stockcard').count()} cards shown | ` + await text('main', 400));
  await shot('2-shortlist');
});

await step('analysis', async () => {
  await go('screener');
  await page.locator('.stockcard').first().click();
  await page.waitForTimeout(6000);
  out('analysis · hero', await text('.stockhero', 500));
  out('analysis · tabs', await page.locator('.tab').evaluateAll((els) => els.map((e) => e.innerText.replace(/\n/g, ' ')).join(' / ')));
  for (const [i, name] of [[1, 'technical'], [2, 'canslim'], [3, 'fundamental']]) {
    await page.locator('.tab').nth(i).click().catch(() => {}); await page.waitForTimeout(900);
    out(`analysis · ${name}`, await text('.sectionbody, .detailgrid, .canslimgrid, main', 420));
  }
  await shot('3-analysis');
});

await step('market', async () => {
  await go('market'); await page.waitForTimeout(1500);
  out('market', await text('main', 1100));
  await shot('4-market');
});

await step('settings · builder', async () => {
  await page.locator('[aria-label="Settings"]').click(); await page.waitForTimeout(1500);
  out('settings · top', await text('main', 500));
  const mk = page.locator('button', { hasText: /New screener|Create|Add screener|Build/i }).first();
  out('settings · create button', await mk.innerText().catch(() => '(none found)'));
  await mk.click(); await page.waitForTimeout(500);
  await page.locator('.condition-value').first().fill('50');
  out('builder · preview text', await text('.condition-preview', 200));
  const run = page.locator('button', { hasText: /^Run|Test|Preview/i }).first();
  out('builder · run button', await run.innerText().catch(() => '(none found)'));
  await run.click(); await page.waitForResponse((r) => r.url().includes('/api/radar/preview'), { timeout: 30000 }); await page.waitForTimeout(500);
  out('builder · preview result', (await page.locator('.builder-preview, .preview-box, .preview-results, .preview-warn, .preview-error').allInnerTexts().catch(() => [])).join(' | ').replace(/\n+/g, ' | ').slice(0, 500) || await text('.editor, #screenerEditor, main', 900));
  await shot('5-builder');
});

await step('registers + data', async () => {
  await page.locator('[aria-label="Registers"]').click(); await page.waitForTimeout(1500);
  out('registers', await text('main', 300));
  await page.locator('[aria-label="Database"]').click(); await page.waitForTimeout(1500);
  out('database', await text('main', 300));
});

out('PROBLEMS', problems.length ? [...new Set(problems)] : 'none');
await browser.close();
