import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Package, Search } from "lucide-react";

import { BarcodeScannerInput } from "../components/BarcodeScannerInput";
import { useAuth } from "../context/AuthContext";
import { listCategories } from "../services/categoryService";
import { findProductByBarcode, listProducts, updateProduct } from "../services/productService";
import type { Category, Product } from "../types/api";

export function InventoryPage() {
  const { role } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<number | "">("");

  async function loadInventory() {
    setProducts(await listProducts());
  }

  useEffect(() => {
    loadInventory();
    listCategories().then(setCategories).catch(() => undefined);
  }, []);

  const filtered = useMemo(
    () =>
      products.filter((product) => {
        const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase()) || product.barcode?.includes(search) || product.qr_code?.includes(search);
        const matchesLow = !lowOnly || product.inventory?.low_stock;
        const matchesCategory = categoryFilter === "" || product.category_id === categoryFilter;
        return matchesSearch && matchesLow && matchesCategory;
      }),
    [categoryFilter, lowOnly, products, search],
  );

  async function updateStock(product: Product, quantity: number) {
    await updateProduct(product.id, { quantity });
    await loadInventory();
  }

  async function handleInventoryScan(code: string) {
    try {
      const product = await findProductByBarcode(code);
      setSearch(product.barcode ?? product.qr_code ?? code);
    } catch {
      setSearch(code);
    }
  }

  return (
    <section className="space-y-5 p-8">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Inventario</h2>
        <p className="text-sm text-gray-500">Consulta stock, mínimos y alertas visuales.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-80">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto o código" className="w-full rounded-lg border border-gray-300 py-3 pl-11 pr-4" />
        </div>
        <BarcodeScannerInput onScan={handleInventoryScan} className="min-w-80" placeholder="Escanear producto" />
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value ? Number(event.target.value) : "")} className="rounded-lg border border-gray-300 px-3 py-3 text-sm">
          <option value="">Todas las categorias</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <button onClick={() => setLowOnly((current) => !current)} className={`rounded-lg px-4 py-2 ${lowOnly ? "bg-yellow-100 text-yellow-800" : "border border-gray-300 bg-white"}`}>
          Bajo stock
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {filtered.map((product) => {
          const quantity = product.inventory?.quantity ?? 0;
          const minimum = product.inventory?.minimum_stock ?? 0;
          const status = quantity === 0 ? "Agotado" : quantity <= minimum ? "Bajo Stock" : "Disponible";
          const statusClass = quantity === 0 ? "bg-red-50 text-red-700" : quantity <= minimum ? "bg-yellow-50 text-yellow-700" : "bg-green-50 text-green-700";
          return (
            <article key={product.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <Package className="h-8 w-8 text-[#1B8A5A]" />
                <span className={`rounded-full px-3 py-1 text-xs ${statusClass}`}>{status}</span>
              </div>
              <h3 className="font-medium text-gray-900">{product.name}</h3>
              <p className="mt-1 text-xs text-gray-500">{product.barcode ?? product.qr_code ?? product.sku}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-gray-500">Stock</p>
                  <p className="text-xl font-semibold">{quantity}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-gray-500">Mínimo</p>
                  <p className="text-xl font-semibold">{minimum}</p>
                </div>
              </div>
              {quantity <= minimum && <p className="mt-3 flex items-center gap-2 text-sm text-yellow-700"><AlertTriangle className="h-4 w-4" /> Requiere reposición</p>}
              {role === "ADMIN" && (
                <div className="mt-4 flex gap-2">
                  <input type="number" defaultValue={quantity} onBlur={(e) => updateStock(product, Number(e.target.value))} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
