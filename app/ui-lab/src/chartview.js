// Trade-Disk — where a register chart opens. Shared by Radar and Lab (ui-radar/src and
// ui-lab/src hold the same copy); plain JS so it is tested under Node.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// the US market's calendar day and minutes from the 09:30 open, for a bar time (seconds)
export const etDayOf = (t) => new Date(t * 1000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
export const etMinOf = (t) => { const [h, m] = new Date(t * 1000).toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' }).split(':').map(Number); return (h % 24) * 60 + m - 570; };

// Where the chart should open: on the day the stock was on the register (daily view), or
// on the minute it was first seen that day (minute views). null when not in the bars.
export function registerFocus(bars, pick, tf) {
  if (!pick || !bars.length) return null;
  if (tf === 'D') {
    const i = bars.findIndex((b) => etDayOf(b.t) === pick.day);
    return i >= 0 ? { index: i, label: `▼ on the register ${pick.day}` } : null;
  }
  // the same anchor in every minute view; with no recorded first-seen time, the day's 09:30 open
  const known = pick.firstSeenMin != null;
  const i = bars.findIndex((b) => etDayOf(b.t) === pick.day && etMinOf(b.t) >= (known ? pick.firstSeenMin : 0));
  if (i < 0) return null;
  return { index: i, label: known ? `▼ first seen ${pick.firstSeen || ''} ET` : `▼ ${pick.day} open (first-seen time not recorded)` };
}

// The window a chart opens on: `count` bars (all when 0), placed so `focusIndex` sits a
// little right of centre (there is more to read after a stock shows up than before).
export function initialView(len, focusIndex = null, count = 0) {
  const n = count > 0 ? Math.min(count, len) : len;
  if (focusIndex == null || focusIndex < 0) return { start: Math.max(0, len - n), count: n };
  return { start: clamp(focusIndex - Math.floor(n * 0.6), 0, Math.max(0, len - n)), count: n };
}
