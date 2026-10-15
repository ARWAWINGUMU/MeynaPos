# Open Sales

Open sales are stored in `open_sales` and `open_sale_lines`, separately from charged `sales`.
They never reserve stock or affect financial reports. `DRAFT` and `HELD` remain editable;
`COMPLETED` links to exactly one charged sale; `CANCELLED` remains an audit record.

Prices, tax and currency are snapshots. Checkout rejects changed prices, tax or currency until
the cashier explicitly accepts current values. Missing/inactive products, insufficient stock
and invalid discounts must be corrected. Notes and customer selection belong to each open sale.

Updates require the saved version. PostgreSQL row locks serialize changes to the same draft.
Checkout locks products in a consistent order and conditionally decrements inventory inside
the same transaction as the sale, payment and draft completion. The draft UUID is the checkout
idempotency key: retrying after an uncertain response returns the original charged sale.
Cashiers access their own drafts; administrators can manage all drafts without transferring ownership.

The UI queues automatic saves, keeps local edits on conflicts/network failures, displays pending
save status and warns before unloading unsaved work. Internal link navigation waits for saving.
Reloading the saved version requires explicit confirmation when local edits may be discarded.
Offline edits cannot be guaranteed after forcibly closing a browser before saving succeeds.

Creating a new sale automatically saves the previous workspace; no pause action is
required. Names are persisted in PostgreSQL, may repeat and are independent of UUID
identity. Default Venta N numbers are allocated by the database without concurrent
collisions. Per-tab options rename or confirm cancellation of a pending sale.
Services retain sold quantities and totals without stock checks or deductions.
See [FUNCTIONAL_UPDATES.md](FUNCTIONAL_UPDATES.md) for endpoint/migration contracts and
[TESTING.md](TESTING.md#test-matrix) for executed scenarios and known limitations.

## Verification

- `docker compose exec -T backend pytest`
- `docker compose exec -T backend sh -c 'OPEN_SALES_POSTGRES_URL="$DATABASE_URL" pytest app/tests/test_open_sales_postgres.py -q'`
- `docker compose build frontend`
- With frontend development dependencies installed, start Vite and open `/tests/openSales.browser.html`.
  The browser test uses a fake API and a test-only login on that development origin; do not run it
  in a browser profile containing a real session for the same origin. A `data-test-status="passed"`
  result verifies tab isolation, saving, reload, conflicts, offline retries, creation/checkout retries,
  cancellation and React StrictMode. Add `?preview=1` for visual inspection with test data.

PostgreSQL tests require an explicit development/test connection and create/drop only their own
randomly named schemas. They exercise real concurrent transactions and reconnect persistence.
They do not reset application databases or use SQLite as evidence of PostgreSQL locking behavior.
