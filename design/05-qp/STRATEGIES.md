# Conditions and Strategy Builder

Parent: [QP](QP.md). Front-end: [FRONTEND-DESIGN](FRONTEND-DESIGN.md). Canonical grammar: [legacy strategies](../../legacy/qp/STRATEGIES.md).

## Condition model

A condition is a canonical rule or nested group. Each row has left operand, operator, contextual parameters, right operand only when required, operand offset, rule-result offset, for-bars/within-bars timing, enable/disable and test actions.

Operands: approved primitive/output, price field, New York time field, constant, supported arithmetic expression, and trade-aware fields only for exit rules. Operators: gt, lt, ge, le, eq, neq, gt_pct, lt_pct, cross_above, cross_below, rising, falling, bounce_up and bounce_down. Unary operators must not show a meaningless right operand.

Groups: AND, OR, ATLEAST(k), THEN(window). Support nested groups, reorder, duplicate, disable, undo/redo, validate, save reusable condition and historical truth preview. Clicking a rule highlights its bars. Missing/warm-up/out-of-session values follow canonical evaluator semantics; do not substitute zero.

## Strategy editor

### Identity
Name, description, Long/Short, Development/Ready, intended tool IDs, immutable version and modified time. Validate tool IDs against the desk registry.

### Entry and exit
Entry uses nested rule groups. Exit supports documented trade-aware operands such as entry price, bars held and unrealized P&L. Trade operands are forbidden in entry rules.

### Risk and order plan
Expose only supported stop, target, scale-out, sizing, discipline, entry-window and end-of-day controls. Unsupported engine behavior must be unavailable with a reason, not approximated in the UI.

### Fill model and data requirements
Fill model is explicit. Carry the same semantics into chart preview, backtest and alerts. Show timeframe, session, feed capabilities and warm-up requirements.

### Validation and versions
Block malformed rules, unknown/unapproved primitives, incompatible types, invalid risk config, unknown tool IDs and unsupported options. Warnings explain sparse data, feed limits and unavailable historical facts. Saving a change creates a new immutable version; backtests retain the version they used. Ready is a user-controlled label, not a performance guarantee. No order placement controls.

## Acceptance

- [ ] All canonical operators use appropriate controls.
- [ ] Groups support AND, OR, ATLEAST and THEN.
- [ ] Entry/exit restrictions are enforced.
- [ ] T1/T2 IDs are validated.
- [ ] Save/version and run snapshots are explicit.
- [ ] Preview and backtest use the canonical evaluator.
