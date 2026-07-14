import { useEffect, useMemo, useState } from "react";
import { Download, Edit, Eye, Printer, Search, ShoppingBag, UserRound, Users } from "lucide-react";

import logoImg from "../assets/logo.png";
import { MetricTile } from "../components/MetricTile";
import { ReusableModal } from "../components/ReusableModal";
import { ReusableTable, type TableColumn } from "../components/ReusableTable";
import { useAuth } from "../context/AuthContext";
import { useBusinessSettings } from "../hooks/useBusinessSettings";
import {
  createCustomer,
  getCustomerHistory,
  listCustomerSummary,
  updateCustomer,
  type CustomerPayload,
  type CustomerSaleHistoryItem,
  type CustomerSummary,
} from "../services/customerService";
import type { CartItem, PaymentMethod, Product, SaleResponse } from "../types/api";
import { formatMoney } from "../utils/money";
import { downloadReceiptPdf, printReceiptPdf, type ReceiptData } from "../utils/receipt";

const emptyCustomer: CustomerPayload = { name: "", phone: "", address: "", email: "", document_number: "" };
const pageSize = 8;

function formatDate(value?: string | null): string {
  if (!value) return "Sin compras";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function paymentLabel(method?: PaymentMethod | null): string {
  if (method === "CASH") return "Efectivo";
  if (method === "CARD") return "Tarjeta";
  if (method === "TRANSFER") return "Transferencia";
  return "N/A";
}

export function CustomersPage() {
  const { fullName } = useAuth();
  const { settings, currency } = useBusinessSettings();
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [history, setHistory] = useState<CustomerSaleHistoryItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(null);
  const [selectedSale, setSelectedSale] = useState<CustomerSaleHistoryItem | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "WITH_PURCHASES" | "WITHOUT_PURCHASES">("ALL");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerSummary | null>(null);
  const [form, setForm] = useState<CustomerPayload>(emptyCustomer);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadCustomers() {
    setLoading(true);
    try {
      setCustomers(await listCustomerSummary(search));
      setError(null);
    } catch {
      setError("No fue posible cargar clientes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      if (filter === "WITH_PURCHASES") return customer.purchase_count > 0;
      if (filter === "WITHOUT_PURCHASES") return customer.purchase_count === 0;
      return true;
    });
  }, [customers, filter]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));
  const paginatedCustomers = filteredCustomers.slice((page - 1) * pageSize, page * pageSize);
  const totalRevenue = customers.reduce((sum, customer) => sum + Number(customer.total_purchased), 0);
  const customersWithPurchases = customers.filter((customer) => customer.purchase_count > 0).length;

  async function openDetail(customer: CustomerSummary) {
    setSelectedCustomer(customer);
    setDetailOpen(true);
    setHistory([]);
    try {
      setHistory(await getCustomerHistory(customer.id));
    } catch {
      setMessage("No fue posible cargar el historial del cliente.");
    }
  }

  function openEdit(customer: CustomerSummary) {
    setEditing(customer);
    setForm({
      name: customer.name,
      document_number: customer.document_number ?? "",
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      address: customer.address ?? "",
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      setMessage("El nombre del cliente es obligatorio.");
      return;
    }
    if (editing) await updateCustomer(editing.id, form);
    else await createCustomer(form);
    setModalOpen(false);
    setMessage(editing ? "Cliente actualizado." : "Cliente creado.");
    await loadCustomers();
  }

  function receiptFromSale(sale: CustomerSaleHistoryItem): ReceiptData | null {
    if (!selectedCustomer || !settings) return null;
    const items: CartItem[] = sale.products.map((item) => ({
      quantity: item.quantity,
      product: {
        id: item.product_id,
        name: item.name,
        sku: String(item.product_id),
        price: item.unit_price,
        cost: "0.00",
        is_active: true,
      } as Product,
    }));
    const method = sale.payment_method ?? "CASH";
    const saleResponse: SaleResponse = {
      id: sale.id,
      invoice_number: sale.sale_number,
      customer_id: selectedCustomer.id,
      subtotal: sale.subtotal,
      tax_percentage: settings.tax_percentage,
      tax_amount: sale.tax,
      tax: sale.tax,
      tipo_descuento: "NONE",
      valor_descuento: "0.00",
      monto_descuento: sale.discount,
      total: sale.total,
      created_at: sale.date,
      payment: { method, amount: sale.total },
    };
    return {
      sale: saleResponse,
      items,
      customer: selectedCustomer,
      cashierName: sale.cashier || fullName || "Cajero",
      paymentMethod: method,
      receivedAmount: Number(sale.total),
      changeAmount: 0,
      subtotal: Number(sale.subtotal),
      tax: Number(sale.tax),
      discount: Number(sale.discount),
      total: Number(sale.total),
      businessSettings: settings,
      logoUrl: logoImg,
    };
  }

  async function downloadSale(sale: CustomerSaleHistoryItem) {
    const receipt = receiptFromSale(sale);
    if (receipt) await downloadReceiptPdf(receipt);
  }

  async function printSale(sale: CustomerSaleHistoryItem) {
    const receipt = receiptFromSale(sale);
    if (receipt) await printReceiptPdf(receipt);
  }

  const columns: Array<TableColumn<CustomerSummary>> = [
    { key: "name", header: "Nombre", render: (customer) => <div><p className="font-semibold text-gray-900">{customer.name}</p><p className="text-xs text-gray-500">{customer.address ?? "Sin dirección"}</p></div> },
    { key: "document", header: "Documento", render: (customer) => customer.document_number ?? "N/A" },
    { key: "phone", header: "Teléfono", render: (customer) => customer.phone ?? "N/A" },
    { key: "email", header: "Correo", render: (customer) => customer.email ?? "N/A" },
    { key: "purchases", header: "Compras", render: (customer) => <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{customer.purchase_count}</span> },
    { key: "total", header: "Total comprado", render: (customer) => <span className="font-semibold text-[#047857]">{formatMoney(customer.total_purchased, currency)}</span> },
    { key: "last", header: "Última compra", render: (customer) => formatDate(customer.last_purchase_at) },
    {
      key: "actions",
      header: "Acciones",
      render: (customer) => (
        <div className="flex gap-2">
          <button onClick={() => openDetail(customer)} className="rounded-lg border border-gray-200 p-2 text-gray-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700" aria-label="Ver detalle"><Eye className="h-4 w-4" /></button>
          <button onClick={() => openEdit(customer)} className="rounded-lg border border-gray-200 p-2 text-gray-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700" aria-label="Editar cliente"><Edit className="h-4 w-4" /></button>
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-6 p-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Clientes</h2>
          <p className="text-sm text-gray-500">Consulta clientes, historial de compras y reimpresión de facturas.</p>
        </div>
        <button onClick={() => { setEditing(null); setForm(emptyCustomer); setModalOpen(true); }} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1B8A5A] px-4 py-3 font-semibold text-white transition hover:bg-[#156b46]">
          <UserRound className="h-4 w-4" /> Crear cliente
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricTile label="Clientes registrados" value={`${customers.length}`} icon={Users} />
        <MetricTile label="Con compras" value={`${customersWithPurchases}`} icon={ShoppingBag} />
        <MetricTile label="Total comprado" value={formatMoney(totalRevenue, currency)} icon={ShoppingBag} />
      </div>

      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">Cargando clientes...</div>}

      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <div className="relative max-w-xl flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && loadCustomers()} placeholder="Buscar por nombre, documento, teléfono o correo" className="w-full rounded-lg border border-gray-300 py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-[#1B8A5A]" />
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "ALL", label: "Todos" },
            { value: "WITH_PURCHASES", label: "Con compras" },
            { value: "WITHOUT_PURCHASES", label: "Sin compras" },
          ].map((option) => (
            <button key={option.value} onClick={() => { setFilter(option.value as typeof filter); setPage(1); }} className={`rounded-lg px-4 py-2 text-sm font-medium transition ${filter === option.value ? "bg-[#1B8A5A] text-white" : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
              {option.label}
            </button>
          ))}
          <button onClick={loadCustomers} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">Buscar</button>
        </div>
      </div>

      <ReusableTable columns={columns} data={paginatedCustomers} emptyMessage="No hay clientes para mostrar." />

      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
        <span>Página {page} de {totalPages}</span>
        <div className="flex gap-2">
          <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="rounded-lg border border-gray-300 px-3 py-2 disabled:opacity-40">Anterior</button>
          <button onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="rounded-lg border border-gray-300 px-3 py-2 disabled:opacity-40">Siguiente</button>
        </div>
      </div>

      <ReusableModal open={modalOpen} title={editing ? "Editar cliente" : "Crear cliente"} onClose={() => setModalOpen(false)}>
        <form onSubmit={(event) => { event.preventDefault(); save(); }} className="grid gap-4 md:grid-cols-2">
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nombre" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={form.document_number ?? ""} onChange={(event) => setForm({ ...form, document_number: event.target.value })} placeholder="Documento" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={form.phone ?? ""} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Teléfono" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={form.email ?? ""} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Correo" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={form.address ?? ""} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Dirección" className="rounded-lg border border-gray-300 px-3 py-2 md:col-span-2" />
          <button className="rounded-lg bg-[#1B8A5A] px-4 py-3 font-semibold text-white hover:bg-[#156b46] md:col-span-2">Guardar cliente</button>
        </form>
      </ReusableModal>

      <ReusableModal open={detailOpen} title={selectedCustomer ? `Historial de ${selectedCustomer.name}` : "Historial"} onClose={() => setDetailOpen(false)}>
        <div className="space-y-4">
          {selectedCustomer && (
            <div className="grid gap-3 rounded-lg bg-gray-50 p-4 text-sm md:grid-cols-3">
              <div><span className="text-gray-500">Compras</span><p className="font-semibold">{selectedCustomer.purchase_count}</p></div>
              <div><span className="text-gray-500">Total comprado</span><p className="font-semibold text-[#047857]">{formatMoney(selectedCustomer.total_purchased, currency)}</p></div>
              <div><span className="text-gray-500">Última compra</span><p className="font-semibold">{formatDate(selectedCustomer.last_purchase_at)}</p></div>
            </div>
          )}
          <div className="max-h-[420px] overflow-y-auto rounded-lg border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 text-xs uppercase text-gray-500">
                <tr><th className="px-3 py-3">Venta</th><th className="px-3 py-3">Fecha</th><th className="px-3 py-3">Total</th><th className="px-3 py-3">Pago</th><th className="px-3 py-3">Acciones</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((sale) => (
                  <tr key={sale.id}>
                    <td className="px-3 py-3 font-medium">{sale.sale_number}</td>
                    <td className="px-3 py-3">{formatDate(sale.date)}</td>
                    <td className="px-3 py-3 font-semibold text-[#047857]">{formatMoney(sale.total, currency)}</td>
                    <td className="px-3 py-3">{paymentLabel(sale.payment_method)}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => { setSelectedSale(sale); setSaleOpen(true); }} className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50" aria-label="Detalle"><Eye className="h-4 w-4" /></button>
                        <button onClick={() => downloadSale(sale)} className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50" aria-label="Descargar PDF"><Download className="h-4 w-4" /></button>
                        <button onClick={() => printSale(sale)} className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50" aria-label="Imprimir"><Printer className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {history.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-500">Este cliente no tiene compras registradas.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </ReusableModal>

      <ReusableModal open={saleOpen} title={selectedSale ? `Venta ${selectedSale.sale_number}` : "Detalle de venta"} onClose={() => setSaleOpen(false)}>
        {selectedSale && (
          <div className="space-y-4 text-sm">
            <div className="grid gap-3 rounded-lg bg-gray-50 p-4 md:grid-cols-2">
              <div><span className="text-gray-500">Fecha</span><p className="font-semibold">{formatDate(selectedSale.date)}</p></div>
              <div><span className="text-gray-500">Cajero</span><p className="font-semibold">{selectedSale.cashier}</p></div>
              <div><span className="text-gray-500">Pago</span><p className="font-semibold">{paymentLabel(selectedSale.payment_method)}</p></div>
              <div><span className="text-gray-500">Estado</span><p className="font-semibold text-emerald-700">{selectedSale.status}</p></div>
            </div>
            <div className="rounded-lg border border-gray-200">
              {selectedSale.products.map((product) => (
                <div key={`${selectedSale.id}-${product.product_id}`} className="flex justify-between border-b border-gray-100 px-4 py-3 last:border-b-0">
                  <span>{product.name} · {product.quantity} x {formatMoney(product.unit_price, currency)}</span>
                  <strong>{formatMoney(product.line_total, currency)}</strong>
                </div>
              ))}
            </div>
            <div className="ml-auto max-w-sm space-y-2 rounded-lg bg-gray-50 p-4">
              <div className="flex justify-between"><span>Subtotal</span><strong>{formatMoney(selectedSale.subtotal, currency)}</strong></div>
              <div className="flex justify-between"><span>Impuesto</span><strong>{formatMoney(selectedSale.tax, currency)}</strong></div>
              <div className="flex justify-between"><span>Descuento</span><strong>-{formatMoney(selectedSale.discount, currency)}</strong></div>
              <div className="flex justify-between border-t border-gray-200 pt-2 text-base"><span>Total</span><strong className="text-[#047857]">{formatMoney(selectedSale.total, currency)}</strong></div>
            </div>
          </div>
        )}
      </ReusableModal>
    </section>
  );
}
