import type { Product } from "../types/api";

export function tracksInventory(product: Pick<Product, "article_type">): boolean {
  return product.article_type !== "SERVICE";
}

export type SalesCategoryFilter = number | "ALL" | "UNCATEGORIZED";

export function filterSalesProducts(products: Product[], search: string, category: SalesCategoryFilter): Product[] {
  const term = search.trim().toLowerCase();
  return products.filter((product) => product.is_active !== false
    && [product.name, product.sku, product.barcode, product.qr_code].some((value) => value?.toLowerCase().includes(term))
    && (category === "ALL" || (category === "UNCATEGORIZED" ? !product.category_id : product.category_id === category)));
}

export function filterInventoryProducts(products: Product[], search: string, categoryId: number | "", lowOnly: boolean, productId: number | null): Product[] {
  const term = search.trim().toLowerCase();
  return products.filter((product) => {
    if (!tracksInventory(product)) return false;
    if (productId && !term && categoryId === "" && !lowOnly) return product.id === productId;
    return [product.name, product.sku, product.barcode, product.qr_code].some((value) => value?.toLowerCase().includes(term))
      && (!lowOnly || Boolean(product.inventory?.low_stock))
      && (categoryId === "" || product.category_id === categoryId);
  });
}
