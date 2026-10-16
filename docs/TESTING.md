# Functional Improvements and Verification

## Responsive Sales Feature Validation (2026-10-16)

This section supersedes the historical duplicate-label behavior in SALE-02 below.
See [RESPONSIVE_SALES.md](RESPONSIVE_SALES.md) for requirements, flows, endpoints,
migration preconditions and limitations. No production deployment was performed.

Commands used with existing dependency images, without changing dependencies:

- N1: `docker exec meynapos-sales-backend-qa sh -c 'OPEN_SALES_POSTGRES_URL="$DATABASE_URL" pytest -q --tb=short'`
- N2: `docker exec -w /app meynapos-functional-validation npm run test:catalog`
- N3: `docker exec -w /app meynapos-functional-validation npm run test:print`
- N4: `docker exec -w /app meynapos-functional-validation npm run build`
- N5: Chrome headless, `--window-size=1440,1100 --virtual-time-budget=20000 --dump-dom http://localhost:5188/tests/navigation.browser.html`; mobile/tablet use `?width=390` / `?width=768` isolated iframe CSS viewports.
- N6: Chrome headless, `--virtual-time-budget=30000 --dump-dom http://localhost:5188/tests/openSales.browser.html`.
- N7: `docker compose config --quiet`; `git diff --check`.

| ID | Module | Type | Scenario | Expected | Obtained | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NAV-01 | Shared layout | Browser integration | Desktop sidebar and preference | Initially visible; hiding releases width and saves preference | PASS at 1424 CSS px | PASS | N5, navigation.browser.tsx |
| NAV-02 | Shared layout | Browser integration | Mobile with visible desktop preference | Initially closed; overlay, Escape/focus restoration, backdrop and navigation close | PASS at 390 CSS px, including backdrop assertion | PASS | N5, ?width=390 |
| NAV-03 | Shared layout | Browser integration | Tablet | Closed initial drawer, focus/navigation, no horizontal overflow | PASS at 768 CSS px | PASS | N5, ?width=768 |
| NAV-04 | Sale menu | Browser integration | Menu inside overflow container | Portal anchored within viewport; rename action works | PASS desktop/mobile/tablet | PASS | N5 |
| PAY-01 | Payments | Browser integration | QR and administrator custom option | Select QR; create and immediately select custom method | PASS desktop/mobile/tablet using fake API | PASS | N5 |
| PAY-02 | Receipts | PDF unit | Custom payment snapshot and historical fallback | Print custom name; preserve legacy Cash label | 15 receipt cases passed | PASS | N3, receipt.test.mjs |
| CAT-06 | Sales catalog | Frontend unit | Category + search, uncategorized, service/depleted stock | Correct intersection; inventory restrictions remain separate | 4 catalog cases passed | PASS | N2, catalog.test.mjs |
| SALE-14 | Multisale | Browser integration | Autosave, reload, rapid edits, network/version conflicts, retries | Independent data; no duplicate charge/create | Harness PASS | PASS | N6, fake API and real useOpenSales |
| QA-03 | Frontend | Build | TypeScript and Vite | Successful production compilation | Successful; nonblocking large-chunk warning | PASS | N4 |
| QA-04 | Backend | Full regression | API, normalized/reusable labels, payment permissions/scope, concurrency, migrations | All cases pass sequentially | 111 passed, 0 skipped, 295.52 seconds; existing warnings remain | PASS | N1 |
| OPS-03 | Repository | Configuration | Compose and whitespace checks | Valid configuration; no whitespace errors | Passed, existing LF/CRLF notices | PASS | N7 |
| OPS-04 | Deployment | Production | Feature deployment to Render | Not part of this feature-branch task | Not executed intentionally | NOT RUN | PR review required |
| NAV-05 | Compatibility | Physical/browser matrix | Safari/Firefox, real touch devices | Compatible navigation | Not executed | NOT RUN | Chrome QA is not cross-browser/device proof |

An initial full backend attempt overlapped another pytest process using the same
SQLite fixture filename, causing missing-table/fixture failures. Those results
are invalid regression evidence; the final run is sequential. PostgreSQL checks
use isolated random schemas, never reset business data or PostgreSQL volumes.
Fresh and populated migrations were also executed independently: both passed.
No package installation, dependency update or production credentials were needed.

## Scope

These changes extend the existing implementation; earlier printing, notification
and open-sale work is preserved. The functional source was validated locally on
2026-10-15 before publication. Documentation edits do not constitute a fresh test
execution. No volumes were deleted and no completed-sale data changes or historical
migration edits are introduced by this release. Publication metadata belongs to Git
history; GitHub/Render outcomes are not inferred from local tests.

Detailed per-feature requirements, rules, modified components, models/migrations,
endpoints, flows and limitations are in [FUNCTIONAL_UPDATES.md](FUNCTIONAL_UPDATES.md).

## Delivery 1: Inventory Notifications

### Diagnosis and Decision

- `InventoryNotificationBell` requested `GET /api/notifications/inventory-alerts`
  every five seconds: 12 requests/minute/administrator, including hidden tabs.
- The repository selects active alerts joined to active products, not the complete
  catalog. Eager loading avoids N+1 queries. Product/active/read indexes and a
  partial unique active-product index already exist.
- The original GET also deleted expired rows and committed on every request.
- Inventory navigation received an ID but converted it into a barcode/name search;
  SKU was missing from the frontend's manual search criteria.
- Retain targeted HTTP polling rather than introduce a process-local WebSocket bus
  that cannot invalidate clients served by other workers. A reliable multi-worker
  push implementation would require an additional PostgreSQL notification listener
  and its reconnect/authentication lifecycle. No demonstrated full-catalog polling
  or N+1 issue justifies that infrastructure in this delivery.

### Changes

- ETag/If-None-Match returns an empty 304 when the authorized alert snapshot is
  unchanged. Responses are private and vary by Authorization; CORS exposes ETag.
- No overlapping polling requests; hidden tabs do not poll. Visibility, focus,
  online recovery and existing successful-mutation events refresh the snapshot.
- GET is read-only. Expired alerts are excluded immediately; the existing startup
  and hourly maintenance task physically purges records older than 15 days.
- Active conditions, read status, resolved episodes and retention remain distinct.
- `/inventario?productId=ID` selects the exact product, bypasses previous filters,
  highlights its card and offers a return to the full inventory. Missing/inactive
  targets show an explicit message. Manual search supports name, SKU, barcode, QR.
- Polling remains five seconds in visible tabs: another cashier's transaction can
  take up to one interval to appear. This is not cross-client instantaneous push.

### Files and Tests

Backend: `api/routes/notifications.py`, `services/inventory_alert_service.py`,
`repositories/inventory_alert_repository.py`, `main.py`, `tests/test_inventory_alerts.py`.
Frontend: `components/InventoryNotificationBell.tsx`, `services/notificationService.ts`,
`pages/InventoryPage.tsx`, `utils/catalog.ts`, `tests/catalog.test.mjs`.
No new migration for this delivery. Targeted backend: 15 passed. Catalog tests cover
exact IDs beyond a simulated first page, duplicate names and all search criteria.

## Delivery 2: Open Sales

- Existing UUID identity, snapshots, autosave, optimistic versions, owner checks,
  row locks and idempotent checkout are reused. Creating/selecting a sale already
  saves the previous workspace; changing tabs never reserves or deducts stock.
- Removed the redundant pause button. Tabs scroll horizontally and each has an
  options menu with rename and confirmed deletion. Deletion cancels the pending
  record for audit rather than deleting completed financial transactions.
- `PATCH /api/open-sales/{id}/name` accepts `{version, name}`; trimmed nonempty
  names have an 80-character limit. Repeated names are allowed. Closed/stale or
  unauthorized updates are rejected using existing guards.
- `0011_open_sale_names` adds persistent name/number fields and a database-number
  allocator. Concurrent cashiers cannot collide; sequence gaps are harmless.
- The cart's Cancel Sale button now uses the existing cancellation confirmation.

Files: backend `models/open_sale.py`, `schemas/open_sale.py`, `services/open_sale_service.py`,
`api/routes/open_sales.py`, migration `0011_open_sale_names.py`, open-sale tests;
frontend `hooks/useOpenSales.ts`, `services/openSaleService.ts`, `types/openSale.ts`,
`components/OpenSalesBar.tsx`, `pages/POSPage.tsx`, `tests/openSales.browser.tsx`.
Targeted backend: 17 passed. Chrome browser harness passed independent workspaces,
rename, autosave, reload, rapid edits, stale versions, offline retries, lost checkout
and creation responses, cancellation and React StrictMode. PostgreSQL tests include
parallel numbering, competing checkouts and persistence with a new connection pool.

## Delivery 3: Final Customer

- Existing generic identity is `document_number = 0000000000`, never its name.
- `0012_final_customer` renames that record to `Cliente final`; IDs and sales remain
  associated. Seed and fallback creation use the same identity and new label.
- Receipts/history continue using their existing customer relationships/snapshots;
  completed-sale fields are not rewritten. The POS helper text uses the new label.

Files: backend `database/seed.py`, `services/customer_service.py`, `tests/conftest.py`,
`tests/test_final_customer.py`, migration `0012_final_customer.py`; frontend `pages/POSPage.tsx`.
Targeted customer/category tests: 5 passed, including repeated default retrieval
without duplicates and a new sale selecting the original generic customer's ID.

## Delivery 4: Unified Product/Service Catalog

- `0013_catalog_services` adds validated `article_type: PRODUCT | SERVICE`, default
  PRODUCT for existing rows. ProductFactory and the existing catalog remain shared.
- Services can be sold in any positive quantity without stock checks or deductions.
  Decimal totals, discounts, taxes, receipt lines and history use the existing sale flow.
- New services do not create inventory rows. Converting a product to a service keeps
  existing stock records but resolves its alerts and excludes it from inventory,
  restocking, stock reports and dashboard stock indicators.
- Product edits lock stock rows to coordinate with checkout. Service inventory
  adjustments are rejected; converting back to PRODUCT reuses preserved stock.
- Catalog/scanned-product forms offer article type and hide service stock controls.
  Services stay in the sales catalog and show a service/non-inventory label.

Files: backend product model/schema/factory/service, sale/open-sale/purchase services,
inventory routes, dashboard service, report repository, inventory alert service,
`tests/test_catalog_services.py`, migration `0013_catalog_services.py`; frontend
`types/api.ts`, `services/productService.ts`, `utils/catalog.ts`, product/POS/inventory/
purchase pages. Targeted service tests: 4 passed; frontend catalog tests: 3 passed.

## Commands and Operational Results

```sh
docker compose exec -T backend pytest app/tests/test_inventory_alerts.py -q
docker compose exec -T backend pytest app/tests/test_open_sales.py -q
docker compose exec -T backend pytest app/tests/test_final_customer.py app/tests/test_customers.py app/tests/test_categories.py -q
docker compose exec -T backend pytest app/tests/test_catalog_services.py -q
docker compose exec -T backend sh -c 'OPEN_SALES_POSTGRES_URL="$DATABASE_URL" pytest -q'
npm run test:catalog
npm run test:print
npm run build
docker compose build backend frontend
docker compose config --quiet
git diff --check
```

Frontend commands ran in an isolated Node validation container with dependencies.
Catalog: 3 passed; printing: 14 passed; TypeScript/Vite builds passed. Both Docker
images built successfully. Compose configuration validated. `docker compose up -d
--no-build` started the new backend/frontend images using the existing PostgreSQL
and media volumes; all three services are healthy and backend startup logs are clean.
No physical printer was tested. Vite's large-chunk warning remains nonblocking.
The Docker npm install reported 13 dependency advisories; dependency upgrades are
outside this change and require a dedicated compatibility/security review.

## Initialization Correction and Remaining Verification

The initial full backend run passed 102 cases and failed the two new migration
checks. After correcting initialization and the legacy fixture, the complete suite
was rerun on the rebuilt backend: **104 passed**, including six PostgreSQL
concurrency/persistence cases and two real Alembic/bootstrap scenarios. Existing
dependency deprecation warnings and a SQLite identity-map warning remain; no tests
were skipped in that run. No functional blocker remains from these deliveries.
Real PostgreSQL migration tests use isolated, disposable `test_migrations_*` schemas;
application schemas and volumes are not reset. Existing application upgrades through
0013 succeeded. Fresh Alembic execution initially failed at historical revision 0009:
`UndefinedTable: relation "business_settings" does not exist`. Earlier revisions do
not create the runtime-managed business settings table. With explicit user approval,
`app/database/migration_bootstrap.py` now creates that frozen pre-0009 baseline only
when absent, within Alembic's transaction. `alembic/env.py` invokes it and escapes
percent signs for ConfigParser so encoded connection URLs remain valid. Existing
tables and historical migration files are untouched. Both PostgreSQL migration
checks subsequently passed, including repeated upgrade, real database preparation,
preserved customer IDs, three saved drafts, notes and existing product classification.

For SaaS evolution, add server-enforced tenant ownership to catalog, alerts, customer
identity and open-sale counters; scope every query and event accordingly. Current
roles and cashier ownership are enforced, but they are not multi-tenant isolation.
Consider per-user read acknowledgements and a transactional PostgreSQL push/outbox
mechanism once multi-worker real-time delivery is required and measured.

## Test Matrix

### Evidence and Status Rules

- PASS means the cited scenario was actually executed successfully, not merely
  implemented. Results below refer to the recorded local validation and publication
  preflight on 2026-10-15, America/Bogota.
- NOT RUN identifies a real pending verification. Source inspection is not a browser,
  device, tenant-isolation or production end-to-end test.
- Full backend command **B1** (repository root):
  `docker compose exec -T backend sh -c 'OPEN_SALES_POSTGRES_URL="$DATABASE_URL" pytest -q'`.
  Final result: **104 passed**, zero skipped, 289 warnings, 360.51 seconds. An earlier
  run had 102 passes/two failures; initialization was corrected and all 104 rerun.
- **F1:** `npm run test:catalog` in the isolated Node validation container: 3 passed.
- **F2:** `npm run test:print` in that container: 14 passed.
- **F3:** Chrome headless ran `frontend/tests/openSales.browser.html` served on the
  isolated QA origin localhost:5188 with a fake API, real AuthProvider/useOpenSales,
  StrictMode and synthetic test-only session. The page reported `data-test-status=passed`
  and `PASS: independent tabs, autosave, reload, rapid edits, version conflicts,
  offline retry, checkout retry, creation retry, cancellation and StrictMode`.
- **F4:** `npm run build` inside the validation container and the frontend Docker
  build stage: TypeScript/Vite succeeded. These are not native-host npm-install tests.
- **D1:** `docker compose build backend frontend`: both images built. The backend
  was rebuilt after the initialization correction; final image startup was verified.
- **D2:** `docker compose up -d --no-build`, `docker compose ps`,
  `docker compose logs backend --tail 25`, `docker compose exec -T backend alembic current`:
  new images healthy, clean startup, revision `0013_catalog_services (head)`.
- **D3:** `docker compose config --quiet` and `git diff --check`: successful.
- **R1:** `Invoke-WebRequest -Uri 'https://meynapos.onrender.com' -UseBasicParsing -TimeoutSec 90`:
  HTTP 200, title MeynaPOS, before publication.
- **R2:** `Invoke-WebRequest -Uri 'https://meynapos-backend.onrender.com/health' -UseBasicParsing -TimeoutSec 90`:
  HTTP 200 with `{"status":"ok","service":"MeynaPOS"}`, before publication.

The backend files below are relative to `backend/app/tests`; frontend files are
relative to `frontend/tests`. Each B1 node was included in the complete executed
suite; listing a node is not a claim of a separate invocation.

| ID | Module | Test Type | Scenario | Expected Result | Obtained Result | Status | Evidence or Execution Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-01 | Notifications | API integration | Normal stock | No active alert | Empty alert list | PASS | B1; test_inventory_alerts.py::test_product_with_normal_stock_does_not_create_alert |
| INV-02 | Notifications | API integration | Sale reaches minimum | One LOW_STOCK alert with new quantity | One matching alert | PASS | B1; test_product_reaching_low_stock_creates_alert |
| INV-03 | Notifications | API integration | Empty product | Critical OUT_OF_STOCK alert | Correct status and zero quantity | PASS | B1; test_out_of_stock_product_creates_critical_alert |
| INV-04 | Notifications | API integration | Low becomes depleted | Update existing episode, not duplicate | Same alert ID, new status | PASS | B1; test_low_stock_to_out_of_stock_updates_existing_alert |
| INV-05 | Notifications | API integration | Another sale while low | Same active episode, updated quantity | One alert retained | PASS | B1; test_repeated_sales_while_low_stock_do_not_duplicate_alert |
| INV-06 | Notifications | API integration | Replenish then decline again | Resolve old episode; create a new episode later | Resolution and distinct new alert ID | PASS | B1; test_replenished_product_resolves_alert; test_product_can_generate_new_alert_after_resolution |
| INV-07 | Notifications | API integration | Read and unread | Change acknowledgement without resolving stock | Active alert remains, read flag toggles | PASS | B1; test_mark_as_read_keeps_active_stock_condition; test_alert_can_be_marked_unread |
| INV-08 | Notifications | API security | Cashier lists/acknowledges alerts | Reject both operations | HTTP 403 | PASS | B1; test_cashier_cannot_access_inventory_alerts; test_cashier_cannot_change_read_state |
| INV-09 | Notifications | Persistence integration | Refresh DB session | Active alert survives | Alert returned after expire_all | PASS | B1; test_persisted_alerts_are_available_after_session_refresh |
| INV-10 | Notifications | Retention integration | Old active/resolved records | Expire/delete without recreating unchanged stock | Old records removed; recent/changed episodes preserved | PASS | B1; test_expiration_does_not_recreate_unchanged_condition; test_cleanup_preserves_recent_and_deletes_resolved_notifications |
| INV-11 | Notifications | HTTP integration | Matching ETag, then sale | Empty 304; changed snapshot returns 200 | 304 with no body, then new ETag/quantity | PASS | B1; test_conditional_alert_request_changes_after_stock_update |
| INV-12 | Inventory | Frontend unit | Duplicate names, target ID 199 of 200 | Only exact ID, even beyond a simulated first page | Only 199 selected; missing ID returns none | PASS | F1; catalog.test.mjs |
| INV-13 | Inventory | Frontend unit | Manual name/SKU/barcode/QR | Match all supported fields | Expected matching IDs for each criterion | PASS | F1; catalog.test.mjs |
| INV-14 | Notifications | Browser lifecycle | Hidden-tab suppression/reconnect | No hidden polling; restore current snapshot | No dedicated automated browser assertion executed | NOT RUN | Manual browser/network verification pending |
| SALE-01 | Open sales | API integration | Save/switch/reload independent drafts | Preserve items, customer, notes and discounts separately | Draft data independent; no stock/financial side effects | PASS | B1; test_hold_persists_without_financial_or_inventory_effects; test_multiple_open_sales_remain_independent_after_reload |
| SALE-02 | Open sales | API integration | Rename, duplicate names, blank/stale labels | Persist duplicates; reject invalid/stale update | Persisted Mesa 4; HTTP 422/409 as appropriate | PASS | B1; test_open_sale_names_persist_and_allow_duplicates |
| SALE-03 | Open sales | API integration | Retry creation/completion | Same UUID and completed sale; one stock deduction | No duplicated draft/payment/sale | PASS | B1; test_creation_retry_uses_the_same_identifier; test_checkout_is_idempotent_and_decrements_stock_once |
| SALE-04 | Open sales | API integration | Cancel pending/attempt closed update | Keep audit record, no completed sale or stock deduction | Cancelled record retained; closed update rejected | PASS | B1; test_cancellation_is_persistent_and_never_creates_a_sale; test_checkout_is_idempotent_and_decrements_stock_once |
| SALE-05 | Open sales | API security | Cashier accesses another cashier's draft | Reject access | HTTP 403 | PASS | B1; test_cashiers_only_access_their_own_sales |
| SALE-06 | Open sales | API integration | Stock/price/tax/currency/inactive/deleted product changes | Block payment until valid/reviewed | Appropriate issue/conflict responses | PASS | B1; test_stock_is_rechecked_after_another_customer_pays; test_price_change_requires_explicit_acceptance; test_currency_and_tax_changes_require_review; test_inactive_product_blocks_payment; test_deleted_product_is_kept_as_a_snapshot_and_blocks_payment |
| SALE-07 | Checkout | API integration | Invalid discount/underpayment | Save incomplete draft but reject payment; roll back effects | No financial/stock changes on failure | PASS | B1; test_invalid_discount_is_saved_but_cannot_be_charged; test_failed_payment_rolls_back_all_effects |
| SALE-08 | Checkout | API integration | Valid 100% discount | Permit zero final total/payment | Sale completes at zero total | PASS | B1; test_free_sale_with_a_valid_full_discount_can_be_completed |
| SALE-09 | Open sales | PostgreSQL concurrency | Four simultaneous creations | Unique numbers independent of name | Four unique database numbers | PASS | B1; test_open_sales_postgres.py::test_parallel_creation_assigns_unique_default_numbers |
| SALE-10 | Checkout | PostgreSQL concurrency | Same draft charged concurrently | One sale/payment/stock decrement | Both requests resolve same sale | PASS | B1; test_parallel_checkout_of_same_draft_creates_one_sale |
| SALE-11 | Checkout | PostgreSQL concurrency | Different drafts/direct sale compete for stock | No oversell | One successful consumption; competing request rejected | PASS | B1; test_parallel_sales_cannot_consume_the_same_stock; test_direct_and_held_checkout_share_atomic_stock_validation |
| SALE-12 | Open sales | PostgreSQL concurrency/persistence | Parallel edits and new connection pool | Reject stale writer; persist saved draft | Version conflict and restored fields | PASS | B1; test_parallel_edits_reject_a_stale_version; test_held_sale_survives_connection_pool_and_service_restart |
| SALE-13 | Open sales | Browser integration | StrictMode, rename, tabs, autosave/reload and network retries | Preserve independent work and retry identity | Harness PASS | PASS | F3; openSales.browser.tsx with fake API |
| CUST-01 | Customers | API/persistence integration | Generic default retrieval/new sale | Cliente final, same ID, no duplicate | Original ID/default label retained | PASS | B1; test_final_customer.py::test_final_customer_keeps_identity_and_is_default |
| CAT-01 | Services | API integration | Mixed cart with discount | Only physical stock deducted; correct total/details | Total 108.00; physical stock 3; no service stock/alert | PASS | B1; test_catalog_services.py::test_mixed_sale_only_decrements_physical_stock |
| CAT-02 | Services | API integration | Sell 20 service units through open checkout | No stock issue; retain sold quantity | Successful completion with quantity 20 | PASS | B1; test_service_open_sale_completes_without_stock |
| CAT-03 | Services | API integration | Product/service conversion and adjustment | Resolve alert, preserve stock, reject service adjustment | Stock retained; alert resolved; HTTP 422 adjustment | PASS | B1; test_converting_to_service_resolves_alert_and_preserves_stock |
| CAT-04 | Services | API validation | Unknown article type | Reject invalid type | HTTP 422 | PASS | B1; test_invalid_article_type_is_rejected |
| CAT-05 | Catalog/inventory | Frontend unit | Service and legacy product | Service excluded from stock; legacy product tracked | Helper assertions passed | PASS | F1; catalog.test.mjs |
| PRINT-01 | Settings | API integration | Save/read business printer preferences | Preferences survive refresh | Stored format/margin/options returned | PASS | B1; test_print_settings.py::test_business_print_preferences_persist |
| PRINT-02 | Settings | API validation/security | Invalid formats/margins/options and cashier write | Reject invalid/unauthorized changes | HTTP 422/403; cashier read allowed | PASS | B1; test_invalid_print_preferences_rejected; test_cashier_can_read_but_cannot_change_business_printer |
| PRINT-03 | Settings | API integration | Update one business configuration | Do not overwrite another record | Other configuration unchanged | PASS | B1; test_updating_business_preferences_does_not_overwrite_another_record; not full tenant-security proof |
| PRINT-04 | Receipts | Frontend/PDF unit | Four formats, 1/150 lines, long names and large totals | Correct mm geometry, readable complete content and final branding | Eight parameterized cases passed | PASS | F2; receipt.test.mjs |
| PRINT-05 | Receipts | Frontend/PDF unit | Long thermal receipt and HTML/PDF geometry | Variable height and consistent pagination | Height/pagination/page equality assertions passed | PASS | F2; thermal-height and native-print/PDF agreement cases |
| PRINT-06 | Receipts | Frontend unit | Optional data, tax/discount/change and preferences | Correct totals/options; durable business settings override local cache | Assertions passed | PASS | F2; optional-fields/preferences/business-refresh cases |
| PRINT-07 | Printing | Physical device | Actual 58/80 mm printer cut length | Complete printed receipt on configured hardware | No physical printer tested | NOT RUN | Requires real printer, paper and driver |
| PRINT-08 | Printing | Browser/device compatibility | Chrome/Edge/Firefox/Safari and different drivers | No clipping and compatible print dialog | No complete cross-browser/driver matrix executed | NOT RUN | Manual compatibility matrix pending; PDF/unit tests are not hardware proof |
| DB-01 | Database | PostgreSQL migration/bootstrap | Empty schema to head and real preparation | All revisions/preparation succeed, repeatable | 0013 reached; repeated upgrade/preparation passed | PASS | B1; test_incremental_migrations_postgres.py parameter None |
| DB-02 | Database | PostgreSQL migration/bootstrap | Populated 0010 to head | Preserve customer ID, three drafts/notes and classify legacy product | Original records retained, names unique, PRODUCT default | PASS | B1; test_incremental_migrations_postgres.py parameter 0010_open_sales |
| QA-01 | Backend | Full regression | Complete backend including opt-in PostgreSQL tests | All tests pass, no skipped PostgreSQL checks | 104 passed, 0 skipped; existing warnings remain | PASS | B1, final run after initialization correction |
| QA-02 | Frontend | Production build | Strict TypeScript and Vite compilation | Build succeeds | Successful production build; nonblocking chunk warning | PASS | F4 |
| OPS-01 | Docker | Build/start integration | Build both images/start without resetting volumes | Images build; backend/frontend/db healthy | Both built and all three healthy | PASS | D1, D2 |
| OPS-02 | Repository | Configuration/whitespace | Compose config and diff validation | No validation/whitespace errors | Commands succeeded; existing LF/CRLF notice only | PASS | D3 |
| RENDER-01 | Render | HTTP pre-publication smoke | Existing public frontend | HTTP 200 and application document | HTTP 200, MeynaPOS title | PASS | R1; executed before push, not proof of the new release |
| RENDER-02 | Render | HTTP pre-publication smoke | Existing backend health | HTTP 200, status ok | Expected JSON returned | PASS | R2; executed before push, not proof of the new release |
| RENDER-03 | Render | Release/functional verification | Expected commit deployed; authenticated sale/reprint after migration | New release runs with preserved business data | Not executed when this pre-publication matrix was prepared | NOT RUN | Verify Render deployment commit/logs and authorized business workflows |
| RENDER-04 | Render | Disaster recovery/persistence | Production backup restore and persistent media across redeploy | Business data and media recover correctly | No production restore/disk verification performed | NOT RUN | Operator backup/disk verification required; do not reset production storage |
| CI-01 | GitHub Actions | Remote pipeline | Workflow for the publication commit | Tests/builds pass remotely | No publication workflow completed when this matrix was prepared | NOT RUN | Check Actions for exact commit; existing CI omits eight opt-in PostgreSQL cases without OPEN_SALES_POSTGRES_URL |

### Known Validation Boundaries

- Passing fake-API browser tests is not an authenticated Render checkout test.
- SQL session refresh and fresh connection pools demonstrate persistence; they do
  not replace crash/recovery drills on production infrastructure.
- Alerts are still polling-based; no instantaneous cross-device push test can pass.
- Current business-ID guards and role/owner checks are not SaaS tenant isolation.
- Native-host npm ci was not used; this checkout has no package-lock.json.
- No dependency updates/audit fixes were applied. Docker npm reported 13 advisories
  (6 moderate, 6 high, 1 critical); this is a separate unresolved security-review task.
