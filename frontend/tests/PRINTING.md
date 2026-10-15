# Receipt Printing Verification

Run `npm run test:print` with the existing frontend dependencies installed.
Automated checks cover PDF dimensions, pagination, long names, large values, taxes, discounts,
optional fields, historical data and local preference persistence. No new libraries are required.

Physical verification is still required for each target printer:

1. Select 58 mm, 80 mm, Letter or A4 in Settings, configure printable margins and save.
2. Compare Preview with Test Print. Select matching paper and actual size (100%) in the system dialog.
3. Print short and long receipts; check all products, totals, legibility, margins and thermal feed/cut behavior.
4. Reprint a historical sale from Customers and confirm its original item names, prices and totals.
5. Change the business format, sign out and sign back in, and verify it remains selected on another workstation.
   Business preferences are stored in PostgreSQL. Local storage is only a cache and is never authoritative.
6. Verify the mandatory MeynaPOS logo, developer credit and slogan appear once, on the last page.
   For Letter/A4 they must sit at the bottom inside the printable margin; thermal receipts have a divider.

The current application runs one business per backend instance. Printer preferences belong to each
business settings record, but this change does not introduce tenant membership or isolation of sales,
inventory and users. Shared-instance multi-tenancy requires that authorization and data-isolation work.

PDF dimensions use millimeters. Extremely long thermal receipts paginate at 5000 mm to stay
below PDF page size limits. Printer drivers may require a lower maximum height or roll-paper setup.
The print button uses native HTML/SVG with explicit named `@page` sizes rather than an embedded PDF viewer.
PDF download uses the same measured pages. Each thermal page ends after its actual content, including the last page.
The web application requests paper dimensions but cannot override printer driver paper choices, scaling, or cutting.
Check native print dialogs in supported Chrome/Edge/Firefox versions. Automated tests do not
verify a physical printer, driver behavior, cutting, or browser print dialogs.
