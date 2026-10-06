# The Monitor tab and the job list

What runs on a screener tool by itself, when, and how to see and change it.
Written from `src/scheduler.js`, `src/routes/monitor.js` and
`src/pipeline.js` (`getScanStatus`).

Related: what each scan does (`docs/DATA-PIPELINE.md`), what the captures
freeze (`docs/REGISTERS.md`), the settings these jobs read
(`docs/SETTINGS.md`).

---

## The tab

Two sections:

| Section | Shows |
|---|---|
| **Scheduled Jobs** | one row per job: name, schedule, on/off, when it last ran, how long it took, ok or the error. Per row: **toggle**, **edit schedule**, **reset to default** |
| **Last Pipeline Run** | the last scan: when, rows found, whether one is running now, its error, and its report (stage by stage) plus when the live cards were last refreshed. If the tool is paused, when and why |

Both come from one call, `GET /api/monitor`:

```json
{
  "pipeline": { "paused", "pausedAt", "pausedReason", "lastRun", "lastRowCount",
                "running", "error", "lastReport", "lastRefresh" },
  "jobs": [ { "jobId", "name", "defaultSchedule", "schedule", "timezone",
              "enabled", "lastRunAt", "lastStatus", "lastError", "lastDuration" } ]
}
```

---

## The jobs

All times are New York time (`America/New_York`). `1-5` = Monday to Friday.

| Job | Default schedule | What it does |
|---|---|---|
| Discovery — Pre-Market (04:00–09:00) | `*/30 4-8 * * 1-5` | a full scan every 30 min |
| Discovery — Open (09:00–10:00) | `*/5 9 * * 1-5` | a full scan every 5 min |
| Discovery — Session (10:00–16:00) | `*/15 10-15 * * 1-5` | a full scan every 15 min |
| Discovery — Close (16:00) | `0 16 * * 1-5` | one last full scan |
| Refresh — Live Card Data (04:00–16:00) | `*/5 4-16 * * 1-5` | re-quotes the cards already found; adds nothing new |
| Shortlist Auto-Rule HH:MM | one minute before R1 | stars the top cards by score (`docs/SETTINGS.md`); needs the scorer (D-D1) |
| R1 Capture HH:MM | the tool's capture time (default 09:36) | freezes the photo (R1) |
| R2 Snapshot 9:26–9:56 AM | `26,31,36,41,46,51,56 9 * * 1-5` | an open-range snapshot every 5 min |
| R2 Snapshot 10:01 AM | `1 10 * * 1-5` | the eighth and last R2 snapshot |
| R3 EOD Capture 4:05 PM | `5 16 * * 1-5` | the day's outcomes (R3) and the joined R4 |
| Scorer Auto-Train 4:20 PM | `20 16 * * 1-5` | retrains the tool's scorer on all R4 history; skipped when there are not enough rows or the scorer is off |
| Midnight r0 Flush | `0 0 * * *` (every day) | empties today's live list (r0) |
| Apply tool schedule changes 4:50 PM | `50 16 * * 1-5`, **T1 only** | restarts the tools whose capture time was changed during the session (`docs/TOOL-LIFECYCLE.md`) |

What a full scan and a refresh do: `docs/DATA-PIPELINE.md`.

### Rules around the jobs

- **A paused tool skips scans.** A full scan or refresh on a paused tool
  returns at once and says it is paused; the captures still run on what is
  already in the list.
- **No overlap.** A scan that starts while another is running is skipped
  (`Scan already running`); a refresh during a scan is skipped too.
- **Errors are logged with the stack**, not just the message, so a job that
  fails every five minutes can be traced to a line.
- **R1 needs the screeners awake.** The capture time is set per tool so the
  photo is taken while that tool's screeners can have found something (D-S9
  is the T6 case where it is not).

---

## Changing a job

| Action | Route | Effect |
|---|---|---|
| Toggle | `POST /api/monitor/jobs/:jobId/toggle` | on ↔ off; an off job keeps its row and schedule |
| Edit schedule | `POST /api/monitor/jobs/:jobId/schedule` body `{ "schedule": "<cron>" }` | refused unless the cron expression is valid; applies at once |
| Reset | `POST /api/monitor/jobs/:jobId/reset` | back to the default schedule |

### What is kept, and where

- **Kept across restarts** (table `scheduler_jobs` in the tool's database):
  each job's schedule and on/off.
- **Lost on restart** (memory only): last run, status, error, duration.
- **A job's id is its name, slugified** (`R1 Capture 09:36` → `r1-capture-09-36`).
  So when a tool's capture time changes, the R1 and Auto-Rule jobs get new
  names and new ids: they start from their defaults, and a custom schedule or
  "off" set on the old ids is dropped. Rows left behind by renamed jobs are
  deleted at startup.

---

## Reading it

| You see | It means |
|---|---|
| Discovery rows ok, `Last Pipeline Run` recent | the tool is scanning |
| Every row ok but no cards | screeners matched nothing; check the screener windows and the floor |
| `paused` with a reason | someone paused it (`docs/TOOL-LIFECYCLE.md`); resume on the Settings tab |
| Auto-Train "skipped" in the log | not enough R4 rows yet, or the tool has no scorer |
| Last run empty after a restart | normal: run history is memory only |
