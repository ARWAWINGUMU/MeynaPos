# Responsive Sales Navigation

## Scope

Feature branch: `feat/responsive-sales-navigation`. Review through a pull request;
do not merge or deploy automatically. Existing authentication, sale identities,
fiscal numbers, stock accounting and completed-sale history remain unchanged.

## Shared Sidebar

`MainLayout` uses `useResponsiveSidebar` and `ResponsiveSidebar` for every route.
The existing Tailwind `lg` breakpoint (1024 CSS pixels) separates desktop from
mobile/tablet. Desktop starts visible and stores `visible`/`hidden` under
`meynapos:sidebar:desktop:v1`. The content releases the sidebar width when hidden.
Mobile always starts closed, independently of that preference. Its overlay closes
on navigation, backdrop click or Escape, locks background scrolling, makes the
underlying layout inert, traps keyboard focus and restores the hamburger focus.
The drawer remains below existing modal layers. No navigation permission changes.

## Open-Sale Labels and Menus

The default label is the smallest available canonical `Venta N` among DRAFT/HELD
sales for the configured business, not the permanent internal number. Renaming,
completion and cancellation release the previous label. Whitespace and case are
normalized for uniqueness. UUIDs, the permanent number allocator and invoice
numbers are never reused or renumbered. A business-row lock serializes creation
and renaming in PostgreSQL; a partial unique index also enforces the invariant.

`PATCH /api/open-sales/{id}/name` retains its version/owner checks and returns
409 `NAME_CONFLICT` for an occupied normalized name. Existing create/complete
retry behavior remains intact. `AnchoredMenu` portals each tab's options to the
document body, clamps/flips its position and supports outside click, Escape and
keyboard menu navigation. Rename/delete continue using existing dialogs.

Migration `0014_open_sale_slots` adds business/name keys without altering labels,
UUIDs or completed financial records. **Before merging/deploying**, inspect active
labels for normalized duplicates and rename them through the current application.
The migration deliberately aborts with the conflicting draft IDs before schema
changes if duplicates exist. It also refuses to assign existing drafts when no
business configuration exists. Do not delete drafts or reset PostgreSQL to bypass
these checks. Historical migrations are unchanged.

## Sales Categories

The POS reads active categories from the existing categories API and combines the
selected category with name/SKU/barcode/QR search. `All` and `Uncategorized` are
always available. Category/product mutations invalidate the local catalog through
the existing Axios event pattern; window focus refreshes categories. Removing a
selected category resets its filter. Services stay sellable and physical-product
stock restrictions remain separate from category filtering.

## Business Payment Options

Payment selection now lives only in the payment dialog. `PaymentOption` stores
business-scoped options, normalized names and a compatible accounting kind.
Defaults are Cash, Card, Transfer and QR Bre-B; QR Bre-B uses the TRANSFER
accounting kind and is not a bank integration. Administrators can add options in
the dialog; cashiers can only consult/select. Empty/duplicate names are rejected.

- `GET /api/payment-methods`: ADMIN/CASHIER; active options for the configured business.
- `POST /api/payment-methods`: ADMIN; `{name, kind}`; returns the persisted option.
- Existing sale/checkout payment payloads accept `method_id`; legacy `method`
  remains supported. If both are supplied, the accounting kind must agree.
- Checkout rejects inactive, missing and foreign-business option IDs before stock
  consumption. Payment stores `method_id` and a `method_name` snapshot.
- Reports, customer history and receipts display the snapshot with a legacy enum
  fallback. Reports group custom names separately and merge legacy/default names.
- Migration `0015_payment_options` seeds defaults for existing businesses and adds
  nullable payment metadata. Historical payments and the PostgreSQL enum are not
  rewritten. Newly initialized businesses obtain defaults idempotently.

Cash underpayment/change, discount validation and atomic/idempotent checkout keep
their existing rules. Noncash methods require manual receipt confirmation. No
split payments, automatic bank verification or payment hardware integration.

## Validation and Limits

See the dated feature section in `TESTING.md` for executed commands/results.
Browser harnesses use fake API adapters on a local QA origin; they never submit
business transactions to Render. PostgreSQL tests use disposable random schemas,
not the application's schema. Run SQLite test suites sequentially because the
existing fixture uses a shared local test database filename.

The application still selects one configured business per backend instance.
Business-scoped keys/options are preparation, **not complete SaaS tenant isolation**;
user-to-tenant membership and all other queries require a separate design review.
Physical printing and Safari/Firefox validation are not covered by Chrome QA.
