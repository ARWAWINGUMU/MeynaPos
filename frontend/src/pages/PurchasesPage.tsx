import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { createPurchase, listPurchases, type PurchaseItemPayload } from "../services/purchaseService";
import { listProducts } from "../services/productService";
import type { Product } from "../types/api";

export function PurchasesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [supplierName, setSupplierName] = useState("");
  const [items, setItems] = useState<PurchaseItemPayload[]>([]);

  async function load() {
    setProducts(await listProducts());
    setPurchases(await listPurchases());
  }

  useEffect(() => { load(); }, []);

  const total = useMemo(() => items.reduce((sum, item) => sum + Number(item.unit_cost) * item.quantity, 0), [items]);

  async function savePurchase() {
    if (!supplierName || items.length === 0) return;
    await createPurchase({ supplier_name: supplierName, items });
    setSupplierName("");
    setItems([]);
    await load();
  }

  return (
    <section className="space-y-6 p-8">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Compras</h2>
        <p className="text-sm text-gray-500">Registra compras e incrementa inventario automáticamente.</p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_140px_140px_auto]">
          <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Proveedor" className="rounded-lg border border-gray-300 px-3 py-2" />
          <select id="purchase-product" className="rounded-lg border border-gray-300 px-3 py-2">
            {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
          <input id="purchase-qty" type="number" placeholder="Cantidad" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input id="purchase-cost" placeholder="Costo" className="rounded-lg border border-gray-300 px-3 py-2" />
          <button onClick={() => {
            const productId = Number((document.getElementById("purchase-product") as HTMLSelectElement).value);
            const quantity = Number((document.getElementById("purchase-qty") as HTMLInputElement).value);
            const unitCost = (document.getElementById("purchase-cost") as HTMLInputElement).value;
            if (productId && quantity > 0 && unitCost) setItems([...items, { product_id: productId, quantity, unit_cost: unitCost }]);
          }} className="rounded-lg bg-[#1B8A5A] px-4 py-2 text-white"><Plus className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
              <span>{products.find((product) => product.id === item.product_id)?.name} · {item.quantity} x ${item.unit_cost}</span>
              <button onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4 text-red-600" /></button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between border-t pt-4">
          <span className="text-lg font-semibold">Total: ${total.toFixed(2)}</span>
          <button onClick={savePurchase} className="rounded-lg bg-[#1B8A5A] px-4 py-2 text-white">Guardar compra</button>
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 font-semibold text-gray-900">Compras registradas</h3>
        <div className="divide-y">
          {purchases.map((purchase) => <div key={purchase.id} className="flex justify-between py-3"><span>{purchase.supplier_name}</span><span>${purchase.total}</span></div>)}
        </div>
      </div>
    </section>
  );
}

