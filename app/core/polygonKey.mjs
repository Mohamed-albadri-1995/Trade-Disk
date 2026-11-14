// Trade-Disk — the one shared Polygon API key, kept where no signed-in user can read it.
//
// The key lives in `app_secret`, a table with row-level security on and NO policy for
// signed-in users, so only the server's service-role client can read or write it. (It
// used to sit in `app_setting`, which every signed-in user may read.) The server uses
// the key on a user's behalf; the browser only ever sees a masked form.
//
// Order of lookup: the POLYGON_API_KEY environment variable, then `app_secret` (needs
// SUPABASE_SERVICE_ROLE_KEY on the server), then the old `app_setting` row — kept only so
// nothing breaks before the migration (db/supabase/2026-11-11-app-secret.sql) is run or
// on a server with no service-role key. Saving the key through the new path deletes the
// old row.

import { admin } from '../lib/supabase.mjs';

const NAME = 'polygon_api_key';
const chk = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const mask = (k) => (k ? `${k.slice(0, 3)}…${k.slice(-3)}` : null);
export const hasKey = (k) => typeof k === 'string' && k.length >= 12;

// The caller's own profile row, read through THEIR client: Supabase verifies the login
// token and row security returns only their row, so this proves a real signed-in user
// (the server itself does not verify tokens) before the service-role client is used.
async function callerProfile(sb) {
  const rows = chk(await sb.from('profile').select('id, role').limit(1));
  if (!rows[0]) throw new Error('sign in to use the Polygon key');
  return rows[0];
}

export async function getPolygonKey(sb, { adminClient = admin, env = process.env } = {}) {
  const fromEnv = (env.POLYGON_API_KEY || '').trim();
  if (fromEnv) return fromEnv;
  if (adminClient) {
    await callerProfile(sb);
    const r = await adminClient.from('app_secret').select('value').eq('key', NAME).limit(1);
    const v = (!r.error && r.data?.[0]?.value || '').trim();   // an error here = table not created yet
    if (v) return v;
  }
  const legacy = chk(await sb.from('app_setting').select('value').eq('key', NAME).limit(1));
  return (legacy[0]?.value || '').trim();
}

export async function polygonKeyStatus(sb, opts) {
  const k = await getPolygonKey(sb, opts);
  return { hasKey: hasKey(k), masked: mask(k) };
}

// Save (or, with an empty value, clear) the shared key. Owners and admins only.
export async function savePolygonKey(sb, key, { adminClient = admin } = {}) {
  const v = String(key || '').trim();
  if (!adminClient) {
    // No service-role key on this server: the private table is unreachable, so the key
    // stays where it was. Set SUPABASE_SERVICE_ROLE_KEY (or POLYGON_API_KEY) to close this.
    chk(await sb.from('app_setting').upsert({ key: NAME, value: v }, { onConflict: 'key' }));
    return { ok: true, hasKey: hasKey(v), masked: mask(v), private: false };
  }
  const me = await callerProfile(sb);
  if (!['owner', 'admin'].includes(me.role)) throw new Error('only an owner or admin can change the Polygon key');
  const r = await adminClient.from('app_secret').upsert({ key: NAME, value: v, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (r.error) throw new Error(`could not save the key privately (${r.error.message}) — run db/supabase/2026-11-11-app-secret.sql first`);
  await sb.from('app_setting').delete().eq('key', NAME);     // remove the readable copy; best effort
  return { ok: true, hasKey: hasKey(v), masked: mask(v), private: true };
}
