import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, DollarSign, Package, ShoppingCart, TrendingUp, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useAuth } from "../context/AuthContext";
import { getDashboardSummary } from "../services/dashboardService";
import { getInventoryReport, getTopProductsReport } from "../services/reportService";
import type { DashboardSummary, InventoryReportItem, TopProductReportItem } from "../types/api";

function money(value: string | number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "USD" }).format(Number(value));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-CO", { month: "short", day: "2-digit" }).format(new Date(`${value}T00:00:00`));
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  color: "emerald" | "cyan" | "orange" | "purple" | "blue";
}) {
  const colorClasses = {
    emerald: "bg-emerald-50 text-emerald-600",
    cyan: "bg-cyan-50 text-cyan-600",
    orange: "bg-orange-50 text-orange-600",
    purple: "bg-purple-50 text-purple-600",
    blue: "bg-blue-50 text-blue-600",
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className={`rounded-lg p-3 ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <span className="text-sm font-medium text-emerald-600">En vivo</span>
      </div>
      <p className="mb-1 text-sm text-gray-600">{title}</p>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

export function DashboardPage() {
  const { fullName, role } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [inventory, setInventory] = useState<InventoryReportItem[]>([]);
  const [topProducts, setTopProducts] = useState<TopProductReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const [summaryData, inventoryData, topData] = await Promise.all([
        getDashboardSummary(),
        getInventoryReport(),
        getTopProductsReport(),
      ]);
      setSummary(summaryData);
      setInventory(inventoryData);
      setTopProducts(topData);
      setError(null);
    } catch {
      setError("No fue posible cargar la información del Dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const interval = window.setInterval(loadDashboard, 30000);
    return () => window.clearInterval(interval);
  }, [loadDashboard]);

  const chartData = useMemo(
    () =>
      summary?.sales_summary.map((item) => ({
        date: formatDate(item.date),
        ingresos: Number(item.total_revenue),
        ventas: item.sales_count,
      })) ?? [],
    [summary],
  );
  const lowStock = inventory.filter((item) => item.low_stock).slice(0, 5);

  return (
    <section className="p-8">
      <div className="mb-8 rounded-2xl bg-gradient-to-r from-[#047857] to-[#0891b2] p-8 text-white">
        <p className="mb-2 text-sm text-white/80">Bienvenido</p>
        <h2 className="mb-2 text-3xl font-semibold">{fullName ?? "Usuario"}</h2>
        <p className="text-white/80">Rol: {role ?? "N/A"}</p>
      </div>

      {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">Cargando información...</div>}

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Ventas del Día" value={`${summary?.daily_sales_count ?? 0}`} icon={ShoppingCart} color="emerald" />
        <StatCard title="Productos en Stock" value={`${summary?.products_in_stock ?? 0}`} icon={Package} color="cyan" />
        <StatCard title="Productos Bajo Stock" value={`${summary?.low_stock_products ?? 0}`} icon={AlertTriangle} color="orange" />
        <StatCard title="Total Clientes" value={`${summary?.total_clients ?? 0}`} icon={Users} color="purple" />
        <StatCard title="Ingresos Mensuales" value={money(summary?.monthly_revenue ?? 0)} icon={TrendingUp} color="blue" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Ingresos por día</h3>
            <DollarSign className="h-5 w-5 text-emerald-600" />
          </div>
          {chartData.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-lg bg-gray-50 text-gray-500">No hay información disponible para este período.</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="dashboardRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#047857" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#047857" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip formatter={(value) => money(Number(value))} />
                  <Area type="monotone" dataKey="ingresos" stroke="#047857" fill="url(#dashboardRevenue)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Productos bajo stock</h3>
          {lowStock.length === 0 ? (
            <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">No hay información disponible para este período.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {lowStock.map((item) => (
                <div key={item.product_id} className="flex items-center justify-between py-3 text-sm">
                  <span className="font-medium text-gray-800">{item.name}</span>
                  <span className="text-amber-700">{item.quantity} / {item.minimum_stock}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm xl:col-span-3">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Productos más vendidos</h3>
          {topProducts.length === 0 ? (
            <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">No hay información disponible para este período.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {topProducts.slice(0, 6).map((item) => (
                <div key={item.product_id} className="rounded-lg border border-gray-200 p-4">
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="mt-1 text-sm text-gray-500">{item.quantity_sold} unidades vendidas</p>
                  <p className="mt-2 font-semibold text-[#047857]">{money(item.total)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
