# 0008 — Running balances kept in step with append-only ledgers

**Status:** accepted

## Decision

Brick stock (`products.stockGood`) and raw material balances
(`raw_materials.quantityMilli`) are stored counters for fast reads, and every
change also appends a movement (`stock_movements`, `material_movements`) with
the balance after it. Both writes happen in one MongoDB transaction, through a
single function per ledger. Decreases are conditional updates
(`balance >= n` in the filter), so concurrent sales cannot oversell and
balances cannot go negative. Production and sales are voided with reversing
movements, never deleted.

## Consequences

Requires a replica set (also in development — see `docker-compose.yml`). The
ledgers make every number on the dashboard explainable line by line.
