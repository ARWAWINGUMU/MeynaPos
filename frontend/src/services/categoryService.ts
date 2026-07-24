import { api } from "./api";
import type { Category } from "../types/api";

export async function listCategories(includeInactive = false): Promise<Category[]> {
  const response = await api.get<Category[]>("/categories", { params: { include_inactive: includeInactive } });
  return response.data;
}

export async function createCategory(payload: { name: string; description?: string }): Promise<Category> {
  const response = await api.post<Category>("/categories", payload);
  return response.data;
}

export async function updateCategory(id: number, payload: { name?: string; description?: string | null; is_active?: boolean }): Promise<Category> {
  const response = await api.put<Category>(`/categories/${id}`, payload);
  return response.data;
}

export async function setCategoryActive(id: number, active: boolean): Promise<Category> {
  const response = await api.patch<Category>(`/categories/${id}/${active ? "activate" : "deactivate"}`);
  return response.data;
}

export async function deleteCategory(id: number): Promise<string> {
  const response = await api.delete<{ message: string }>(`/categories/${id}`);
  return response.data.message;
}
