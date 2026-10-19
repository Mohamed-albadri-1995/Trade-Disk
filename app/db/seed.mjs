// Trade-Disk — seed the demo workspace (CLI): Journal + Radar.
import { openDb } from '../lib/db.mjs';
import { seedDemo } from './seed-data.mjs';
import { seedRadar } from './radar-seed.mjs';
import { seedMarket } from './radar-market-seed.mjs';
import { ensureSeeded } from '../core/sources.mjs';

const db = openDb();
const trades = seedDemo(db);
const stocks = seedRadar(db);
const market = seedMarket(db);
ensureSeeded(db); // the dual-mode feed registry (personal mode, all groups on demo)
console.log(`seeded ${trades} trades + ${stocks} radar stocks + ${market} market snapshot + feed registry (demo).`);
