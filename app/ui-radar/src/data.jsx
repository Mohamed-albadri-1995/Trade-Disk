import React, { useState, useEffect } from 'react';
import { api } from './api.js';

// The Database viewer — browse every table in your account, page through its rows,
// and download it as CSV or JSON. Read-only; it shows only your own data (RLS-scoped).
const fmtCell = (v) => {
  if (v == null) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.length > 140 ? s.slice(0, 137) + '…' : s;
};
const titleOf = (v) => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));

function download(filename, content, mime) {
  try {
    const url = URL.createObjectURL(new Blob([content], { type: mime || 'text/plain' }));
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
    return true;
  } catch { return false; }
}

export function DataView({ onToast }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState(null);
  const [sel, setSel] = useState(null);
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(50);
  const [busy, setBusy] = useState(false);
  const [dl, setDl] = useState(false);

  useEffect(() => { api.dataTables().then((r) => setList(r.tables || [])).catch((e) => setErr(String(e.message || e))); }, []);
  useEffect(() => {
    if (!sel) return;
    let live = true; setBusy(true); setErr(null);
    api.dataRows(sel, page, size).then((r) => { if (live) (r?.error ? setErr(r.error) : setData(r)); }).catch((e) => { if (live) setErr(String(e.message || e)); }).finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [sel, page, size]);

  const open = (t) => { setSel(t); setData(null); setPage(1); setErr(null); };

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
      <div><div className="eyebrow">Your data</div><h1>Database</h1><p className="subtitle">Browse every table in your account, page through the rows, and download CSV or JSON. Read-only — your own data only.</p></div>
    </div>
  );

  if (!list && err) return <section id="data" className="screen active"><Head /><div className="empty"><b>Couldn’t load your tables</b>{err}</div></section>;
  if (!list) return <section id="data" className="screen active"><Head /><div className="empty"><b>Loading your tables…</b></div></section>;

  const groups = {};
  for (const t of list) (groups[t.group] = groups[t.group] || []).push(t);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
    <section id="data" className="screen active">
      <Head />
      {!sel ? (
        Object.entries(groups).map(([g, ts]) => (
          <section className="market-block" key={g}>
            <div className="block-head"><div><h2>{g}</h2></div></div>
            <div className="index-grid">
              {ts.map((t) => (
                <article key={t.table} className="card index-card" style={{ cursor: 'pointer' }} role="button" tabIndex={0}
                  onClick={() => open(t.table)} onKeyDown={(e) => { if (e.key === 'Enter') open(t.table); }} title={`Open ${t.label}`}>
                  <div className="index-top"><strong>{t.label}</strong></div>
                  <div className="index-price" style={{ fontSize: 22 }}>{t.count.toLocaleString()}</div>
                  <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>{t.table} · rows →</span>
                </article>
              ))}
            </div>
          </section>
        ))
      ) : (
        <section className="market-block">
          <div className="block-head" style={{ gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
              <button className="ghost" onClick={() => { setSel(null); setData(null); }}>← Tables</button>
              <h2 style={{ margin: 0 }}>{data?.label || sel}</h2>
              <span className="tag">{data ? data.total.toLocaleString() : '…'} rows</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="ghost" disabled={dl} onClick={() => doDownload('csv')}>{dl ? '…' : '⬇ CSV'}</button>
              <button className="ghost" disabled={dl} onClick={() => doDownload('json')}>{dl ? '…' : '⬇ JSON'}</button>
            </div>
          </div>

          {err ? <div className="empty"><b>Couldn’t load rows</b>{err}</div>
            : busy && !data ? <div className="empty"><b>Loading {sel}…</b></div>
              : !data || !data.rows.length ? <div className="empty"><b>No rows</b>This table is empty.</div>
                : (
                  <>
                    <div className="table-wrap" style={{ overflowX: 'auto' }}>
                      <table className="market-table" style={{ fontSize: 12 }}>
                        <thead><tr>{data.columns.map((c) => <th key={c} style={{ whiteSpace: 'nowrap' }}>{c}</th>)}</tr></thead>
                        <tbody>
                          {data.rows.map((r, i) => (
                            <tr key={i}>{data.columns.map((c) => <td key={c} style={{ whiteSpace: 'nowrap', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }} title={titleOf(r[c])}>{fmtCell(r[c])}</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                      <button className="ghost" disabled={page <= 1 || busy} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Prev</button>
                      <span className="subtitle">Page {data.page} of {totalPages}</span>
                      <button className="ghost" disabled={page >= totalPages || busy} onClick={() => setPage((p) => p + 1)}>Next →</button>
                      <select className="select" style={{ width: 'auto' }} value={size} onChange={(e) => { setSize(+e.target.value); setPage(1); }}>
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
