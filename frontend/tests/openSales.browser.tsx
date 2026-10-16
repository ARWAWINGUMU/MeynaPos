import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { AxiosError } from "axios";
import { AuthProvider } from "../src/context/AuthContext";
import { useOpenSales } from "../src/hooks/useOpenSales";
import { api } from "../src/services/api";
import { saveSession } from "../src/utils/authStorage";
import type { Product, SaleResponse } from "../src/types/api";
import type { OpenSale } from "../src/types/openSale";
import { OpenSalesBar } from "../src/components/OpenSalesBar";
import { POSPage } from "../src/pages/POSPage";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MainLayout } from "../src/layouts/MainLayout";
import "../src/styles.css";

const server = new Map<string, OpenSale>();
const completed = new Map<string, SaleResponse>();
let offline = false;
let loseCheckoutResponse = false;
let loseCreateResponse = false;
let current: ReturnType<typeof useOpenSales> | undefined;
let chargeCount = 0;
const products: Product[] = [1, 2].map((id) => ({ id, name: `Test product ${id}`, sku: `TEST-${id}`,
  price: "10.00", cost: "5.00", is_active: true, inventory: { quantity: 50, minimum_stock: 1, low_stock: false } }));

api.defaults.adapter = async (config) => {
  await new Promise((resolve) => window.setTimeout(resolve, 30));
  const respond = (data: unknown) => ({ data: structuredClone(data), status: 200, statusText: "OK", headers: {}, config });
  const failNetwork = () => { throw new AxiosError("Connection interrupted", "ERR_NETWORK", config); };
  if (offline) return failNetwork();
  const body: Partial<OpenSale> & { id?: string; version?: number; items?: Array<{ product_id: number; quantity: number; unit_price: string }>; payment?: SaleResponse["payment"] } =
    typeof config.data === "string" ? JSON.parse(config.data) : {};
  const parts = (config.url ?? "").split("/").filter(Boolean);
  if (parts[0] === "products") return respond(products);
  if (parts[0] === "categories") return respond([]);
  if (parts[0] === "notifications") return respond([]);
  if (parts[0] === "payment-methods") return respond([
    { id: 1, business_id: 1, code: "CASH", name: "Efectivo", kind: "CASH", is_active: true },
    { id: 2, business_id: 1, code: "CARD", name: "Tarjeta", kind: "CARD", is_active: true },
    { id: 3, business_id: 1, code: "TRANSFER", name: "Transferencia", kind: "TRANSFER", is_active: true },
    { id: 4, business_id: 1, code: "QR_BREB", name: "QR Bre-B", kind: "TRANSFER", is_active: true },
  ]);
  if (parts[0] === "customers") {
    const customers = [1, 2].map((id) => ({ id, name: `Customer ${id}`, document_number: String(id) }));
    return respond(parts[1] === "default" ? customers[0] : customers);
  }
  if (parts[0] === "settings") return respond({ id: 1, business_name: "MeynaPOS QA", tax_id: "", address: "", city: "", phone: "", email: "", currency: "COP", tax_percentage: "0", updated_at: new Date().toISOString() });
  if (config.method === "get" && parts.length === 1) return respond([...server.values()].filter((sale) => ["DRAFT", "HELD"].includes(sale.status)));
  if (config.method === "post" && parts.length === 1) {
    const id = body.id ?? crypto.randomUUID();
    if (!server.has(id)) server.set(id, { id, number: server.size + 1, name: `Venta ${server.size + 1}`, cashier_id: 1, cashier_name: "Test cashier", customer_id: 1,
      customer_name: "Customer 1", status: "DRAFT", version: 1, currency: "COP", tax_percentage: "0.00",
      discount_type: "NONE", discount_value: "0.00", subtotal: "0.00", tax_amount: "0.00", discount_amount: "0.00",
      total: "0.00", notes: "", sale_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), lines: [], issues: [] });
    if (loseCreateResponse) { loseCreateResponse = false; return failNetwork(); }
    return respond(server.get(id));
  }
  const sale = server.get(parts[1]);
  if (!sale) throw new Error("Missing test sale");
  if (config.method === "get") return respond(sale);
  if (parts[2] === "complete" && completed.has(sale.id)) return respond(completed.get(sale.id));
  if (sale.version !== body.version) throw new AxiosError("Version conflict", "ERR_BAD_REQUEST", config, undefined,
    { data: { detail: { code: "VERSION_CONFLICT" } }, status: 409, statusText: "Conflict", headers: {}, config });
  if (config.method === "put") {
    sale.lines = (body.items ?? []).map((item) => {
      const product = products.find((candidate) => candidate.id === item.product_id);
      if (!product) throw new Error("Missing test product");
      return { product_id: product.id, original_product_id: product.id, product_name: product.name,
        product_sku: product.sku, quantity: item.quantity, unit_price: item.unit_price, product };
    });
    sale.customer_id = body.customer_id ?? 1;
    sale.customer_name = `Customer ${sale.customer_id}`;
    sale.discount_type = body.discount_type ?? "NONE";
    sale.discount_value = body.discount_value ?? "0.00";
    sale.notes = body.notes ?? "";
    sale.status = body.status ?? "DRAFT";
    sale.subtotal = sale.lines.reduce((sum, line) => sum + line.quantity * Number(line.unit_price), 0).toFixed(2);
    const discount = sale.discount_type === "PERCENTAGE" ? Number(sale.subtotal) * Number(sale.discount_value) / 100 : sale.discount_type === "FIXED" ? Number(sale.discount_value) : 0;
    sale.discount_amount = discount.toFixed(2);
    sale.total = (Number(sale.subtotal) - discount).toFixed(2);
  } else if (parts[2] === "name") sale.name = body.name?.trim() ?? sale.name;
  else if (parts[2] === "cancel") sale.status = "CANCELLED";
  else if (parts[2] === "complete") {
    sale.status = "COMPLETED";
    sale.sale_id = ++chargeCount;
    const response: SaleResponse = { id: chargeCount, invoice_number: `TEST-${chargeCount}`, customer_id: sale.customer_id ?? 1,
      subtotal: sale.subtotal, tax_percentage: "0.00", tax_amount: "0.00", tax: "0.00", tipo_descuento: sale.discount_type,
      valor_descuento: sale.discount_value, monto_descuento: sale.discount_amount ?? "0.00", total: sale.total ?? "0.00",
      created_at: new Date().toISOString(), details: sale.lines.map((line) => ({ product_id: line.product_id,
        product_name: line.product_name, quantity: line.quantity, unit_price: line.unit_price,
        line_total: (line.quantity * Number(line.unit_price)).toFixed(2) })), payment: body.payment ?? { method: "CASH", amount: "100.00" } };
    completed.set(sale.id, response);
    sale.version += 1;
    if (loseCheckoutResponse) { loseCheckoutResponse = false; return failNetwork(); }
    return respond(response);
  }
  sale.version += 1;
  return respond(sale);
};

function Harness() {
  const workspace = useOpenSales();
  useEffect(() => { current = workspace; });
  return <div className="mx-auto max-w-5xl p-4"><OpenSalesBar workspace={workspace} onCancel={() => undefined} onReload={() => undefined} /></div>;
}

function workspace() {
  if (!current) throw new Error("Workspace not ready");
  return current;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function waitFor(predicate: () => boolean, label: string): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > 6000) throw new Error(`Timeout: ${label}; ${current?.error ?? ""}`);
    await new Promise((resolve) => window.setTimeout(resolve, 10));
  }
}

async function run() {
  const token = [btoa("{}"), btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })), "test"].join(".");
  saveSession({ token, user: { id: 1, name: "Test cashier", role: "ADMIN" }, mustChangePassword: false });
  const element = document.getElementById("root");
  assert(element, "Missing root");
  let root = createRoot(element);
  if (new URLSearchParams(window.location.search).has("preview")) {
    root.render(<AuthProvider><MemoryRouter><Routes><Route element={<MainLayout />}>
      <Route path="*" element={<POSPage />} />
    </Route></Routes></MemoryRouter></AuthProvider>);
    document.body.dataset.testStatus = "preview";
    return;
  }
  root.render(<React.StrictMode><AuthProvider><Harness /></AuthProvider></React.StrictMode>);
  await waitFor(() => Boolean(current?.active) && !workspace().loading, "initial sale");
  const firstId = workspace().active!.id;
  workspace().setCart([{ product: products[0], quantity: 2 }]);
  workspace().setCustomerId(2);
  workspace().setDiscountType("PERCENTAGE");
  workspace().setDiscountValue("10");
  workspace().setNotes("Customer A notes");
  await waitFor(() => !workspace().dirty && !workspace().saving && server.get(firstId)?.notes === "Customer A notes", "autosave A");
  await workspace().create();
  await waitFor(() => workspace().active?.id !== firstId && !workspace().busy, "new sale B");
  const secondId = workspace().active!.id;
  await workspace().rename(secondId, "Mesa 4");
  await waitFor(() => workspace().active?.name === "Mesa 4" && !workspace().busy, "rename sale");
  workspace().setCart([{ product: products[1], quantity: 3 }]);
  workspace().setNotes("Customer B notes");
  await waitFor(() => !workspace().dirty && server.get(secondId)?.notes === "Customer B notes", "autosave B");
  await workspace().select(firstId);
  await waitFor(() => workspace().active?.id === firstId && !workspace().busy, "restore A");
  assert(workspace().editor.cart[0].product.id === 1 && workspace().editor.cart[0].quantity === 2, "Products mixed across tabs");
  assert(workspace().editor.customerId === 2 && workspace().editor.discountValue === "10", "Customer or discount lost");
  assert(workspace().editor.notes === "Customer A notes", "Notes mixed across tabs");
  workspace().setCart([{ product: products[0], quantity: 3 }]);
  workspace().setCart([{ product: products[0], quantity: 4 }]);
  await waitFor(() => !workspace().dirty && server.get(firstId)?.lines[0].quantity === 4, "rapid edits");
  assert(server.get(secondId)?.lines[0].quantity === 3, "Updating A changed B");

  root.unmount();
  current = undefined;
  root = createRoot(element);
  root.render(<React.StrictMode><AuthProvider><Harness /></AuthProvider></React.StrictMode>);
  await waitFor(() => Boolean(current?.active) && !workspace().loading, "reload");
  if (workspace().active?.id !== firstId) await workspace().select(firstId);
  await waitFor(() => workspace().editor.cart[0]?.quantity === 4 && !workspace().busy, "recovered saved cart");

  const remote = server.get(firstId)!;
  remote.version += 1;
  remote.notes = "Changed in another browser";
  workspace().setNotes("Unsaved local note");
  await waitFor(() => Boolean(workspace().error) && !workspace().saving, "version conflict");
  assert(workspace().dirty && workspace().editor.notes === "Unsaved local note", "Conflict discarded local work");
  assert(remote.notes === "Changed in another browser", "Conflict overwrote remote work");
  await workspace().reload();
  await waitFor(() => !workspace().busy && !workspace().dirty, "conflict reload");
  offline = true;
  workspace().setNotes("Kept while offline");
  await waitFor(() => Boolean(workspace().error) && !workspace().saving, "offline error");
  assert(workspace().dirty && workspace().editor.notes === "Kept while offline", "Offline changes lost");
  offline = false;
  await workspace().flush();
  await waitFor(() => !workspace().dirty, "retry saves offline edits");

  loseCheckoutResponse = true;
  try { await workspace().complete({ method: "CASH", amount: "100.00" }); } catch { /* Retry the same checkout identity. */ }
  await waitFor(() => !workspace().busy, "failed response");
  assert(chargeCount === 1 && workspace().active?.id === firstId, "Uncertain checkout lost its retry identity");
  const paid = await workspace().complete({ method: "CASH", amount: "100.00" });
  assert(paid.id === 1 && chargeCount === 1, "Checkout retry charged twice");
  assert(server.get(secondId)?.status === "HELD", "Checkout changed another held sale");
  await waitFor(() => !workspace().busy, "checkout completes");
  await workspace().create();
  await waitFor(() => Boolean(workspace().active) && !workspace().busy, "fresh sale after checkout");
  const countBeforeCreate = server.size;
  loseCreateResponse = true;
  try { await workspace().create(); } catch { /* Retry creation with its original identifier. */ }
  await waitFor(() => !workspace().busy, "uncertain creation response");
  assert(server.size === countBeforeCreate + 1, "Expected the server to create one new draft");
  await workspace().create();
  await waitFor(() => !workspace().busy, "creation retry");
  assert(server.size === countBeforeCreate + 1, "Creation retry duplicated a draft");
  const cancelledId = workspace().active!.id;
  await workspace().cancel();
  await waitFor(() => !workspace().busy && workspace().active?.id !== cancelledId, "cancel sale");
  assert(server.get(cancelledId)?.status === "CANCELLED", "Cancellation was not saved");
  document.body.dataset.testStatus = "passed";
  document.getElementById("results")!.textContent = "PASS: independent tabs, autosave, reload, rapid edits, version conflicts, offline retry, checkout retry, creation retry, cancellation and StrictMode";
}

void run().catch((error: unknown) => {
  document.body.dataset.testStatus = "failed";
  document.getElementById("results")!.textContent = error instanceof Error ? error.stack ?? error.message : String(error);
});
