import { useEffect, useMemo, useState } from "react";
import { Edit, Eye, EyeOff, ImagePlus, Package, Plus, RotateCcw, Search, Tags, Trash2 } from "lucide-react";

import { BarcodeScannerInput } from "../components/BarcodeScannerInput";
import { ReusableModal } from "../components/ReusableModal";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useBusinessSettings } from "../hooks/useBusinessSettings";
import { createCategory, deleteCategory, listCategories, updateCategory } from "../services/categoryService";
import { createProduct, deactivateProduct, findProductByBarcode, listProducts, permanentlyDeleteProduct, reactivateProduct, updateProduct, uploadProductImage, type ProductFormPayload } from "../services/productService";
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
  const { showToast } = useToast();
  const { currency } = useBusinessSettings();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [modalOpen, setModalOpen] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [productAction, setProductAction] = useState<"deactivate" | "permanent_delete">("deactivate");
  const [categoryDeleteId, setCategoryDeleteId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [removingProduct, setRemovingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormPayload>(emptyForm);
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [managedCategoryName, setManagedCategoryName] = useState("");
  const [managedCategoryId, setManagedCategoryId] = useState<number | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadProducts() {
    try {
      setProducts(await listProducts(undefined, undefined, role === "ADMIN", statusFilter));
    } catch {
      showToast("No fue posible cargar los productos.", "error");
    }
  }

  async function loadCategories() {
    try {
      setCategories(await listCategories(role === "ADMIN"));
    } catch {
      showToast("No fue posible cargar las categorías.", "error");
    }
  }

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, [statusFilter]);

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const term = search.toLowerCase();
        const matchesSearch =
          product.name.toLowerCase().includes(term) ||
          product.barcode?.toLowerCase().includes(term) ||
          product.qr_code?.toLowerCase().includes(term) ||
          product.sku.toLowerCase().includes(term);
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
      showToast("Completa nombre, SKU, precio de venta y precio de compra.", "error");
      return;
    }
    setLoading(true);
    try {
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
      showToast(editing ? "Producto actualizado correctamente." : "Producto creado correctamente.", "success");
      await loadProducts();
    } catch {
      showToast("No fue posible guardar el producto.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function saveCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      const category = await createCategory({ name });
      setCategories((current) => [...current, category].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((current) => ({ ...current, category_id: category.id }));
      setNewCategoryName("");
      showToast("Categoría creada correctamente.", "success");
    } catch {
      showToast("No fue posible crear la categoría.", "error");
    }
  }

  async function saveManagedCategory() {
    const name = managedCategoryName.trim();
    if (!name) {
      showToast("El nombre de la categoría es obligatorio.", "error");
      return;
    }
    try {
      if (managedCategoryId) {
        await updateCategory(managedCategoryId, { name });
        showToast("Categoría actualizada correctamente.", "success");
      } else {
        await createCategory({ name });
        showToast("Categoría creada correctamente.", "success");
      }
      setManagedCategoryId(null);
      setManagedCategoryName("");
      await loadCategories();
    } catch {
      showToast("No fue posible guardar la categoría.", "error");
    }
  }

  async function confirmDeleteCategory() {
    if (!categoryDeleteId) return;
    try {
      const message = await deleteCategory(categoryDeleteId);
      showToast(message, "success");
      setCategoryDeleteId(null);
      await loadCategories();
    } catch {
      showToast("No se puede eliminar la categoría porque tiene productos asociados.", "error");
    }
  }

  function openCreateWithScannedCode(code: string) {
    setEditing(null);
    setForm({ ...emptyForm, barcode: code.length <= 80 ? code : "", qr_code: code.length > 80 ? code : "" });
    setImageFile(null);
    setModalOpen(true);
  }

  async function handleProductScan(code: string) {
    try {
      const product = await findProductByBarcode(code);
      setSearch(product.barcode ?? product.qr_code ?? code);
      showToast(`${product.name} encontrado por escaneo.`, "success");
    } catch {
      if (role === "ADMIN") {
        openCreateWithScannedCode(code);
        showToast(`Código ${code} no encontrado. Completa los datos para crear el producto.`, "info");
        return;
      }
      showToast(`No existe un producto activo con el código ${code}.`, "error");
    }
  }

  function openRemoveProduct(product: Product) {
    setRemovingProduct(product);
    setProductAction("deactivate");
    setAdminPassword("");
    setShowAdminPassword(false);
    setRemoveModalOpen(true);
  }

  function openPermanentDeleteProduct(product: Product) {
    setRemovingProduct(product);
    setProductAction("permanent_delete");
    setAdminPassword("");
    setShowAdminPassword(false);
    setRemoveModalOpen(true);
  }

  async function confirmRemoveProduct() {
    if (!removingProduct) return;
    if (!adminPassword) {
      showToast("Ingrese su contraseña de administrador.", "error");
      return;
    }
    setLoading(true);
    try {
      if (productAction === "deactivate") {
        await deactivateProduct(removingProduct.id, adminPassword);
        showToast("Producto desactivado correctamente. Su historial se conserva.", "success");
      } else {
        await permanentlyDeleteProduct(removingProduct.id, adminPassword);
        showToast("Producto eliminado permanentemente. Las ventas históricas se conservaron.", "success");
      }
      setRemoveModalOpen(false);
      setRemovingProduct(null);
      setAdminPassword("");
      setShowAdminPassword(false);
      await loadProducts();
    } catch {
      setAdminPassword("");
      setShowAdminPassword(false);
      showToast("No fue posible confirmar su identidad. Verifique la contraseña e intente nuevamente.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleReactivate(product: Product) {
    try {
      await reactivateProduct(product.id);
      showToast("Producto reactivado correctamente.", "success");
      await loadProducts();
    } catch {
      showToast("No fue posible reactivar el producto.", "error");
    }
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

      <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_220px_180px_minmax(260px,420px)]">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, SKU, código de barras o QR" className="w-full rounded-lg border border-gray-300 py-3 pl-11 pr-4" />
        </label>
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value ? Number(event.target.value) : "")} className="rounded-lg border border-gray-300 px-3 py-3 text-sm">
          <option value="">Todas las categorías</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "active" | "inactive" | "all")} className="rounded-lg border border-gray-300 px-3 py-3 text-sm">
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="all">Todos</option>
        </select>
        <BarcodeScannerInput onScan={handleProductScan} placeholder="Escanear para buscar o crear" />
      </div>

      {role === "ADMIN" && (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-emerald-50 p-2 text-[#1B8A5A]"><Tags className="h-5 w-5" /></span>
              <div>
                <h3 className="font-semibold text-gray-900">Categorías</h3>
                <p className="text-sm text-gray-500">Crea, edita y elimina categorías sin productos asociados.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input value={managedCategoryName} onChange={(event) => setManagedCategoryName(event.target.value)} placeholder="Nombre de categoría" className="min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
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
              <div key={category.id} className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <span>{category.name}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-600">{category.product_count} productos</span>
                <button type="button" onClick={() => { setManagedCategoryId(category.id); setManagedCategoryName(category.name); }} className="font-semibold text-[#1E4E5F] hover:underline">Editar</button>
                {category.product_count === 0 && (
                  <button type="button" onClick={() => setCategoryDeleteId(category.id)} className="font-semibold text-red-700 hover:underline">Eliminar</button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {filteredProducts.map((product) => (
          <article key={product.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-lg">
            <div className="flex aspect-square items-center justify-center bg-gray-100">
              {resolveMediaUrl(product.image_url) ? <img src={resolveMediaUrl(product.image_url) ?? ""} alt={product.name} className="h-full w-full object-cover" /> : <Package className="h-20 w-20 text-gray-300" />}
            </div>
            <div className="space-y-3 p-4">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 font-medium text-gray-900">{product.name}</h3>
                  {!product.is_active && <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">Inactivo</span>}
                </div>
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
                  {product.is_active ? (
                    <button onClick={() => openRemoveProduct(product)} title="Desactivar producto" aria-label={`Desactivar ${product.name}`} className="inline-flex items-center justify-center rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700">Desactivar</button>
                  ) : (
                    <button onClick={() => handleReactivate(product)} title="Reactivar producto" aria-label={`Reactivar ${product.name}`} className="inline-flex items-center justify-center rounded-lg border border-emerald-200 px-3 py-2 text-emerald-700"><RotateCcw className="h-4 w-4" /></button>
                  )}
                  <button onClick={() => openPermanentDeleteProduct(product)} title="Eliminar permanentemente" aria-label={`Eliminar permanentemente ${product.name}`} className="inline-flex items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-red-700"><Trash2 className="h-4 w-4" /></button>
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
          <button disabled={loading} className="rounded-lg bg-[#1B8A5A] px-4 py-3 text-white disabled:opacity-70 md:col-span-2">{loading ? "Guardando..." : "Guardar producto"}</button>
        </form>
      </ReusableModal>

      <ReusableModal
        open={removeModalOpen}
        title={productAction === "permanent_delete" ? "Eliminar permanentemente" : "Desactivar producto"}
        onClose={() => {
          setRemoveModalOpen(false);
          setAdminPassword("");
          setShowAdminPassword(false);
        }}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {productAction === "permanent_delete"
              ? "¿Desea eliminar permanentemente este producto? El producto desaparecerá del catálogo, pero sus ventas y registros históricos se conservarán. Esta acción no se puede deshacer."
              : "¿Desea desactivar este producto? No estará disponible para nuevas ventas, pero sus registros históricos se conservarán."}
          </div>
          <div>
            <p className="font-medium text-gray-900">{removingProduct?.name}</p>
            <p className="text-sm text-gray-500">{removingProduct?.sku} · {removingProduct?.barcode ?? removingProduct?.qr_code ?? "Sin código"}</p>
          </div>
          <form autoComplete="off" onSubmit={(event) => { event.preventDefault(); confirmRemoveProduct(); }} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm text-gray-700">Contraseña del administrador</span>
              <div className="relative">
                <input
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  type={showAdminPassword ? "text" : "password"}
                  name="product_admin_reauthentication_value"
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10"
                />
                <button type="button" onClick={() => setShowAdminPassword((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                  {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => { setRemoveModalOpen(false); setAdminPassword(""); setShowAdminPassword(false); }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={loading || !adminPassword} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-70">
                {loading ? "Procesando..." : "Confirmar"}
              </button>
            </div>
          </form>
        </div>
      </ReusableModal>

      <ReusableModal open={categoryDeleteId !== null} title="Eliminar categoría" onClose={() => setCategoryDeleteId(null)}>
        <div className="space-y-4">
          <p className="text-sm text-gray-700">Esta categoría solo se eliminará si no tiene productos asociados.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setCategoryDeleteId(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
            <button onClick={confirmDeleteCategory} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">Eliminar</button>
          </div>
        </div>
      </ReusableModal>
    </section>
  );
}
