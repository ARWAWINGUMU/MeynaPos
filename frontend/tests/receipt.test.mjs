import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "vite";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import axios from "axios";

let activeBusiness = null;
axios.defaults.adapter = async (config) => ({ data: activeBusiness, status: 200, statusText: "OK", headers: {}, config });
const brandLogo = `data:image/png;base64,${(await readFile(new URL("../src/assets/logo.png", import.meta.url))).toString("base64")}`;

for (const [entry, filename] of [["receipt", "receipt"], ["printPreferences", "preferences"]]) {
  await build({ logLevel: "error", build: { ssr: `src/utils/${entry}.ts`,
    outDir: `node_modules/.cache/${filename}-tests`, emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: `${filename}.mjs` } } } });
}
const { createReceiptPdf, buildReceiptHtml, prepareReceiptDocument, resolveReceiptForPrinting } = await import("../node_modules/.cache/receipt-tests/receipt.mjs");
const { PAPER_FORMATS, normalizePrintPreferences, getPrintPreferences, savePrintPreferences, getBusinessPrintPreferences } =
  await import("../node_modules/.cache/preferences-tests/preferences.mjs");

function receipt(count = 1) {
  return {
    sale: { id: 42, invoice_number: "HISTORICAL-42", created_at: "2024-04-10T14:30:00Z" },
    items: Array.from({ length: count }, (_, index) => ({ quantity: 100000,
      product: { id: index, name: `ITEM${index} long product name `.repeat(4), price: "1250000", cost: "0", sku: String(index), is_active: true } })),
    customer: { id: 1, name: "Historical customer" }, cashierName: "Historical cashier", paymentMethod: "CASH",
    subtotal: 125000000000, tax: 23750000000, discount: 1000000000, total: 147750000000,
    businessSettings: { id: 1, business_name: "Test Business", tax_id: "", address: "", city: "", phone: "",
      email: "", currency: "COP", tax_percentage: "19", updated_at: "2024-04-10" }, logoUrl: brandLogo,
  };
}
const preferences = (format) => normalizePrintPreferences({ format, margin: PAPER_FORMATS[format].margin, showLogo: false });

test("Custom payment snapshots are printed and legacy receipts retain their fallback", async () => {
  const custom = await createReceiptPdf({ ...receipt(), paymentMethod: "TRANSFER", paymentMethodName: "Local voucher" }, preferences("LETTER"));
  assert.ok(custom.output().includes("Local voucher"));
  const legacy = await createReceiptPdf(receipt(), preferences("LETTER"));
  assert.ok(legacy.output().includes("Efectivo"));
});

for (const format of Object.keys(PAPER_FORMATS)) {
  for (const count of [1, 150]) {
    test(`${format}: ${count} products, long names, large amounts, taxes, discount and history`, async () => {
      const pdf = await createReceiptPdf(receipt(count), preferences(format));
      assert.ok(Math.abs(pdf.internal.pageSize.getWidth() - PAPER_FORMATS[format].width) < 0.01);
      if (PAPER_FORMATS[format].height) {
        assert.ok(Math.abs(pdf.internal.pageSize.getHeight() - PAPER_FORMATS[format].height) < 0.01);
        assert.ok(count === 1 || pdf.getNumberOfPages() > 1);
      }
      const output = pdf.output();
      assert.ok(!output.includes("($) Tj"), "Currency symbol must not be orphaned on its own line");
      if (process.env.RECEIPT_QA_DIR) {
        await mkdir(process.env.RECEIPT_QA_DIR, { recursive: true });
        await writeFile(`${process.env.RECEIPT_QA_DIR}/${format}-${count}.pdf`, Buffer.from(pdf.output("arraybuffer")));
        await writeFile(`${process.env.RECEIPT_QA_DIR}/${format}-${count}.html`, await buildReceiptHtml(receipt(count), preferences(format)));
      }
      for (let index = 0; index < count; index += 1) assert.ok(output.includes(`ITEM${index}`));
      for (const label of ["HISTORICAL-42", "Historical customer", "Historical cashier", "Subtotal", "Impuesto", "Descuento", "Total final"]) {
        assert.ok(output.includes(label), `Missing ${label}`);
      }
      assert.ok(!output.includes("Recibido"), "Do not invent historical payment amounts");
      for (let page = 1; page <= pdf.getNumberOfPages(); page += 1) {
        pdf.setPage(page);
        const pageContent = pdf.internal.pages[page].join("\n");
        assert.equal(pageContent.includes("MeynaPOS"), page === pdf.getNumberOfPages(), "Brand footer belongs only on the last page");
        if (page === pdf.getNumberOfPages()) {
          for (const totalLabel of ["Subtotal", "Impuesto", "Descuento", "Total final"]) {
            assert.ok(pageContent.includes(totalLabel), "Totals must stay together on the last page");
          }
          assert.ok(pageContent.includes("Desarrollado"));
          assert.ok(pageContent.includes("MeynaTech"));
          assert.ok(pageContent.includes("Soluciones"));
          assert.ok(pageContent.includes("/I0 Do"), "Footer must contain the brand logo");
          if (PAPER_FORMATS[format].height) {
            const sloganCommand = pdf.internal.pages[page].find((command) => command.includes("crecer juntos"));
            const position = sloganCommand.match(/([\d.-]+) ([\d.-]+) Td/);
            assert.ok(Number(position[2]) < (preferences(format).margin + 6) * 72 / 25.4, "Footer must sit at the physical bottom margin");
          }
        }
        const width = pdf.internal.pageSize.getWidth() * 72 / 25.4;
        const height = pdf.internal.pageSize.getHeight() * 72 / 25.4;
        for (const command of pdf.internal.pages[page]) {
          const match = command.match(/([\d.-]+) ([\d.-]+) Td/);
          if (match) {
            assert.ok(Number(match[1]) >= 0 && Number(match[1]) <= width, "Text outside paper width");
            assert.ok(Number(match[2]) >= 0 && Number(match[2]) <= height, "Text outside paper height");
          }
        }
      }
    });
  }
}

test("Thermal height grows with content and very long receipts paginate", async () => {
  for (const format of ["THERMAL_58", "THERMAL_80"]) {
    const short = await createReceiptPdf(receipt(), preferences(format));
    const long = await createReceiptPdf(receipt(30), preferences(format));
    assert.ok(long.internal.pageSize.getHeight() > short.internal.pageSize.getHeight());
    const huge = await createReceiptPdf(receipt(400), preferences(format));
    assert.ok(huge.getNumberOfPages() > 1);
    assert.ok(huge.output().includes("ITEM399"));
  }
});

test("Optional fields, cash received, change and HTML print rules", async () => {
  const data = { ...receipt(), receivedAmount: 150000000000, changeAmount: 2250000000 };
  const hidden = { ...preferences("THERMAL_58"), showCashier: false, showCustomer: false, showFooter: false };
  const output = (await createReceiptPdf(data, hidden)).output();
  assert.ok(output.includes("Recibido") && output.includes("Cambio"));
  for (const value of ["Historical customer", "Historical cashier", "NIT/Documento"]) assert.ok(!output.includes(value));
  assert.ok(output.includes("MeynaPOS"), "Footer cannot be hidden");
  for (const format of Object.keys(PAPER_FORMATS)) {
    const html = await buildReceiptHtml(data, preferences(format));
    assert.ok(html.includes("@page") && html.includes("@media print") && html.includes("break-inside:avoid"));
    assert.ok(html.includes(`width:${PAPER_FORMATS[format].width}mm`));
    assert.ok(!html.includes("size:auto"), "Printing must explicitly request the configured paper size");
  }
});

test("Native printing and PDFs use identical physical pages, including the final thermal cut length", async () => {
  for (const format of Object.keys(PAPER_FORMATS)) {
    const data = receipt(PAPER_FORMATS[format].height ? 150 : 400);
    const document = await prepareReceiptDocument(data, preferences(format));
    const pdf = await createReceiptPdf(data, preferences(format));
    const html = await buildReceiptHtml(data, preferences(format));
    assert.equal(document.pages.length, pdf.getNumberOfPages());
    for (const [index, page] of document.pages.entries()) {
      pdf.setPage(index + 1);
      assert.ok(Math.abs(pdf.internal.pageSize.getWidth() - page.width) < 0.01);
      assert.ok(Math.abs(pdf.internal.pageSize.getHeight() - page.height) < 0.01);
      assert.ok(html.includes(`@page receipt${index}{size:${page.width}mm ${page.height}mm;margin:0}`));
      if (!PAPER_FORMATS[format].height) {
        const lastContent = Math.max(...page.commands.map((command) => command.kind === "image"
          ? command.y + command.height : command.y));
        assert.ok(page.height - lastContent <= preferences(format).margin + 4,
          "Thermal pages must end just after their content, not at a fixed driver height");
      }
    }
  }
});

test("Preferences validate margins, persist and stay separate by business", () => {
  const values = new Map();
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  savePrintPreferences(1, preferences("THERMAL_58"));
  assert.equal(getPrintPreferences(1).format, "THERMAL_58");
  assert.equal(getPrintPreferences(2).format, "LETTER");
  assert.equal(normalizePrintPreferences({ format: "THERMAL_58", margin: 999 }).margin, 8);
  assert.equal(normalizePrintPreferences({ format: "invalid", margin: -5 }).format, "LETTER");
  values.set("meynapos:print-preferences:v1:1", "invalid JSON");
  assert.equal(getPrintPreferences(1).format, "LETTER");
  globalThis.localStorage = { getItem: () => { throw new Error("Storage disabled"); } };
  assert.equal(getPrintPreferences(1).format, "LETTER");
  delete globalThis.localStorage;
});

test("Business preferences override local defaults and survive clearing browser storage", () => {
  const settings = { ...receipt().businessSettings, print_preferences: preferences("THERMAL_80") };
  globalThis.localStorage = { getItem: () => JSON.stringify(preferences("LETTER")) };
  assert.equal(getBusinessPrintPreferences(settings).format, "THERMAL_80");
  delete globalThis.localStorage;
  assert.equal(getBusinessPrintPreferences(settings).format, "THERMAL_80");
  assert.equal(normalizePrintPreferences({ showFooter: false }).showFooter, true);
});

test("Sale actions refresh business identity and printer settings and reject a business mismatch", async () => {
  globalThis.localStorage = { getItem: () => null };
  const data = receipt();
  activeBusiness = { ...data.businessSettings, business_name: "Updated Business", print_preferences: preferences("THERMAL_58") };
  const current = await resolveReceiptForPrinting(data);
  assert.equal(current.businessSettings.business_name, "Updated Business");
  const pdf = await createReceiptPdf(current);
  assert.ok(Math.abs(pdf.internal.pageSize.getWidth() - 58) < 0.01);
  activeBusiness = { ...activeBusiness, id: 2 };
  await assert.rejects(resolveReceiptForPrinting(data), /negocio activo/);
  delete globalThis.localStorage;
});
