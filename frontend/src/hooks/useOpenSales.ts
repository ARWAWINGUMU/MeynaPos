import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { useAuth } from "../context/AuthContext";
import { cancelOpenSale, completeOpenSale, createOpenSale, getOpenSale, listOpenSales, openSaleError, repriceOpenSale, saveOpenSale } from "../services/openSaleService";
import type { SalePayload } from "../types/api";
import { editorFromOpenSale, type OpenSale, type OpenSaleEditor } from "../types/openSale";
import { renameOpenSale } from "../services/openSaleService";

const emptyEditor: OpenSaleEditor = { cart: [], customerId: "", discountType: "NONE", discountValue: "", notes: "" };

export function useOpenSales() {
  const { session } = useAuth();
  const [sales, setSales] = useState<OpenSale[]>([]);
  const [active, setActive] = useState<OpenSale | null>(null);
  const [editor, setEditor] = useState<OpenSaleEditor>(emptyEditor);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef<OpenSale | null>(null);
  const editorRef = useRef<OpenSaleEditor>(emptyEditor);
  const generation = useRef(0);
  const persisted = useRef(0);
  const savingPromise = useRef<Promise<OpenSale> | null>(null);
  const blocked = useRef(false);
  const operationPending = useRef(false);
  const bootId = useRef(crypto.randomUUID());
  const pendingCreationId = useRef<string | null>(null);

  const createPending = useCallback(async () => {
    const id = pendingCreationId.current ?? crypto.randomUUID();
    pendingCreationId.current = id;
    const created = await createOpenSale(id);
    pendingCreationId.current = null;
    return created;
  }, []);

  const remember = useCallback((sale: OpenSale) => {
    activeRef.current = sale;
    setActive(sale);
    setSales((current) => current.some((item) => item.id === sale.id)
      ? current.map((item) => item.id === sale.id ? sale : item) : [...current, sale]);
  }, []);

  const restore = useCallback((sale: OpenSale) => {
    if (["COMPLETED", "CANCELLED"].includes(sale.status)) throw new Error("La venta ya fue cerrada. Selecciona otra venta abierta.");
    remember(sale);
    editorRef.current = editorFromOpenSale(sale);
    setEditor(editorRef.current);
    generation.current = 0;
    persisted.current = 0;
    blocked.current = false;
    setDirty(false);
    setError(null);
  }, [remember]);

  const flush = useCallback(async (status?: "DRAFT" | "HELD"): Promise<OpenSale> => {
    while (savingPromise.current) await savingPromise.current;
    if (blocked.current) throw new Error("Resuelve el conflicto recargando la venta guardada.");
    const sale = activeRef.current;
    if (!sale) throw new Error("La venta todavía no está lista.");
    if (generation.current === persisted.current && (!status || sale.status === status)) return sale;
    const task = (async () => {
      setSaving(true);
      try {
        do {
          const current = activeRef.current;
          if (!current || current.id !== sale.id) throw new Error("La venta activa cambió.");
          const marker = generation.current;
          const updated = await saveOpenSale(current, editorRef.current, status ?? "DRAFT");
          remember(updated);
          persisted.current = marker;
        } while (generation.current !== persisted.current);
        setDirty(false);
        setError(null);
        return activeRef.current!;
      } catch (cause) {
        const message = openSaleError(cause);
        if (message.includes("otra ventana") || message.includes("ya fue")) blocked.current = true;
        setError(message);
        throw cause;
      } finally { setSaving(false); }
    })();
    savingPromise.current = task;
    try { return await task; }
    finally { savingPromise.current = null; }
  }, [remember]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listOpenSales().then(async (items) => {
      if (cancelled) return;
      const initial = items.find((sale) => sale.cashier_id === session?.user.id) ?? items[0]
        ?? await createOpenSale(bootId.current);
      if (cancelled) return;
      setSales(items.length ? items : [initial]);
      restore(initial);
    }).catch((cause) => { if (!cancelled) setError(openSaleError(cause)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [session?.user.id, restore]);

  useEffect(() => {
    if (!dirty || loading || blocked.current) return;
    void flush().catch(() => undefined);
  }, [editor, dirty, loading, flush]);

  useEffect(() => {
    const guardNavigation = (event: MouseEvent) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || (link.target && link.target !== "_self") || link.origin !== window.location.origin
        || link.pathname === window.location.pathname || (generation.current === persisted.current && !savingPromise.current)) return;
      event.preventDefault();
      event.stopPropagation();
      void flush().then(() => link.click()).catch(() => undefined);
    };
    document.addEventListener("click", guardNavigation, true);
    return () => {
      document.removeEventListener("click", guardNavigation, true);
      if (activeRef.current && generation.current !== persisted.current && !blocked.current) void flush().catch(() => undefined);
    };
  }, [flush]);

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (generation.current !== persisted.current || savingPromise.current) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);

  const change = useCallback(<K extends keyof OpenSaleEditor>(key: K, value: SetStateAction<OpenSaleEditor[K]>) => {
    if (!activeRef.current || operationPending.current) return;
    const current = editorRef.current[key];
    const next = typeof value === "function" ? (value as (previous: OpenSaleEditor[K]) => OpenSaleEditor[K])(current) : value;
    editorRef.current = { ...editorRef.current, [key]: next };
    generation.current += 1;
    setEditor(editorRef.current);
    setDirty(true);
  }, []);

  async function execute<T>(operation: () => Promise<T>): Promise<T> {
    if (operationPending.current) throw new Error("Espera a que termine la operación actual.");
    operationPending.current = true;
    setBusy(true);
    try { return await operation(); }
    catch (cause) { setError(openSaleError(cause)); throw cause; }
    finally { operationPending.current = false; setBusy(false); }
  }

  const select = (id: string) => execute(async () => {
    await flush(editorRef.current.cart.length ? "HELD" : "DRAFT");
    const recovered = await getOpenSale(id);
    restore(recovered.status === "HELD" ? await saveOpenSale(recovered, editorFromOpenSale(recovered), "DRAFT") : recovered);
  });

  const create = () => execute(async () => {
    if (activeRef.current) await flush(editorRef.current.cart.length ? "HELD" : "DRAFT");
    restore(await createPending());
  });

  const reload = () => execute(async () => {
    while (savingPromise.current) { try { await savingPromise.current; } catch { break; } }
    const items = await listOpenSales();
    setSales(items);
    const current = items.find((item) => item.id === activeRef.current?.id) ?? items[0];
    restore(current ?? await createPending());
  });

  const hold = () => execute(async () => {
    await flush("HELD");
    restore(await createPending());
  });

  const rename = (identifier: string, name: string) => execute(async () => {
    const current = await flush();
    const target = current.id === identifier ? current : await getOpenSale(identifier);
    const updated = await renameOpenSale(target, name);
    if (current.id === identifier) remember(updated);
    else setSales((items) => items.map((item) => item.id === identifier ? updated : item));
  });

  const cancel = (identifier?: string) => execute(async () => {
    const current = await flush();
    await cancelOpenSale(!identifier || identifier === current.id ? current : await getOpenSale(identifier));
    const items = await listOpenSales();
    setSales(items);
    restore(items.find((item) => item.id === current.id) ?? items[0] ?? await createPending());
  });

  const validate = () => execute(async () => {
    const current = await flush();
    const checked = await getOpenSale(current.id);
    restore(checked);
    return checked;
  });

  const reprice = () => execute(async () => {
    const current = await flush();
    const updated = await repriceOpenSale(current);
    restore(updated);
    return updated;
  });

  const complete = (payment: SalePayload["payment"]) => execute(async () => {
    const current = await flush();
    const result = await completeOpenSale(current, payment);
    setSales((items) => items.filter((item) => item.id !== current.id));
    activeRef.current = null;
    setActive(null);
    editorRef.current = emptyEditor;
    setEditor(emptyEditor);
    generation.current = 0;
    persisted.current = 0;
    setDirty(false);
    return result;
  });

  return { sales, active, editor, loading, busy, saving, dirty, error,
    setCart: useCallback((value: SetStateAction<OpenSaleEditor["cart"]>) => change("cart", value), [change]),
    setCustomerId: useCallback((value: SetStateAction<OpenSaleEditor["customerId"]>) => change("customerId", value), [change]),
    setDiscountType: useCallback((value: SetStateAction<OpenSaleEditor["discountType"]>) => change("discountType", value), [change]),
    setDiscountValue: useCallback((value: SetStateAction<OpenSaleEditor["discountValue"]>) => change("discountValue", value), [change]),
    setNotes: useCallback((value: SetStateAction<string>) => change("notes", value), [change]),
    isActive: useCallback((id: string | undefined) => Boolean(id) && activeRef.current?.id === id && !operationPending.current, []),
    flush, select, create, reload, hold, cancel, rename, validate, reprice, complete };
}
