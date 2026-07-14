import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CreditCard, Package, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { MetricTile } from "../components/MetricTile";
import {
  getInventoryReport,
  getMonthlyRevenueReport,
  getPaymentMethodsReport,
  getSalesReport,
  getTopProductsReport,
} from "../services/reportService";
import { useBusinessSettings } from "../hooks/useBusinessSettings";
import type {
  InventoryReportItem,
  MonthlyRevenueReportItem,
  PaymentMethodReportItem,
  SalesReportItem,
  TopProductReportItem,
} from "../types/api";
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
  const [sales, setSales] = useState<SalesReportItem[]>([]);
  const [inventory, setInventory] = useState<InventoryReportItem[]>([]);
  const [topProducts, setTopProducts] = useState<TopProductReportItem[]>([]);
  const [payments, setPayments] = useState<PaymentMethodReportItem[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenueReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    try {
      const [salesData, inventoryData, topData, paymentData, monthlyData] = await Promise.all([
        getSalesReport(),
        getInventoryReport(),
        getTopProductsReport(),
        getPaymentMethodsReport(),
        getMonthlyRevenueReport(),
      ]);
      setSales(salesData);
      setInventory(inventoryData);
      setTopProducts(topData);
      setPayments(paymentData);
      setMonthlyRevenue(monthlyData);
      setError(null);
    } catch {
      setError("No fue posible cargar los reportes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
    const interval = window.setInterval(loadReports, 30000);
    return () => window.clearInterval(interval);
  }, [loadReports]);

  const lowStock = useMemo(() => inventory.filter((item) => item.low_stock), [inventory]);
  const totalRevenue = useMemo(() => sales.reduce((sum, item) => sum + Number(item.total), 0), [sales]);
  const topProductsChart = topProducts.map((item) => ({ name: item.name, ingresos: Number(item.total), cantidad: item.quantity_sold }));
  const monthlyChart = monthlyRevenue.map((item) => ({ month: item.month, ingresos: Number(item.total_revenue), ventas: item.sales_count }));
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
        <MetricTile label="Ventas registradas" value={`${sales.length}`} icon={BarChart3} />
        <MetricTile label="Ingresos" value={formatMoney(totalRevenue, currency)} icon={TrendingUp} />
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
                    {paymentsChart.map((entry, index) => (
                      <Cell key={entry.name} fill={paymentColors[index % paymentColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatMoney(Number(value), currency)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm xl:col-span-2">
          <h3 className="mb-4 font-semibold text-gray-900">Ingresos mensuales</h3>
          {monthlyChart.every((item) => item.ingresos === 0) ? (
            <EmptyState />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip formatter={(value, name) => (name === "ingresos" ? formatMoney(Number(value), currency) : value)} />
                  <Bar dataKey="ingresos" fill="#0891b2" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-semibold text-gray-900">Reporte de ventas</h3>
        {sales.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-3">Número</th>
                  <th className="px-3 py-3">Fecha</th>
                  <th className="px-3 py-3">Cajero</th>
                  <th className="px-3 py-3">Cliente</th>
                  <th className="px-3 py-3">Subtotal</th>
                  <th className="px-3 py-3">Impuesto</th>
                  <th className="px-3 py-3">Descuento</th>
                  <th className="px-3 py-3">Total</th>
                  <th className="px-3 py-3">Pago</th>
                  <th className="px-3 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map((sale) => (
                  <tr key={sale.sale_number}>
                    <td className="px-3 py-3 font-medium text-gray-900">{sale.sale_number}</td>
                    <td className="px-3 py-3">{formatDate(sale.date)}</td>
                    <td className="px-3 py-3">{sale.cashier}</td>
                    <td className="px-3 py-3">{sale.customer}</td>
                    <td className="px-3 py-3">{formatMoney(sale.subtotal, currency)}</td>
                    <td className="px-3 py-3">{formatMoney(sale.tax, currency)}</td>
                    <td className="px-3 py-3">-{formatMoney(sale.discount, currency)}</td>
                    <td className="px-3 py-3 font-semibold text-[#047857]">{formatMoney(sale.total, currency)}</td>
                    <td className="px-3 py-3">{sale.payment_method}</td>
                    <td className="px-3 py-3"><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">{sale.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
    </section>
  );
}
