import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Edit, ImagePlus, Package, Plus, Search, Tags, Trash2, XCircle } from "lucide-react";

import { BarcodeScannerInput } from "../components/BarcodeScannerInput";
import { ReusableModal } from "../components/ReusableModal";
import { useAuth } from "../context/AuthContext";
import { useBusinessSettings } from "../hooks/useBusinessSettings";
import { createCategory, listCategories, setCategoryActive, updateCategory } from "../services/categoryService";
import { createProduct, deactivateProduct, findProductByBarcode, listProducts, updateProduct, uploadProductImage, type ProductFormPayload } from "../services/productService";
import type { Category, Product } from "../types/api";
import { resolveMediaUrl } from "../utils/media";
import { formatMoney, formatMoneyInput, parseMoneyInput } from "../utils/money";

const emptyForm: ProductFormPayload = {
  name: "",
  description: "",
  sku: "",
  barcode: "",
  qr_code: "",
  price: "",
  cost: "",
  category_id: null,
  initial_stock: 0,
  minimum_stock: 5,
};

export function ProductsPage() {
  const { role } = useAuth();
  const { currency } = useBusinessSettings();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<number | "">("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormPayload>(emptyForm);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [managedCategoryName, setManagedCategoryName] = useState("");
  const [managedCategoryId, setManagedCategoryId] = useState<number | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadProducts() {
    setProducts(await listProducts(search, undefined, role === "ADMIN"));
  }

  async function loadCategories() {
    setCategories(await listCategories(role === "ADMIN"));
  }

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase()) || product.barcode?.includes(search) || product.qr_code?.includes(search) || product.sku.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = categoryFilter === "" || product.category_id === categoryFilter;
        return matchesSearch && matchesCategory;
      }),
    [categoryFilter, products, search],
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
      qr_code: product.qr_code ?? "",
      price: product.price,
      cost: product.cost,
      category_id: product.category_id ?? null,
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
      qr_code: form.qr_code || undefined,
      category_id: form.category_id || undefined,
    };
    const saved = editing
      ? await updateProduct(editing.id, {
          name: payload.name,
          description: payload.description,
          sku: payload.sku,
          barcode: payload.barcode,
          qr_code: payload.qr_code,
          price: payload.price,
          cost: payload.cost,
          category_id: payload.category_id,
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

  async function saveCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      return;
    }
    const category = await createCategory({ name });
    setCategories((current) => [...current, category].sort((a, b) => a.name.localeCompare(b.name)));
    setForm((current) => ({ ...current, category_id: category.id }));
    setNewCategoryName("");
  }

  async function saveManagedCategory() {
    const name = managedCategoryName.trim();
    if (!name) {
      setMessage("El nombre de la categoria es obligatorio.");
      return;
    }
    if (managedCategoryId) {
      await updateCategory(managedCategoryId, { name });
      setMessage("Categoria actualizada.");
    } else {
      await createCategory({ name });
      setMessage("Categoria creada.");
    }
    setManagedCategoryId(null);
    setManagedCategoryName("");
    await loadCategories();
  }

  async function toggleCategory(category: Category) {
    await setCategoryActive(category.id, !category.is_active);
    setMessage(category.is_active ? "Categoria desactivada." : "Categoria activada.");
    await loadCategories();
  }

  function openCreateWithScannedCode(code: string) {
    setEditing(null);
    setForm({
      ...emptyForm,
      barcode: code.length <= 80 ? code : "",
      qr_code: code.length > 80 ? code : "",
    });
    setImageFile(null);
    setModalOpen(true);
  }

  async function handleProductScan(code: string) {
    try {
      const product = await findProductByBarcode(code);
      setSearch(product.barcode ?? product.qr_code ?? code);
      setMessage(`${product.name} encontrado por escaneo.`);
    } catch {
      if (role === "ADMIN") {
        openCreateWithScannedCode(code);
        setMessage(`Código ${code} no encontrado. Completa los datos para crear el producto.`);
        return;
      }
      setMessage(`No existe un producto activo con el código ${code}.`);
    }
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

      <div className="grid gap-3 xl:grid-cols-[minmax(260px,520px)_220px_minmax(260px,420px)]">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, SKU, código de barras o QR" className="w-full rounded-lg border border-gray-300 py-3 pl-11 pr-4" />
        </label>
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value ? Number(event.target.value) : "")} className="rounded-lg border border-gray-300 px-3 py-3 text-sm">
          <option value="">Todas las categorias</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.is_active ? "" : " (inactiva)"}</option>)}
        </select>
        <BarcodeScannerInput onScan={handleProductScan} placeholder="Escanear para buscar o crear" />
      </div>

      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}

      {role === "ADMIN" && (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-emerald-50 p-2 text-[#1B8A5A]"><Tags className="h-5 w-5" /></span>
              <div>
                <h3 className="font-semibold text-gray-900">Categorias</h3>
                <p className="text-sm text-gray-500">Crea, edita y activa o desactiva categorias del catalogo.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input value={managedCategoryName} onChange={(event) => setManagedCategoryName(event.target.value)} placeholder="Nombre de categoria" className="min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <button type="button" onClick={saveManagedCategory} className="rounded-lg bg-[#1B8A5A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#156b46]">
                {managedCategoryId ? "Actualizar" : "Crear"}
              </button>
              {managedCategoryId && (
                <button type="button" onClick={() => { setManagedCategoryId(null); setManagedCategoryName(""); }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
                  Cancelar
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <div key={category.id} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${category.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-gray-200 bg-gray-50 text-gray-500"}`}>
                {category.is_active ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                <span>{category.name}</span>
                <button type="button" onClick={() => { setManagedCategoryId(category.id); setManagedCategoryName(category.name); }} className="font-semibold text-[#1E4E5F] hover:underline">Editar</button>
                <button type="button" onClick={() => toggleCategory(category)} className="font-semibold text-[#1B8A5A] hover:underline">
                  {category.is_active ? "Desactivar" : "Activar"}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {filteredProducts.map((product) => (
          <article key={product.id} className={`overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-lg ${product.is_active ? "border-gray-200" : "border-red-200 opacity-70"}`}>
            <div className="flex aspect-square items-center justify-center bg-gray-100">
              {resolveMediaUrl(product.image_url) ? <img src={resolveMediaUrl(product.image_url) ?? ""} alt={product.name} className="h-full w-full object-cover" /> : <Package className="h-20 w-20 text-gray-300" />}
            </div>
            <div className="space-y-3 p-4">
              <div>
                <h3 className="line-clamp-2 font-medium text-gray-900">{product.name}</h3>
                <p className="mt-1 text-xs text-gray-500">{product.sku} · {product.barcode ?? product.qr_code ?? "Sin código"}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-semibold text-[#1B8A5A]">{formatMoney(product.price, currency)}</span>
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
          <input value={form.qr_code ?? ""} onChange={(e) => setForm({ ...form, qr_code: e.target.value })} placeholder="Código QR como texto" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={formatMoneyInput(form.price, currency)} onChange={(e) => setForm({ ...form, price: parseMoneyInput(e.target.value) })} inputMode="decimal" placeholder="Precio de venta" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={formatMoneyInput(form.cost, currency)} onChange={(e) => setForm({ ...form, cost: parseMoneyInput(e.target.value) })} inputMode="decimal" placeholder="Precio de compra" className="rounded-lg border border-gray-300 px-3 py-2" />
          <select value={form.category_id ?? ""} onChange={(e) => setForm({ ...form, category_id: e.target.value ? Number(e.target.value) : null })} className="rounded-lg border border-gray-300 px-3 py-2">
            <option value="">Sin categoría</option>
            {categories.filter((category) => category.is_active || category.id === form.category_id).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <div className="flex gap-2">
            <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Nueva categoría" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2" />
            <button type="button" onClick={saveCategory} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50">Crear</button>
          </div>
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
