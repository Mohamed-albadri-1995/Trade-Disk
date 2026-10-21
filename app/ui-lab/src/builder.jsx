// Trade-Disk — TradeLab strategy builder. Build a trading rule by clicking:
// operands (a price, a library indicator, or a number), an operator, and groups
// (AND / OR / at-least / then). A risk block adds the stop, targets and discipline.
// It emits the exact strategy document the engine evaluates — no second grammar.
import React from 'react';
import { cls } from './lib.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const defPrimitive = (meta) => ({ kind: 'primitive', name: meta.primitives[0]?.name || 'sma', params: {} });
const defRule = (meta) => ({ left: { kind: 'price', source: 'close' }, op: 'gt', right: defPrimitive(meta) });

// one operand: Price | Indicator | Number, with its fields
function Operand({ meta, op, onChange, allowTrade }) {
  const set = (patch) => onChange({ ...op, ...patch });
  const prim = op.kind === 'primitive' ? meta.primitives.find((p) => p.name === op.name) : null;
  return (
    <div className="op">
      <select className="sel kind" value={op.kind} onChange={(e) => {
        const k = e.target.value;
        if (k === 'price') onChange({ kind: 'price', source: 'close' });
        else if (k === 'const') onChange({ kind: 'const', value: 0 });
        else if (k === 'trade') onChange({ kind: 'trade', field: 'pnl_pct' });
        else onChange(defPrimitive(meta));
      }}>
        <option value="price">Price</option>
        <option value="primitive">Indicator</option>
        <option value="const">Number</option>
        {allowTrade && <option value="trade">Trade</option>}
      </select>
      {op.kind === 'price' && (
        <select className="sel" value={op.source} onChange={(e) => set({ source: e.target.value })}>
          {meta.sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      )}
      {op.kind === 'const' && <input className="inp num" type="number" value={op.value} onChange={(e) => set({ value: +e.target.value })} />}
      {op.kind === 'trade' && (
        <select className="sel" value={op.field} onChange={(e) => set({ field: e.target.value })}>
          <option value="pnl_pct">unrealised %</option><option value="bars_held">bars held</option><option value="entry">entry price</option>
        </select>
      )}
      {op.kind === 'primitive' && prim && (
        <>
          <select className="sel" value={op.name} onChange={(e) => onChange({ kind: 'primitive', name: e.target.value, params: {} })}>
            {meta.primitives.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
          {prim.lines && (
            <select className="sel" value={op.sub || prim.lines[0]} onChange={(e) => set({ sub: e.target.value })}>
              {prim.lines.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          )}
          {prim.inputs === 'source' && (
            <select className="sel" value={op.source || 'close'} onChange={(e) => set({ source: e.target.value })}>
              {meta.sources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {prim.params.map((pr) => (
            <input key={pr.name} className="inp num" type="number" title={pr.name}
              value={op.params?.[pr.name] ?? pr.default}
              onChange={(e) => set({ params: { ...op.params, [pr.name]: +e.target.value } })} />
          ))}
          <input className="inp num" type="number" title="offset (bars ago)" placeholder="off" value={op.offset || ''} onChange={(e) => set({ offset: +e.target.value || undefined })} />
        </>
      )}
    </div>
  );
}

function Rule({ meta, rule, onChange, onRemove }) {
  const opDef = meta.operators.find((o) => o.op === rule.op) || {};
  return (
    <div className="rule">
      <Operand meta={meta} op={rule.left} onChange={(l) => onChange({ ...rule, left: l })} allowTrade={false} />
      <select className="sel op-sel" value={rule.op} onChange={(e) => onChange({ ...rule, op: e.target.value })}>
        {meta.operators.map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}
      </select>
      {!opDef.solo && <Operand meta={meta} op={rule.right || { kind: 'const', value: 0 }} onChange={(r) => onChange({ ...rule, right: r })} allowTrade />}
      {opDef.pct && <input className="inp num" type="number" title="percent" value={rule.pct ?? 1} onChange={(e) => onChange({ ...rule, pct: +e.target.value })} />}
      {opDef.solo && <input className="inp num" type="number" title="lookback bars" value={rule.lookback ?? 12} onChange={(e) => onChange({ ...rule, lookback: +e.target.value })} />}
      <button className="x" title="remove rule" onClick={onRemove}>✕</button>
    </div>
  );
}

function Group({ meta, title, group, onChange }) {
  const g = group || { logic: 'AND', rules: [] };
  const setRule = (i, r) => { const rules = g.rules.slice(); rules[i] = r; onChange({ ...g, rules }); };
  const addRule = () => onChange({ ...g, rules: [...g.rules, defRule(meta)] });
  const rmRule = (i) => onChange({ ...g, rules: g.rules.filter((_, k) => k !== i) });
  return (
    <div className="grp">
      <div className="grp-head">
        <span className="grp-title">{title}</span>
        <select className="sel" value={g.logic} onChange={(e) => onChange({ ...g, logic: e.target.value })}>
          {meta.groups.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        {g.logic === 'ATLEAST' && <input className="inp num" type="number" title="k" value={g.k ?? 1} onChange={(e) => onChange({ ...g, k: +e.target.value })} />}
        {g.logic === 'THEN' && <input className="inp num" type="number" title="window bars" value={g.window ?? 10} onChange={(e) => onChange({ ...g, window: +e.target.value })} />}
      </div>
      {g.rules.map((r, i) => <Rule key={i} meta={meta} rule={r} onChange={(x) => setRule(i, x)} onRemove={() => rmRule(i)} />)}
      <button className="add" onClick={addRule}>+ add condition</button>
    </div>
  );
}

function Risk({ risk, onChange }) {
  const r = risk || {};
  const sl = r.sl || { type: 'pct', value: 8 };
  const targets = r.targets || [];
  const setSl = (patch) => onChange({ ...r, sl: { ...sl, ...patch } });
  const setTarget = (i, patch) => { const t = targets.slice(); t[i] = { ...t[i], ...patch }; onChange({ ...r, targets: t }); };
  return (
    <div className="risk">
      <div className="risk-row">
        <label>Stop</label>
        <select className="sel" value={r.sl ? sl.type : 'none'} onChange={(e) => e.target.value === 'none' ? onChange({ ...r, sl: null }) : setSl({ type: e.target.value })}>
          <option value="none">none</option><option value="pct">percent</option><option value="atr">ATR ×</option><option value="points">$ points</option>
        </select>
        {r.sl && <input className="inp num" type="number" value={sl.value} onChange={(e) => setSl({ value: +e.target.value })} />}
      </div>
      <div className="risk-row">
        <label>Targets</label>
        {targets.map((t, i) => (
          <span key={i} className="tgt">
            <input className="inp num" type="number" step="0.1" title="fraction" value={t.fraction} onChange={(e) => setTarget(i, { fraction: +e.target.value })} />
            @<input className="inp num" type="number" step="0.5" title="R multiple" value={t.r_multiple ?? 2} onChange={(e) => setTarget(i, { r_multiple: +e.target.value })} />R
            <button className="x" onClick={() => onChange({ ...r, targets: targets.filter((_, k) => k !== i) })}>✕</button>
          </span>
        ))}
        {targets.length < 3 && <button className="add sm" onClick={() => onChange({ ...r, targets: [...targets, { fraction: targets.length ? 0.5 : 1, r_multiple: 2 }] })}>+ leg</button>}
      </div>
      <div className="risk-row">
        <label>Entry</label>
        <select className="sel" value={r.entry_mode || 'edge'} onChange={(e) => onChange({ ...r, entry_mode: e.target.value })}>
          <option value="edge">on the cross (edge)</option><option value="status">any bar true (status)</option>
        </select>
        <label className="sub">cooldown</label>
        <input className="inp num" type="number" title="cooldown bars" value={r.cooldown_bars || 0} onChange={(e) => onChange({ ...r, cooldown_bars: +e.target.value })} />
        <label className="sub">min hold</label>
        <input className="inp num" type="number" title="min hold bars" value={r.min_hold_bars || 0} onChange={(e) => onChange({ ...r, min_hold_bars: +e.target.value })} />
      </div>
    </div>
  );
}

export default function Builder({ meta, doc, setDoc, onEvaluate, onSave, saved, onLoad, onDelete, templates, onTemplate, busy, dirty }) {
  if (!meta) return <div className="muted pad">Loading the builder…</div>;
  const d = doc;
  return (
    <div className="builder">
      <div className="b-id">
        <input className="inp name" value={d.name} onChange={(e) => setDoc({ ...d, name: e.target.value })} placeholder="Strategy name" />
        <select className="sel" value={d.side} onChange={(e) => setDoc({ ...d, side: e.target.value })}><option value="long">Long</option><option value="short">Short</option></select>
        <select className="sel" value={d.fill || 'desk'} onChange={(e) => setDoc({ ...d, fill: e.target.value })} title="fill model">
          {meta.fills.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      <Group meta={meta} title="Entry when" group={d.entry} onChange={(g) => setDoc({ ...d, entry: g })} />
      <Group meta={meta} title="Exit when" group={d.exit} onChange={(g) => setDoc({ ...d, exit: g })} />
      <Risk risk={d.risk} onChange={(r) => setDoc({ ...d, risk: r })} />

      <div className="b-actions">
        <button className="btn primary" onClick={onEvaluate} disabled={busy}>▶ Evaluate on chart</button>
        <button className="btn" onClick={onSave} disabled={busy}>{dirty ? '● ' : ''}Save</button>
      </div>

      <div className="b-templates">
        <div className="muted small">Start from a template</div>
        <div className="chips">
          {templates.map((t) => <button key={t.id} className="chip" title={t.about} onClick={() => onTemplate(t.id)}>{t.name}</button>)}
        </div>
      </div>

      {saved.length > 0 && (
        <div className="b-saved">
          <div className="muted small">Saved strategies</div>
          {saved.map((s) => (
            <div key={s.id} className={cls('saved-row', d.id === s.id && 'active')}>
              <button className="saved-name" onClick={() => onLoad(s.id)}>{s.name} <em>v{s.version} · {s.side}</em></button>
              <button className="x" title="delete" onClick={() => onDelete(s.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
