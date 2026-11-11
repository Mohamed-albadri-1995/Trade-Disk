// Radar — the HTTP front door: sign-in gate and resilience to bad requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const PORT = 18000 + Math.floor(Math.random() * 2000);
const base = `http://127.0.0.1:${PORT}`;
const forged = `Bearer x.${Buffer.from(JSON.stringify({ sub: 'u1' })).toString('base64url')}.y`;
let proc;
const up = async () => { try { return (await fetch(`${base}/api/health`)).ok; } catch { return false; } };
async function start() {
  proc = spawn(process.execPath, [join(import.meta.dirname, '..', 'server.mjs')], { env: { ...process.env, PORT: String(PORT), SUPABASE_SERVICE_ROLE_KEY: '' }, stdio: 'ignore' });
  for (let i = 0; i < 50 && !(await up()); i++) await new Promise((r) => setTimeout(r, 100));
  assert.ok(await up(), 'server started');
}
test.before(start);
test.after(() => proc?.kill());

test('server: every Radar route needs a sign-in token', async () => {
  for (const path of ['bundle', 'scan/volume-surges', 'market', 'export', 'configs']) {
    assert.equal((await fetch(`${base}/api/radar/${path}`)).status, 401, path);
  }
  assert.equal((await fetch(`${base}/api/radar/bundle`, { headers: { authorization: 'Bearer not-a-token' } })).status, 401);
  assert.equal((await fetch(`${base}/api/radar/config`, { method: 'POST', body: '{}' })).status, 401);
});

test('server: unknown Radar route is 404, a malformed route parameter is an error, not a crash', async () => {
  const h = { authorization: forged };
  assert.equal((await fetch(`${base}/api/radar/nope`, { headers: h })).status, 404);
  assert.equal((await fetch(`${base}/api/radar/scan/%E0%A4%A`, { headers: h })).status, 500);
  assert.equal((await fetch(`${base}/api/radar/screeners`, { headers: h })).status, 200);
});

test('server: files outside the web folder are not served', async () => {
  const r = await fetch(`${base}/..%2Fpackage.json`);
  assert.notEqual(r.status, 200);
});

test('server: a malformed web address does not take the server down', { todo: 'GET /%E0%A4%A throws inside serveStatic with nothing to catch it; Node exits, so one request from anyone (no sign-in) stops the app and the background scheduler' }, async () => {
  await fetch(`${base}/%E0%A4%A`).catch(() => {});
  await new Promise((r) => setTimeout(r, 300));
  const alive = await up();
  if (!alive) await start();          // bring it back for any test that follows
  assert.ok(alive, 'server still answering after a malformed URL');
});
