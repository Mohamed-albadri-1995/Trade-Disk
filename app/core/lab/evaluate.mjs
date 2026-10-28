// Trade-Disk — the Lab's strategy engine. ONE grammar for a trading rule and ONE
// evaluator that turns it into trades, so the signal you see on the chart is the
// signal the backtest trades. A strategy is a document: a side, an entry group,
// an exit group, and a risk block. Rules compare operands; operands read the
// verified library (library.mjs) — the only market math. Every missing value
// (warm-up, undefined) makes a rule FALSE, never zero.
//
// The honest part is the fill: the default `desk` model enters at the next bar's
// open and prices the stop and target from the DECISION bar's close, exactly as a
// real bracket order is priced; a gap through the stop is charged (filled at the
// open), a target fills at its level. This is why a backtest here does not flatter.

import { compute, source, resolve, SOURCES } from './library.mjs';

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const NA = NaN;

// ===== primitive resolution: qp-first, JS-library fallback ==================
// A strategy names primitives (ema, atr, vwap, …). The ONE source of truth for
// their values is the qp library the live algo imports (the Python qp-compute
// service). The backtest/preview precomputes those series server-side and hands
// them in via opts.prims, keyed by primKey; the engine reads them here. When a
// primitive is not in that map — qp not configured, a primitive qp doesn't cover,
// or an all-NaN series such as session VWAP on daily bars — the engine falls back
// to the local JS library (library.mjs), which is bar-for-bar verified against the
// same qp primitives, so a value always exists and nothing silently breaks.
export function primKey(spec) {
  return JSON.stringify({ name: spec.name, source: spec.source || 'close', params: spec.params || {}, sub: spec.sub || null });
}
function primSeries(bars, spec, opts) {
  const prims = opts && opts.prims;
  if (prims) { const hit = prims.get(primKey(spec)); if (hit) return hit; }
  return compute(bars, spec);
}
// Every distinct primitive a strategy will ask for: the operands in its entry/exit
// groups, its primitive stop anchor, and the ATR(14) the level maths always needs.
// qpprims.mjs computes these through qp-compute; primKey ties each result back to
// the exact operand the engine resolves, so the lookup never misses on normalising.
export function collectPrimitives(strat) {
  const out = new Map();
  const add = (spec) => { if (spec && spec.name) out.set(primKey(spec), { name: spec.name, source: spec.source || 'close', params: spec.params || {}, sub: spec.sub || null }); };
  const walkOp = (op) => {
    if (!op) return;
    if (op.kind === 'primitive') add({ name: op.name, source: op.source, params: op.params, sub: op.sub });
    else if (op.kind === 'expr') { walkOp(op.left); walkOp(op.right); }
  };
  const walkGroup = (g) => { for (const r of (g && g.rules) || []) { if (r.logic) walkGroup(r); else { walkOp(r.left); walkOp(r.right); } } };
  walkGroup(strat && strat.entry); walkGroup(strat && strat.exit);
  if (strat && strat.risk && strat.risk.sl && strat.risk.sl.type === 'prim') add({ name: strat.risk.sl.anchor, source: strat.risk.sl.source, params: strat.risk.sl.params, sub: strat.risk.sl.sub });
  add({ name: 'atr', params: { length: 14 } });   // level maths (ATR stops/targets) always needs ATR(14)
  return [...out.values()];
}

// ===== operands: a value series aligned to the bars ========================
// kinds: primitive | price | const | expr | trade (exit-only). Modifiers on any
// operand: hold (carry last real value forward, Pine's fixnan), offset (n bars
// ago), applied hold-then-offset. `trade` operands resolve from the open
// position during the exit walk; with no open trade they are all-NaN (rule false).
function operandSeries(bars, op, trade, cache, opts) {
  const key = JSON.stringify(op);
  if (op.kind !== 'trade' && cache.has(key)) return cache.get(key);
  let s;
  switch (op.kind) {
    case 'const': s = bars.map(() => +op.value); break;
    case 'price': s = source(bars, SOURCES.includes(op.source) ? op.source : 'close'); break;
    case 'primitive': s = primSeries(bars, { name: op.name, source: op.source, params: op.params, sub: op.sub }, opts); break;
    case 'expr': {
      const a = operandSeries(bars, op.left, trade, cache, opts), b = operandSeries(bars, op.right, trade, cache, opts);
      s = a.map((x, i) => {
        const y = b[i];
        if (!isNum(x) || !isNum(y)) return NA;
        if (op.operator === 'add') return x + y;
        if (op.operator === 'sub') return x - y;
        if (op.operator === 'mul') return x * y;
        if (op.operator === 'div') return y === 0 ? NA : x / y;
        return NA;
      });
      break;
    }
    case 'trade': s = trade ? trade[op.field] || bars.map(() => NA) : bars.map(() => NA); break;
    default: s = bars.map(() => NA);
  }
  if (op.hold) { let last = NA; s = s.map((v) => { if (isNum(v)) last = v; return last; }); }
  if (op.offset) { const n = op.offset | 0, out = s.map((_, i) => (i >= n ? s[i - n] : NA)); s = out; }
  if (op.kind !== 'trade') cache.set(key, s);
  return s;
}

// ===== operators: two value series → a boolean series ======================
function ruleRaw(bars, rule, trade, cache, opts) {
  const L = operandSeries(bars, rule.left, trade, cache, opts);
  const R = rule.right ? operandSeries(bars, rule.right, trade, cache, opts) : null;
  const n = bars.length, out = new Array(n).fill(false);
  const pct = rule.pct != null ? +rule.pct : 0;
  const tol = rule.tol_pct != null ? +rule.tol_pct : 0.15;
  for (let i = 0; i < n; i++) {
    const l = L[i], r = R ? R[i] : NA;
    const pl = i > 0 ? L[i - 1] : NA, pr = R && i > 0 ? R[i - 1] : NA;
    switch (rule.op) {
      case 'gt': out[i] = isNum(l) && isNum(r) && l > r; break;
      case 'lt': out[i] = isNum(l) && isNum(r) && l < r; break;
      case 'ge': out[i] = isNum(l) && isNum(r) && l >= r; break;
      case 'le': out[i] = isNum(l) && isNum(r) && l <= r; break;
      case 'eq': out[i] = isNum(l) && isNum(r) && Math.abs(l - r) <= 1e-9 * Math.max(1, Math.abs(l), Math.abs(r)); break;
      case 'neq': out[i] = isNum(l) && isNum(r) && Math.abs(l - r) > 1e-9 * Math.max(1, Math.abs(l), Math.abs(r)); break;
      case 'gt_pct': out[i] = isNum(l) && isNum(r) && l - r >= Math.abs(r) * pct / 100; break;
      case 'lt_pct': out[i] = isNum(l) && isNum(r) && r - l >= Math.abs(r) * pct / 100; break;
      case 'cross_above': out[i] = isNum(l) && isNum(r) && isNum(pl) && isNum(pr) && pl <= pr && l > r; break;
      case 'cross_below': out[i] = isNum(l) && isNum(r) && isNum(pl) && isNum(pr) && pl >= pr && l < r; break;
      case 'rising': out[i] = trend(L, i, rule, +1); break;
      case 'falling': out[i] = trend(L, i, rule, -1); break;
      case 'bounce_up': out[i] = bounce(bars, i, r, tol, +1); break;
      case 'bounce_down': out[i] = bounce(bars, i, r, tol, -1); break;
      default: out[i] = false;
    }
  }
  return out;
}

// rising/falling over `lookback` bars (default 12): ends above/below where it
// started (optionally by min_pct), with >= `consistency` of non-zero steps that
// way; flat steps do not count against it.
function trend(S, i, rule, dir) {
  const lb = rule.lookback != null ? rule.lookback | 0 : 12;
  if (i < lb) return false;
  const a = S[i - lb], b = S[i];
  if (!isNum(a) || !isNum(b)) return false;
  const minPct = rule.min_pct != null ? +rule.min_pct : 0;
  if (dir > 0 ? !(b - a >= Math.abs(a) * minPct / 100) : !(a - b >= Math.abs(a) * minPct / 100)) return false;
  const cons = rule.consistency != null ? +rule.consistency : 0.75;
  let same = 0, moves = 0;
  for (let j = i - lb + 1; j <= i; j++) {
    if (!isNum(S[j]) || !isNum(S[j - 1])) continue;
    const d = S[j] - S[j - 1];
    if (d === 0) continue;
    moves++;
    if (dir > 0 ? d > 0 : d < 0) same++;
  }
  return moves > 0 && same / moves >= cons;
}

// wick comes within tol% of the level and the bar closes back on its side, in the
// favourable 60% of its own range.
function bounce(bars, i, level, tol, dir) {
  const b = bars[i];
  if (!isNum(level) || !isNum(b.h) || !isNum(b.l) || !isNum(b.c) || b.h === b.l) return false;
  const near = dir > 0 ? Math.abs(b.l - level) <= Math.abs(level) * tol / 100
    : Math.abs(b.h - level) <= Math.abs(level) * tol / 100;
  const side = dir > 0 ? b.c > level : b.c < level;
  const posInRange = (b.c - b.l) / (b.h - b.l);
  const favourable = dir > 0 ? posInRange >= 0.4 : posInRange <= 0.6;
  return near && side && favourable;
}

// timing on a rule's RESULT: offset (shift), for_bars (all of last N), within_bars (any of last N).
function applyTiming(raw, rule) {
  let r = raw;
  if (rule.offset) { const n = rule.offset | 0; r = r.map((_, i) => (i >= n ? raw[i - n] : false)); }
  if (rule.for_bars) { const n = rule.for_bars | 0, src = r; r = r.map((_, i) => { if (i < n - 1) return false; for (let j = 0; j < n; j++) if (!src[i - j]) return false; return true; }); }
  if (rule.within_bars) { const n = rule.within_bars | 0, src = r; r = r.map((_, i) => { for (let j = 0; j < n && i - j >= 0; j++) if (src[i - j]) return true; return false; }); }
  return r;
}

// ===== groups: AND / OR / ATLEAST(k) / THEN(window) ========================
function groupBool(bars, group, trade, cache, opts) {
  const parts = (group.rules || []).map((r) => (r.logic ? groupBool(bars, r, trade, cache, opts) : applyTiming(ruleRaw(bars, r, trade, cache, opts), r)));
  const n = bars.length, out = new Array(n).fill(false);
  if (parts.length === 0) return out;
  const logic = group.logic || 'AND';
  if (logic === 'THEN') {                       // steps in order, each within `window` bars of the previous
    const w = group.window != null ? group.window | 0 : 10;
    let done = parts[0].slice();
    for (let k = 1; k < parts.length; k++) {
      const next = new Array(n).fill(false);
      for (let i = 0; i < n; i++) {
        if (!parts[k][i]) continue;
        for (let j = Math.max(0, i - w); j < i; j++) if (done[j]) { next[i] = true; break; }
      }
      done = next;
    }
    return done;
  }
  for (let i = 0; i < n; i++) {
    let c = 0; for (const p of parts) if (p[i]) c++;
    if (logic === 'OR') out[i] = c > 0;
    else if (logic === 'ATLEAST') out[i] = c >= Math.max(1, group.k | 0);
    else out[i] = c === parts.length;           // AND
  }
  return out;
}

// ===== fill models & level maths ===========================================
export const FILLS = ['close', 'next_open', 'desk', 'live'];
const dirOf = (strat) => (strat.side === 'short' ? -1 : 1);

// distance for a pct/atr/points spec off a reference price
function levelDist(spec, ref, atr) {
  if (!spec) return null;
  if (spec.type === 'pct') return Math.abs(ref) * (+spec.value) / 100;
  if (spec.type === 'atr') return (isNum(atr) ? atr : NA) * (+spec.value);
  if (spec.type === 'points') return +spec.value;
  return null;
}

// ===== simulate one symbol =================================================
// Returns { trades, entrySig, exitSigPreview, levels } for a single bars frame.
// One position at a time (flat-only), which is how these setups trade.
export function simulate(bars, strat, opts = {}) {
  const fill = opts.fill || strat.fill || 'desk';
  if (!FILLS.includes(fill)) throw new Error(`unknown fill model: ${fill}`);
  const costBps = +opts.costBps || 0;                 // per side
  const dir = dirOf(strat);
  const risk = strat.risk || {};
  const cache = new Map();
  const entrySig = groupBool(bars, strat.entry || { logic: 'AND', rules: [] }, null, cache, opts);
  const atr14 = primSeries(bars, { name: 'atr', params: { length: 14 } }, opts);
  const hasExit = strat.exit && (strat.exit.rules || []).length > 0;
  const entryMode = risk.entry_mode || 'edge';
  const n = bars.length;
  const trades = [];
  let cooldownUntil = -1, perDay = {}, exitPreview = new Array(n).fill(false);

  for (let i = 0; i < n; i++) {
    const fire = entryMode === 'edge' ? (entrySig[i] && !(i > 0 && entrySig[i - 1])) : entrySig[i];
    if (!fire || i <= cooldownUntil) continue;

    // where the fill lands and which price prices the brackets
    let entryBar, entryFill, levelRef;
    if (fill === 'close' || fill === 'live') { entryBar = i; entryFill = bars[i].c; levelRef = bars[i].c; }
    else { if (i + 1 >= n) break; entryBar = i + 1; entryFill = bars[i + 1].o; levelRef = fill === 'desk' ? bars[i].c : bars[i + 1].o; }
    if (!isNum(entryFill) || !isNum(levelRef)) continue;

    const atrD = atr14[i];
    // stop
    let stopPrice = null, stopIsPrim = false, primAnchor = null, stopFrozen = null;
    if (risk.sl) {
      if (risk.sl.type === 'prim') {
        stopIsPrim = true; primAnchor = risk.sl;
        const ser = primSeries(bars, { name: risk.sl.anchor, source: risk.sl.source, params: risk.sl.params, sub: risk.sl.sub }, opts);
        const base = isNum(ser[i]) ? ser[i] : levelRef;
        stopPrice = base; stopFrozen = risk.sl.freeze ? base : null;
      } else {
        const d = levelDist(risk.sl, levelRef, atrD);
        if (isNum(d)) stopPrice = levelRef - dir * d;
      }
    }
    const riskPerShare = stopPrice != null && isNum(stopPrice) ? Math.abs(entryFill - stopPrice) : null;

    // discipline gates
    if (riskPerShare != null) {
      const stopPct = riskPerShare / entryFill * 100;
      if (risk.max_stop_pct != null && stopPct > +risk.max_stop_pct) continue;
      if (risk.min_stop_pct != null && stopPct < +risk.min_stop_pct) continue;
    }
    const day = bars[i].t ? new Date(bars[i].t * 1000).toISOString().slice(0, 10) : i;
    if (risk.max_entries_per_day != null && (perDay[day] || 0) >= +risk.max_entries_per_day) continue;

    // targets: single tp, or scale-out legs (fraction + r_multiple|tp). Fractions
    // that do not reach 1 leave a runner that exits on the rule/stop/end.
    let legs = [];
    if (Array.isArray(risk.targets) && risk.targets.length) {
      for (const t of risk.targets) {
        let tp = null;
        if (t.r_multiple != null && riskPerShare != null) tp = entryFill + dir * (+t.r_multiple) * riskPerShare;
        else if (t.tp) { const d = levelDist(t.tp, levelRef, atrD); if (isNum(d)) tp = levelRef + dir * d; }
        if (tp != null) legs.push({ fraction: +t.fraction, tp });
      }
    } else if (risk.tp) {
      const d = levelDist(risk.tp, levelRef, atrD);
      if (isNum(d)) legs.push({ fraction: 1, tp: levelRef + dir * d });
    }
    const legFrac = legs.reduce((a, l) => a + l.fraction, 0);
    const runnerFrac = Math.max(0, 1 - legFrac);

    // per-trade series for `trade` operands in the exit group
    let exitBool = null;
    if (hasExit) {
      const ec = new Map();
      const entryArr = new Array(n).fill(NA), heldArr = new Array(n).fill(NA), pnlArr = new Array(n).fill(NA);
      for (let j = entryBar; j < n; j++) { entryArr[j] = entryFill; heldArr[j] = j - entryBar; pnlArr[j] = isNum(bars[j].c) ? (bars[j].c - entryFill) / entryFill * 100 * dir : NA; }
      exitBool = groupBool(bars, strat.exit, { entry: entryArr, bars_held: heldArr, pnl_pct: pnlArr }, ec, opts);
    }

    // ---- walk the position forward ----
    let remaining = 1, bankedPx = 0, bankedFr = 0, exitReason = null, exitBar = null, movedStop = stopPrice;
    const minHold = risk.min_hold_bars | 0;
    for (let j = entryBar; j < n; j++) {
      const b = bars[j];
      if (stopIsPrim && !stopFrozen) {              // trailing primitive stop, protective-only
        const ser = primSeries(bars, { name: primAnchor.anchor, source: primAnchor.source, params: primAnchor.params, sub: primAnchor.sub }, opts);
        if (isNum(ser[j])) movedStop = dir > 0 ? Math.max(movedStop, ser[j]) : Math.min(movedStop, ser[j]);
      }
      const sp = stopIsPrim ? (stopFrozen != null ? stopFrozen : movedStop) : stopPrice;
      // 1) leg targets banked first (unless stop_first), 2) stop, 3) exit rule, 4) end
      if (legs.length && !risk.stop_first) {
        for (const leg of legs) {
          if (leg.done) continue;
          const hit = dir > 0 ? b.h >= leg.tp : b.l <= leg.tp;
          if (hit) { leg.done = true; bankedPx += leg.fraction * leg.tp; bankedFr += leg.fraction; remaining -= leg.fraction; exitReason = 'TP'; }
        }
      }
      if (sp != null && isNum(sp) && remaining > 0) {
        const gap = dir > 0 ? b.o <= sp : b.o >= sp;
        const touch = dir > 0 ? b.l <= sp : b.h >= sp;
        if (gap || touch) {
          const px = gap ? b.o : sp;
          const inProfit = dir > 0 ? px > entryFill : px < entryFill;
          bankedPx += remaining * px; bankedFr += remaining; remaining = 0;
          exitReason = inProfit && (stopIsPrim || movedStop !== stopPrice) ? 'trail' : 'SL'; exitBar = j; break;
        }
      }
      if (legs.length && risk.stop_first) {           // stop had priority; now take any leg the bar reached
        for (const leg of legs) {
          if (leg.done) continue;
          const hit = dir > 0 ? b.h >= leg.tp : b.l <= leg.tp;
          if (hit) { leg.done = true; bankedPx += leg.fraction * leg.tp; bankedFr += leg.fraction; remaining -= leg.fraction; exitReason = 'TP'; }
        }
      }
      if (remaining <= 1e-9) { exitBar = j; break; }
      if (hasExit && exitBool[j] && j - entryBar >= minHold) {
        bankedPx += remaining * b.c; bankedFr += remaining; remaining = 0; exitReason = 'exit'; exitBar = j; break;
      }
      if (j === n - 1) {                               // open at the end of the data
        bankedPx += remaining * b.c; bankedFr += remaining; exitReason = exitReason ? exitReason : 'open'; exitBar = j;
        if (exitReason !== 'open' && remaining > 0) exitReason = 'open';
      }
    }
    if (exitBar == null) continue;
    const exitPx = bankedFr > 0 ? bankedPx / bankedFr : bars[exitBar].c;
    const grossPct = (exitPx - entryFill) / entryFill * 100 * dir;
    const netPct = grossPct - 2 * costBps / 100;        // round trip pays costs twice
    const r = riskPerShare != null ? (netPct / 100 * entryFill) / riskPerShare : null;
    trades.push({
      side: strat.side || 'long', entryBar, exitBar,
      entry_ts: bars[entryBar].t, exit_ts: bars[exitBar].t,
      entry: +entryFill.toFixed(4), exit: +exitPx.toFixed(4), stop: stopPrice != null ? +stopPrice.toFixed(4) : null,
      ret: +netPct.toFixed(4), gross: +grossPct.toFixed(4), r: r != null ? +r.toFixed(3) : null,
      reason: exitReason, bars_held: exitBar - entryBar, fill,
    });
    perDay[day] = (perDay[day] || 0) + 1;
    cooldownUntil = exitBar + (risk.cooldown_bars | 0);
    i = exitBar;                                        // flat-only: resume scanning after the exit
  }
  return { trades, entrySig, exitPreview: hasExit ? exitPreview : null };
}

// ===== validation (used on save) ===========================================
export function validateStrategy(strat) {
  const errors = [];
  if (!strat || typeof strat !== 'object') return { ok: false, errors: ['not an object'] };
  if (!['long', 'short'].includes(strat.side)) errors.push('side must be long or short');
  if (strat.fill && !FILLS.includes(strat.fill)) errors.push(`unknown fill model: ${strat.fill}`);
  const scanGroup = (g, where) => {
    for (const r of g.rules || []) {
      if (r.logic) { scanGroup(r, where); continue; }
      for (const side of ['left', 'right']) {
        const op = r[side]; if (!op) continue;
        if (op.kind === 'primitive' && !resolve(op.name)) errors.push(`unknown primitive: ${op.name}`);
        if (op.kind === 'trade' && where === 'entry') errors.push('a trade operand cannot be used in the entry group');
      }
    }
  };
  if (strat.entry) scanGroup(strat.entry, 'entry'); else errors.push('an entry group is required');
  if (strat.exit) scanGroup(strat.exit, 'exit');
  const risk = strat.risk || {};
  if (Array.isArray(risk.targets)) {
    for (const t of risk.targets) if (t.r_multiple != null && !risk.sl) errors.push('an R-multiple target needs a stop');
    const sum = risk.targets.reduce((a, t) => a + (+t.fraction || 0), 0);
    if (sum > 1 + 1e-9) errors.push(`target fractions sum to ${sum.toFixed(2)} (over 1)`);
  }
  return { ok: errors.length === 0, errors };
}

// A light preview over one bars frame, for the chart drawer.
export function evaluatePreview(bars, strat, opts = {}) {
  const { trades, entrySig } = simulate(bars, strat, opts);
  return {
    trades,
    entryBars: entrySig.map((v, i) => (v ? i : -1)).filter((i) => i >= 0),
    lastEntryTrue: entrySig[bars.length - 1] || false,
  };
}
