# Functional and Deployment Update

Date: 2026-10-15, America/Bogota. This document describes the implemented release,
not a proposed redesign. See [TESTING.md](TESTING.md) for the evidence matrix.

## 1. Persistent Inventory Notifications

1. **Objective:** inform administrators of low-stock and depleted products without
   losing alert state after a page reload or backend restart.
2. **Functional requirements:** header bell, unread counter capped visually at 5+,
   active-alert panel, product/quantity/minimum/status/date, read/unread actions,
   inventory link and empty/error states.
3. **Business rules:** quantity <= 0 is OUT_OF_STOCK; quantity <= minimum is
   LOW_STOCK; sufficient stock or inactive/non-inventory articles resolve alerts.
   A condition has one active episode per product. A read alert remains active.
   Replenishment resolves the episode; a later decline can create another one.
   Alerts expire after 15 days; expiry alone does not recreate unchanged episodes.
   Only administrators may read or acknowledge this endpoint.
4. **Components:** `backend/app/models/inventory_alert.py`, its repository/schema/
   service, notification routes, product/sale/purchase services, `app/main.py`,
   `frontend/src/components/InventoryNotificationBell.tsx`, notification service,
   `AppLayout.tsx`, API mutation interceptor and alert types.
5. **Models/migrations:** `InventoryAlert` stores condition, active/read flags and
   timestamps. `0007_inventory_alerts` adds the table/active-product uniqueness;
   `0008_alert_retention` adds `Inventory.notification_status` independently of
   notification retention. No history table or inventory movement is deleted.
6. **Endpoints:** `GET /api/notifications/inventory-alerts`;
   `PATCH /api/notifications/inventory-alerts/{id}/read?read=true|false`.
7. **Flow:** a successful catalog, inventory, sale or purchase operation synchronizes
   affected products. The bell loads the authorized HTTP snapshot, then refreshes
   after local mutations, focus, reconnect or visible-tab polling. Existing startup/
   hourly maintenance physically purges expired notification rows.
8. **Test cases:** normal/low/empty transitions, repeated sales, replenishment,
   recurrence, persistence across session refresh, read/unread, retention, denied
   cashier access and conditional HTTP responses.
9. **Results:** all 15 alert tests passed in the recorded backend execution.
10. **Limitations:** read acknowledgement is shared, not per administrator. Visible
    polling remains five seconds; cross-device delivery is not instantaneous.
    No WebSocket, Redis, external messaging or tenant isolation was introduced.

## 2. Efficient Refresh and Exact Inventory Navigation

1. **Objective:** avoid unnecessary notification payloads and locate the exact
   product that generated an alert rather than an ambiguous name/code search.
2. **Functional requirements:** ETag validation, no overlapping/background polling,
   reconnect refresh, `/inventario?productId=ID`, highlighted result, explicit
   unavailable-product message and return to the full inventory.
3. **Business rules:** a matching If-None-Match returns 304 without a response body;
   GET never performs retention writes. Authorization precedes cache validation.
   Manual matching accepts name, SKU, barcode and QR; services are not stock items.
4. **Components:** notification route/service/repository, CORS ETag exposure,
   notification client/bell, `InventoryPage.tsx`, `utils/catalog.ts` and catalog tests.
5. **Models/migrations:** reuse existing product/alert IDs and indexes; no new schema.
6. **Endpoints:** existing notification GET now returns ETag, private/no-cache and
   Vary: Authorization headers. Existing inventory/catalog routes remain compatible.
7. **Flow:** the notification sends the internal ID in the inventory route. The page
   clears previous filters, selects that ID and highlights it. Manual filters can
   then be applied, or the user can clear the focused-product route parameter.
8. **Test cases:** duplicate names, target beyond a simulated first page, missing ID,
   name/SKU/barcode/QR matching and service exclusion; changed/unchanged alert GET.
9. **Results:** three catalog tests and the alert conditional-request case passed.
10. **Limitations:** inventory currently loads the existing unpaginated catalog; the
    test covers exact ID selection in a 200-item dataset, not a server pagination
    endpoint. Hidden-tab suppression/reconnect paths exist but do not have a
    dedicated automated browser assertion in this release. Polling targets alerts,
    not the full catalog; a multi-worker push bus is deferred until justified.

## 3. Independent, Named Open Sales and Safe Checkout

1. **Objective:** let cashiers manage several independent pending orders and charge
   each exactly once without prematurely consuming inventory.
2. **Functional requirements:** new/switch/autosave/reload, customizable labels,
   scrolling tabs, per-sale options, rename/delete confirmation, independent
   customer/cart/notes/discounts, review changed prices/tax/currency and retry errors.
3. **Business rules:** UUID is identity, never the display name. Default numbers are
   allocated by the database and can have gaps. Labels may repeat but cannot be
   empty or exceed 80 characters. Cashiers access only their own open sales; admins
   can access all. Version mismatches reject writes. Cancellation is retained for
   audit and cannot cancel a completed payment. Switching/cancelling does not move
   stock. Checkout locks the draft and products, validates current stock/prices and
   commits sale/payment/stock/draft completion together. Repeated completion returns
   the original sale. A valid 100% discount permits a zero-amount payment; underpaid
   positive totals remain invalid. Incomplete discounts may be saved, not charged.
4. **Components:** open-sale model/schema/repository/service/routes; sale/product
   repositories and sale/payment validation; `useOpenSales`, `OpenSalesBar`,
   open-sale API/types, `POSPage` and API inventory-change event handling.
5. **Models/migrations:** `0010_open_sales` creates `OpenSale`/`OpenSaleLine`, ownership,
   snapshots, status/version and completed-sale reference. `0011_open_sale_names`
   adds name/number and `open_sale_numbers`; existing drafts are backfilled in place.
6. **Endpoints:** GET/POST `/api/open-sales`; GET/PUT `/api/open-sales/{id}`;
   PATCH `/{id}/name` with `{version,name}`; POST `/{id}/cancel`, `/{id}/reprice`
   with `{version}`; POST `/{id}/complete` with `{version,payment}`. All suffixes
   are relative to `/api/open-sales`. Existing `/api/sales` remains available.
7. **Flow:** edits autosave; new/select first flushes the previous workspace. Rename
   persists a versioned label; delete confirms then cancels only the selected draft.
   Checkout revalidates, requests explicit acceptance of changed values, commits
   once and opens a new workspace only after a confirmed payment response.
8. **Test cases:** independent fields/reload, name persistence/duplicates/blank names,
   lost create/checkout responses, optimistic conflicts, ownership, cancellation,
   failed-payment rollback, stale catalog values, deleted products, full discounts,
   parallel numbering/payment/editing and competing stock consumption.
9. **Results:** 17 API tests and six PostgreSQL concurrency/persistence tests passed;
   the Chrome StrictMode harness passed independent tabs, rename, autosave/reload,
   rapid edits, conflict handling, offline retry, checkout/create retry and cancel.
10. **Limitations:** unsaved offline edits remain in memory and are not a durable
    offline queue. Browser-close/navigation guards cannot guarantee saving after
    abrupt device shutdown. No stock reservations, restaurant tables or fractional
    units are implemented. Owner/role security is not full tenant isolation.

## 4. Generic Customer: Cliente final

1. **Objective:** use the new visible generic-customer name without losing identity
   or creating a duplicate customer.
2. **Functional requirements:** default new-sale selection, selectable ordinary
   customers, consistent customer display and idempotent default retrieval.
3. **Business rules:** the stable marker is document `0000000000`, not the name.
   Keep its ID and relations. Never modify that global record for one individual
   sale. Completed-sale monetary/detail snapshots are not rewritten by this change.
4. **Components:** seed, CustomerService fallback creation, POS helper text and tests.
5. **Models/migrations:** `0012_final_customer` updates the existing marked customer
   to `Cliente final`; no new customer model, deleted customer or relationship reset.
6. **Endpoints:** no new endpoint; existing customer/default and open-sale APIs
   return/use the renamed record.
7. **Flow:** migration renames the original record; future seeding/default retrieval
   reuses its document marker. A new sale assigns its existing ID unless another
   valid customer is selected.
8. **Test cases:** repeated retrieval, default sale/customer ID, no duplicate marked
   customer, migration preserving the original ID and related pending drafts.
9. **Results:** the focused default-customer case and real migration case passed;
   customer/category regression group passed five tests.
10. **Limitations:** generic identity is still global. Future tenant support needs a
    business-scoped marker/unique key. There is no new immutable customer-profile
    snapshot feature; existing historical customer relationships remain in use.

## 5. Unified Physical Product and Service Catalog

1. **Objective:** sell non-stock services through the same catalog and checkout.
2. **Functional requirements:** PRODUCT/SERVICE selection, service stock fields
   hidden, optional barcode, name/description/category/image/price support, service
   quantities in carts and mixed product/service sales.
3. **Business rules:** legacy items default to PRODUCT. Services do not require or
   deduct inventory, generate alerts, accept stock adjustments or participate in
   stock reports/dashboard indicators. Converting a physical item preserves its
   existing inventory row but resolves its alert. A new service has no inventory
   row. Physical sales continue validating/deducting stock atomically. Services
   retain positive integer sold quantities and normal tax/discount/total rules.
4. **Components:** product model/schema/factory/service, sale/open-sale/purchase
   services, inventory routes, dashboard/report queries; frontend product types/API,
   shared catalog helper, product/POS/inventory/purchase pages and tests.
5. **Models/migrations:** `0013_catalog_services` adds nonnullable `article_type`
   with PRODUCT default and PRODUCT/SERVICE check constraint. `tracks_inventory`
   derives behavior; existing inventory and completed-sale rows are retained.
6. **Endpoints:** existing product POST/PUT/GET include article_type. Inventory GET
   excludes services; inventory adjustments reject them. Existing sales/open-sales
   endpoints accept service product IDs; inventory reports exclude services.
7. **Flow:** choose article type and save the shared catalog entry. POS permits
   adding/incrementing services without a stock limit. Backend checkout calculates
   all lines but updates stock/alerts only for physical products.
8. **Test cases:** mixed checkout/discount, service-only open checkout, physical-only
   stock decrement, no service inventory/alerts, conversion/reversal preservation,
   invalid type, service stock-adjustment rejection and legacy classification.
9. **Results:** four service integration cases, catalog exclusion test and populated
   migration scenario passed; existing product/sale regression tests also passed.
10. **Limitations:** quantities remain integers; units/hours/reservations are not new
    modules. SKU remains required. There is no separate service accounting model.

## 6. Adaptive Receipts, PDFs and Business Printer Preferences

1. **Objective:** use real paper dimensions and consistent content for printing,
   preview, downloads and historical reprints rather than arbitrary scaling.
2. **Functional requirements:** 58/80 mm thermal, Letter/A4, compatible margins,
   optional business/contact/customer/cashier data, preview, test print, persistent
   preferences and shared print/download behavior across POS and customer history.
3. **Business rules:** business preferences are authoritative, not local-device
   defaults. Validate margins by format. Mandatory MeynaPOS branding/footer cannot
   be hidden; Letter/A4 place it at the final page bottom, thermal receipts separate
   it with a divider. Use configured business logo/name and current authorized
   printer settings. Historical cash received/change is omitted when unavailable,
   never fabricated. A mismatched business identity is rejected by the print helper.
4. **Components:** setting model/schema/service, `PrintSettingsPanel`, business
   settings client, `useReceiptPrinter`, receipt/layout/print-document/preferences
   utilities, POS/settings/customer pages, brand asset and print tests.
5. **Models/migrations:** `0009_print_preferences` adds JSON preferences to the
   existing BusinessSetting. The browser cache is business-keyed, not authoritative.
6. **Endpoints:** existing GET/PUT `/api/settings` reads/writes `print_preferences`;
   receipt/PDF rendering remains frontend-side and adds no PDF backend endpoint.
7. **Flow:** save validated preferences; print/download reloads current business
   settings; a shared physical-mm layout wraps names and paginates commands. PDF
   and native HTML/SVG rendering use the same page geometry. Native printing uses
   a prepared iframe and the browser/system printer dialog, not the PDF viewer.
8. **Test cases:** all four sizes with one/150 items, long names/large totals,
   thermal height growth/long pagination, tax/discount, optional data, footer,
   HTML/PDF page agreement, preference persistence/margins/business mismatch/RBAC.
9. **Results:** 10 backend preference cases and 14 frontend receipt cases passed.
   No physical printer, silent-print integration or all-browser matrix was tested.
10. **Limitations:** printer/driver settings can still override browser page requests.
    Paper selection cannot be enforced portably; use compatible driver settings
    and actual-size printing. Reprints use current business/printer configuration,
    not a new immutable invoice/business-settings archive. Brand-image loading
    errors are surfaced instead of silently omitting mandatory branding.

## 7. Database Initialization and Render Compatibility

1. **Objective:** upgrade existing installations and initialize fresh databases
   without rewriting executed migrations or resetting business data.
2. **Functional requirements:** additive migrations through 0013, idempotent
   preparation and Docker startup compatible with Render's PORT environment.
3. **Business rules:** preserve DATABASE_URL, JWT/media/admin settings and volumes.
   Never reset the initial administrator or drop business data to deploy. The
   pre-0009 business-settings baseline is created only if absent, transactionally.
4. **Components:** `backend/alembic/env.py`,
   `app/database/migration_bootstrap.py`, existing prepare_database and Docker
   entrypoint. `.gitattributes` preserves LF shell-script endings on Windows/Linux.
5. **Models/migrations:** online bootstrap supplies the frozen table expected by
   historical 0009, without changing revision files. Alembic ConfigParser escapes
   percent signs in encoded URLs. New release revisions are 0007 through 0013.
6. **Endpoints:** `/health` remains unchanged; no deployment/admin-public API added.
7. **Flow:** Docker executes `/app/docker-entrypoint.sh`, prepares/upgrades PostgreSQL,
   initializes existing runtime-managed structures/seeds, then launches Uvicorn.
   Render was confirmed by the operator to use main, root `backend`, Dockerfile
   `Dockerfile`, and this entrypoint. No Render configuration was changed.
8. **Test cases:** fresh schema, populated 0010 schema, repeated head upgrade, real
   preparation, original customer ID, retained draft notes/numbers and legacy types.
9. **Results:** two isolated PostgreSQL migration/bootstrap cases passed. Full local
   backend suite: 104 passed. Both Docker images built and all services started
   healthy. Public Render frontend/backend returned 200 before publication.
10. **Limitations:** these are not production migration/recovery drills. Render
    dashboard, backups, persistent-disk mounting and authenticated post-deploy flows
    require operator verification. No zero-downtime or automatic-deploy guarantee is
    inferred from Git push or a healthy old deployment. Retain backups and verify
    the new release after Render reports deployment completion.

## Publication and Operations

- Repository: https://github.com/ARWAWINGUMU/MeynaPos, existing `main` branch.
- Existing frontend: https://meynapos.onrender.com.
- Existing backend: https://meynapos-backend.onrender.com.
- Health: https://meynapos-backend.onrender.com/health.
- Preserve the current Render service settings, build-time VITE variables, allowed
  origins, PostgreSQL connection and persistent media disk. Do not substitute local
  Docker service hostnames/ports into Render configuration.
- No render.yaml is introduced because services already exist and were configured
  outside a repository blueprint. Docker Compose describes local verification only.
- Check deployment logs for migration completion and Uvicorn startup; verify the
  expected commit in Render, health, login, sales, settings and historical reprints.
- The existing GitHub backend job skips eight opt-in PostgreSQL cases unless
  OPEN_SALES_POSTGRES_URL is provided; the recorded 104-case local run provided it.
  CI outcome is separate from local test evidence. Node advisories and large-chunk
  warnings are recorded in TESTING.md; dependency upgrades are not part of this release.
