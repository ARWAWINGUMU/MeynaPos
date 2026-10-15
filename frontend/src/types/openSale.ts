import type { CartItem, DiscountType, Product } from "./api";

export type OpenSaleStatus = "DRAFT" | "HELD" | "COMPLETED" | "CANCELLED";

export interface OpenSaleIssue {
  code: string;
  message: string;
  product_id: number | null;
  current_price: string | null;
  available_stock: number | null;
}

export interface OpenSale {
  id: string;
  number: number;
  name: string;
  cashier_id: number;
  cashier_name: string;
  customer_id: number | null;
  customer_name: string | null;
  status: OpenSaleStatus;
  version: number;
  currency: string;
  tax_percentage: string;
  discount_type: DiscountType;
  discount_value: string;
  subtotal: string;
  tax_amount: string;
  discount_amount: string | null;
  total: string | null;
  notes: string;
  sale_id: number | null;
  created_at: string;
  updated_at: string;
  issues: OpenSaleIssue[];
  lines: Array<{
    original_product_id: number;
    product_id: number | null;
    product_name: string;
    product_sku: string;
    quantity: number;
    unit_price: string;
    product: Product | null;
  }>;
}

export interface OpenSaleEditor {
  cart: CartItem[];
  customerId: number | "";
  discountType: DiscountType;
  discountValue: string;
  notes: string;
}

export function editorFromOpenSale(sale: OpenSale): OpenSaleEditor {
  return {
    cart: sale.lines.map((line) => ({ quantity: line.quantity, product: {
      ...(line.product ?? { id: line.original_product_id, name: line.product_name, sku: line.product_sku,
        price: line.unit_price, cost: "0", is_active: false }),
      id: line.original_product_id, price: line.unit_price, name: line.product_name,
    } })),
    customerId: sale.customer_id ?? "", discountType: sale.discount_type,
    discountValue: sale.discount_value, notes: sale.notes,
  };
}

export function payloadFromEditor(editor: OpenSaleEditor) {
  return {
    customer_id: editor.customerId || null,
    items: editor.cart.map((item) => ({ product_id: item.product.id, quantity: item.quantity, unit_price: item.product.price })),
    discount_type: editor.discountType, discount_value: editor.discountType === "NONE" ? "0.00" : editor.discountValue || "0.00",
    notes: editor.notes,
  };
}
