# Frontend design handoff

This branch is the working handoff point for the next design-document agent.

## Read in this order

1. [Frontend requirements and agent handoff](FRONTEND_REQUIREMENTS_AND_AGENT_HANDOFF.md) — frozen requirements baseline, ownership rules, required reconciliation and acceptance checklist.
2. [Repository architecture](../ARCHITECTURE.md) — system-wide boundaries and invariants.
3. [Design tree](../design/README.md) — index of architecture documents.
4. [Frontend design](../design/02-front-door/FRONT-END-DESIGN.md) — current documented homepage/frontend entry.
5. [Card contract](../design/03-desk/tool/CARD.md)
6. [Market reader](../design/03-desk/MARKET.md)
7. [Registers](../design/03-desk/tool/REGISTERS.md)
8. [Shared Record](../design/09-shared-record/SHARED-RECORD.md)
9. [File ownership](../design/04-files/FILES.md)
10. [Screener builder](../design/03-desk/tool/SCREENERS.md) and [tool pages](../design/03-desk/tool/PAGES.md)

## What this branch does and does not contain

- It includes the repository's existing frontend/architecture documents plus the new explicit handoff contract.
- The handoff asks the next agent to reconcile the approved frontend against those contracts before changing them.
- It does not claim the design-document reconciliation is complete.
- The separate local prototype package previously prepared in the ChatGPT working environment is not copied into this repository branch in this commit. Before treating a specific prototype build as the visual source of truth, the owner/agent must confirm and attach that exact artifact to the repository.

## Agent completion report

The agent should report: changed paths; conflicts resolved; unresolved OPEN decisions; field/source/consumer matrix location; cross-reference/PDF validation; and any implementation deliberately left out of scope.
