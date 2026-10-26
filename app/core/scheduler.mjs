// Trade-Disk — Radar's in-process scheduler. The hosted service runs one long-lived
// Node process, so a once-a-minute timer drives the saved scan schedules without any
// external cron: on each tick it reads every account's schedule windows and, for each
// window due this minute, fires a data collection (collect.mjs) in the background — the
// scan runs, the register updates, the market refreshes and the snapshot is frozen.
// After the close it runs the day's outcome labels once. It needs the service-role key
// (to act for an account with no live request); without it the scheduler stays off and
// scans run only on demand from the page.
//
// Window times are read in US Eastern (the market's clock) unless a window's timezone
// is explicitly 'UTC'. One replica is assumed (Railway default); a per-minute in-memory
// guard stops a window firing twice within the same minute.

import { admin } from '../lib/supabase.mjs';
import { collect } from './collect.mjs';
import { computeLabels } from './labels.mjs';

const chk = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
let timer = null;
const firedThisMinute = new Set();   // `${owner}|${key}|${minuteStamp}`
let lastLabelDay = null;

// Clock parts in a timezone: weekday, hour, minute, ISO date.
function parts(tz) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
  let hh = +p.hour; if (hh === 24) hh = 0;                      // some ICU builds emit 24 at midnight
  return { weekday: p.weekday, hh, mm: +p.minute, date: `${p.year}-${p.month}-${p.day}` };
}
const minutesOf = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
function windowDue(nowMin, w) {
  const start = minutesOf(w.start), end = minutesOf(w.end), every = Math.max(1, +w.every || 5);
  return nowMin >= start && nowMin <= end && (nowMin - start) % every === 0;
}

async function tick() {
  if (!admin) return;
  try {
    const et = parts('America/New_York');
    if (et.weekday === 'Sat' || et.weekday === 'Sun') return;   // US market closed
    const etMin = et.hh * 60 + et.mm;
    const utc = parts('UTC'); const utcMin = utc.hh * 60 + utc.mm;
    const stamp = `${et.date} ${String(et.hh).padStart(2, '0')}:${String(et.mm).padStart(2, '0')}`;

    const scheds = chk(await admin.from('radar_screener').select('owner_id, id, windows, timezone'));
    for (const s of scheds) {
      const windows = Array.isArray(s.windows) ? s.windows : [];
      if (!windows.length) continue;
      const useUtc = s.timezone === 'UTC';
      const due = windows.some((w) => windowDue(useUtc ? utcMin : etMin, w));
      if (!due) continue;
      const fkey = `${s.owner_id}|${s.id}|${stamp}`;
      if (firedThisMinute.has(fkey)) continue;
      firedThisMinute.add(fkey);
      collect(admin, s.owner_id, s.id)
        .then((r) => console.log('[scheduler] collect', s.id, JSON.stringify(r)))
        .catch((e) => console.log('[scheduler] collect error', s.id, e.message));
    }

    // Outcome labels once per day, shortly after the 16:00 ET close.
    if (etMin >= 16 * 60 + 5 && lastLabelDay !== et.date) {
      lastLabelDay = et.date;
      const owners = [...new Set(scheds.map((s) => s.owner_id))];
      for (const o of owners) computeLabels(admin, o, et.date).then((r) => console.log('[scheduler] labels', JSON.stringify(r))).catch(() => {});
    }
    if (firedThisMinute.size > 5000) firedThisMinute.clear();
  } catch (e) { console.log('[scheduler] tick error', e.message); }
}

export function startScheduler() {
  if (timer) return;
  if (!admin) { console.log('[scheduler] off — no service-role key; scans run on demand only'); return; }
  console.log('[scheduler] on — checking schedules every minute (ET market clock)');
  tick();
  timer = setInterval(tick, 60 * 1000);
}
