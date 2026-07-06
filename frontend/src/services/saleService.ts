import { api } from "./api";
import type { SalePayload, SaleResponse } from "../types/api";

export async function createSale(payload: SalePayload): Promise<SaleResponse> {
  const response = await api.post<SaleResponse>("/sales", payload);
  return response.data;
}
