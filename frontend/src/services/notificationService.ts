import type { InventoryAlert } from "../types/api";
import { api } from "./api";

export async function listInventoryAlerts(etag?: string): Promise<{ alerts: InventoryAlert[] | null; etag?: string }> {
  const response = await api.get<InventoryAlert[]>("/notifications/inventory-alerts", {
    headers: etag ? { "If-None-Match": etag } : undefined,
    validateStatus: (status) => status === 304 || (status >= 200 && status < 300),
  });
  return { alerts: response.status === 304 ? null : response.data, etag: response.headers.etag };
}

export async function markInventoryAlertAsRead(alertId: number, read = true): Promise<InventoryAlert> {
  const response = await api.patch<InventoryAlert>(`/notifications/inventory-alerts/${alertId}/read`, null, { params: { read } });
  return response.data;
}
