// Trade-Disk — admin API client (the feed switch). Every request carries the
// signed-in user's token; the server's RLS lets only an owner/admin write.
import { authHeader } from './auth.js';

async function j(path, opts = {}) {
  const auth = await authHeader();
  const res = await fetch(path, { ...opts, headers: { ...(opts.headers || {}), ...auth } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `${opts?.method || 'GET'} ${path} → ${res.status}`);
  return body;
}
const post = (path, data) => j(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });

export const api = {
  sources: () => j('/api/admin/sources'),
  setMode: (mode) => post('/api/admin/mode', { mode }),
  setGroup: (id, mode, active) => post(`/api/admin/group/${id}`, { mode, active }),
  setKey: (id, provider, key) => post(`/api/admin/key/${id}`, { provider, key }),
  refresh: () => post('/api/admin/refresh', {}),
};
