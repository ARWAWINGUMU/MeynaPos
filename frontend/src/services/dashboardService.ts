import { api } from "./api";
import type { DashboardSummary } from "../types/api";

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const response = await api.get<DashboardSummary>("/dashboard/summary");
  return response.data;
}
