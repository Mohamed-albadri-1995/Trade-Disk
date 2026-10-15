// Trade-Disk — Journal API client. One place that talks to /api/journal/*.
const H = { 'content-type': 'application/json', accept: 'application/json' };
const j = r => r.json();

export const getBundle = () => fetch('/api/journal/bundle', { headers: { accept: 'application/json' } }).then(j);
export const addTrade = t => fetch('/api/journal/trades', { method: 'POST', headers: H, body: JSON.stringify(t) }).then(j);
export const updateTrade = (id, patch) => fetch('/api/journal/trades/' + encodeURIComponent(id), { method: 'PATCH', headers: H, body: JSON.stringify(patch) }).then(j);
export const saveDayNote = (day, note) => fetch('/api/journal/day-notes/' + encodeURIComponent(day), { method: 'PUT', headers: H, body: JSON.stringify({ note }) }).then(j);
export const addReview = r => fetch('/api/journal/reviews', { method: 'POST', headers: H, body: JSON.stringify(r) }).then(j);
export const deleteReview = id => fetch('/api/journal/reviews/' + encodeURIComponent(id), { method: 'DELETE', headers: H }).then(j);
export const importTrades = trades => fetch('/api/journal/import', { method: 'POST', headers: H, body: JSON.stringify({ trades }) }).then(j);
export const resetDemo = () => fetch('/api/journal/reset', { method: 'POST', headers: H }).then(j);
