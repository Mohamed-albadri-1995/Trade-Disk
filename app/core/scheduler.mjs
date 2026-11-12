// Trade-Disk — Radar's in-process scheduler. The hosted service runs one long-lived
// Node process, so a once-a-minute timer drives the saved scan schedules without any
// external cron: on each tick it reads every account's schedule windows and, for each
// window due this minute, fires a data collection (collect.mjs) in the background — the
// scan runs, the register updates, the market refreshes and the snapshot is frozen.
// After the close it runs the day's outcome labels once. It needs the service-role key
// (to act for an account with no live request); without it the scheduler stays off and
// scans run only on demand from the page.
//
// Window times are read in the schedule's own time zone: 'UTC', or any IANA zone the
// page saved (it stores the device's real zone for "Device local time"). A legacy
// 'device' value, a missing one or an unknown zone falls back to US Eastern, the
// market's clock. Weekends and NYSE holidays are skipped on the Eastern calendar.
// One replica is assumed (Railway default). The timer ticks three times a minute so a
// slow or drifting tick can never step over a due minute, and a per-minute in-memory
// guard stops a window firing twice within the same minute.

import { admin } from '../lib/supabase.mjs';
import { collect } from './collect.mjs';
import { computeLabels } from './labels.mjs';

const chk = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
let timer = null;
const firedThisMinute = new Set();   // `${owner}|${key}|${minuteStamp}`
let lastLabelRun = null;             // `${ET date}|close` or `${ET date}|late`

// Full-day NYSE closures (ET dates). Early-close days still trade, so they are not
// listed. Extend this each year from the exchange's published calendar.
export const MARKET_HOLIDAYS = new Set([
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
]);
export const marketOpenDay = (et) => et.weekday !== 'Sat' && et.weekday !== 'Sun' && !MARKET_HOLIDAYS.has(et.date);

// Clock parts in a timezone: weekday, hour, minute, ISO date. Throws on an unknown zone.
export function parts(tz, now = new Date()) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  let hh = +p.hour; if (hh === 24) hh = 0;                      // some ICU builds emit 24 at midnight
  return { weekday: p.weekday, hh, mm: +p.minute, date: `${p.year}-${p.month}-${p.day}` };
}
const minutesOf = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
export function windowDue(nowMin, w) {
  const start = minutesOf(w.start), end = minutesOf(w.end), every = Math.max(1, +w.every || 5);
  return nowMin >= start && nowMin <= end && (nowMin - start) % every === 0;
}
// Minute-of-day right now in a schedule's time zone (see the header for the fallbacks).
export function minuteIn(timezone, now = new Date()) {
  const zone = !timezone || timezone === 'device' ? 'America/New_York' : timezone;
  let p;
  try { p = parts(zone, now); } catch { p = parts('America/New_York', now); }
  return p.hh * 60 + p.mm;
}

// One pass: fire every schedule window due this minute. `client` and `now` default to
// the service-role client and the real clock. Returns what it fired and a promise that
// settles when those collections finish (the timer ignores both).
export async function tick(client = admin, now = new Date()) {
  const jobs = [], fired = [];
  if (!client) return { fired, done: Promise.resolve() };
  try {
    const et = parts('America/New_York', now);
    if (!marketOpenDay(et)) return { fired, done: Promise.resolve() };   // weekend or NYSE holiday
    const etMin = et.hh * 60 + et.mm;
    const stamp = `${et.date} ${String(et.hh).padStart(2, '0')}:${String(et.mm).padStart(2, '0')}`;

    const scheds = chk(await client.from('radar_screener').select('owner_id, id, windows, timezone'));
    for (const s of scheds) {
      const windows = Array.isArray(s.windows) ? s.windows : [];
      if (!windows.length) continue;
      const nowMin = minuteIn(s.timezone, now);
      const due = windows.some((w) => windowDue(nowMin, w));
      if (!due) continue;
      const fkey = `${s.owner_id}|${s.id}|${stamp}`;
      if (firedThisMinute.has(fkey)) continue;
      firedThisMinute.add(fkey);
      fired.push(`${s.owner_id}|${s.id}`);
      jobs.push(collect(client, s.owner_id, s.id)
        .then((r) => console.log('[scheduler] collect', s.id, JSON.stringify(r)))
        .catch((e) => console.log('[scheduler] collect error', s.id, e.message)));
    }

    // Outcome labels twice a day: shortly after the 16:00 ET close, and again after the
    // after-hours session (20:00 ET) so stocks first seen by a late window are labelled
    // too. The second run rewrites the same rows with the complete day.
    const slot = etMin >= 20 * 60 + 5 ? 'late' : etMin >= 16 * 60 + 5 ? 'close' : null;
    if (slot && lastLabelRun !== `${et.date}|${slot}`) {
      lastLabelRun = `${et.date}|${slot}`;
      const owners = [...new Set(scheds.map((s) => s.owner_id))];
      for (const o of owners) jobs.push(computeLabels(client, o, et.date).then((r) => console.log('[scheduler] labels', slot, JSON.stringify(r))).catch(() => {}));
    }
    if (firedThisMinute.size > 5000) firedThisMinute.clear();
  } catch (e) { console.log('[scheduler] tick error', e.message); }
  return { fired, done: Promise.all(jobs) };
}

export function startScheduler() {
  if (timer) return;
  if (!admin) { console.log('[scheduler] off — no service-role key; scans run on demand only'); return; }
  console.log('[scheduler] on — checking schedules every minute (each schedule in its own time zone)');
  tick();
  timer = setInterval(() => tick(), 20 * 1000);
}
