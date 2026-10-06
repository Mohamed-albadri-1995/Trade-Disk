# Trade Desk — deployment

**pm2 supervises the desk. systemd runs the scheduled jobs. Nothing is
supervised by both.**

That last sentence is the whole point of this file, and getting it wrong cost
113,854 restarts — see *The two supervisors*, below.

## What runs, and who owns it

| Process | Port | What | Owner |
|---------|------|------|-------|
| `tool-T1` … `tool-T11` | 3000, 3010, 3050, 3060, 3120 | one screener each — `src/index.js` with `TOOL_ID` and its own `DB_PATH` | pm2 |
| `qp`      | 8765 | the chart and backtest platform — `quant-platform/chart` | pm2 |
| `journal` | 3100 | the journal — `journal/server.js`, data in `data/journal` | pm2 |
| `archive` | the stopped tools' ports | read-only registers for tools that no longer scan | pm2 |

T1 also serves the landing page and the screener suite, so stopping it takes
the front door with it.

`tools.config.json` is the registry every one of these reads — the ports above
come from it, not from this table. If the two disagree, that file is right.

**Tools added from the screen** (Screener Suite → *Manage tools*) live in
`data/tools.local.json`, beside the repo registry and never in it: T12, T13 …,
plus any rename, schedule change, stop or delete made there. Everything reads
the two merged (`src/toolsRegistry.js`, and `chart/screener.py` for qp), so a
tool made on the phone is started by every deploy after it. One command starts
a tool, for the deploy and the page alike: `bash deploy/tool-ctl.sh
start|stop|restart T13` (and `archive` to re-read what the archive serves).
A new tool gets the next free port (3130, 3140 …) — the AWS security group has
to allow it, as it does the others.

## Deploying

**The deploy is `./deploy-tools.sh`.** It pulls the branch, installs
dependencies, stops every tool and starts only the ones `tools.config.json`
has enabled (so a retired tool like T10 stays off), starts `archive`,
restarts qp through pm2 if it is not running this checkout
(`deploy/qp-restart.sh` — never through systemd), then checks the feeds and
lists anything that keeps restarting.

```sh
cd ~/Tade-desk-server && ./deploy-tools.sh
```

Run it outside market hours: it stops the tools while it works.

For a small change during the day, a pull and a restart of just what changed:

```sh
cd ~/Tade-desk-server && git pull
pm2 restart qp journal tool-T1 tool-T2 tool-T6 tool-T7 tool-T11
```

**Never `pm2 restart all`.** It restarts STOPPED processes too, and brings a
retired tool back to scanning.

Add `archive` when `tools.config.json` changed. The journal is in this repo
(`journal/`) and `./deploy-tools.sh` starts it with everything else. The first
time, it copies the database and the Alpaca accounts from the old separate
install (`~/journal-app/data`) into `data/journal/`; the old copy is left where
it was, as a backup.

`desk.js` and `desk.css` are served `no-cache` by every process, so a pull is
enough — the browser asks rather than using what it has. See
`src/utils/sharedAssets.js`.

## qp

qp has a config file rather than a command line, because its guard rails
(`min_uptime`, `max_restarts`) do not exist as command-line flags — pm2 answers
``unknown option `--min-uptime` `` and starts nothing.

```sh
pm2 delete qp
pm2 start deploy/qp.config.js
pm2 save
```

After that `pm2 restart qp` is enough. It waits up to 60 seconds for port
8765 to come free — a restart hands over and the old process takes a moment to
let go — and refuses with a named reason if it does not.

## The two supervisors

**pm2 supervises every long-running process. systemd only runs qp's scheduled
jobs.** On 2026-09-23 qp was found under both: systemd's copy held port 8765
and pm2 relaunched its own copy once a second for two days (113,854 restarts),
a full core of a two-core box. Every unit that supervised a desk process is
disabled, and nothing in this repo installs one any more:

```
trade-screener.service   disabled
trade-scorer.service     disabled
trade-desk.service       disabled
qp-chart.service         disabled     ← disabled 2026-09-23
```

If a port is ever contested again, the question is *who is the parent*:

```sh
sudo ss -ltnp | grep <port>       # the PID holding it
ps -ef | grep '[c]hart.server'    # PPID 1 = systemd, otherwise pm2
systemctl list-unit-files | grep -iE 'qp|chart|trade|screener'
```

Still in use, and not supervising anything pm2 supervises
(`quant-platform/deploy/`):

```
qp-backfill.service      one-shot backfills
qp-daily.service/.timer  the daily job
```

## Login

Every program — the screener tools, the archive, the journal and qp — asks for
one password. Set it (or change it) on the box:

    ./scripts/set-password.sh

It writes `data/auth.json` (mode 0600, never committed, never backed up): a
scrypt hash of the password and a signing secret. Signing in on any program
signs you in on all of them for 30 days — the cookie is shared across ports.
Changing the password signs every browser out. `/logout` on any program signs
you out.

With no password set, every program is **locked** to everyone but the box
itself, and the deploy says so. The programs' own calls to each other over
localhost (qp reading registers, the backup, the deploy's health checks) never
need it. The desk is plain http, so the password crosses the network
unencrypted — put it behind https (or keep the ports closed to everyone but
you) if that matters for where you use it.

## Backups — Cloudflare R2

`scripts/backup-r2.js` runs nightly under pm2 as `r2-backup` (weekdays 23:20
UTC, and once at each deploy). It uploads a consistent copy of every SQLite
database — each screener tool, the journal, qp's strategies and backtests —
and the shared `data/*.json` files to `daily/<date>/`, keeps the first backup
of each month under `monthly/`, and writes each tool's registers as CSV under
`analysis/<tool>/<REG>/<date>.csv.gz` for analysis. Key files are never
uploaded.

```sh
bash scripts/set-r2-keys.sh                    # once: saves data/r2.json (0600) and tests it
node scripts/backup-r2.js --all-dates          # once: backfill every past register day
node scripts/restore-r2.js 2026-10-02          # list a night
node scripts/restore-r2.js 2026-10-02 data/t2.db   # fetch into restore/, never over data/
```

Retention is a bucket setting: an R2 lifecycle rule on `daily/` (60 days
recommended). **`docs/BACKUPS.md`** has the whole structure: the bucket layout,
the manifest, what is never uploaded, the monthly retry, and step-by-step
restores.

## Notes

- **Keys** live in files, not in the environment: `data/keys.json`,
  `quant-platform/.env`, `~/trade-desk.env`; the journal's Alpaca accounts in
  `data/journal/journal-accounts.json` (mode 0600). All gitignored.
- **Small host.** Two cores. It is enough, and it is only enough while nothing
  is spinning: one process in a restart loop is a measurable share of a
  decision that has to land inside the minute it decides for.
- **A restart count is a health metric.** Every process here should sit in
  single digits. Five figures beside `online` is a process that has never
  started, and it will not tell you so on its own.
