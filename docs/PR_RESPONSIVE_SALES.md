# Pull Request: Responsive Navigation and Sales Improvements

Base: `main`
Compare: `feat/responsive-sales-navigation`

## Summary

- Shared desktop collapsible sidebar and accessible mobile/tablet drawer.
- Smallest available open-sale labels, normalized business-scoped uniqueness and
  anchored tab menus; permanent/fiscal identifiers and checkout idempotency retained.
- Dynamic sales category/search filters, including uncategorized articles.
- Payment dialog options persisted per configured business, QR Bre-B/manual
  confirmation, administrator-created methods and historical payment snapshots.
- Incremental migrations 0014/0015; no historical migration or dependency updates.

## Review and Deployment

Validation: 111 backend tests (including isolated PostgreSQL concurrency/migrations),
4 catalog tests, 15 receipt tests, successful TypeScript/Vite production build,
Chrome navigation at desktop/768/390 CSS px, existing multisale browser harness,
Compose configuration and whitespace checks. See TESTING.md for exact evidence
and the discarded overlapping SQLite run; no production tests are implied.

- Review `docs/RESPONSIVE_SALES.md` and the dated matrix in `docs/TESTING.md`.
- Before merge, inspect existing DRAFT/HELD labels for normalized duplicates and
  rename conflicts using the current application. Migration 0014 aborts safely
  instead of silently changing labels. Preserve database/media backups.
- Existing installations need business configuration before assigning old drafts.
- User-to-tenant membership is not implemented; one business per backend remains
  the supported deployment model. Do not interpret these keys as full SaaS isolation.
- QR/custom transfer methods are manual records, not financial integrations.
- Do not merge or deploy automatically. Render/main were not changed by this task.
- Physical printing and non-Chrome browser/device validation remain operator tasks.

Create the PR from the feature branch after reviewing the final recorded tests:
https://github.com/ARWAWINGUMU/MeynaPos/compare/main...feat/responsive-sales-navigation?expand=1
