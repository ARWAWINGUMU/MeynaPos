import { api } from "./api";
import type {
  DailySalesReport,
  InventoryReportItem,
  MonthlyRevenueReportItem,
  PaymentMethodReportItem,
  SalesReportItem,
  TopProductReportItem,
} from "../types/api";

export async function getDailySalesReport(): Promise<DailySalesReport> {
  const response = await api.get<DailySalesReport>("/reports/daily-sales");
  return response.data;
}

export async function getSalesReport(): Promise<SalesReportItem[]> {
  const response = await api.get<SalesReportItem[]>("/reports/sales");
  return response.data;
}

export async function getInventoryReport(): Promise<InventoryReportItem[]> {
  const response = await api.get<InventoryReportItem[]>("/reports/inventory");
  return response.data;
}

export async function getTopProductsReport(): Promise<TopProductReportItem[]> {
  const response = await api.get<TopProductReportItem[]>("/reports/top-products");
  return response.data;
}

export async function getPaymentMethodsReport(): Promise<PaymentMethodReportItem[]> {
  const response = await api.get<PaymentMethodReportItem[]>("/reports/payment-methods");
  return response.data;
}

export async function getMonthlyRevenueReport(): Promise<MonthlyRevenueReportItem[]> {
  const response = await api.get<MonthlyRevenueReportItem[]>("/reports/monthly-revenue");
  return response.data;
}
