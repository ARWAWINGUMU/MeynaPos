import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bell, Check, PackageX } from "lucide-react";
import { NavLink } from "react-router-dom";

import { listInventoryAlerts, markInventoryAlertAsRead } from "../services/notificationService";
import type { InventoryAlert, InventoryAlertStatus } from "../types/api";

function getAlertLabel(status: InventoryAlertStatus): string {
  return status === "OUT_OF_STOCK" ? "Agotado" : "Bajo stock";
}

function formatAlertDate(value: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function InventoryAlertItem({ alert, onRead }: { alert: InventoryAlert; onRead: (alert: InventoryAlert, read: boolean) => void }) {
  const isOutOfStock = alert.status === "OUT_OF_STOCK";
  const Icon = isOutOfStock ? PackageX : AlertTriangle;

  return (
    <div className={`rounded-xl border p-3 ${isOutOfStock ? "border-red-100 bg-red-50" : "border-amber-100 bg-amber-50"}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-1 rounded-full p-2 ${isOutOfStock ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="truncate text-sm font-semibold text-gray-900">{alert.product_name}</p>
              <p className="text-xs text-gray-600">Disponible: {alert.quantity} / Minimo: {alert.minimum_stock}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${isOutOfStock ? "bg-red-600 text-white" : "bg-amber-500 text-white"}`}>
              {getAlertLabel(alert.status)}
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-500">Actualizado: {formatAlertDate(alert.updated_at)}</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <NavLink to={`/inventario?productId=${alert.product_id}`} onClick={() => onRead(alert, true)} className="text-xs font-semibold text-[#047857] hover:text-[#065f46]">
              Consultar en inventario
            </NavLink>
              <button type="button" onClick={() => onRead(alert, !alert.read)} className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50">
                <Check className="h-3.5 w-3.5" />
                {alert.read ? "No le\u00eddo" : "Marcar le\u00eddo"}
              </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InventoryNotificationBell() {
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const etagRef = useRef<string>();
  const requestPending = useRef(false);

  const loadAlerts = useCallback(async () => {
    if (requestPending.current || document.visibilityState === "hidden") return;
    requestPending.current = true;
    try {
      setError(null);
      const result = await listInventoryAlerts(etagRef.current);
      etagRef.current = result.etag;
      if (result.alerts !== null) setAlerts(result.alerts);
    } catch {
      setError("No fue posible cargar las alertas.");
    } finally {
      requestPending.current = false;
    }
  }, []);

  useEffect(() => {
    void loadAlerts();
    const intervalId = window.setInterval(() => {
      void loadAlerts();
    }, 5000);
    const refresh = () => { void loadAlerts(); };
    window.addEventListener("meynapos:inventory-changed", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("meynapos:inventory-changed", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadAlerts]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const pendingCount = useMemo(() => alerts.filter((alert) => !alert.read).length, [alerts]);

  async function handleRead(alert: InventoryAlert, read: boolean) {
    if (alert.read === read) {
      return;
    }
    try {
      const updated = await markInventoryAlertAsRead(alert.id, read);
      setAlerts((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch {
      setError("No fue posible actualizar el estado de lectura.");
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative rounded-lg p-2 transition-colors hover:bg-emerald-50"
        aria-label="Notificaciones de inventario"
      >
        <Bell className="h-5 w-5 text-gray-600" />
        {pendingCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
            {pendingCount > 5 ? "5+" : pendingCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[24rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Alertas de inventario</p>
              <p className="text-xs text-gray-500">Productos con stock bajo o agotado</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{pendingCount} pendientes</span>
          </div>

          {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

          <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
            {alerts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
                <Bell className="mx-auto mb-3 h-8 w-8 text-gray-300" />
                <p className="text-sm font-semibold text-gray-700">Sin alertas activas</p>
                <p className="mt-1 text-xs text-gray-500">El inventario se encuentra dentro de los niveles configurados.</p>
              </div>
            ) : (
              alerts.map((alert) => <InventoryAlertItem key={alert.id} alert={alert} onRead={(item, read) => void handleRead(item, read)} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}
