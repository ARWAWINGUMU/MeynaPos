import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CreditCard, Eye, Package, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { MetricTile } from "../components/MetricTile";
import { ReusableModal } from "../components/ReusableModal";
import { useToast } from "../context/ToastContext";
import { useBusinessSettings } from "../hooks/useBusinessSettings";
import { getInventoryReport, getPaymentMethodsReport, getSaleDetail, getSalesReport, getTopProductsReport } from "../services/reportService";
import type { InventoryReportItem, PaymentMethodReportItem, SaleResponse, SalesReportItem, TopProductReportItem } from "../types/api";
import { formatMoney } from "../utils/money";

const paymentColors = ["#047857", "#0891b2", "#1E4E5F"];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function EmptyState() {
  return <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">No hay información disponible para este período.</p>;
}

export function ReportsPage() {
  const { currency } = useBusinessSettings();
  const { showToast } = useToast();
  const [sales, setSales] = useState<SalesReportItem[]>([]);
  const [salesPage, setSalesPage] = useState(1);
  const [salesPageSize, setSalesPageSize] = useState(20);
  const [salesTotalPages, setSalesTotalPages] = useState(0);
  const [salesTotal, setSalesTotal] = useState(0);
  const [selectedSale, setSelectedSale] = useState<SaleResponse | null>(null);
  const [inventory, setInventory] = useState<InventoryReportItem[]>([]);
  const [topProducts, setTopProducts] = useState<TopProductReportItem[]>([]);
  const [payments, setPayments] = useState<PaymentMethodReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSales = useCallback(async (page = salesPage, pageSize = salesPageSize) => {
    setSalesLoading(true);
    try {
      const data = await getSalesReport(page, pageSize);
      setSales(data.items);
      setSalesPage(data.page);
      setSalesPageSize(data.page_size);
      setSalesTotal(data.total);
      setSalesTotalPages(data.total_pages);
    } catch {
      showToast("No fue posible cargar las ventas.", "error");
    } finally {
      setSalesLoading(false);
    }
  }, [salesPage, salesPageSize, showToast]);

  const loadReports = useCallback(async () => {
    try {
      const [salesData, inventoryData, topData, paymentData] = await Promise.all([
        getSalesReport(salesPage, salesPageSize),
        getInventoryReport(),
        getTopProductsReport(),
        getPaymentMethodsReport(),
      ]);
      setSales(salesData.items);
      setSalesPage(salesData.page);
      setSalesPageSize(salesData.page_size);
      setSalesTotal(salesData.total);
      setSalesTotalPages(salesData.total_pages);
      setInventory(inventoryData);
      setTopProducts(topData);
      setPayments(paymentData);
      setError(null);
    } catch {
      setError("No fue posible cargar los reportes.");
      showToast("No fue posible cargar los reportes.", "error");
    } finally {
      setLoading(false);
    }
  }, [salesPage, salesPageSize, showToast]);

  useEffect(() => {
    loadReports();
    const interval = window.setInterval(loadReports, 30000);
    return () => window.clearInterval(interval);
  }, [loadReports]);

  async function openSaleDetail(saleId: number) {
    try {
      setSelectedSale(await getSaleDetail(saleId));
    } catch {
      showToast("No fue posible cargar el detalle de la venta.", "error");
    }
  }

  const lowStock = useMemo(() => inventory.filter((item) => item.low_stock), [inventory]);
  const totalRevenue = useMemo(() => sales.reduce((sum, item) => sum + Number(item.total), 0), [sales]);
  const topProductsChart = topProducts.map((item) => ({ name: item.name, ingresos: Number(item.total), cantidad: item.quantity_sold }));
  const paymentsChart = payments.map((item) => ({ name: item.method, value: Number(item.total), transactions: item.transactions }));

  return (
    <section className="space-y-6 p-8">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Reportes</h2>
        <p className="text-sm text-gray-500">Ventas, inventario, productos e ingresos con datos reales.</p>
      </div>

      {loading && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">Cargando reportes...</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Ventas en página" value={`${sales.length}`} icon={BarChart3} />
        <MetricTile label="Ingresos en página" value={formatMoney(totalRevenue, currency)} icon={TrendingUp} />
        <MetricTile label="Bajo stock" value={`${lowStock.length}`} icon={Package} />
        <MetricTile label="Métodos pago" value={`${payments.length}`} icon={CreditCard} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-900">Productos más vendidos</h3>
          {topProductsChart.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProductsChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip formatter={(value, name) => (name === "ingresos" ? formatMoney(Number(value), currency) : value)} />
                  <Bar dataKey="ingresos" fill="#047857" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-900">Ventas por método de pago</h3>
          {paymentsChart.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentsChart} dataKey="value" nameKey="name" outerRadius={95} label>
                    {paymentsChart.map((entry, index) => <Cell key={entry.name} fill={paymentColors[index % paymentColors.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => formatMoney(Number(value), currency)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Últimas ventas</h3>
            <p className="text-sm text-gray-500">{salesTotal} ventas registradas</p>
          </div>
          <select
            value={salesPageSize}
            onChange={(event) => {
              const nextSize = Number(event.target.value);
              setSalesPageSize(nextSize);
              loadSales(1, nextSize);
            }}
            className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value={10}>10 por página</option>
            <option value={20}>20 por página</option>
            <option value={50}>50 por página</option>
          </select>
        </div>

        {sales.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="max-h-[460px] overflow-auto rounded-lg border border-gray-100">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="sticky top-0 z-[1] bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-3">Número</th>
                  <th className="px-3 py-3">Fecha</th>
                  <th className="px-3 py-3">Cajero</th>
                  <th className="px-3 py-3">Cliente</th>
                  <th className="px-3 py-3">Total</th>
                  <th className="px-3 py-3">Pago</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map((sale) => (
                  <tr key={sale.sale_id}>
                    <td className="px-3 py-3 font-medium text-gray-900">{sale.sale_number}</td>
                    <td className="px-3 py-3">{formatDate(sale.date)}</td>
                    <td className="px-3 py-3">{sale.cashier}</td>
                    <td className="px-3 py-3">{sale.customer}</td>
                    <td className="px-3 py-3 font-semibold text-[#047857]">{formatMoney(sale.total, currency)}</td>
                    <td className="px-3 py-3">{sale.payment_method}</td>
                    <td className="px-3 py-3"><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">{sale.status}</span></td>
                    <td className="px-3 py-3">
                      <button onClick={() => openSaleDetail(sale.sale_id)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">
                        <Eye className="h-3.5 w-3.5" /> Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <button disabled={salesLoading || salesPage <= 1} onClick={() => loadSales(salesPage - 1, salesPageSize)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">
            Anterior
          </button>
          <p className="text-sm text-gray-600">Página {salesTotalPages === 0 ? 0 : salesPage} de {salesTotalPages}</p>
          <button disabled={salesLoading || salesPage >= salesTotalPages} onClick={() => loadSales(salesPage + 1, salesPageSize)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">
            Siguiente
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-semibold text-gray-900">Reporte de inventario</h3>
        {inventory.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-3">Producto</th>
                  <th className="px-3 py-3">Categoría</th>
                  <th className="px-3 py-3">Stock actual</th>
                  <th className="px-3 py-3">Stock mínimo</th>
                  <th className="px-3 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {inventory.map((item) => (
                  <tr key={item.product_id}>
                    <td className="px-3 py-3 font-medium text-gray-900">{item.name}</td>
                    <td className="px-3 py-3">{item.category}</td>
                    <td className="px-3 py-3">{item.quantity}</td>
                    <td className="px-3 py-3">{item.minimum_stock}</td>
                    <td className="px-3 py-3">{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ReusableModal open={Boolean(selectedSale)} title="Detalle de venta" onClose={() => setSelectedSale(null)}>
        {selectedSale && (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-lg bg-gray-50 p-4 text-sm md:grid-cols-2">
              <p><span className="font-medium">Factura:</span> {selectedSale.invoice_number}</p>
              <p><span className="font-medium">Fecha:</span> {formatDate(selectedSale.created_at)}</p>
              <p><span className="font-medium">Subtotal:</span> {formatMoney(selectedSale.subtotal, currency)}</p>
              <p><span className="font-medium">Impuesto:</span> {formatMoney(selectedSale.tax_amount, currency)}</p>
              <p><span className="font-medium">Descuento:</span> {formatMoney(selectedSale.monto_descuento, currency)}</p>
              <p><span className="font-medium">Total:</span> {formatMoney(selectedSale.total, currency)}</p>
              <p><span className="font-medium">Método:</span> {selectedSale.payment.method}</p>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2">Producto</th>
                    <th className="px-3 py-2">Cantidad</th>
                    <th className="px-3 py-2">Precio</th>
                    <th className="px-3 py-2">Total línea</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedSale.details.map((detail, index) => (
                    <tr key={`${detail.product_id ?? "historical"}-${index}`}>
                      <td className="px-3 py-2">{detail.product_name}</td>
                      <td className="px-3 py-2">{detail.quantity}</td>
                      <td className="px-3 py-2">{formatMoney(detail.unit_price, currency)}</td>
                      <td className="px-3 py-2">{formatMoney(detail.line_total, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </ReusableModal>
    </section>
  );
}
