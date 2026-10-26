// Trade-Disk — Radar demo universe, reproduced verbatim from the approved radar
// prototype's stockData (frontend-design/radar.html). Fictional demo data, never
// real quotes. Exposed as a function so the CLI seed and a future reset can reuse it.

export const RADAR_STOCKS = [
  { t: 'NVDA', n: 'NVIDIA Corporation', p: 128.40, c: 3.31, abs: 4.12, s: 82, r: 6.2, adr: 3.2, pm: 1.34, pmHigh: 128.90, pmLow: 127.10, pmRange: 1.80, pmPct: 1.40, cap: '3.15T', capBand: 'large', sec: 'Semiconductors', mark: 'N', color: '', tags: ['Big Move', 'Pre-Market', 'Earnings'], ema: true, stacked: true, news: true, cs: true, changeLine: [9, 12, 10, 16, 14, 20, 18, 23, 21, 27, 24, 31] },
  { t: 'AMD', n: 'Advanced Micro Devices', p: 162.30, c: 3.25, abs: 5.11, s: 76, r: 4.1, adr: 4.2, pm: 1.56, pmHigh: 163.80, pmLow: 160.80, pmRange: 3.00, pmPct: 1.85, cap: '262B', capBand: 'large', sec: 'Semiconductors', mark: 'A', color: 'blue', tags: ['Big Move', 'Earnings'], ema: true, stacked: true, news: true, cs: true, changeLine: [8, 11, 9, 15, 14, 18, 17, 22, 19, 24, 23, 28] },
  { t: 'SMCI', n: 'Super Micro Computer', p: 49.12, c: 17.16, abs: 7.20, s: 74, r: 7.1, adr: 7.8, pm: 1.89, pmHigh: 49.80, pmLow: 48.60, pmRange: 1.20, pmPct: 2.44, cap: '28B', capBand: 'large', sec: 'Computer Hardware', mark: 'S', color: 'purple', tags: ['Big Move', 'High RVOL'], ema: true, stacked: false, news: true, cs: false, changeLine: [5, 9, 7, 14, 12, 20, 16, 22, 19, 28, 25, 33] },
  { t: 'PLTR', n: 'Palantir Technologies', p: 37.45, c: 5.10, abs: 1.82, s: 72, r: 2.8, adr: 4.1, pm: 1.22, pmHigh: 37.90, pmLow: 36.80, pmRange: 1.10, pmPct: 2.94, cap: '82B', capBand: 'large', sec: 'Software', mark: 'P', color: 'blue', tags: ['Big Move', 'AI'], ema: true, stacked: true, news: true, cs: true, changeLine: [8, 10, 9, 13, 12, 17, 15, 19, 17, 23, 21, 26] },
  { t: 'TSLA', n: 'Tesla, Inc.', p: 254.20, c: 2.49, abs: 6.18, s: 71, r: 3.4, adr: 5.5, pm: 1.31, pmHigh: 256.00, pmLow: 252.00, pmRange: 4.00, pmPct: 1.57, cap: '810B', capBand: 'large', sec: 'Automotive', mark: 'T', color: 'orange', tags: ['Pre-Market', 'Momentum'], ema: true, stacked: false, news: true, cs: false, changeLine: [10, 8, 13, 11, 15, 13, 18, 16, 19, 18, 23, 25] },
  { t: 'COIN', n: 'Coinbase Global', p: 167.32, c: 2.11, abs: 3.46, s: 68, r: 2.3, adr: 4.6, pm: 1.19, pmHigh: 169.00, pmLow: 165.00, pmRange: 4.00, pmPct: 2.39, cap: '41B', capBand: 'large', sec: 'Financial', mark: 'C', color: 'blue', tags: ['Momentum', 'Crypto'], ema: true, stacked: false, news: true, cs: false, changeLine: [7, 11, 8, 12, 10, 16, 14, 18, 17, 22, 19, 25] },
  { t: 'SOFI', n: 'SoFi Technologies', p: 12.54, c: 5.73, abs: 0.68, s: 66, r: 3.1, adr: 4.4, pm: 1.41, pmHigh: 12.70, pmLow: 12.40, pmRange: 0.30, pmPct: 2.39, cap: '13B', capBand: 'large', sec: 'Financial', mark: 'S', color: 'purple', tags: ['Pre-Market', 'Momentum'], ema: true, stacked: true, news: true, cs: false, changeLine: [6, 8, 7, 12, 11, 15, 13, 18, 17, 22, 20, 27] },
  { t: 'HOOD', n: 'Robinhood Markets', p: 24.31, c: 4.07, abs: 0.95, s: 64, r: 3.1, adr: 3.9, pm: 1.27, pmHigh: 24.60, pmLow: 24.10, pmRange: 0.50, pmPct: 2.06, cap: '21B', capBand: 'large', sec: 'Financial', mark: 'H', color: 'green', tags: ['Big Move', 'Pre-Market'], ema: true, stacked: false, news: true, cs: false, changeLine: [8, 11, 9, 13, 12, 16, 15, 19, 18, 22, 20, 26] },
];

const COLS = ['t', 'n', 'p', 'c', 'abs', 's', 'r', 'adr', 'pm', 'pm_high', 'pm_low', 'pm_range', 'pm_pct',
  'cap', 'cap_band', 'sec', 'mark', 'color', 'tags', 'ema', 'stacked', 'news', 'cs', 'change_line', 'sort'];

export function seedRadar(db) {
  db.exec('DELETE FROM radar_shortlist; DELETE FROM radar_stock;');
  const ins = db.prepare(`INSERT INTO radar_stock (${COLS.join(',')}) VALUES (${COLS.map(() => '?').join(',')})`);
  RADAR_STOCKS.forEach((s, i) => ins.run(
    s.t, s.n, s.p, s.c, s.abs, s.s, s.r, s.adr, s.pm, s.pmHigh, s.pmLow, s.pmRange, s.pmPct,
    s.cap, s.capBand, s.sec, s.mark, s.color, JSON.stringify(s.tags),
    s.ema ? 1 : 0, s.stacked ? 1 : 0, s.news ? 1 : 0, s.cs ? 1 : 0, JSON.stringify(s.changeLine), i));
  return db.prepare('SELECT COUNT(*) c FROM radar_stock').get().c;
}
