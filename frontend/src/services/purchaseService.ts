import { api } from "./api";

export interface PurchaseItemPayload {
  product_id: number;
  quantity: number;
  unit_cost: string;
}

export interface PurchasePayload {
  supplier_name: string;
  items: PurchaseItemPayload[];
}

export interface Purchase {
  id: number;
  supplier_name: string;
  total: string;
  details: PurchaseItemPayload[];
}

export async function listPurchases(): Promise<Purchase[]> {
  const response = await api.get<Purchase[]>("/purchases");
  return response.data;
}

export async function createPurchase(payload: PurchasePayload): Promise<Purchase> {
  const response = await api.post<Purchase>("/purchases", payload);
  return response.data;
}

