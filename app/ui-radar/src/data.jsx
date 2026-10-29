import React, { useState, useEffect, useMemo } from 'react';
import { api } from './api.js';

const cls = (...a) => a.filter(Boolean).join(' ');

// The Database viewer — your account's tables laid out as folders you expand, each
// table opening to its rows (page through them, tap a row to read the whole record,
// download CSV or JSON). Read-only; it shows only your own data (RLS-scoped).
const fmtCell = (v) => {
  if (v == null) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.length > 140 ? s.slice(0, 137) + '…' : s;
};
const isHex = (v) => typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// Render any value readably: objects/arrays become an indented key→value tree
// (so a JSON column like `facts` reads like an outline, not one long string);
// primitives render plain, with a small swatch next to colour values.
function JsonTree({ value }) {
  if (value == null) return <span className="muted">null</span>;
  if (Array.isArray(value)) {
    if (!value.length) return <span className="muted">(empty)</span>;
    return <ul className="db-jt">{value.map((v, i) => <li key={i}><span className="db-jt-k">{i + 1}</span><JsonTree value={v} /></li>)}</ul>;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (!keys.length) return <span className="muted">(empty)</span>;
    return <ul className="db-jt">{keys.map((k) => <li key={k}><span className="db-jt-k">{k}</span><JsonTree value={value[k]} /></li>)}</ul>;
  }
  if (isHex(value)) return <span className="db-jt-v"><i className="db-swatch" style={{ background: value }} />{value}</span>;
  return <span className={cls('db-jt-v', typeof value === 'number' && 'num', typeof value === 'boolean' && 'bool')}>{String(value)}</span>;
}
const renderVal = (v) => (v != null && typeof v === 'object' ? <JsonTree value={v} /> : v == null ? <span className="muted">null</span> : String(v));
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function download(filename, content, mime) {
  try {
    const url = URL.createObjectURL(new Blob([content], { type: mime || 'text/plain' }));
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
    return true;
  } catch { return false; }
}

// Build a nested folder tree from each table's "group" (e.g. "Radar · live" → folder
// Radar → subfolder Live). Single-word groups (Journal, Lab) are one level deep.
function buildTree(list) {
  const root = { name: '', path: '', folders: new Map(), tables: [] };
  for (const t of list) {
    const parts = String(t.group || 'Other').split('·').map((s) => s.trim()).filter(Boolean);
    let node = root, path = '';
    for (const p of parts) {
      path = path ? `${path}/${p}` : p;
      if (!node.folders.has(p)) node.folders.set(p, { name: cap(p), path, folders: new Map(), tables: [] });
      node = node.folders.get(p);
    }
    node.tables.push(t);
  }
  // roll up table + row counts so a folder can show what it holds
  const stat = (n) => {
    let tc = n.tables.length, rc = n.tables.reduce((a, t) => a + (t.count || 0), 0);
    for (const f of n.folders.values()) { const s = stat(f); tc += s.tc; rc += s.rc; }
    n.tc = tc; n.rc = rc; return { tc, rc };
  };
  stat(root);
  return root;
}

function Folder({ node, depth, openSet, toggle, onOpen }) {
  const isOpen = openSet.has(node.path);
  const pad = 12 + depth * 15;
  return (
    <div className="db-folder">
      <button className="db-folder-row" style={{ paddingLeft: pad }} aria-expanded={isOpen} onClick={() => toggle(node.path)}>
        <span className={cls('db-caret', isOpen && 'open')}>▸</span>
        <span className="db-ficon">{isOpen ? '📂' : '📁'}</span>
        <span className="db-fname">{node.name}</span>
        <span className="db-fmeta">{plural(node.tc, 'table')} · {node.rc.toLocaleString()} rows</span>
      </button>
      {isOpen && (
        <div className="db-children">
          {[...node.folders.values()].map((f) => (
            <Folder key={f.path} node={f} depth={depth + 1} openSet={openSet} toggle={toggle} onOpen={onOpen} />
          ))}
          {node.tables.map((t) => (
            <button key={t.table} className="db-table-row" style={{ paddingLeft: pad + 15 }} onClick={() => onOpen(t.table)} title={`Open ${t.label}`}>
              <span className="db-ticon">▦</span>
              <span className="db-tlabel">{t.label}</span>
              <span className="db-tname">{t.table}</span>
              <span className="db-trows">{t.count.toLocaleString()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DataView({ onToast }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState(null);
  const [openSet, setOpenSet] = useState(() => new Set());
  const [sel, setSel] = useState(null);
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(50);
  const [busy, setBusy] = useState(false);
  const [dl, setDl] = useState(false);
  const [openRow, setOpenRow] = useState(null);           // which row's full record is expanded

  useEffect(() => {
    api.dataTables().then((r) => {
      const tbls = r.tables || [];
      setList(tbls);
      // open the top-level folders by default so the structure is visible at a glance;
      // deeper folders (e.g. Radar's Live/History/Collection) start closed to drill into.
      const top = new Set();
      for (const t of tbls) { const first = String(t.group || 'Other').split('·')[0].trim(); if (first) top.add(first); }
      setOpenSet(top);
    }).catch((e) => setErr(String(e.message || e)));
  }, []);

  useEffect(() => {
    if (!sel) return;
    let live = true; setBusy(true); setErr(null); setOpenRow(null);
    api.dataRows(sel, page, size).then((r) => { if (live) (r?.error ? setErr(r.error) : setData(r)); }).catch((e) => { if (live) setErr(String(e.message || e)); }).finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [sel, page, size]);

  const tree = useMemo(() => (list ? buildTree(list) : null), [list]);
  const selMeta = useMemo(() => (list || []).find((t) => t.table === sel) || null, [list, sel]);
  const crumb = useMemo(() => (selMeta ? String(selMeta.group || '').split('·').map((s) => cap(s.trim())).filter(Boolean) : []), [selMeta]);

  const toggle = (path) => setOpenSet((s) => { const n = new Set(s); n.has(path) ? n.delete(path) : n.add(path); return n; });
  const openTable = (t) => { setSel(t); setData(null); setPage(1); setErr(null); };

  async function doDownload(format) {
    if (!sel || dl) return;
    setDl(true);
    try {
      const r = await api.dataExport(sel, format);
      if (r?.error) { onToast?.(r.error); return; }
      download(r.filename, r.content, r.mime) ? onToast?.(`Downloaded ${r.filename} · ${r.rows} rows`) : onToast?.('Download not supported in this browser');
    } catch (e) { onToast?.(String(e.message || e)); } finally { setDl(false); }
  }

  const Head = () => (
    <div className="page-head">
      <div><div className="eyebrow">Your data</div><h1>Database</h1><p className="subtitle">Your tables, in folders. Open one to page through its rows — tap any row to read the whole record — and download CSV or JSON. Read-only, your own data only.</p></div>
    </div>
  );

  if (!list && err) return <section id="data" className="screen active db"><Head /><div className="empty"><b>Couldn’t load your tables</b>{err}</div></section>;
  if (!list) return <section id="data" className="screen active db"><Head /><div className="empty"><b>Loading your tables…</b></div></section>;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
    <section id="data" className="screen active db">
      <Head />
      {!sel ? (
        <div className="db-tree">
          {[...tree.folders.values()].map((f) => (
            <Folder key={f.path} node={f} depth={0} openSet={openSet} toggle={toggle} onOpen={openTable} />
          ))}
          {tree.tables.map((t) => (
            <button key={t.table} className="db-table-row" style={{ paddingLeft: 12 }} onClick={() => openTable(t.table)}>
              <span className="db-ticon">▦</span><span className="db-tlabel">{t.label}</span><span className="db-tname">{t.table}</span><span className="db-trows">{t.count.toLocaleString()}</span>
            </button>
          ))}
        </div>
      ) : (
        <section className="db-view">
          <div className="db-viewhead">
            <button className="ghost" onClick={() => { setSel(null); setData(null); }}>← Tables</button>
            <div className="db-crumb">{crumb.map((c, i) => <React.Fragment key={i}>📁 {c} <span className="db-sep">/</span> </React.Fragment>)}<b>▦ {data?.label || sel}</b></div>
            <span className="tag">{data ? data.total.toLocaleString() : '…'} rows</span>
            <div className="db-dl">
              <button className="ghost" disabled={dl} onClick={() => doDownload('csv')}>{dl ? '…' : '⬇ CSV'}</button>
              <button className="ghost" disabled={dl} onClick={() => doDownload('json')}>{dl ? '…' : '⬇ JSON'}</button>
            </div>
          </div>

          {err ? <div className="empty"><b>Couldn’t load rows</b>{err}</div>
            : busy && !data ? <div className="empty"><b>Loading {sel}…</b></div>
              : !data || !data.rows.length ? <div className="empty"><b>No rows</b>This table is empty.</div>
                : (
                  <>
                    <div className="muted small db-hint">Tap a row to see every column in full.</div>
                    <div className="db-tablewrap">
                      <table className="db-table">
                        <thead><tr><th className="db-xcol" aria-label="expand" />{data.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                        <tbody>
                          {data.rows.map((r, i) => (
                            <React.Fragment key={i}>
                              <tr className={cls('db-rowline', openRow === i && 'on')} onClick={() => setOpenRow(openRow === i ? null : i)}>
                                <td className="db-xcell">{openRow === i ? '▾' : '▸'}</td>
                                {data.columns.map((c) => <td key={c} className="db-cell" title={fmtCell(r[c])}>{fmtCell(r[c])}</td>)}
                              </tr>
                              {openRow === i && (
                                <tr className="db-detail"><td colSpan={data.columns.length + 1}>
                                  <dl className="db-detail-grid">
                                    {data.columns.map((c) => <React.Fragment key={c}><dt>{c}</dt><dd>{renderVal(r[c])}</dd></React.Fragment>)}
                                  </dl>
                                </td></tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="db-pager">
                      <button className="ghost" disabled={page <= 1 || busy} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Prev</button>
                      <span className="subtitle">Page {data.page} of {totalPages}</span>
                      <button className="ghost" disabled={page >= totalPages || busy} onClick={() => setPage((p) => p + 1)}>Next →</button>
                      <select className="select db-size" value={size} onChange={(e) => { setSize(+e.target.value); setPage(1); }}>
                        {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}/page</option>)}
                      </select>
                    </div>
                  </>
                )}
        </section>
      )}
    </section>
  );
}
