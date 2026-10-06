# The design leaves

One document per domain of the [architecture](../ARCHITECTURE.md). The
[document map](../ARCHITECTURE.md#12-the-document-map) lists every leaf, the
trunk section it belongs to, and the legacy documents it builds on.

Each leaf has the same five parts:

1. **Its place in the trunk**: the section it details, and the domains it
   talks to.
2. **The legacy design, in full**: every field, source, calculation and rule
   the old desk had, so nothing it knew is lost.
3. **What failed**: the faults found in the 2026-10 review, by ID.
4. **The new design**: how it is built, and why.
5. **Contracts**: the tables, fact families and routes it owns or reads.
