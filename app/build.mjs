// Trade-Disk — production build. Installs deps for and builds each front end into
// app/web/, which server.mjs then serves (one origin: static apps + /api). The
// Station builds to the web/ root with emptyOutDir:false, the three tools build to
// their own web/<tool>/ subdir with emptyOutDir:true, so build order is not
// significant — each tool only ever empties its own folder.
//
// Run from app/ (npm run build). Railway/Nixpacks runs this as the build phase.
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const UIS = ['ui-station', 'ui', 'ui-radar', 'ui-admin'];
const root = import.meta.dirname;
const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });

for (const ui of UIS) {
  const cwd = join(root, ui);
  console.log(`\n▶ ${ui}: install`);
  run('npm install --no-audit --no-fund', cwd);
  console.log(`▶ ${ui}: build`);
  run('npm run build', cwd);
}
console.log('\n✓ all front ends built into app/web/');
