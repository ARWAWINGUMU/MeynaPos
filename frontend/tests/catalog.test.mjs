import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "vite";

await build({ logLevel: "error", build: { ssr: "src/utils/catalog.ts", outDir: "node_modules/.cache/catalog-tests",
  emptyOutDir: true, rollupOptions: { output: { entryFileNames: "catalog.mjs" } } } });
const { tracksInventory, filterInventoryProducts, filterSalesProducts } = await import("../node_modules/.cache/catalog-tests/catalog.mjs");
const products = Array.from({ length: 200 }, (_, index) => ({ id: index + 1, name: "Same name", sku: `SKU-${index + 1}`,
  barcode: `BAR-${index + 1}`, qr_code: `QR-${index + 1}`, article_type: "PRODUCT", category_id: 1,
  inventory: { quantity: 10, minimum_stock: 5, low_stock: false } }));

test("Notification product ID selects exactly the target beyond the first page", () => {
  assert.deepEqual(filterInventoryProducts(products, "", "", false, 199).map((item) => item.id), [199]);
  assert.deepEqual(filterInventoryProducts(products, "", "", false, 999), []);
});

test("Manual inventory search supports name, internal code, barcode and QR", () => {
  assert.equal(filterInventoryProducts(products, "same name", "", false, null).length, 200);
  for (const term of ["sku-199", "bar-199", "qr-199"]) {
    assert.deepEqual(filterInventoryProducts(products, term, "", false, null).map((item) => item.id), [199]);
  }
});

test("Services are not depleted inventory and legacy products remain compatible", () => {
  assert.equal(tracksInventory({}), true);
  assert.equal(tracksInventory({ article_type: "SERVICE" }), false);
  assert.deepEqual(filterInventoryProducts([{ ...products[0], article_type: "SERVICE" }], "", "", false, null), []);
});

test("Sales categories combine with search and preserve services and depleted products", () => {
  const catalog = [...products, { ...products[0], id: 201, category_id: null, article_type: "SERVICE" },
    { ...products[0], id: 202, category_id: 2, inventory: { quantity: 0 } },
    { ...products[0], id: 203, is_active: false }];
  assert.equal(filterSalesProducts(catalog, "", "ALL").length, 202);
  assert.deepEqual(filterSalesProducts(catalog, "", "UNCATEGORIZED").map((item) => item.id), [201]);
  assert.deepEqual(filterSalesProducts(catalog, "", 2).map((item) => item.id), [202]);
  assert.deepEqual(filterSalesProducts(catalog, "sku-199", 1).map((item) => item.id), [199]);
  assert.deepEqual(filterSalesProducts(catalog, "sku-199", 2), []);
});
