// Trade-Disk — seed the demo workspace (CLI). The data lives in seed-data.mjs so
// the /api/journal/reset endpoint can rebuild it too.
import { openDb } from '../lib/db.mjs';
import { seedDemo } from './seed-data.mjs';

const n = seedDemo(openDb());
console.log(`seeded ${n} trades (demo).`);
