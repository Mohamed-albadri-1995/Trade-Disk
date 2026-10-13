# Trade capture and acquisition

**Above:** [JOURNAL.md](JOURNAL.md) §3 and [REVIEW.md](REVIEW.md) §9.

## 1. Purpose

Define how a trader gets real trades into the Trading Journal without making the user fight with broker-specific export formats. The legacy import methods, parser assumptions and import-page design are not requirements for the new product.

**Decision:** the existing import-method design is being replaced. Do not implement the old TradingView/TTP/DXtrade-specific flow merely because it exists in legacy code. The new user-facing methods will be selected after the capture experience is designed.

## 2. Requirements that must survive the redesign

Regardless of the eventual capture methods, every path must create or update the same canonical trade/fill model and use the same pairing and validation logic.

- Support manual trade entry for traders who do not connect a broker or have a file.
- Support a broker/account connection or another low-friction acquisition path when technically and commercially appropriate.
- Support a file-based fallback if it materially helps the target users; exact formats and UX remain undecided.
- Preserve account/source provenance and source identifiers.
- Handle long and short positions, scale-ins, scale-outs, partial fills, partial exits, reversals and positions that remain open at the end of a capture batch.
- Use weighted average entry and exit prices based on actual fill quantities.
- Do not silently discard unmatched fills, open positions, rejected rows or records that cannot be paired.
- Reprocessing the same source data must be idempotent: update or recognize existing records rather than duplicate them.
- Show a clear review/confirmation step when ambiguity could change the trade result.
- Keep the original source record or a safe normalized representation sufficient for troubleshooting.
- Record fees by fill when available. If fees are estimated from a fee profile, mark them as estimated.
- Use full timestamps with timezone/offset semantics; do not infer an exit date from an entry date.
- Never fabricate stops, targets, notes, setups, fill prices or other missing facts.

## 3. Candidate acquisition approaches to evaluate

These are options to evaluate, not final decisions:
1. **Fast manual entry** — optimized for a trader entering a trade in seconds, with optional advanced fields.
2. **Broker connection/sync** — account connection, explicit permissions, connection test, last-sync status, and review of newly detected trades.
3. **Standardized file upload** — detect a supported format, preview parsed records, identify issues, confirm, then show an import report.
4. **Structured paste or template** — a lightweight fallback for trades copied from another platform.
5. **API or webhook integration** — a later option for advanced users, only if security and maintenance costs are justified.

Do not commit to all five. Compare effort for the trader, supported coverage, reliability, maintenance burden, security and ongoing provider costs before selecting launch methods.

## 4. Proposed capture flow

1. Choose a capture method.
2. Provide or select the account and time zone where needed.
3. Preview the detected trades and fills before committing.
4. Show warnings for missing prices, unknown fees, ambiguous pairing, missing exit timestamps and duplicate source IDs.
5. Let the trader resolve ambiguity or skip a specific record intentionally.
6. Save valid records through the common pairing/validation engine.
7. Show a result summary: added, updated, already known, still open, needs review, and rejected—with a reason for each rejected record.
8. Provide links to the saved trades and the data-quality report.

The flow must be practical on Android, not just desktop.

## 5. Manual trade form

Minimum useful fields:
- Symbol.
- Direction: long or short.
- Entry timestamp and average/entry price.
- Exit timestamp and average/exit price, optional for an open trade.
- Quantity.
- Account (optional for a user with no accounts configured).
- Fees, if known.
- Setup, stop, target, tags and notes as optional fields that can be added progressively.

Advanced fields can include individual fills, planned entry/exit, initial risk, trade thesis, execution notes and custom tags. Defaults must never create false historical facts. Stop and target are separate concepts; the stop used for initial R must be preserved.

## 6. Canonical pairing and validation rules

- One shared engine processes manual entry, broker sync and file/paste input.
- A position is assembled from fills with stable identifiers and explicit allocation rules.
- Scale-ins change weighted average entry; scale-outs allocate realized P&L and fees correctly.
- A reversal closes the prior position and opens a new position in the opposite direction.
- Open positions remain visible and are not reported as closed trades.
- A record missing enough information to calculate realized P&L remains flagged incomplete instead of being assigned a fabricated result.
- Validate quantity, price, timestamp order, direction, currency and fee units.
- Duplicate detection uses source/account identifiers where available and a conservative fingerprint fallback; uncertain matches go to review instead of silently merging unrelated trades.
- All timestamps are stored as unambiguous instants and displayed in the chosen timezone.
- Pairing outcomes and parser decisions must be covered by automated tests.

## 7. Import/capture report

The result screen should report:
- Source and account.
- Time range covered and last successful sync.
- New trades, updated trades, known duplicates, open positions and records needing review.
- Rejected records with row/fill reference and a plain-language reason.
- Fees found, fees estimated and fees missing.
- Link to retry or resolve problems.
- Never show a success message based only on the number saved if records were dropped or left unmatched.

## 8. Security and privacy

- Broker secrets are stored server-side, protected, and never returned to the browser after saving.
- Explain requested permissions and provide disconnect/revoke controls.
- Do not request order-placement permissions for a journal that only reads trades.
- Avoid logging secrets or full sensitive broker payloads.
- Make account removal and data deletion behavior explicit.

## 9. Open decisions

Before implementing acquisition methods, choose:
- Which connection provider(s), if any, are feasible for the first release.
- Which broker or platform integrations have enough demand to justify maintenance.
- Whether a standardized file fallback is needed for launch and which formats are worth supporting.
- What the fastest useful manual entry should look like on a phone.
- What review behavior is required for ambiguous round trips.

Until these decisions are made, the acquisition UI is a design task, not a fixed implementation specification.
