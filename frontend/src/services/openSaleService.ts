import axios from "axios";
import { api } from "./api";
import type { SalePayload, SaleResponse } from "../types/api";
import type { OpenSale, OpenSaleEditor } from "../types/openSale";
import { payloadFromEditor } from "../types/openSale";

export async function listOpenSales(): Promise<OpenSale[]> {
  return (await api.get<OpenSale[]>("/open-sales")).data;
}

export async function getOpenSale(id: string): Promise<OpenSale> {
  return (await api.get<OpenSale>(`/open-sales/${id}`)).data;
}

export async function createOpenSale(id: string): Promise<OpenSale> {
  return (await api.post<OpenSale>("/open-sales", { id })).data;
}

export async function saveOpenSale(sale: OpenSale, editor: OpenSaleEditor, status: "DRAFT" | "HELD"): Promise<OpenSale> {
  return (await api.put<OpenSale>(`/open-sales/${sale.id}`, { ...payloadFromEditor(editor), version: sale.version, status })).data;
}

export async function cancelOpenSale(sale: OpenSale): Promise<OpenSale> {
  return (await api.post<OpenSale>(`/open-sales/${sale.id}/cancel`, { version: sale.version })).data;
}

export async function renameOpenSale(sale: OpenSale, name: string): Promise<OpenSale> {
  return (await api.patch<OpenSale>(`/open-sales/${sale.id}/name`, { version: sale.version, name })).data;
}

export async function repriceOpenSale(sale: OpenSale): Promise<OpenSale> {
  return (await api.post<OpenSale>(`/open-sales/${sale.id}/reprice`, { version: sale.version })).data;
}

export async function completeOpenSale(sale: OpenSale, payment: SalePayload["payment"]): Promise<SaleResponse> {
  return (await api.post<SaleResponse>(`/open-sales/${sale.id}/complete`, { version: sale.version, payment })).data;
}

export function openSaleError(error: unknown): string {
  if (axios.isAxiosError<{ detail?: string | { code?: string; message?: string } }>(error)) {
    const detail = error.response?.data.detail;
    if (typeof detail === "object" && detail?.code === "VERSION_CONFLICT") return "Esta venta cambió en otra ventana. Recarga la venta guardada antes de continuar.";
    if (typeof detail === "object" && detail?.code === "SALE_CLOSED") return "Esta venta ya fue cobrada o cancelada. Recarga las ventas abiertas.";
    if (typeof detail === "object" && ["OPEN_SALE_CHANGED", "PRICE_CHANGED"].includes(detail?.code ?? "")) return "Cambió el precio, impuesto o stock. Revisa la venta antes de cobrar.";
    if (typeof detail === "string") {
      const messages: Record<string, string> = {
        "Payment amount is lower than sale total": "El valor recibido no cubre el total de la venta.",
        "Only active products can be added to an open sale": "Solo puedes agregar productos activos. Actualiza el catálogo.",
        "Use the explicit price update action to change saved prices": "Acepta los valores vigentes para actualizar los precios guardados.",
      };
      return messages[detail] ?? detail;
    }
    if (!error.response) return "Sin conexión. Los cambios siguen pendientes de guardar; reintenta antes de salir.";
  }
  return error instanceof Error ? error.message : "No fue posible guardar la venta.";
}
