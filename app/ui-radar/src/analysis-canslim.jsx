import React from 'react';

// The CAN SLIM / O'Neil tab — a seven-factor evidence review computed live from the
// same free data as the rest of the workspace: SEC EDGAR filings (C current earnings,
// A annual earnings), Yahoo daily bars (N new highs, S supply/demand, L leadership)
// and the live market snapshot (M market direction). Factors that need a paid or
// holdings feed — a true RS percentile, institutional 13F sponsorship, short interest,
// confirmed base-pattern detection — are stated as such, never invented. It is an
// evidence review, not a buy signal.

const n = (v, d = 2, suf = '') => (v == null || !isFinite(v) ? '—' : (+v).toFixed(d) + suf);
const pctS = (v, d = 1) => (v == null || !isFinite(v) ? '—' : (v >= 0 ? '+' : '') + (+v).toFixed(d) + '%');
const tone = (v) => (v == null || !isFinite(v) ? undefined : v >= 0 ? 'good' : 'bad');
function big(v) {
  if (v == null || !isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
  if (a >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  return '$' + (+v).toFixed(0);
}
const shortLbl = (l) => String(l || '').replace(/ 20(\d\d)/, " '$1");

function pathOf(series, w = 320, h = 70, pad = 6) {
  const v = (series || []).filter((x) => x != null);
  if (v.length < 2) return '';
  const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
  const step = w / (v.length - 1);
  return v.map((c, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)} ${(h - pad - ((c - lo) / span) * (h - pad * 2)).toFixed(1)}`).join(' ');
}

const CsStat = ({ label, value, note, tone }) => (
  <div className="cs-stat"><small>{label}</small><strong className={tone || undefined}>{value}</strong>{note ? <em>{note}</em> : null}</div>
);
const CsFactor = ({ letter, title, question, status, warn, children }) => (
  <section className="cs-factor-panel">
    <div className="cs-factor-intro">
      <div className={`cs-letter ${warn ? 'warn' : ''}`}>{letter}</div>
      <div><h3>{title}</h3><p>{question}</p><span className={`cs-status ${warn ? 'warn' : ''}`}>{status}</span></div>
    </div>
    {children}
  </section>
);
const ChartBars = ({ bars }) => {
  const vals = bars.map(([, v]) => v).filter((v) => v != null && isFinite(v));
  const scale = Math.max(0.01, ...vals.map((v) => Math.abs(v))) * 1.1;
  return (
    <>
      <div className="cs-chartbars">{bars.map(([l, v]) => <div className="cs-barcol" key={l}><span>{v == null ? '—' : (+v).toFixed(2)}</span><i style={{ height: `${Math.max(2, Math.min(68, (Math.max(0, v) / scale) * 68))}px` }}></i></div>)}</div>
      <div className="cs-chartlabels">{bars.map(([l]) => <span key={l}>{shortLbl(l)}</span>)}</div>
    </>
  );
};

export function Canslim({ stock, a, loading }) {
  if (loading || !a || !a.canslim) {
    return <div id="canslim" className="pane"><div className="empty"><b>Building the seven-factor review…</b>Reading SEC filings, price action and the market snapshot for the CAN SLIM factors.</div></div>;
  }
  const cs = a.canslim, tech = a.technical || {}, s = stock;
  const price = tech.price != null ? tech.price : s.p;
  const prev = tech.prevClose;
  const abs = prev != null ? price - prev : (s.abs ?? 0);
  const chgPct = prev != null && prev !== 0 ? (price / prev - 1) * 100 : (s.c ?? 0);
  const up = chgPct >= 0;
  const statusBy = Object.fromEntries((cs.strip || []).map(([l, st]) => [l, st]));
  const warnBy = Object.fromEntries((cs.strip || []).map(([l, , w]) => [l, w]));

  const qEps = (cs.C?.quarterly || []).slice(-8);
  const annEps = (cs.A?.annual || []).slice(-6);

  return (
    <div id="canslim" className="pane">
      <div className="page-head">
        <div><div className="eyebrow">William J. O’Neil framework</div><h2>CAN SLIM / O’Neil Analysis</h2><p className="subtitle">Seven-factor evidence review, computed live from free filings, price action and the market snapshot.</p></div>
        <span className="demo" style={{ color: '#5df0b7', borderColor: '#1a6555', background: '#0c302a' }}>● LIVE · not a buy signal</span>
      </div>
      <div className="canslim-page" id="canslimDetails">
        <div className="cs-topline">
          <div className="cs-markethead">
            <div>
              <div className="cs-market-price" id="csPrice">${n(price)} <small className={up ? 'positive' : 'negative'}>{up ? '+' : '−'}{Math.abs(abs).toFixed(2)} ({up ? '+' : '−'}{Math.abs(chgPct).toFixed(2)}%)</small></div>
              <div className="cs-market-meta">{a.name || s.n} &nbsp;|&nbsp; {s.sec || 'US equity'} &nbsp;|&nbsp; {a.source || 'Yahoo + SEC EDGAR'}{a.asOf ? `  ·  ${a.asOf}` : ''}</div>
            </div>
            <svg className="cs-sparkline" viewBox="0 0 320 70" preserveAspectRatio="none"><path d={pathOf(a.overview?.chart)} fill="none" stroke={up ? '#20e5a4' : '#ff6374'} strokeWidth="2.5" /></svg>
          </div>
          <div className="cs-factorstrip">
            <div className="cs-strip-title">7-FACTOR REVIEW (CAN SLIM)</div>
            <div className="cs-factor-pills">{(cs.strip || []).map(([l, v, w]) => <div className={`cs-factor-pill ${w ? 'warn' : ''}`} key={l}><b>{l}</b><span>{v}</span></div>)}</div>
            <div className="cs-disclaimer">Evidence review — not a buy signal.</div>
          </div>
        </div>

        <CsFactor letter="C" title="Current Quarterly Earnings" question="Are recent quarterly earnings increasing significantly?" status={statusBy.C} warn={warnBy.C}>
          <div className="cs-stat-grid">
            <CsStat label="Latest quarter EPS growth" value={pctS(cs.C?.epsYoyPct)} note="YoY" tone={tone(cs.C?.epsYoyPct)} />
            <CsStat label="Latest quarter sales growth" value={pctS(cs.C?.salesYoyPct)} note="YoY" tone={tone(cs.C?.salesYoyPct)} />
            <div className="cs-evidence" style={{ gridColumn: '1/-1' }}>
              <h4>Recent quarterly EPS (diluted, from filings)</h4>
              <table className="cs-table"><thead><tr><th>Quarter</th><th>EPS</th><th>Year-ago EPS</th><th>YoY Growth</th></tr></thead>
                <tbody>{qEps.length ? qEps.slice().reverse().map((q, ri) => <tr key={ri}><td>{q.label}</td><td>{q.value == null ? '—' : '$' + n(q.value)}</td><td>{q.yearAgo == null ? '—' : '$' + n(q.yearAgo)}</td><td className={tone(q.yoyPct)}>{pctS(q.yoyPct)}</td></tr>) : <tr><td colSpan={4}>No quarterly filings available</td></tr>}</tbody></table>
            </div>
          </div>
          {qEps.length ? <div className="cs-evidence"><h4>Quarterly EPS trend (last {qEps.length})</h4><ChartBars bars={qEps.map((q) => [q.label, q.value])} /></div> : null}
        </CsFactor>

        <CsFactor letter="A" title="Annual Earnings" question="Has the company grown its earnings over several years?" status={statusBy.A} warn={warnBy.A}>
          <div className="cs-stat-grid">
            <CsStat label="3-Year EPS CAGR" value={pctS(cs.A?.epsCagr3yPct)} note="Annualized" tone={tone(cs.A?.epsCagr3yPct)} />
            <CsStat label="Return on Equity" value={n(cs.A?.roe, 1, '%')} note="> 17% reference" tone={cs.A?.roe != null && cs.A.roe >= 17 ? 'good' : undefined} />
            <CsStat label="Earnings record" value={annEps.length ? `${annEps.length} fiscal years` : '—'} note="From 10-K filings" />
            <div className="cs-evidence" style={{ gridColumn: '1/-1' }}>
              <h4>Annual EPS history (fiscal year, diluted)</h4>
              <table className="cs-table"><thead><tr><th>Fiscal Year</th><th>EPS</th></tr></thead>
                <tbody>{annEps.length ? annEps.slice().reverse().map((d, ri) => <tr key={ri}><td>{d.fy}</td><td>{d.value == null ? '—' : '$' + n(d.value)}</td></tr>) : <tr><td colSpan={2}>No annual filings available</td></tr>}</tbody></table>
            </div>
          </div>
          {annEps.length ? <div className="cs-evidence"><h4>Annual EPS trend</h4><ChartBars bars={annEps.map((d) => [String(d.fy), d.value])} /></div> : null}
        </CsFactor>

        <CsFactor letter="N" title="New Highs" question="Is the stock near new price highs?" status={statusBy.N} warn={warnBy.N}>
          <div className="cs-stat-grid">
            <CsStat label="52-week high" value={cs.N?.high52 == null ? '—' : '$' + n(cs.N.high52)} />
            <CsStat label="Current price" value={'$' + n(tech.price ?? s.p)} />
            <CsStat label="Distance from high" value={n(cs.N?.distFromHighPct, 1, '%')} note="0% = at the high" tone={cs.N?.distFromHighPct != null && cs.N.distFromHighPct >= -5 ? 'good' : undefined} />
            <CsStat label="52-week low" value={tech.low52 == null ? '—' : '$' + n(tech.low52)} />
          </div>
          <div className="cs-evidence">
            <h4>Base &amp; breakout</h4>
            <p className="subtitle" style={{ fontSize: '11px' }}>Confirmed base patterns (cup-with-handle, flat base) and pivot points need chart-pattern detection, which isn’t wired on free daily bars. “New highs” here is proximity to the 52-week high, not a confirmed breakout.</p>
          </div>
        </CsFactor>

        <CsFactor letter="S" title="Supply and Demand" question="What do share supply and trading demand show?" status={statusBy.S} warn={warnBy.S}>
          <div className="cs-stat-grid">
            <CsStat label="Diluted shares" value={cs.S?.sharesStr || '—'} />
            <CsStat label="Up/Down volume ratio" value={cs.S?.upDownVolRatio == null ? '—' : n(cs.S.upDownVolRatio, 2) + '×'} note="recent sessions" tone={cs.S?.upDownVolRatio != null && cs.S.upDownVolRatio >= 1 ? 'good' : undefined} />
            <CsStat label="Accumulation" value={cs.S?.accumulation ? 'Accumulation' : 'Distribution'} tone={cs.S?.accumulation ? 'good' : 'bad'} />
            <CsStat label="Float / short interest" value="Needs holdings feed" />
          </div>
          <div className="cs-evidence">
            <h4>Reading supply</h4>
            <p className="subtitle" style={{ fontSize: '11px' }}>Share count is the diluted weighted average from filings. Free float, insider holdings and short interest need a holdings feed and are not shown.</p>
          </div>
        </CsFactor>

        <CsFactor letter="L" title="Leader or Laggard" question="How does the stock rank for relative strength?" status={statusBy.L} warn={warnBy.L}>
          <div className="cs-stat-grid">
            <CsStat label="3-month return" value={pctS(cs.L?.mom3mPct)} note="price momentum" tone={tone(cs.L?.mom3mPct)} />
            <CsStat label="6-month return" value={pctS(cs.L?.mom6mPct)} note="price momentum" tone={tone(cs.L?.mom6mPct)} />
            <CsStat label="Sector" value={cs.L?.sector || '—'} />
            <CsStat label="RS percentile" value="Needs full-universe ranking" />
          </div>
          <div className="cs-evidence">
            <h4>Relative strength</h4>
            <p className="subtitle" style={{ fontSize: '11px' }}>Leadership is read here from this stock’s own 3- and 6-month price momentum. A true RS percentile (rank versus the whole market) needs the full research universe and isn’t computed on free data.</p>
          </div>
        </CsFactor>

        <CsFactor letter="I" title="Institutional Sponsorship" question="What does institutional ownership show?" status={statusBy.I} warn={warnBy.I}>
          <div className="cs-evidence">
            <h4>Not available on free data</h4>
            <p className="subtitle" style={{ fontSize: '11px' }}>{cs.I?.note || 'Institutional 13F sponsorship — funds holding, quarter-over-quarter change and institution quality — needs a holdings/13F feed. 13F data is also delayed up to 45 days.'}</p>
          </div>
        </CsFactor>

        <CsFactor letter="M" title="Market Direction" question="Does the broader market support the setup?" status={statusBy.M} warn={warnBy.M}>
          <div className="cs-stat-grid">
            <CsStat label="Market regime" value={cs.M?.regime || '—'} tone={cs.M?.bias === 'LONG' ? 'good' : cs.M?.bias === 'SHORT' ? 'bad' : undefined} />
            <CsStat label="Directional bias" value={cs.M?.bias || '—'} />
            <CsStat label="Distribution days" value={cs.M?.distributionDays == null ? '—' : String(cs.M.distributionDays)} />
            <CsStat label="Source" value="Live Market tab" />
          </div>
          <div className="cs-evidence">
            <h4>Market direction</h4>
            <p className="subtitle" style={{ fontSize: '11px' }}>From the live market snapshot (SPY moving averages, Bollinger position, sector breadth). The full regime model, heatmap and rankings live in the Market tab.</p>
          </div>
        </CsFactor>

        <section className="cs-missing">
          <h3>What needs a feed beyond free data</h3>
          <ul>
            <li>A true RS percentile (rank vs. the whole market) needs the full research universe.</li>
            <li>Institutional 13F sponsorship and institution quality need a holdings feed (and are delayed up to 45 days).</li>
            <li>Free float and short interest / days-to-cover need a holdings feed.</li>
            <li>Confirmed base patterns and pivot breakouts need chart-pattern detection, not just daily bars.</li>
            <li>Per-ticker news and dated catalysts need a news/events feed.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
