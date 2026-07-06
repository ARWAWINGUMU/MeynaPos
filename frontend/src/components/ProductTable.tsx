import type { Product } from "../types/api";

export function ProductTable({ products }: { products: Product[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">SKU</th>
            <th className="px-4 py-3">Barcode</th>
            <th className="px-4 py-3">Price</th>
            <th className="px-4 py-3">Stock</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {products.map((product) => (
            <tr key={product.id}>
              <td className="px-4 py-3 font-medium text-slate-900">{product.name}</td>
              <td className="px-4 py-3 text-slate-600">{product.sku}</td>
              <td className="px-4 py-3 text-slate-600">{product.barcode ?? "-"}</td>
              <td className="px-4 py-3 text-slate-900">${product.price}</td>
              <td className="px-4 py-3">
                <span className={product.inventory?.low_stock ? "text-amber-700" : "text-emerald-700"}>
                  {product.inventory?.quantity ?? 0}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

