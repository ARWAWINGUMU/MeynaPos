import type { Role } from "./auth";

export type { Role } from "./auth";

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: Role;
  full_name: string;
}

export interface Inventory {
  quantity: number;
  minimum_stock: number;
  low_stock: boolean;
}

export interface Product {
  id: number;
  name: string;
  description?: string | null;
  barcode?: string | null;
  qr_code?: string | null;
  sku: string;
  price: string;
  cost: string;
  category_id?: number | null;
  image_url?: string | null;
  is_active: boolean;
  inventory?: Inventory | null;
}

export interface ProductRemovalResponse {
  action: "deleted" | "deactivated" | "permanently_deleted";
  product: Product | null;
  history_preserved: boolean;
}

export interface Category {
  id: number;
  name: string;
  description?: string | null;
  is_active: boolean;
  product_count: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type PaymentMethod = "CASH" | "CARD" | "TRANSFER";
export type DiscountType = "NONE" | "FIXED" | "PERCENTAGE";

export interface SalePayload {
  customer_id: number;
  items: Array<{ product_id: number; quantity: number }>;
  payment: {
    method: PaymentMethod;
    amount: string;
    reference?: string | null;
  };
  tipo_descuento?: DiscountType;
  valor_descuento?: string;
  monto_descuento?: string;
}

export interface SaleResponse {
  id: number;
  invoice_number: string;
  customer_id: number;
  subtotal: string;
  tax_percentage: string;
  tax_amount: string;
  tax: string;
  tipo_descuento: DiscountType;
  valor_descuento: string;
  monto_descuento: string;
  total: string;
  created_at: string;
  details: Array<{
    product_id: number | null;
    product_name: string;
    product_sku?: string | null;
    product_barcode?: string | null;
    quantity: number;
    unit_price: string;
    line_total: string;
  }>;
  payment: {
    method: PaymentMethod;
    amount: string;
    reference?: string | null;
  };
}

export interface DailySalesReport {
  date: string;
  transactions: number;
  subtotal: string;
  tax: string;
  discount: string;
  total: string;
}

export interface SalesSummaryPoint {
  date: string;
  sales_count: number;
  total_revenue: string;
}

export interface DashboardSummary {
  daily_sales_count: number;
  products_in_stock: number;
  low_stock_products: number;
  total_clients: number;
  monthly_revenue: string;
  sales_summary: SalesSummaryPoint[];
}

export interface SalesReportItem {
  sale_id: number;
  sale_number: string;
  date: string;
  cashier: string;
  customer: string;
  subtotal: string;
  tax: string;
  discount: string;
  total: string;
  payment_method: string;
  status: string;
}

export interface PaginatedSalesReport {
  items: SalesReportItem[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface TopProductReportItem {
  product_id: number | null;
  name: string;
  quantity_sold: number;
  total: string;
}

export interface PaymentMethodReportItem {
  method: string;
  transactions: number;
  total: string;
}

export interface MonthlyRevenueReportItem {
  month: string;
  sales_count: number;
  total_revenue: string;
}

export interface InventoryReportItem {
  product_id: number;
  name: string;
  sku: string;
  barcode?: string | null;
  category: string;
  quantity: number;
  minimum_stock: number;
  low_stock: boolean;
  status: string;
}
