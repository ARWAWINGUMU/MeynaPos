import { api } from "./api";
import type { Product } from "../types/api";

export interface ProductFormPayload {
  name: string;
  description?: string;
  barcode?: string;
  sku: string;
  price: string;
  cost: string;
  image_url?: string;
  initial_stock?: number;
  minimum_stock?: number;
}

export async function listProducts(search?: string, categoryId?: number, includeInactive = false): Promise<Product[]> {
  const response = await api.get<Product[]>("/products", { params: { search, category_id: categoryId, include_inactive: includeInactive } });
  return response.data;
}

export async function findProductByBarcode(barcode: string): Promise<Product> {
  const response = await api.get<Product>(`/products/barcode/${barcode}`);
  return response.data;
}

export async function createProduct(payload: ProductFormPayload): Promise<Product> {
  const response = await api.post<Product>("/products", payload);
  return response.data;
}

export async function updateProduct(id: number, payload: Partial<ProductFormPayload> & { quantity?: number; minimum_stock?: number; is_active?: boolean }): Promise<Product> {
  const response = await api.put<Product>(`/products/${id}`, payload);
  return response.data;
}

export async function deactivateProduct(id: number): Promise<Product> {
  const response = await api.delete<Product>(`/products/${id}`);
  return response.data;
}

export async function uploadProductImage(id: number, file: File): Promise<Product> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<Product>(`/products/${id}/image`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}
