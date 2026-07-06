import { api } from "./api";

export interface Customer {
  id: number;
  name: string;
  phone?: string | null;
  address?: string | null;
  email?: string | null;
  document_number?: string | null;
}

export type CustomerPayload = Omit<Customer, "id">;

export async function listCustomers(search?: string): Promise<Customer[]> {
  const response = await api.get<Customer[]>("/customers", { params: { search } });
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
