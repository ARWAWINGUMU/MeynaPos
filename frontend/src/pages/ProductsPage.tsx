import { useEffect, useMemo, useState } from "react";
import { Edit, ImagePlus, Package, Plus, Search, Trash2 } from "lucide-react";

import { ReusableModal } from "../components/ReusableModal";
import { useAuth } from "../context/AuthContext";
import { createProduct, deactivateProduct, listProducts, updateProduct, uploadProductImage, type ProductFormPayload } from "../services/productService";
import type { Product } from "../types/api";

const emptyForm: ProductFormPayload = {
  name: "",
  description: "",
  sku: "",
  barcode: "",
  price: "",
  cost: "",
  initial_stock: 0,
  minimum_stock: 5,
};

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "http://localhost:8000/api").replace("/api", "");

export function ProductsPage() {
  const { role } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormPayload>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadProducts() {
    setProducts(await listProducts(search, undefined, role === "ADMIN"));
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const filteredProducts = useMemo(
    () => products.filter((product) => product.name.toLowerCase().includes(search.toLowerCase()) || product.barcode?.includes(search) || product.sku.toLowerCase().includes(search.toLowerCase())),
    [products, search],
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setImageFile(null);
    setModalOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({
      name: product.name,
      description: product.description ?? "",
      sku: product.sku,
      barcode: product.barcode ?? "",
      price: product.price,
      cost: product.cost,
      initial_stock: product.inventory?.quantity ?? 0,
      minimum_stock: product.inventory?.minimum_stock ?? 5,
    });
    setImageFile(null);
    setModalOpen(true);
  }

  async function saveProduct() {
    if (!form.name || !form.sku || !form.price || !form.cost) {
      setMessage("Completa nombre, SKU, precio de venta y precio de compra.");
      return;
    }
    const payload = {
      ...form,
      barcode: form.barcode || undefined,
    };
    const saved = editing
      ? await updateProduct(editing.id, {
          name: payload.name,
          description: payload.description,
          sku: payload.sku,
          barcode: payload.barcode,
          price: payload.price,
          cost: payload.cost,
          quantity: payload.initial_stock,
          minimum_stock: payload.minimum_stock,
        })
      : await createProduct(payload);
    if (imageFile) {
      await uploadProductImage(saved.id, imageFile);
    }
    setModalOpen(false);
    setMessage(editing ? "Producto actualizado." : "Producto creado.");
    await loadProducts();
  }

  async function handleDeactivate(product: Product) {
    await deactivateProduct(product.id);
    setMessage("Producto desactivado.");
    await loadProducts();
  }

  return (
    <section className="space-y-5 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Productos</h2>
          <p className="text-sm text-gray-500">Catálogo visual, inventario y códigos de barras.</p>
        </div>
        {role === "ADMIN" && (
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-[#1B8A5A] px-4 py-2 text-white hover:bg-[#156b46]">
            <Plus className="h-4 w-4" /> Crear producto
          </button>
        )}
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, SKU o código de barras" className="w-full rounded-lg border border-gray-300 py-3 pl-11 pr-4" />
      </div>

      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {filteredProducts.map((product) => (
          <article key={product.id} className={`overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-lg ${product.is_active ? "border-gray-200" : "border-red-200 opacity-70"}`}>
            <div className="flex aspect-square items-center justify-center bg-gray-100">
              {product.image_url ? <img src={`${apiBaseUrl}${product.image_url}`} alt={product.name} className="h-full w-full object-cover" /> : <Package className="h-20 w-20 text-gray-300" />}
            </div>
            <div className="space-y-3 p-4">
              <div>
                <h3 className="line-clamp-2 font-medium text-gray-900">{product.name}</h3>
                <p className="mt-1 text-xs text-gray-500">{product.sku} · {product.barcode ?? "Sin código"}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-semibold text-[#1B8A5A]">${product.price}</span>
                <span className={product.inventory?.low_stock ? "rounded-full bg-yellow-50 px-2 py-1 text-xs text-yellow-700" : "rounded-full bg-green-50 px-2 py-1 text-xs text-green-700"}>
                  {product.inventory?.quantity ?? 0} unidades
                </span>
              </div>
              {role === "ADMIN" && (
                <div className="flex gap-2 border-t border-gray-100 pt-3">
                  <button onClick={() => openEdit(product)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"><Edit className="h-4 w-4" /> Editar</button>
                  <button onClick={() => handleDeactivate(product)} className="inline-flex items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-red-700"><Trash2 className="h-4 w-4" /></button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      <ReusableModal open={modalOpen} title={editing ? "Editar producto" : "Crear producto"} onClose={() => setModalOpen(false)}>
        <form onSubmit={(event) => { event.preventDefault(); saveProduct(); }} className="grid gap-4 md:grid-cols-2">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="SKU" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Código de barras" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Precio de venta" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="Precio de compra" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input type="number" value={form.initial_stock} onChange={(e) => setForm({ ...form, initial_stock: Number(e.target.value) })} placeholder="Stock" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input type="number" value={form.minimum_stock} onChange={(e) => setForm({ ...form, minimum_stock: Number(e.target.value) })} placeholder="Stock mínimo" className="rounded-lg border border-gray-300 px-3 py-2" />
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-gray-600">
            <ImagePlus className="h-4 w-4" />
            <span>{imageFile?.name ?? "Seleccionar imagen"}</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} className="hidden" />
          </label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción" className="rounded-lg border border-gray-300 px-3 py-2 md:col-span-2" />
          <button className="rounded-lg bg-[#1B8A5A] px-4 py-3 text-white md:col-span-2">Guardar producto</button>
        </form>
      </ReusableModal>
    </section>
  );
}
