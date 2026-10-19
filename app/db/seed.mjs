// Trade-Disk — seed the demo workspace (CLI): Journal + Radar.
import { openDb } from '../lib/db.mjs';
import { seedDemo } from './seed-data.mjs';
import { seedRadar } from './radar-seed.mjs';
import { seedMarket } from './radar-market-seed.mjs';

const db = openDb();
const trades = seedDemo(db);
const stocks = seedRadar(db);
const market = seedMarket(db);
console.log(`seeded ${trades} trades + ${stocks} radar stocks + ${market} market snapshot (demo).`);
