import { openDb } from '../lib/db.mjs';
import * as radar from '../api/radar.mjs';

const db = openDb();
const s = radar.stocks(db);
console.log('stocks:', s.length, '| first:', JSON.stringify({ t: s[0].t, p: s[0].p, s: s[0].s, tags: s[0].tags, stacked: s[0].stacked }));
console.log('toggle NVDA ->', JSON.stringify(radar.toggleShortlist(db, 'NVDA')));
console.log('toggle PLTR ->', JSON.stringify(radar.toggleShortlist(db, 'PLTR')));
console.log('shortlist:', JSON.stringify(radar.shortlist(db)));
console.log('toggle NVDA again ->', JSON.stringify(radar.toggleShortlist(db, 'NVDA')), '| shortlist:', JSON.stringify(radar.shortlist(db)));
