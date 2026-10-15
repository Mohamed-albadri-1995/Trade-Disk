// Trade-Disk — build the Journal app from the approved prototype.
// The prototype (frontend-design/index.html) is the VISUAL CONTRACT: we copy it
// verbatim and change ONLY its data source — instead of generating demo trades in
// localStorage, it loads /api/journal/bundle from the backend and renders the same
// screens unchanged. Opened as a plain file (no server) it still falls back to the
// built-in demo seed, so the prototype keeps working standalone.

import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const FE = join(import.meta.dirname, '..', '..', 'frontend-design');
const WEB = join(import.meta.dirname, '..', 'web');
mkdirSync(WEB, { recursive: true });

let html = readFileSync(join(FE, 'index.html'), 'utf8');

function replace(find, repl) {
  const i = html.indexOf(find);
  if (i < 0) throw new Error('NOT FOUND: ' + JSON.stringify(find.slice(0, 70)));
  if (html.indexOf(find, i + 1) >= 0) throw new Error('NOT UNIQUE: ' + JSON.stringify(find.slice(0, 70)));
  html = html.slice(0, i) + repl + html.slice(i + find.length);
}

// 1-2) make the static reference data replaceable by the backend's
replace("const setups=['Breakout retest'", "let setups=['Breakout retest'");
replace("const accounts=[", "let accounts=[");

// 3) stop generating demo trades into localStorage; start empty, filled by boot()
replace(
  "let trades=readStore('td-trades',null); if(!Array.isArray(trades)){trades=buildSeed();writeStore('td-trades',trades)}",
  "let trades=[]; /* loaded from the backend in boot(); buildSeed() is the offline fallback */"
);

// 4) load from the API before the first paint; fall back to the demo seed offline
const BOOT = `async function boot(){
  try{
    const r=await fetch('/api/journal/bundle',{headers:{accept:'application/json'}});
    if(!r.ok)throw new Error('http '+r.status);
    const b=await r.json();
    if(Array.isArray(b.trades))trades=b.trades;
    if(Array.isArray(b.accounts)&&b.accounts.length)accounts=b.accounts;
    if(Array.isArray(b.setups)&&b.setups.length)setups=b.setups;
    if(b.dayNotes&&typeof b.dayNotes==='object')dayNotes=b.dayNotes;
  }catch(e){ if(!trades.length)trades=buildSeed(); } /* standalone/offline */
  render();
}`;
replace(
  "$('#newTradeBtn').addEventListener('click',newTrade);\nrender();\n})();",
  "$('#newTradeBtn').addEventListener('click',newTrade);\n" + BOOT + "\nboot();\n})();"
);

writeFileSync(join(WEB, 'index.html'), html);

// the other product apps are served as-is so the Station's preview links work
for (const f of ['radar.html', 'tradelab.html']) copyFileSync(join(FE, f), join(WEB, f));

console.log('built app/web/index.html (' + html.length + ' bytes) + radar.html + tradelab.html');
