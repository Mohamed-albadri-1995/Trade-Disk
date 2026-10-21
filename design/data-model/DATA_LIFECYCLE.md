# Trade-Disk — Ingestion, Enrichment, Materialization and Read Lifecycle

## 1. Logical pipeline

```text
Raw stock discovered
        |
        v
Raw observation + ingestion event
        |
        v
Identity normalization + sector/group mapping
        |
        v
Source facts stored (quote, bars, shares, fundamentals, news/events)
        |
        v
Domain enrichers / approved calculation modules
  |             |              |               |
  v             v              v               v
Technical     CAN SLIM      Market model    Fundamentals/news
snapshot      snapshot      + sector rows   snapshot
  |             |              |               |
  +-------------+--------------+---------------+
                      |
                      v
        Stock-specific sector context projection
                      |
                      v
       Build/version frontend read snapshots
       (stock card, technical, fundamental, market)
                      |
                      v
        Publish complete snapshot atomically
                      |
                      v
          Pre-evaluated screener run/results
                      |
                      v
          Frontend reads prepared records
```

The upstream process and provider are intentionally outside this design. The important contract starts when the raw stock is discovered and registered.

## 2. Raw insertion is not frontend readiness

A row in the raw/universe table means “we know this instrument exists / was observed,” not “every UI field is ready.” Track readiness at a snapshot/domain level. For example, quote and technical data may be available while annual fundamentals or news are unavailable. The UI should return a coherent card with explicit missing-data states instead of blocking all fields or fabricating values.

## 3. Materialize what the UI reads

When a stock enters or changes, build the current read models for that stock:

- compact stock-card payload (header, card metrics, small chart preview, tags, relevant news previews, CAN SLIM summary, stock-specific sector context);
- technical page snapshot for the supported default timeframe(s), with parameters included in indicator identity;
- fundamentals/news read snapshot;
- links to the applicable broad-market snapshot and stock sector/group mapping;
- screener membership/results when a screener evaluation is triggered.

Market-wide data is its own shared snapshot, not copied into every stock's source tables. Stock card materialization may copy a few values from that market snapshot into a stock-context projection for quick reads, but it must retain the exact `market_snapshot_id`/sector row ID that produced them.

## 4. Dependency invalidation

When a dependency changes, mark dependent projections stale and rebuild them:

- quote/bar update → stock quote/card and affected technical indicators, ranges and screener results;
- float/share facts update → stock card, supply/demand evidence and screeners that use those fields;
- fundamental period update → fundamental read snapshot and any CAN SLIM factors that depend on it;
- news/event update → stock news preview, full news snapshot and catalyst-based screener results;
- stock sector mapping change → stock-specific sector context and any sector-dependent screener results;
- new market snapshot or sector row → Market dashboard and stock-specific context projections for stocks mapped to affected sectors;
- screener definition/filter/window change → config version increments; previous run results remain tied to old config version until a new run occurs.

The exact cadence, queue, retry policy and stale-data SLA are intentionally deferred. Schema should support them without changing the read contract.

## 5. Consistency / atomic publication

Do not update a live read model field-by-field while the frontend is reading it. Build a new snapshot bundle with a new ID, validate required references, then publish/switch the current pointer in one transaction or equivalent atomic operation. Include `published_at`, domain `as_of`, source status, schema version and upstream snapshot references.

If two data domains have different as-of times, preserve both. A quote from 15:30 ET and fundamental data from the last reported quarter are not expected to share a timestamp.

## 6. Screener semantics

Selecting `T1` must resolve to a stable `screener_id`, its versioned definition, filter tree, visible columns, sorting preferences, schedule windows, and latest `screener_run_id`. Results should be persisted as rows that reference both the stock and the stock-card snapshot used during evaluation. That way the result card does not accidentally combine a score/rank from one evaluation with a newer price from an unrelated snapshot without a visible update policy.

The run interval and windows are configuration only until a scheduler/worker actually executes them. A saved schedule is not evidence that a run occurred. Record every actual run and its status separately.

## 7. Performance principles

- Index current snapshot pointers by stock/screener/market IDs.
- Index result rows by run ID + rank/sort key and stock ID.
- Read one prebuilt card snapshot instead of joining every domain table per card.
- Paginate screener and industry-group results with stable ordering.
- Cache/serve Market dashboard by `market_snapshot_id`; do not recompute sector rows for each stock request.
- Use explicit snapshot references to debug a bad card and reproduce exactly what was shown.
