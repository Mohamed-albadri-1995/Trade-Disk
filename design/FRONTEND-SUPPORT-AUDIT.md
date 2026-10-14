# Does the design support the front end? — a 3-tool reconciliation audit

**What this is.** A design-support audit for the approved Trade-Disk front end,
covering all three tools — **Journal**, **Lab (qp)** and **Radar**
(screener + stock-analysis). It answers one question: *do the current design
documents support what the front end must show, store, update and persist* —
and where they do not, it names the smallest justified change.

**What it reconciles.** Three sources of truth, checked against each other:
1. the **front end** (the built pages + the uploaded approved package: the
   requirements freeze, the mockups, the field catalog);
2. the **repo design tree** (`ARCHITECTURE.md` + `design/**`);
3. the uploaded **data layer** (`database/`: `DATA_LIFECYCLE`, `FRONTEND_DATA_MAP`,
   `SCHEMA_DRAFT`, `schema.sql`, `FRONTEND_FIELD_CATALOG`).

This is an audit, not a doc edit. No design document is changed by it. The
edits it proposes are listed in §7 and happen only after you agree.

---

## 1. Verdict at a glance

| Area | Does the design support the front end? | The gap |
|---|---|---|
| **Journal** | **Yes** — the most mature tool. | Minor: confirm the review tabs' fields all have a producer. |
| **Lab (qp)** | **Yes.** Chart, library, strategy grammar, backtest, feeds are all specified and match the built prototype. | Minor: the strategy builder's expressiveness is aligned with `STRATEGIES.md`; nothing missing. |
| **Radar — fields & data lifecycle** | **Mostly yes.** The card, market read, registers, screeners and the uploaded schema cover the fields and the fetch→store→show→update→persist cycle well. | The 4-tab **analysis workspace** (Technical / CAN SLIM / Fundamental·Market·News) shows **more detail than `CARD.md` documents** (full fundamentals, valuation, multi-timeframe, pattern/levels). Needs a read-model doc. |
| **Radar — architecture** | **No, not as written.** | The design is a **single-user personal box**; the front end + your commercial plan need **accounts, an admin dashboard, hosted multi-user, and swappable licensed providers**. This is the headline finding (§3). |
| **Admin dashboard** | **No** — does not exist in any doc. | New design area (§5). Seeds exist (Settings keys, the health page). |
| **Data lifecycle** | **Strong.** The combined design (adapters → facts/snapshots → atomic publish → UI reads) is coherent and honest. | A few things to make explicit (§4). |

**Bottom line:** the design supports the front end at the **field and
data-flow level** for all three tools. The real work is an **architectural
evolution** from a personal desk to a commercial, multi-user, hosted platform —
which the existing building blocks were, fortunately, well-chosen to allow.

---

## 2. Method — what I checked

For each tool I traced every frontend surface to a producer and a store:
front end field → read model → canonical fact → source adapter → persistence.
The uploaded `FRONTEND_DATA_MAP.md` already does most of this mapping, and it
agrees with the repo's `CARD.md`, `MARKET.md`, `REGISTERS.md`, `SCREENERS.md`
and `DATA-SOURCES.md` on the important rules (honest nulls, one producer per
fact, no frontend computation, screener identity/versions, time-aware facts).
That agreement is why the verdict is mostly green.

---

## 3. The central finding — personal desk → commercial platform

The repo's top-level design is, by its own words, built for one person:

> *ARCHITECTURE §2:* "one trader → **one login; no accounts or roles**; simple
> beats scalable" · "one small server with 1 GB of memory" · "free data".

The front end you approved, and the plan you stated (personal now, **commercial
later, swap data sources from an admin dashboard**), need the opposite on four
axes:

| Axis | Personal desk (today's design) | Commercial platform (where the front end points) |
|---|---|---|
| **Identity** | one login, no accounts/roles | accounts, auth, **admin vs user roles** |
| **Storage** | each tool's **file on the box** is the record; the shared-record (Postgres) is a *copy* | a **hosted relational DB is the record** (your `schema.sql`); no per-box files |
| **Data sources** | free/unofficial (TradingView scrape, Yahoo), fine for personal | **licensed** feeds for commercial; swap by config from the admin dashboard |
| **Deployment** | one 1 GB box | hosted, scalable, multi-tenant |

**This tension is resolvable, and cheaply, because the pieces already fit:**

- The design **already uses Postgres** (the shared record) and **already names
  "hosted DB" as an open decision** (ARCHITECTURE §10, SHARED-RECORD §3.7). Your
  uploaded `schema.sql` is essentially *the shared record promoted to be the
  primary store* — the natural commercial form.
- **Adapters already abstract every provider** (`DATA-SOURCES.md` §3.1), with
  **keys set and tested in Settings** (fixes legacy D-T4) and **fallback orders**.
  That is 80% of "swap the data source from the dashboard."
- The **snapshot / read-model** idea in your `DATA_LIFECYCLE.md` (atomic publish,
  dependency invalidation) is the same shape as the registers' **photo (R1)** and
  the **materialized read** the shared record already serves "as of a day."

**Recommended framing:** treat the personal box as **one deployment mode**
("self-host / solo") and introduce a **"hosted / multi-tenant" mode** as the
commercial target. Most block docs stay true; the deltas are identity, where the
record lives, and provider licensing. This keeps the honest-data and
one-producer invariants intact while making the product sellable.

---

## 4. Data lifecycle — the "sensitive" part, assessed

You flagged that fetch → put-in-tables → show → update → save-permanently is
sensitive, especially for Radar's many fields. The combined design handles this
**well**; here is the assessment and the few things to make explicit.

**Already solid (keep):**
- **One adapter per source**, honest null (`unavailable` + reason), no
  overwrite, call counts — `DATA-SOURCES.md` §3.
- **Write path vs read path** separation; the UI reads **prepared snapshots**,
  never joins raw tables or computes — `FRONTEND_DATA_MAP.md` §1, matches the
  registers' photo model.
- **Atomic snapshot publication** (build a new `snapshot_id`, validate refs,
  switch the current pointer in one transaction) — `DATA_LIFECYCLE.md` §5. This
  is the key rule that keeps a card from showing a new price with a stale score.
- **Time-aware everything:** per-domain `as_of` + `published_at` + `source_status`
  + `is_stale`; a quote and a fundamental are not forced to one timestamp.

**Make explicit (small additions):**
1. **Adopt the snapshot/read-model vocabulary into the repo.** `CARD.md` and
   `REGISTERS.md` describe the photo (R1) but not the *live* `stock_card_snapshot`
   read model the front end reads between photos. Name it and its coherence rule.
2. **Dependency invalidation / refresh cadence** is `TBD` in both the package and
   the repo. That is acceptable for design, but the admin dashboard will need a
   place to see/trigger refresh and view staleness.
3. **Screener run vs schedule.** Both agree a saved schedule ≠ a run happened,
   and results reference the snapshot they were evaluated against. Keep this —
   it is exactly right and prevents the "new price, old rank" bug.

---

## 5. New design areas (not in any current doc)

These are genuine gaps for the commercial product. Each needs a short new doc or
a named section.

| New area | Why | Where it should live |
|---|---|---|
| **Accounts, auth, roles** | multi-user commercial; admin vs user | new `design/13-accounts/ACCOUNTS.md` |
| **Admin dashboard** | manage providers, keys, feature flags, thresholds, health, (later) plans/billing; make changes without code | new `design/14-admin/ADMIN.md` |
| **Provider abstraction + licensing** | swap free→licensed by config; record each provider's commercial-use terms | extend `DATA-SOURCES.md` (provider registry + licensing flags + runtime selection) |
| **Hosted deployment / tenancy** | the record lives in a hosted DB, not box files; data isolation per tenant | extend `ARCHITECTURE.md` §8 + `SHARED-RECORD.md`/`FILES.md` |
| **Canonical data model** | adopt your `schema.sql` as the design's data model, reconciled with the shared-record tables | new `design/DATA-MODEL.md` (or fold `schema.sql` in) |

**Licensing reality to record now:** TradingView's scanner is unofficial
(ARCHITECTURE §11 already flags this) and Yahoo is not licensed for commercial
redistribution. The admin "swap source" is the right mechanism, but going
commercial means selecting **licensed** providers (Polygon, Alpaca, paid news,
etc.). The design should carry a per-provider "ok for commercial?" flag so the
dashboard can refuse an unlicensed source in commercial mode.

---

## 6. Approved-freeze conflicts to resolve in the docs

The uploaded `STEP_1` freeze lists these; they are **small doc edits**, not
redesigns:

1. **Overview has no Score Breakdown** (removed, must not return) — `CARD.md`
   describes the card's folds but not the analysis-workspace Overview; when the
   analysis-workspace read model is documented, exclude Score Breakdown.
2. **Overview sections carry no numbers.**
3. **Navigation:** Screener + Shortlist (bottom), Market + Settings as separate
   destinations, the 4-tab analysis workspace; no News/More tabs. Record this in
   `PAGES.md` (which today describes the desk tool's 8 tabs, a *different*
   surface — see §8).

---

## 7. Proposed design-doc changes (smallest justified)

Only after you agree. In dependency order:

1. **`ARCHITECTURE.md`** — add "deployment modes" (solo-box vs hosted
   multi-tenant); soften §2's "no accounts or roles" to "no accounts in solo
   mode; accounts/roles in hosted mode"; name the commercial target.
2. **`design/DATA-MODEL.md`** (new) — adopt `schema.sql`/`SCHEMA_DRAFT` as the
   canonical relational model; map each table to its repo owner; mark read-model
   (snapshot) tables vs canonical tables.
3. **`DATA-SOURCES.md`** — add a provider registry, per-provider licensing /
   commercial-use flags, and runtime provider selection (the swap), driven from
   the admin dashboard; keep the adapter contract as-is.
4. **`design/13-accounts/ACCOUNTS.md`** (new) — identity, auth, roles, tenancy,
   per-user data (shortlists, custom screeners, journal accounts).
5. **`design/14-admin/ADMIN.md`** (new) — the admin dashboard: providers & keys,
   feature flags, thresholds, health/jobs, (later) plans/billing.
6. **`CARD.md` + `PAGES.md`** — document the **analysis-workspace read models**
   (Overview compact card, Technical, CAN SLIM, Fundamental·Market·News) and the
   approved navigation; resolve the freeze conflicts in §6.
7. **`SHARED-RECORD.md` / `FILES.md`** — state that in hosted mode the relational
   DB is the record (not a copy of box files); keep solo mode as-is.
8. **`REGISTERS.md`** — name the live `stock_card_snapshot` read model alongside
   the photo (R1), with the atomic-publish coherence rule.

Everything else in the design tree stays as written.

---

## 8. Open questions — decisions only you can make

These gate the doc updates. My recommendation is in **bold**.

1. **Target shape:** keep the personal box *and* add hosted/commercial as a
   second mode (**recommended**), or pivot the design fully to hosted-first?
2. **Accounts now or later:** design accounts/roles now so the build doesn't
   need reworking (**recommended: design now, build when needed**), or defer
   entirely until after Journal + Lab ship for personal use?
3. **Primary store:** adopt your `schema.sql` relational DB (Postgres/Supabase)
   as the canonical record for the hosted build (**recommended**), or keep the
   tool-file + shared-record split and only grow the shared record?
4. **Commercial data provider:** which licensed feed is the intended commercial
   source (Polygon? Alpaca? a paid aggregator)? Affects the provider registry and
   what the admin swap offers.
5. **The learning model in multi-user:** the desk's "each tool is an isolated
   experiment; results never shared" is core to the personal design. In a
   commercial product, is that still per-user, or do shared/curated screeners
   exist? (**recommended: per-user by default; optional shared/curated later.**)

---

## 9. Status

| Part | Status |
|---|---|
| audit of the 3 tools against the front end + data layer | **done** (this document) |
| reconciliation of storage/accounts/admin | **proposed** (§3, §5, §7); awaiting the §8 decisions |
| the design-doc edits | **not started**; begin after agreement |
