// Browser-test harness: the real server and the real Radar code, with an in-memory
// database in place of Supabase, so the app can be driven in a browser without an
// account and without touching the hosted project. Market data (TradingView, Yahoo) is
// live. Usage: node test/e2e/serve.mjs [port]   (build the front end first)
import { start, setClientFactory } from '../../server.mjs';
import { fakeDb } from '../helpers.mjs';

const db = fakeDb({ app_setting: [{ key: 'mode', value: 'personal' }], profile: [{ id: 'e2e-user', role: 'owner' }] });
setClientFactory(() => db);
start(+process.argv[2] || 8799, { scheduler: false });
