import { api } from "./api";
import type { PaymentMethod } from "../types/api";

export interface Customer {
  id: number;
  name: string;
  phone?: string | null;
  address?: string | null;
  email?: string | null;
  document_number?: string | null;
}

export type CustomerPayload = Omit<Customer, "id">;

export interface CustomerSummary extends Customer {
  purchase_count: number;
  total_purchased: string;
  last_purchase_at?: string | null;
}

export interface CustomerSaleProduct {
  product_id: number | null;
  name: string;
  quantity: number;
  unit_price: string;
  line_total: string;
}

export interface CustomerSaleHistoryItem {
  id: number;
  sale_number: string;
  date: string;
  cashier: string;
  products: CustomerSaleProduct[];
  subtotal: string;
  tax: string;
  discount: string;
  total: string;
  payment_method?: PaymentMethod | null;
  status: string;
}

export async function listCustomers(search?: string): Promise<Customer[]> {
  const response = await api.get<Customer[]>("/customers", { params: { search } });
  return response.data;
}

export async function listCustomerSummary(search?: string): Promise<CustomerSummary[]> {
  const response = await api.get<CustomerSummary[]>("/customers/summary", { params: { search } });
  return response.data;
}

export async function getCustomerHistory(id: number): Promise<CustomerSaleHistoryItem[]> {
  const response = await api.get<CustomerSaleHistoryItem[]>(`/customers/${id}/history`);
  return response.data;
}

export async function getDefaultCustomer(): Promise<Customer> {
  const response = await api.get<Customer>("/customers/default");
  return response.data;
}

export async function createCustomer(payload: CustomerPayload): Promise<Customer> {
  const response = await api.post<Customer>("/customers", payload);
  return response.data;
}

export async function updateCustomer(id: number, payload: CustomerPayload): Promise<Customer> {
  const response = await api.put<Customer>(`/customers/${id}`, payload);
  return response.data;
}
