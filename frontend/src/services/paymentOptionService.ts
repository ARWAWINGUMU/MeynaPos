import { api } from "./api";
import type { PaymentMethod } from "../types/api";

export interface PaymentOption {
  id: number;
  business_id: number;
  code: string;
  name: string;
  kind: PaymentMethod;
  is_active: boolean;
}

export async function listPaymentOptions(): Promise<PaymentOption[]> {
  return (await api.get<PaymentOption[]>("/payment-methods")).data;
}

export async function createPaymentOption(name: string, kind: PaymentMethod): Promise<PaymentOption> {
  return (await api.post<PaymentOption>("/payment-methods", { name, kind })).data;
}
