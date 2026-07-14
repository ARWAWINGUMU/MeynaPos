import { api } from "./api";
import type { CurrencyCode } from "../utils/money";

export interface BusinessSettings {
  id: number;
  business_name: string;
  tax_id: string;
  address: string;
  phone: string;
  email: string;
  city: string;
  currency: CurrencyCode;
  tax_percentage: string;
  logo_url?: string | null;
  updated_at: string;
}

export type BusinessSettingsPayload = Partial<Omit<BusinessSettings, "id" | "updated_at">>;

export async function getSettings(): Promise<BusinessSettings> {
  const response = await api.get<BusinessSettings>("/settings");
  return response.data;
}

export async function updateSettings(payload: BusinessSettingsPayload): Promise<BusinessSettings> {
  const response = await api.put<BusinessSettings>("/settings", payload);
  return response.data;
}

export async function uploadBusinessLogo(file: File): Promise<BusinessSettings> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<BusinessSettings>("/settings/logo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}
