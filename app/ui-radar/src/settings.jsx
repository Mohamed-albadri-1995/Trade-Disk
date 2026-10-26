import React, { useState, useRef, useEffect } from 'react';
import {
  FILTER_LIBRARY, OPERATORS, TIMEFRAMES, SOURCES, VARIANTS, SESSIONS, EVERY_OPTIONS, TIMEZONES,
  newCondition, newWindow, fieldVisibility, buildConditionPreview, conditionIncomplete,
  filterSummary, scheduleSummary,
} from './screener-builder.js';
import { api } from './api.js';

const MetricOptions = () => FILTER_LIBRARY.map((g) => (
  <optgroup key={g.category} label={g.category}>
    {g.items.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
  </optgroup>
));

// One condition row: filter, timeframe, operator, compare mode and the fields each
// mode/metric reveals — the prototype's addFilterCondition/updateConditionRow.
function ConditionRow({ c, n, isLast, onChange, onRemove }) {
  const vis = fieldVisibility(c);
  const set = (patch) => onChange({ ...c, ...patch });
  return (
    <article className="condition-row">
      <div className="condition-row-head"><strong>CONDITION <span className="condition-number">{n}</span></strong><button type="button" onClick={onRemove}>Remove</button></div>
      <div className="condition-fields">
        <div className="field"><label>Filter</label>
          <select className="condition-metric" aria-label="Filter" value={c.metric} onChange={(e) => set({ metric: e.target.value })}><MetricOptions /></select>
        </div>
        <div className="field"><label>Timeframe</label>
          <select className="condition-timeframe" value={c.timeframe} onChange={(e) => set({ timeframe: e.target.value })}>{TIMEFRAMES.map((t) => <option key={t}>{t}</option>)}</select>
        </div>
        <div className="field condition-length-field" hidden={!vis.length}><label>Length / lookback</label>
          <input className="condition-length" type="number" min="1" max="1000" placeholder="14" value={c.length} onChange={(e) => set({ length: e.target.value })} />
        </div>
        <div className="field"><label>Operator</label>
          <select className="condition-op" value={c.operator} onChange={(e) => set({ operator: e.target.value })}>{OPERATORS.map((o) => <option key={o}>{o}</option>)}</select>
        </div>
        <div className="field condition-mode-field"><label>Compare against</label>
          <select className="condition-mode" value={c.mode} onChange={(e) => set({ mode: e.target.value })}>
            <option value="value">Fixed value</option><option value="filter">Another filter</option><option value="percent">Percentage distance</option>
          </select>
        </div>
        <div className="field condition-value-field" hidden={!vis.value}><label>Value</label>
          <input className="condition-value" placeholder="e.g. 10" inputMode="decimal" value={c.value} onChange={(e) => set({ value: e.target.value })} />
        </div>
        <div className="field condition-source-field" hidden={!vis.source}><label>Source</label>
          <select className="condition-source" value={c.source} onChange={(e) => set({ source: e.target.value })}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
        </div>
        <div className="field condition-ma-field" hidden={!vis.variant}><label>Indicator type</label>
          <select className="condition-variant" value={c.variant} onChange={(e) => set({ variant: e.target.value })}>{VARIANTS.map((v) => <option key={v}>{v}</option>)}</select>
        </div>
        <div className="condition-fields-extra" style={{ display: 'contents' }}>
          <div className="field condition-second-field" hidden={!vis.second}><label>Second filter</label>
            <select className="condition-second" value={c.compareMetric} onChange={(e) => set({ compareMetric: e.target.value })}><MetricOptions /></select>
          </div>
          <div className="field condition-second-tf-field" hidden={!vis.second}><label>Second timeframe</label>
            <select className="condition-second-tf" value={c.compareTimeframe} onChange={(e) => set({ compareTimeframe: e.target.value })}>{TIMEFRAMES.map((t) => <option key={t}>{t}</option>)}</select>
          </div>
          <div className="field condition-second-length-field" hidden={!vis.second}><label>Second length</label>
            <input className="condition-second-length" type="number" min="1" value={c.compareLength} onChange={(e) => set({ compareLength: e.target.value })} />
          </div>
          <div className="field condition-percent-field" hidden={!vis.percent}><label>Distance (%)</label>
            <input className="condition-percent" type="number" step="0.1" value={c.percent} onChange={(e) => set({ percent: e.target.value })} />
          </div>
          <div className="field condition-upper-field" hidden={!vis.upper}><label>Upper value</label>
            <input className="condition-upper" type="number" value={c.upper} onChange={(e) => set({ upper: e.target.value })} />
          </div>
        </div>
      </div>
      <div className="condition-preview">Rule preview: <b className="condition-preview-text">{buildConditionPreview(c)}</b></div>
      <div className="condition-logic" style={{ display: isLast ? 'none' : 'flex' }}>
        <span>Combine with next condition:</span>
        <select className="condition-join" value={c.join} onChange={(e) => set({ join: e.target.value })}><option>AND</option><option>OR</option></select>
      </div>
    </article>
  );
}

function ScheduleWindow({ w, onChange, onRemove }) {
  const set = (patch) => onChange({ ...w, ...patch });
  return (
    <div className="schedule-window">
      <div className="field"><label>Session / window</label>
        <select className="window-session" value={w.session} onChange={(e) => set({ session: e.target.value })}>{SESSIONS.map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      <div className="field"><label>Start</label><input className="window-start" type="time" value={w.start} onChange={(e) => set({ start: e.target.value })} /></div>
      <div className="field"><label>End</label><input className="window-end" type="time" value={w.end} onChange={(e) => set({ end: e.target.value })} /></div>
      <div className="field"><label>Repeat every</label>
        <select className="window-every" value={w.every} onChange={(e) => set({ every: Number(e.target.value) })}>{EVERY_OPTIONS.map((n) => <option key={n} value={n}>{n} min</option>)}</select>
      </div>
      <button type="button" className="remove-window" aria-label="Remove running window" onClick={onRemove}>×</button>
    </div>
  );
}

function SavedScreener({ c, onEdit, onDelete }) {
  const conds = c.conditions || [];
  const windows = c.windows || [];
  return (
    <div className="saved-screener">
      <div className="saved-screener-main">
        <div className="saved-screener-title"><strong>{c.name}</strong><span className="settings-pill">CUSTOM</span></div>
        <small>{c.description || 'Custom stock screen'}</small>
        <div className="saved-screener-meta">
          <span className="settings-pill">{conds.length || (c.filters ? c.filters.length : 0)} conditions</span>
          <span className="settings-pill">{windows.length} windows</span>
        </div>
        <small><b>IF</b> {filterSummary(conds) || (c.filters || []).join(' · ') || 'No conditions defined'}</small>
        <small><b>RUN</b> {scheduleSummary(windows) || 'No schedule defined'} · {c.timezone || 'device'} time</small>
      </div>
      <div className="saved-screener-actions">
        <button onClick={() => onEdit(c.id)}>Edit</button>
        <button onClick={() => onDelete(c.id)}>Delete</button>
      </div>
    </div>
  );
}

// One built-in screener's scan schedule — its rules are fixed, so only the windows
// and timezone are editable. Saved to the server per screener key.
function BuiltinSchedule({ s, schedule, onSave, onLoad, onToast }) {
  const [windows, setWindows] = useState(() => (schedule?.windows?.length ? schedule.windows : [newWindow()]).map((w) => newWindow(w)));
  const [timezone, setTimezone] = useState(schedule?.timezone || 'device');
  const [saving, setSaving] = useState(false);
  // Pick up the server's stored schedule once it arrives.
  useEffect(() => {
    if (schedule) {
      setWindows((schedule.windows?.length ? schedule.windows : [newWindow()]).map((w) => newWindow(w)));
      setTimezone(schedule.timezone || 'device');
    }
  }, [schedule]);
  const save = () => {
    if (!windows.length || windows.some((w) => !w.start || !w.end || w.start >= w.end)) { onToast('Each window needs a valid start and end time.'); return; }
    setSaving(true);
    onSave(s.key, { windows, timezone }).catch(() => {}).finally(() => setSaving(false));
  };
  return (
    <div className="saved-screener" style={{ display: 'block' }}>
      <div className="saved-screener-title" style={{ marginBottom: '4px', alignItems: 'center' }}>
        <strong>{s.name}</strong><span className="settings-pill">BUILT-IN</span>
        {s.conditions?.length ? <button type="button" className="secondary-btn" style={{ marginLeft: 'auto', padding: '5px 10px' }} onClick={() => onLoad(s)}>✎ Open rules in builder</button> : null}
      </div>
      <small>{s.note}</small>
      <div className="schedule-window-list" style={{ marginTop: '10px' }}>
        {windows.map((w) => (
          <ScheduleWindow key={w.id} w={w}
            onChange={(nw) => setWindows((ws) => ws.map((x) => (x.id === w.id ? nw : x)))}
            onRemove={() => setWindows((ws) => (ws.length > 1 ? ws.filter((x) => x.id !== w.id) : ws))} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
        <button type="button" className="add-window" onClick={() => setWindows((ws) => [...ws, newWindow()])}>＋ Add window</button>
        <select className="select" style={{ maxWidth: '180px' }} value={timezone} onChange={(e) => setTimezone(e.target.value)}>{TIMEZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <button className="primary" style={{ marginLeft: 'auto' }} disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save schedule'}</button>
      </div>
    </div>
  );
}

// The Settings screen: the built-in screeners' schedules, the custom-screener
// overview, and the on-demand editor. All server-persisted.
export function Settings({ onToast }) {
  const [configs, setConfigs] = useState([]);
  const [schedules, setSchedules] = useState({});
  const [builtins, setBuiltins] = useState([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', conditions: [], windows: [], timezone: 'device' });
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const editorRef = useRef(null);

  useEffect(() => {
    api.configs().then(({ custom, schedules }) => { setConfigs(custom || []); setSchedules(schedules || {}); }).catch(() => {});
    api.screeners().then(setBuiltins).catch(() => {});
  }, []);
  useEffect(() => { if (editorOpen && editorRef.current) editorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [editorOpen]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', description: '', conditions: [newCondition()], windows: [newWindow()], timezone: 'device' });
    setEditorOpen(true);
  };
  const openEdit = (id) => {
    const c = configs.find((x) => x.id === id);
    if (!c) return;
    setEditingId(c.id);
    setForm({
      name: c.name, description: c.description || '',
      conditions: (c.conditions && c.conditions.length ? c.conditions : (c.filters || []).map((metric) => ({ metric }))).map((x) => newCondition(x)),
      windows: (c.windows && c.windows.length ? c.windows : [{}]).map((w) => newWindow(w)),
      timezone: c.timezone || 'device',
    });
    setEditorOpen(true);
  };
  // Load a built-in's rules into the builder as a new editable copy — this is how a
  // built-in is "buildable": you see its real conditions, can edit them, run and save.
  const openFromBuiltin = (s) => {
    setEditingId(null);
    setForm({
      name: `${s.name} (my copy)`, description: s.note || '',
      conditions: (s.conditions?.length ? s.conditions : [{}]).map((x) => newCondition(x)),
      windows: [newWindow()], timezone: 'device',
    });
    setPreview(null);
    setEditorOpen(true);
  };
  const close = () => { setEditorOpen(false); setPreview(null); };

  // Run the current conditions live (TradingView) without saving — a quick test.
  const runPreview = () => {
    const conditions = form.conditions.map((c) => ({ ...c, value: String(c.value).trim() }));
    if (!conditions.length) { onToast('Add at least one condition to run.'); return; }
    setPreviewing(true); setPreview(null);
    api.preview({ conditions })
      .then((r) => setPreview(r))
      .catch((e) => setPreview({ error: String(e.message) }))
      .finally(() => setPreviewing(false));
  };

  const setConditions = (fn) => setForm((f) => ({ ...f, conditions: fn(f.conditions) }));
  const setWindows = (fn) => setForm((f) => ({ ...f, windows: fn(f.windows) }));

  const save = () => {
    const name = form.name.trim();
    if (!name) { onToast('Enter a screener name first.'); return; }
    const conditions = form.conditions.map((c) => ({ ...c, value: String(c.value).trim() }));
    if (!conditions.length || conditions.some(conditionIncomplete)) { onToast('Complete each condition or remove the empty row.'); return; }
    if (!form.windows.length) { onToast('Add at least one running window.'); return; }
    if (form.windows.some((w) => !w.start || !w.end || w.start >= w.end)) { onToast('Each running window needs a valid start and end time.'); return; }
    const cfg = { id: editingId || undefined, name, description: form.description.trim(), conditions, windows: form.windows, timezone: form.timezone };
    api.saveConfig(cfg)
      .then(({ custom }) => { setConfigs(custom || []); setEditorOpen(false); onToast('Screener saved to your workspace.'); })
      .catch((e) => onToast(String(e.message)));
  };

  const del = (id) => {
    const c = configs.find((x) => x.id === id);
    if (!c || !window.confirm('Delete "' + c.name + '"? This cannot be undone.')) return;
    api.deleteConfig(id).then(({ custom }) => { setConfigs(custom || []); onToast('Screener removed.'); }).catch((e) => onToast(String(e.message)));
  };

  const saveSchedule = (key, body) => api.saveSchedule(key, body)
    .then(({ schedules }) => { setSchedules(schedules || {}); onToast('Scan schedule saved.'); })
    .catch((e) => { onToast(String(e.message)); throw e; });

  return (
    <section id="settings" className="screen active">
      <div className="page-head">
        <div>
          <div className="eyebrow">Your screening workspace</div>
          <h1>Settings</h1>
          <p className="subtitle">Manage your screening tools and their scan schedules.</p>
        </div>
        <span className="tag">Saved to your workspace</span>
      </div>
      <div className="settings-note"><strong>Saved on the server</strong> — your screeners and schedules live in your workspace, not just this browser, so they follow you across devices. Automatic background scanning on these schedules is wired in a later step; for now the schedule is stored and the Screener tab runs on demand.</div>

      <section className="panel settings-overview">
        <div className="settings-overview-head">
          <div><h2>Built-in screeners</h2><p className="subtitle">The five live screeners. Set when each one should scan — its rules are fixed.</p></div>
        </div>
        <div id="builtinScheduleList">
          {builtins.length ? builtins.map((s) => (
            <BuiltinSchedule key={s.key} s={s} schedule={schedules[s.key]} onSave={saveSchedule} onLoad={openFromBuiltin} onToast={onToast} />
          )) : <div className="settings-empty"><b>Loading…</b>Reading the live screeners.</div>}
        </div>
      </section>

      <section className="panel settings-overview">
        <div className="settings-overview-head">
          <div><h2>Your custom screeners</h2><p className="subtitle">Build your own rules and schedule. Create one only when you need it.</p></div>
          <button className="primary create-screener-btn" onClick={openCreate}>＋ Create screener</button>
        </div>
        <div className="settings-summary"><span><b id="savedScreenerCount">{configs.length}</b> saved</span><span>Names, filters and running windows</span></div>
        <div id="savedScreenerList">
          {configs.length ? configs.map((c) => <SavedScreener key={c.id} c={c} onEdit={openEdit} onDelete={del} />)
            : <div className="settings-empty"><b>No custom screeners yet</b>Your built-in screeners are above. Create a custom screen when you want your own rules.</div>}
        </div>
      </section>

      {editorOpen && (
        <section ref={editorRef} className="panel settings-card settings-editor">
          <div className="editor-heading">
            <div><div className="eyebrow">Screener configuration</div><h2>{editingId ? 'Edit screener' : 'Create a screener'}</h2><p className="subtitle">Choose the conditions and the times this screener should run.</p></div>
            <button className="iconbtn" aria-label="Close editor" onClick={close}>✕</button>
          </div>
          <div className="settings-form-grid">
            <div className="field"><label htmlFor="scrName">SCREENER NAME</label><input className="input" id="scrName" maxLength={60} placeholder="e.g. My Breakout Watch" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label htmlFor="scrDescription">DESCRIPTION (OPTIONAL)</label><input className="input" id="scrDescription" maxLength={120} placeholder="What should this screener find?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>

          <div className="settings-section-title"><span>F</span><div><h3>Filter conditions</h3><p>Build explicit rules. Every row adds a condition to this screen.</p></div></div>
          <div className="condition-toolbar"><p>Build conditions from a broad filter library. Compare a filter to a value, another filter, or a percentage distance.</p><button className="add-condition" type="button" onClick={() => setConditions((cs) => [...cs, newCondition()])}>＋ Add condition</button></div>
          <p className="condition-mobile-note">On smaller screens, each condition becomes a stacked rule card.</p>
          <div id="conditionRows" className="condition-list">
            {form.conditions.map((c, i) => (
              <ConditionRow key={c.id} c={c} n={i + 1} isLast={i === form.conditions.length - 1}
                onChange={(nc) => setConditions((cs) => cs.map((x) => (x.id === c.id ? nc : x)))}
                onRemove={() => setConditions((cs) => cs.filter((x) => x.id !== c.id))} />
            ))}
          </div>

          <div className="settings-section-title"><span>W</span><div><h3>Running windows</h3><p>Add one or more independent windows. Each window has its own interval.</p></div></div>
          <div id="scheduleWindowList" className="schedule-window-list">
            {form.windows.map((w) => (
              <ScheduleWindow key={w.id} w={w}
                onChange={(nw) => setWindows((ws) => ws.map((x) => (x.id === w.id ? nw : x)))}
                onRemove={() => setWindows((ws) => ws.filter((x) => x.id !== w.id))} />
            ))}
          </div>
          <button type="button" className="add-window" onClick={() => setWindows((ws) => [...ws, newWindow()])}>＋ Add running window</button>

          <div className="field timezone-field"><label htmlFor="scheduleTimezone">TIME ZONE</label>
            <select className="select" id="scheduleTimezone" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>{TIMEZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <div className="window-help">Production scheduling must respect US exchange holidays and daylight-saving changes.</div>
          </div>

          {preview && (
            <div className="preview-result">
              {preview.error
                ? <div className="preview-err">⚠ {preview.error}</div>
                : <>
                    <div className="preview-head"><b>{preview.count} live match{preview.count === 1 ? '' : 'es'}</b> <span className="muted">of {preview.totalCount} in the US market · right now</span></div>
                    <div className="preview-tickers">{(preview.stocks || []).slice(0, 24).map((s) => <span key={s.t} className="preview-chip" title={`${s.n} · ${s.p}`}>{s.t}</span>)}{preview.count > 24 ? <span className="muted"> +{preview.count - 24} more</span> : null}</div>
                  </>}
              {preview.unsupported?.length ? <div className="preview-warn">{preview.unsupported.length} condition(s) can't run on the live scanner yet: {preview.unsupported.map((u) => u.metric + (u.reason ? ` (${u.reason.replace(/ on the live scanner yet| yet/, '')})` : '')).join('; ')}. The rest ran.</div> : null}
            </div>
          )}
          <div className="settings-actions">
            <button className="secondary-btn" onClick={runPreview} disabled={previewing}>{previewing ? 'Running…' : '▶ Run / preview'}</button>
            <button className="primary" onClick={save}>Save screener</button>
            <button className="secondary-btn" onClick={close}>Cancel</button>
          </div>
        </section>
      )}
    </section>
  );
}
