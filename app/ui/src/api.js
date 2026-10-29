// Trade-Disk — Journal API client. One place that talks to /api/journal/*. Every
// request carries the signed-in user's token, so the server serves (and writes)
// only this account's data.
import { authHeader } from './auth.js';

const JSON_H = { 'content-type': 'application/json' };

async function req(path, opts = {}) {
  const auth = await authHeader();
  const res = await fetch(path, { ...opts, headers: { accept: 'application/json', ...(opts.headers || {}), ...auth } });
  return res.json();
}

export const getBundle = () => req('/api/journal/bundle');
export const addTrade = (t) => req('/api/journal/trades', { method: 'POST', headers: JSON_H, body: JSON.stringify(t) });
export const updateTrade = (id, patch) => req('/api/journal/trades/' + encodeURIComponent(id), { method: 'PATCH', headers: JSON_H, body: JSON.stringify(patch) });
export const saveDayNote = (day, note) => req('/api/journal/day-notes/' + encodeURIComponent(day), { method: 'PUT', headers: JSON_H, body: JSON.stringify({ note }) });
export const addReview = (r) => req('/api/journal/reviews', { method: 'POST', headers: JSON_H, body: JSON.stringify(r) });
export const deleteReview = (id) => req('/api/journal/reviews/' + encodeURIComponent(id), { method: 'DELETE' });
export const importTrades = (trades) => req('/api/journal/import', { method: 'POST', headers: JSON_H, body: JSON.stringify({ trades }) });
export const resetDemo = () => req('/api/journal/reset', { method: 'POST' });
export const clearWorkspace = () => req('/api/journal/clear', { method: 'POST' });
export const loadSamples = () => req('/api/journal/samples', { method: 'POST' });
