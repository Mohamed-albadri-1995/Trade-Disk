// Trade-Disk — one-time load of the migrated legacy screener history. The transformed
// data (from the old tool's SQLite backups) lives in R2; this fetches it via short-lived
// presigned URLs and loads it with the service-role client so it can write under the
// owner account (owner_id is baked into the data). Idempotent: it checks whether
// radar_history already holds rows and skips if so, so it runs exactly once.
//
//   radar_screen_catalog  — each legacy screen as a PAUSED screener (real filters + window)
//   radar_history         — one row per (screen, day, ticker) with the day's freeze time
//   radar_history_outcome — the legacy engine's recorded outcomes (up-R / down-R, A/B)

import { admin } from '../lib/supabase.mjs';
import { gunzipSync } from 'node:zlib';

const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
async function fetchJsonGz(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${r.status}`);
  return JSON.parse(gunzipSync(Buffer.from(await r.arrayBuffer())));
}

// `urls` = { cat, mem, out } presigned R2 GET URLs for the transformed JSON.
export async function importLegacy(urls) {
  if (!admin) return { ok: false, error: 'service-role key not configured' };
  if (!urls?.cat || !urls?.mem || !urls?.out) return { ok: false, error: 'need { cat, mem, out } urls' };
  const { count } = await admin.from('radar_history').select('ticker', { count: 'exact', head: true });
  if (count && count > 0) return { ok: true, skipped: 'already imported', existing: count };

  const [cat, mem, out] = await Promise.all([fetchJsonGz(urls.cat), fetchJsonGz(urls.mem), fetchJsonGz(urls.out)]);
  const up = async (table, rows, onConflict) => {
    for (const b of chunk(rows, 500)) {
      const { error } = await admin.from(table).upsert(b, { onConflict });
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  };
  await up('radar_screen_catalog', cat, 'owner_id,screen');
  await up('radar_history', mem, 'owner_id,screen,day,ticker');
  await up('radar_history_outcome', out, 'owner_id,src,day,ticker,variant');
  return { ok: true, screens: cat.length, members: mem.length, outcomes: out.length };
}
