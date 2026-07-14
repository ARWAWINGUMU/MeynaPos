import {
  ArrowLeftRight,
  Banknote,
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  Minus,
  Package,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import logoImg from "../assets/logo.png";
import { BarcodeScannerInput } from "../components/BarcodeScannerInput";
import { ReusableModal } from "../components/ReusableModal";
import { useAuth } from "../context/AuthContext";
import { createCategory, listCategories } from "../services/categoryService";
import {
  createCustomer,
  getDefaultCustomer,
  getCustomerHistory,
  listCustomers,
  type Customer,
  type CustomerSaleHistoryItem,
  type CustomerPayload,
} from "../services/customerService";
import { createProduct, findProductByBarcode, listProducts, type ProductFormPayload } from "../services/productService";
import { createSale } from "../services/saleService";
import { getSettings, type BusinessSettings } from "../services/settingService";
import type { CartItem, Category, DiscountType, PaymentMethod, Product } from "../types/api";
import { resolveMediaUrl } from "../utils/media";
import { formatMoney, formatMoneyInput, parseMoneyInput } from "../utils/money";
import { downloadReceiptPdf, printReceiptPdf, type ReceiptData } from "../utils/receipt";

interface PaymentDraft {
  method: PaymentMethod;
  receivedAmount: number;
  changeAmount: number;
}

const emptyCustomerForm: CustomerPayload = {
  name: "",
  document_number: "",
  phone: "",
  email: "",
  address: "",
};

const emptyProductForm: ProductFormPayload = {
  name: "",
  description: "",
  barcode: "",
  qr_code: "",
  sku: "",
  price: "",
  cost: "",
  category_id: null,
  initial_stock: 0,
  minimum_stock: 5,
};

function getProductImageUrl(product: Product): string | null {
  return resolveMediaUrl(product.image_url);
}

export function POSPage() {
  const { fullName, role } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [defaultCustomer, setDefaultCustomer] = useState<Customer | null>(null);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | "">("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<"ALL" | "AVAILABLE" | "LOW" | "OUT">("ALL");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [cashReceived, setCashReceived] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("NONE");
  const [discountValue, setDiscountValue] = useState("");
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingSale, setLoadingSale] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerHistoryOpen, setCustomerHistoryOpen] = useState(false);
  const [scanNotFoundModalOpen, setScanNotFoundModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState<CustomerPayload>(emptyCustomerForm);
  const [customerHistory, setCustomerHistory] = useState<CustomerSaleHistoryItem[]>([]);
  const [customerHistoryLoading, setCustomerHistoryLoading] = useState(false);
  const [scannedCode, setScannedCode] = useState("");
  const [productForm, setProductForm] = useState<ProductFormPayload>(emptyProductForm);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const loadProducts = useCallback(async () => {
    setProducts(await listProducts(search));
  }, [search]);

  const loadCustomers = useCallback(async () => {
    const [defaultRecord, records] = await Promise.all([getDefaultCustomer(), listCustomers()]);
    const merged = records.some((customer) => customer.id === defaultRecord.id) ? records : [defaultRecord, ...records];
    setDefaultCustomer(defaultRecord);
    setCustomers(merged);
    setSelectedCustomerId((current) => current || defaultRecord.id);
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    listCategories().then(setCategories).catch(() => undefined);
  }, []);

  useEffect(() => {
    getSettings()
      .then(setBusinessSettings)
      .catch(() => setMessage("No fue posible cargar la configuración del negocio."));
  }, []);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId],
  );

  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.document_number, customer.phone, customer.email].some((value) => value?.toLowerCase().includes(term)),
    );
  }, [customerSearch, customers]);

  const visibleProducts = useMemo(() => {
    return products.filter((product) => {
      const stock = product.inventory?.quantity ?? 0;
      if (stockFilter === "AVAILABLE") {
        return stock > 0;
      }
      if (stockFilter === "LOW") {
        return Boolean(product.inventory?.low_stock) && stock > 0;
      }
      if (stockFilter === "OUT") {
        return stock <= 0;
      }
      return true;
    });
  }, [products, stockFilter]);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0),
    [cart],
  );
  const taxPercentage = Number(businessSettings?.tax_percentage ?? 0);
  const tax = subtotal * taxPercentage / 100;
  const totalBeforeDiscount = subtotal + tax;
  const parsedDiscountValue = Number(discountValue || 0);
  const discountNumericValue = Number.isFinite(parsedDiscountValue) ? parsedDiscountValue : 0;
  const discountAmount = useMemo(() => {
    if (discountType === "FIXED") {
      return Math.max(discountNumericValue, 0);
    }
    if (discountType === "PERCENTAGE") {
      return totalBeforeDiscount * Math.max(discountNumericValue, 0) / 100;
    }
    return 0;
  }, [discountNumericValue, discountType, totalBeforeDiscount]);
  const total = Math.max(totalBeforeDiscount - discountAmount, 0);
  const cashAmount = Number(cashReceived || 0);
  const cashChange = Math.max(cashAmount - total, 0);
  const currencyCode = businessSettings?.currency ?? "COP";

  const addToCart = useCallback((product: Product) => {
    const stock = product.inventory?.quantity ?? 0;
    if (stock <= 0) {
      setMessage("Este producto no tiene stock disponible.");
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      const currentQuantity = existing?.quantity ?? 0;
      if (currentQuantity + 1 > stock) {
        setMessage("No hay stock suficiente para agregar más unidades.");
        return current;
      }
      if (existing) {
        return current.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...current, { product, quantity: 1 }];
    });
  }, []);

  const handleScan = useCallback(
    async (barcodeValue: string) => {
      try {
        const product = await findProductByBarcode(barcodeValue);
        addToCart(product);
        setMessage(`${product.name} agregado por código de barras.`);
      } catch {
        setScannedCode(barcodeValue);
        setScanNotFoundModalOpen(true);
        setMessage("No se encontró un producto activo con ese código.");
      }
    },
    [addToCart],
  );

  function changeQuantity(productId: number, delta: number) {
    setCart((current) =>
      current
        .map((item) => {
          if (item.product.id !== productId) {
            return item;
          }
          const stock = item.product.inventory?.quantity ?? 0;
          const nextQuantity = Math.min(stock, item.quantity + delta);
          return { ...item, quantity: nextQuantity };
        })
        .filter((item) => item.quantity > 0),
    );
  }

  function validateSale(): boolean {
    if (cart.length === 0) {
      setMessage("Agrega productos antes de registrar la venta.");
      return false;
    }
    if (!selectedCustomer) {
      setMessage("Selecciona un cliente antes de facturar.");
      return false;
    }
    if (!businessSettings) {
      setMessage("La configuración del negocio todavía no está disponible.");
      return false;
    }
    const invalidStock = cart.find((item) => item.quantity > (item.product.inventory?.quantity ?? 0));
    if (invalidStock) {
      setMessage(`Stock insuficiente para ${invalidStock.product.name}.`);
      return false;
    }
    if (discountType === "FIXED" && (discountNumericValue <= 0 || discountNumericValue > totalBeforeDiscount)) {
      setMessage("El descuento fijo debe ser mayor que 0 y no superar el subtotal más impuestos.");
      return false;
    }
    if (discountType === "PERCENTAGE" && (discountNumericValue <= 0 || discountNumericValue > 100)) {
      setMessage("El descuento porcentual debe ser mayor que 0 y menor o igual a 100.");
      return false;
    }
    return true;
  }

  function startCheckout() {
    setMessage(null);
    if (!validateSale()) {
      return;
    }
    setCashReceived("");
    setPaymentModalOpen(true);
  }

  function confirmPayment() {
    if (!validateSale()) {
      return;
    }
    if (paymentMethod === "CASH" && cashAmount < total) {
      setMessage("El valor recibido no puede ser menor al total de la venta.");
      return;
    }
    setPaymentDraft({
      method: paymentMethod,
      receivedAmount: paymentMethod === "CASH" ? cashAmount : total,
      changeAmount: paymentMethod === "CASH" ? cashChange : 0,
    });
    setPaymentModalOpen(false);
    setConfirmModalOpen(true);
  }

  async function confirmSale() {
    const currentBusinessSettings = businessSettings;
    if (!paymentDraft || !selectedCustomer || !currentBusinessSettings) {
      setMessage("Faltan datos para confirmar la venta.");
      return;
    }

    setLoadingSale(true);
    try {
      const saleItems = cart.map((item) => ({ product_id: item.product.id, quantity: item.quantity }));
      const saleResponse = await createSale({
        customer_id: selectedCustomer.id,
        items: saleItems,
        payment: {
          method: paymentDraft.method,
          amount: paymentDraft.receivedAmount.toFixed(2),
        },
        tipo_descuento: discountType,
        valor_descuento: discountType === "NONE" ? "0.00" : discountNumericValue.toFixed(2),
      });
      const receiptData: ReceiptData = {
        sale: saleResponse,
        items: cart,
        customer: selectedCustomer,
        cashierName: fullName ?? "Cajero",
        paymentMethod: paymentDraft.method,
        receivedAmount: paymentDraft.receivedAmount,
        changeAmount: paymentDraft.changeAmount,
        subtotal: Number(saleResponse.subtotal),
        tax: Number(saleResponse.tax_amount ?? saleResponse.tax),
        discount: Number(saleResponse.monto_descuento ?? 0),
        total: Number(saleResponse.total),
        businessSettings: currentBusinessSettings,
        logoUrl: logoImg,
      };
      setReceipt(receiptData);
      setCart([]);
      setCashReceived("");
      setDiscountType("NONE");
      setDiscountValue("");
      setPaymentDraft(null);
      setConfirmModalOpen(false);
      setMessage("Venta registrada correctamente.");
      await loadProducts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible registrar la venta.");
    } finally {
      setLoadingSale(false);
    }
  }

  function openCreateCustomerModal() {
    setCustomerForm(emptyCustomerForm);
    setCustomerModalOpen(true);
  }

  async function saveCustomer() {
    if (!customerForm.name.trim() || !customerForm.document_number?.trim()) {
      setMessage("El nombre y documento del cliente son obligatorios.");
      return;
    }
    const customer = await createCustomer(customerForm);
    await loadCustomers();
    setSelectedCustomerId(customer.id);
    setCustomerModalOpen(false);
    setMessage("Cliente creado.");
  }

  async function openCustomerHistory() {
    if (!selectedCustomer) {
      setMessage("Selecciona un cliente para consultar su historial.");
      return;
    }
    setCustomerHistoryOpen(true);
    setCustomerHistoryLoading(true);
    try {
      setCustomerHistory(await getCustomerHistory(selectedCustomer.id));
    } catch {
      setMessage("No fue posible cargar el historial del cliente.");
    } finally {
      setCustomerHistoryLoading(false);
    }
  }

  async function saveCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      return;
    }
    const category = await createCategory({ name });
    setCategories((current) => [...current, category].sort((a, b) => a.name.localeCompare(b.name)));
    setProductForm((current) => ({ ...current, category_id: category.id }));
    setNewCategoryName("");
  }

  function openScannedProductForm() {
    setProductForm({
      ...emptyProductForm,
      barcode: scannedCode.length <= 80 ? scannedCode : "",
      qr_code: scannedCode.length > 80 ? scannedCode : "",
    });
    setScanNotFoundModalOpen(false);
    setProductModalOpen(true);
  }

  async function saveScannedProduct() {
    if (!productForm.name || !productForm.sku || !productForm.price || !productForm.cost) {
      setMessage("Completa nombre, SKU, precio de venta y precio de compra.");
      return;
    }
    const product = await createProduct({
      ...productForm,
      barcode: productForm.barcode || undefined,
      qr_code: productForm.qr_code || undefined,
      category_id: productForm.category_id || undefined,
    });
    setProductModalOpen(false);
    setMessage("Producto creado desde el código escaneado.");
    await loadProducts();
    addToCart(product);
  }

  return (
    <section className="flex min-h-[calc(100vh-9rem)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col bg-[#F8FAFC]">
        <div className="space-y-4 border-b border-gray-200 bg-white p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Ventas</h2>
              <p className="text-sm text-gray-500">Busca, escanea y factura productos desde una sola pantalla.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "ALL", label: "Todos" },
                { value: "AVAILABLE", label: "Disponibles" },
                { value: "LOW", label: "Bajo stock" },
                { value: "OUT", label: "Sin stock" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setStockFilter(option.value as typeof stockFilter)}
                  className={`rounded-lg px-4 py-2 text-sm transition-colors ${
                    stockFilter === option.value ? "bg-[#1B8A5A] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[1fr_280px]">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-12 w-full rounded-lg border border-gray-300 bg-white pl-11 pr-4 outline-none focus:ring-2 focus:ring-[#1B8A5A]"
                placeholder="Buscar productos..."
              />
            </label>
            <BarcodeScannerInput onScan={handleScan} placeholder="Código de barras o QR" />
          </div>

          {message && <p className="rounded-lg border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-800">{message}</p>}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {visibleProducts.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Package className="mb-4 h-16 w-16 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900">No hay productos</h3>
              <p className="text-sm text-gray-500">No se encontraron productos para la búsqueda actual.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {visibleProducts.map((product) => {
                const imageUrl = getProductImageUrl(product);
                const stock = product.inventory?.quantity ?? 0;
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition hover:border-[#1B8A5A]/40 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={stock <= 0}
                  >
                    {imageUrl ? (
                      <img src={imageUrl} alt={product.name} className="h-32 w-full object-cover" />
                    ) : (
                      <div className="flex h-32 items-center justify-center bg-emerald-50">
                        <Package className="h-10 w-10 text-[#1B8A5A]" />
                      </div>
                    )}
                    <div className="space-y-3 p-4">
                      <div>
                        <p className="line-clamp-1 font-semibold text-gray-900">{product.name}</p>
                        <p className="text-xs text-gray-500">{product.sku}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-[#1B8A5A]">{formatMoney(product.price, currencyCode)}</span>
                        <span className={`text-xs ${stock <= 0 ? "text-red-600" : product.inventory?.low_stock ? "text-amber-600" : "text-gray-500"}`}>
                          {stock} unidades
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <aside className="flex w-full flex-col border-l border-gray-200 bg-white lg:w-[430px]">
        <div className="border-b border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-[#1B8A5A]" />
              <h3 className="text-lg font-semibold text-gray-900">Carrito de Venta</h3>
            </div>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-sm text-red-600 hover:text-red-700">
                Vaciar
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3 border-b border-gray-200 p-5">
          <label className="block text-sm font-medium text-gray-700">Cliente</label>
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={customerSearch}
              onChange={(event) => setCustomerSearch(event.target.value)}
              placeholder="Buscar cliente por nombre o documento"
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#1B8A5A]"
            />
          </label>
          <div className="flex gap-2">
            <select
              value={selectedCustomerId}
              onChange={(event) => setSelectedCustomerId(Number(event.target.value))}
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B8A5A]"
            >
              {filteredCustomers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}{customer.id === defaultCustomer?.id ? " (predeterminado)" : ""}
                </option>
              ))}
            </select>
            <button onClick={openCreateCustomerModal} className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50" aria-label="Crear cliente">
              <Plus className="h-4 w-4" />
            </button>
            <button onClick={openCustomerHistory} className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50" aria-label="Ver historial del cliente">
              <Eye className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-gray-500">Usa el cliente predeterminado o registra uno antes de facturar.</p>
        </div>

        <div className="min-h-[240px] flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <ShoppingCart className="mb-4 h-16 w-16 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900">Carrito vacío</h3>
              <p className="text-sm text-gray-500">Agrega productos del catálogo para comenzar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.product.id} className="rounded-lg border border-gray-200 bg-[#F8FAFC] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-medium text-gray-900">{item.product.name}</p>
                      <p className="text-sm font-semibold text-[#1B8A5A]">{formatMoney(item.product.price, currencyCode)}</p>
                    </div>
                    <button onClick={() => changeQuantity(item.product.id, -item.quantity)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50" aria-label="Eliminar producto">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center overflow-hidden rounded-md border border-gray-200 bg-white">
                      <button onClick={() => changeQuantity(item.product.id, -1)} className="p-2 hover:bg-gray-50" aria-label="Disminuir cantidad">
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-12 text-center text-sm font-semibold">{item.quantity}</span>
                      <button onClick={() => changeQuantity(item.product.id, 1)} className="p-2 hover:bg-gray-50" aria-label="Aumentar cantidad">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="font-semibold text-gray-900">{formatMoney(Number(item.product.price) * item.quantity, currencyCode)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4 border-t border-gray-200 p-5">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium text-gray-900">{formatMoney(subtotal, currencyCode)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Impuestos ({taxPercentage.toFixed(2)}%)</span>
              <span className="font-medium text-gray-900">{formatMoney(tax, currencyCode)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Descuento</span>
              <span className="font-medium text-gray-900">-{formatMoney(discountAmount, currencyCode)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-3">
              <span className="text-lg font-semibold text-gray-900">Total final</span>
              <span className="text-2xl font-bold text-[#1B8A5A]">{formatMoney(total, currencyCode)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "CASH", label: "Efectivo", icon: Banknote },
              { value: "CARD", label: "Tarjeta", icon: CreditCard },
              { value: "TRANSFER", label: "Transfer.", icon: ArrowLeftRight },
            ].map((method) => {
              const Icon = method.icon;
              return (
                <button
                  key={method.value}
                  onClick={() => setPaymentMethod(method.value as PaymentMethod)}
                  className={`rounded-lg border p-3 text-xs font-medium transition ${
                    paymentMethod === method.value ? "border-[#1B8A5A] bg-emerald-50 text-[#1B8A5A]" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="mx-auto mb-1 h-5 w-5" />
                  {method.label}
                </button>
              );
            })}
          </div>

          <button onClick={startCheckout} className="w-full rounded-lg bg-[#1B8A5A] px-4 py-3 font-semibold text-white hover:bg-[#156b46]">
            Procesar Pago
          </button>
          <button onClick={() => setCart([])} className="w-full rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50">
            Cancelar Venta
          </button>
        </div>
      </aside>

      <ReusableModal open={paymentModalOpen} title="Procesar pago" onClose={() => setPaymentModalOpen(false)}>
        <div className="space-y-5">
          <div className="rounded-lg bg-emerald-50 p-4 text-center">
            <p className="text-sm text-gray-500">Total final a pagar</p>
            <p className="text-4xl font-bold text-[#1B8A5A]">{formatMoney(total, currencyCode)}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Tipo de descuento</span>
              <select
                value={discountType}
                onChange={(event) => {
                  setDiscountType(event.target.value as DiscountType);
                  setDiscountValue("");
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-3 outline-none focus:ring-2 focus:ring-[#1B8A5A]"
              >
                <option value="NONE">Sin descuento</option>
                <option value="FIXED">Valor fijo</option>
                <option value="PERCENTAGE">Porcentaje</option>
              </select>
            </label>
            {discountType !== "NONE" && (
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700">{discountType === "FIXED" ? "Valor descuento" : "Porcentaje descuento"}</span>
                <input
                  value={discountType === "FIXED" ? formatMoneyInput(discountValue, currencyCode) : discountValue}
                  onChange={(event) => setDiscountValue(discountType === "FIXED" ? parseMoneyInput(event.target.value) : event.target.value.replace(/[^\d.]/g, ""))}
                  inputMode="decimal"
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 text-lg font-semibold outline-none focus:ring-2 focus:ring-[#1B8A5A]"
                  placeholder={discountType === "FIXED" ? "0" : "0%"}
                />
              </label>
            )}
          </div>
          <div className="rounded-lg border border-gray-200 p-4 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><strong>{formatMoney(subtotal, currencyCode)}</strong></div>
            <div className="flex justify-between"><span>Impuesto</span><strong>{formatMoney(tax, currencyCode)}</strong></div>
            <div className="flex justify-between"><span>Descuento</span><strong>-{formatMoney(discountAmount, currencyCode)}</strong></div>
            <div className="flex justify-between border-t border-gray-200 pt-2 text-base"><span>Total final</span><strong>{formatMoney(total, currencyCode)}</strong></div>
          </div>
          {paymentMethod === "CASH" && (
            <>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700">Valor recibido</span>
                <input
                  value={formatMoneyInput(cashReceived, currencyCode)}
                  onChange={(event) => setCashReceived(parseMoneyInput(event.target.value))}
                  inputMode="decimal"
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 text-lg font-semibold outline-none focus:ring-2 focus:ring-[#1B8A5A]"
                  placeholder="0"
                />
              </label>
              <div className={`rounded-lg p-4 ${cashAmount >= total ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
                <p className="text-sm">Cambio</p>
                <p className="text-2xl font-bold">{cashAmount >= total ? formatMoney(cashChange, currencyCode) : "Valor insuficiente"}</p>
              </div>
            </>
          )}
          <button
            onClick={confirmPayment}
            disabled={paymentMethod === "CASH" && cashAmount < total}
            className="w-full rounded-lg bg-[#1B8A5A] px-4 py-3 font-semibold text-white hover:bg-[#156b46] disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Confirmar Pago
          </button>
        </div>
      </ReusableModal>

      <ReusableModal open={confirmModalOpen} title="Confirmar venta" onClose={() => setConfirmModalOpen(false)}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Revisa los datos antes de registrar la venta.</p>
          <div className="rounded-lg border border-gray-200 p-4 text-sm">
            <div className="flex justify-between"><span>Cliente</span><strong>{selectedCustomer?.name}</strong></div>
            <div className="flex justify-between"><span>Método</span><strong>{paymentDraft?.method === "CASH" ? "Efectivo" : paymentDraft?.method === "CARD" ? "Tarjeta" : "Transferencia"}</strong></div>
            <div className="flex justify-between"><span>Impuesto aplicado</span><strong>{taxPercentage.toFixed(2)}%</strong></div>
            <div className="flex justify-between"><span>Descuento</span><strong>-{formatMoney(discountAmount, currencyCode)}</strong></div>
            <div className="flex justify-between"><span>Total final</span><strong>{formatMoney(total, currencyCode)}</strong></div>
            <div className="flex justify-between"><span>Recibido</span><strong>{formatMoney(paymentDraft?.receivedAmount ?? 0, currencyCode)}</strong></div>
            <div className="flex justify-between"><span>Cambio</span><strong>{formatMoney(paymentDraft?.changeAmount ?? 0, currencyCode)}</strong></div>
          </div>
          <button onClick={confirmSale} disabled={loadingSale} className="w-full rounded-lg bg-[#1B8A5A] px-4 py-3 font-semibold text-white hover:bg-[#156b46] disabled:opacity-70">
            {loadingSale ? "Registrando venta..." : "Registrar venta"}
          </button>
        </div>
      </ReusableModal>

      <ReusableModal open={scanNotFoundModalOpen} title="Código no encontrado" onClose={() => setScanNotFoundModalOpen(false)}>
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-medium uppercase text-gray-500">Código capturado</p>
            <p className="mt-1 break-all font-semibold text-gray-900">{scannedCode}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <button onClick={() => handleScan(scannedCode)} className="rounded-lg border border-gray-300 px-4 py-3 font-medium hover:bg-gray-50">
              Buscar nuevamente
            </button>
            {role === "ADMIN" && (
              <button onClick={openScannedProductForm} className="rounded-lg bg-[#1B8A5A] px-4 py-3 font-semibold text-white hover:bg-[#156b46]">
                Crear producto
              </button>
            )}
            <button onClick={() => setScanNotFoundModalOpen(false)} className="rounded-lg border border-gray-300 px-4 py-3 font-medium hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </div>
      </ReusableModal>

      <ReusableModal open={productModalOpen} title="Crear producto escaneado" onClose={() => setProductModalOpen(false)}>
        <form onSubmit={(event) => { event.preventDefault(); saveScannedProduct(); }} className="grid gap-3 md:grid-cols-2">
          <input value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} placeholder="Nombre" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={productForm.sku} onChange={(event) => setProductForm({ ...productForm, sku: event.target.value })} placeholder="SKU" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={productForm.barcode ?? ""} onChange={(event) => setProductForm({ ...productForm, barcode: event.target.value })} placeholder="Código de barras" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={productForm.qr_code ?? ""} onChange={(event) => setProductForm({ ...productForm, qr_code: event.target.value })} placeholder="Código QR como texto" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={formatMoneyInput(productForm.price, currencyCode)} onChange={(event) => setProductForm({ ...productForm, price: parseMoneyInput(event.target.value) })} inputMode="decimal" placeholder="Precio de venta" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={formatMoneyInput(productForm.cost, currencyCode)} onChange={(event) => setProductForm({ ...productForm, cost: parseMoneyInput(event.target.value) })} inputMode="decimal" placeholder="Precio de compra" className="rounded-lg border border-gray-300 px-3 py-2" />
          <select value={productForm.category_id ?? ""} onChange={(event) => setProductForm({ ...productForm, category_id: event.target.value ? Number(event.target.value) : null })} className="rounded-lg border border-gray-300 px-3 py-2">
            <option value="">Sin categoría</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <div className="flex gap-2">
            <input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Nueva categoría" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2" />
            <button type="button" onClick={saveCategory} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50">Crear</button>
          </div>
          <input type="number" value={productForm.initial_stock} onChange={(event) => setProductForm({ ...productForm, initial_stock: Number(event.target.value) })} placeholder="Stock" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input type="number" value={productForm.minimum_stock} onChange={(event) => setProductForm({ ...productForm, minimum_stock: Number(event.target.value) })} placeholder="Stock mínimo" className="rounded-lg border border-gray-300 px-3 py-2" />
          <textarea value={productForm.description ?? ""} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} placeholder="Descripción" className="rounded-lg border border-gray-300 px-3 py-2 md:col-span-2" />
          <button className="rounded-lg bg-[#1B8A5A] px-4 py-3 font-semibold text-white hover:bg-[#156b46] md:col-span-2">
            Guardar producto
          </button>
        </form>
      </ReusableModal>

      <ReusableModal open={customerModalOpen} title="Crear cliente" onClose={() => setCustomerModalOpen(false)}>
        <div className="grid gap-3 md:grid-cols-2">
          <input value={customerForm.name} onChange={(event) => setCustomerForm({ ...customerForm, name: event.target.value })} placeholder="Nombre" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={customerForm.document_number ?? ""} onChange={(event) => setCustomerForm({ ...customerForm, document_number: event.target.value })} placeholder="Documento" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={customerForm.phone ?? ""} onChange={(event) => setCustomerForm({ ...customerForm, phone: event.target.value })} placeholder="Teléfono" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={customerForm.email ?? ""} onChange={(event) => setCustomerForm({ ...customerForm, email: event.target.value })} placeholder="Correo" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={customerForm.address ?? ""} onChange={(event) => setCustomerForm({ ...customerForm, address: event.target.value })} placeholder="Dirección" className="rounded-lg border border-gray-300 px-3 py-2 md:col-span-2" />
          <button onClick={saveCustomer} className="rounded-lg bg-[#1B8A5A] px-4 py-2 font-semibold text-white hover:bg-[#156b46] md:col-span-2">
            Guardar cliente
          </button>
        </div>
      </ReusableModal>

      <ReusableModal open={customerHistoryOpen} title={selectedCustomer ? `Historial de ${selectedCustomer.name}` : "Historial del cliente"} onClose={() => setCustomerHistoryOpen(false)}>
        <div className="space-y-4">
          {customerHistoryLoading && <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">Cargando historial...</p>}
          <div className="max-h-[420px] overflow-y-auto rounded-lg border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-3">Venta</th>
                  <th className="px-3 py-3">Fecha</th>
                  <th className="px-3 py-3">Productos</th>
                  <th className="px-3 py-3">Pago</th>
                  <th className="px-3 py-3">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customerHistory.map((sale) => (
                  <tr key={sale.id}>
                    <td className="px-3 py-3 font-medium">{sale.sale_number}</td>
                    <td className="px-3 py-3">{new Date(sale.date).toLocaleString()}</td>
                    <td className="px-3 py-3">{sale.products.map((product) => product.name).join(", ")}</td>
                    <td className="px-3 py-3">{sale.payment_method === "CASH" ? "Efectivo" : sale.payment_method === "CARD" ? "Tarjeta" : "Transferencia"}</td>
                    <td className="px-3 py-3 font-semibold text-[#1B8A5A]">{formatMoney(sale.total, currencyCode)}</td>
                  </tr>
                ))}
                {!customerHistoryLoading && customerHistory.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-gray-500">Este cliente no tiene compras registradas.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </ReusableModal>

      <ReusableModal open={Boolean(receipt)} title="Venta registrada correctamente" onClose={() => setReceipt(null)}>
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-emerald-50 p-4 text-emerald-800">
            <CheckCircle2 className="h-6 w-6" />
            <p className="text-sm font-medium">¿Desea imprimir o guardar el recibo?</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button onClick={() => receipt && downloadReceiptPdf(receipt)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 font-medium hover:bg-gray-50">
              <Download className="h-4 w-4" /> Guardar PDF
            </button>
            <button onClick={() => receipt && printReceiptPdf(receipt)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 font-medium hover:bg-gray-50">
              <Printer className="h-4 w-4" /> Imprimir
            </button>
            <button onClick={() => setReceipt(null)} className="rounded-lg bg-[#1B8A5A] px-4 py-3 font-semibold text-white hover:bg-[#156b46]">
              Cerrar
            </button>
          </div>
        </div>
      </ReusableModal>
    </section>
  );
}
