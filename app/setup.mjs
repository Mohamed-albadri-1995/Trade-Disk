// Trade-Disk — one-command setup (solo mode). Installs deps for the three front
// ends, builds them into app/web/, then seeds the demo database. After this, run
// `npm start` from app/ and open http://localhost:8787.
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const here = import.meta.dirname;
// Build order: the tool apps first (each into app/web/<tool>/), the Station last
// (into app/web/ root; it never empties the subdirs).
const uis = ['ui', 'ui-radar', 'ui-admin', 'ui-station'];
const run = (cmd, cwd) => { console.log(`\n$ ${cmd}   (${cwd.replace(here, 'app')})`); execSync(cmd, { cwd, stdio: 'inherit' }); };

for (const u of uis) {
  const dir = join(here, u);
  run('npm install', dir);
  run('npm run build', dir);
}
run('node db/seed.mjs', here);

console.log('\n✔ Setup complete.\n  Start it:  npm start   (from the app/ folder)\n  Then open: http://localhost:8787\n');
