import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Pencil } from "lucide-react";
import { MainLayout } from "../src/layouts/MainLayout";
import { AuthProvider } from "../src/context/AuthContext";
import { AnchoredMenu } from "../src/components/AnchoredMenu";
import { PaymentMethodSelector } from "../src/components/PaymentMethodSelector";
import type { PaymentOption } from "../src/services/paymentOptionService";
import { api } from "../src/services/api";
import { saveSession } from "../src/utils/authStorage";
import "../src/styles.css";

const options: PaymentOption[] = ["CASH", "CARD", "TRANSFER", "QR_BREB"].map((code, index) => ({
  id: index + 1, business_id: 1, code, name: ["Efectivo", "Tarjeta", "Transferencia", "QR Bre-B"][index],
  kind: index === 0 ? "CASH" : index === 1 ? "CARD" : "TRANSFER", is_active: true,
}));
api.defaults.adapter = async (config) => {
  let data: unknown = [];
  if (config.url === "/payment-methods") {
    if (config.method === "post") {
      const payload = JSON.parse(config.data);
      const created: PaymentOption = { id: options.length + 1, business_id: 1, code: "QA", name: payload.name, kind: payload.kind, is_active: true };
      options.push(created);
      data = created;
    } else data = options;
  } else if (config.url === "/settings") data = { id: 1, business_name: "QA business", currency: "COP", tax_percentage: "0", updated_at: new Date().toISOString() };
  return { data: structuredClone(data), status: 200, statusText: "OK", headers: {}, config };
};

function Content() {
  const [selected, setSelected] = useState<PaymentOption | null>(null);
  const [renamed, setRenamed] = useState(false);
  return <div className="min-w-0 space-y-6">
    <h2>Navigation QA</h2>
    <div className="flex justify-end overflow-hidden"><AnchoredMenu label="Sale options" items={[
      { label: "Rename QA", icon: Pencil, onSelect: () => setRenamed(true) },
    ]} /></div>
    <output id="renamed">{String(renamed)}</output>
    <PaymentMethodSelector selected={selected} onSelect={setSelected} />
    <output id="selected">{selected?.name}</output>
  </div>;
}

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for UI");
}
function button(text: string) {
  const found = Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.includes(text));
  assert(found, `Missing button ${text}`);
  return found;
}
async function run() {
  const token = [btoa("{}"), btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })), "test"].join(".");
  saveSession({ token, user: { id: 1, name: "QA Administrator", role: "ADMIN" }, mustChangePassword: false });
  // A desktop preference must never open the initial mobile drawer.
  localStorage.setItem("meynapos:sidebar:desktop:v1", "visible");
  const root = document.getElementById("root");
  assert(root, "Missing root");
  createRoot(root).render(<AuthProvider><MemoryRouter><Routes><Route element={<MainLayout />}>
    <Route path="*" element={<Content />} />
  </Route></Routes></MemoryRouter></AuthProvider>);
  await waitFor(() => Boolean(document.querySelector('[aria-controls="main-navigation"]')));
  const trigger = document.querySelector<HTMLButtonElement>('[aria-controls="main-navigation"]');
  const panel = document.getElementById("main-navigation");
  const main = document.querySelector("main");
  assert(trigger && panel && main, "Layout missing");
  const desktop = matchMedia("(min-width: 1024px)").matches;
  assert(trigger.getAttribute("aria-expanded") === String(desktop), "Wrong initial sidebar state");
  if (desktop) {
    const original = main.getBoundingClientRect().width;
    trigger.click();
    await waitFor(() => trigger.getAttribute("aria-expanded") === "false");
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert(main.getBoundingClientRect().width > original, "Hidden desktop sidebar did not release width");
    assert(localStorage.getItem("meynapos:sidebar:desktop:v1") === "hidden", "Preference not saved");
    trigger.click();
    await waitFor(() => trigger.getAttribute("aria-expanded") === "true");
  } else {
    trigger.click();
    await waitFor(() => trigger.getAttribute("aria-expanded") === "true");
    assert(panel.getAttribute("aria-modal") === "true", "Mobile drawer is not modal");
    assert(document.body.style.overflow === "hidden", "Background scroll not locked");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await waitFor(() => trigger.getAttribute("aria-expanded") === "false");
    assert(document.activeElement === trigger, "Focus was not restored");
    trigger.click();
    await waitFor(() => trigger.getAttribute("aria-expanded") === "true");
    const backdrop = document.querySelector<HTMLButtonElement>('button[aria-label="Cerrar menu"].inset-0');
    assert(backdrop, "Mobile backdrop missing");
    backdrop.click();
    await waitFor(() => trigger.getAttribute("aria-expanded") === "false");
    trigger.click();
    await waitFor(() => trigger.getAttribute("aria-expanded") === "true");
    const link = panel.querySelector<HTMLAnchorElement>('a[href="/inventario"]');
    assert(link, "Inventory route lost");
    link.click();
    await waitFor(() => trigger.getAttribute("aria-expanded") === "false");
  }
  const menuTrigger = document.querySelector<HTMLButtonElement>('[aria-label="Sale options"]');
  assert(menuTrigger, "Menu trigger missing");
  menuTrigger.click();
  await waitFor(() => Boolean(document.querySelector('[role="menu"]')));
  const menu = document.querySelector<HTMLElement>('[role="menu"]');
  assert(menu && menu.parentElement === document.body, "Menu clipped by container");
  const bounds = menu.getBoundingClientRect();
  assert(bounds.left >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight, "Menu outside viewport");
  button("Rename QA").click();
  await waitFor(() => document.getElementById("renamed")?.textContent === "true");
  await waitFor(() => Boolean(Array.from(document.querySelectorAll("button")).find((item) => item.textContent === "QR Bre-B")));
  button("QR Bre-B").click();
  await waitFor(() => document.getElementById("selected")?.textContent === "QR Bre-B");
  button("medio de pago").click();
  await waitFor(() => Boolean(document.querySelector('input[maxlength="80"]')));
  const input = document.querySelector<HTMLInputElement>('input[maxlength="80"]');
  assert(input, "Custom payment input missing");
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "QA voucher");
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await waitFor(() => !button("Guardar medio de pago").disabled);
  button("Guardar medio de pago").click();
  await waitFor(() => document.getElementById("selected")?.textContent === "QA voucher");
  assert(document.documentElement.scrollWidth <= innerWidth, "Horizontal page overflow");
  document.body.dataset.testStatus = "passed";
  document.getElementById("results")!.textContent = `PASS: ${innerWidth}px layout, sidebar, navigation, anchored menu, QR and custom payment`;
}
const frameWidth = Number(new URLSearchParams(location.search).get("width"));
if (frameWidth > 0) {
  const frame = document.createElement("iframe");
  frame.width = String(frameWidth);
  frame.height = "950";
  frame.src = location.pathname;
  frame.title = "Responsive viewport";
  document.body.append(frame);
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== frame.contentWindow || event.origin !== location.origin) return;
    document.body.dataset.testStatus = event.data.status;
    document.getElementById("results")!.textContent = event.data.result;
  });
} else {
  void run().catch((error: unknown) => {
    document.body.dataset.testStatus = "failed";
    document.getElementById("results")!.textContent = error instanceof Error ? error.stack ?? error.message : String(error);
  }).finally(() => {
    if (parent !== window) parent.postMessage({ status: document.body.dataset.testStatus,
      result: document.getElementById("results")!.textContent }, location.origin);
  });
}
