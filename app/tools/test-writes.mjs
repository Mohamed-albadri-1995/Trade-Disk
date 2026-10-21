import { openDb } from '../lib/db.mjs';
import * as j from '../api/journal.mjs';

const db = openDb();
const before = j.trades(db).length;

const t = j.addTrade(db, { symbol: 'test', side: 'Long', setup: 'Breakout retest', assetType: 'stock', qty: 100, entry: 10, exit: 10.5, stop: 9.8, date: '2026-10-14', adherence: 'Good' });
console.log('ADD   ', t.id, '| status', t.status, '| net', t.net, '| r', t.r, '| symbol', t.symbol);

const u = j.updateTrade(db, t.id, { stop: 9.5, fees: 2, notes: 'edited', adherence: 'Average' });
console.log('EDIT  ', u.id, '| net', u.net, '| r', u.r, '| initialRisk', u.initialRisk, '| adherence', u.adherence, '| notes', u.notes);

j.saveDayNote(db, '2026-10-14', 'plan note');
console.log('DAYNOTE', JSON.stringify(j.dayNotes(db)['2026-10-14']));

const rv = j.addReview(db, { title: 'Weekly review', body: 'kept risk tight' });
console.log('REVIEW ', rv.id, rv.title, '| reviews', j.reviews(db).length);

console.log('COUNT  ', j.trades(db).length, '(was', before + ')');
console.log('RESET  ', JSON.stringify(j.reset(db)), '| count now', j.trades(db).length, '| reviews', j.reviews(db).length);
