import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Banknote, CreditCard, Plus, QrCode } from "lucide-react";
import { isAxiosError } from "axios";
import { useAuth } from "../context/AuthContext";
import { createPaymentOption, listPaymentOptions, type PaymentOption } from "../services/paymentOptionService";
import type { PaymentMethod } from "../types/api";

export function PaymentMethodSelector({ selected, onSelect }: { selected: PaymentOption | null; onSelect: (option: PaymentOption) => void }) {
  const { role } = useAuth();
  const [options, setOptions] = useState<PaymentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<PaymentMethod>("TRANSFER");
  const [saving, setSaving] = useState(false);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const initialSelection = useRef(selected?.id);

  useEffect(() => {
    let active = true;
    void listPaymentOptions().then((items) => {
      if (!active) return;
      setOptions(items);
      const current = items.find((item) => item.id === initialSelection.current) ?? items[0];
      if (current) selectRef.current(current);
    }).catch(() => { if (active) setError("No fue posible cargar los medios de pago. Cierra y vuelve a abrir el pago para reintentar."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function addOption() {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createPaymentOption(name.trim(), kind);
      setOptions((current) => [...current, created]);
      onSelect(created);
      setName("");
      setAdding(false);
    } catch (cause) {
      setError(isAxiosError(cause) && cause.response?.status === 409 ? "Ya existe un medio de pago con ese nombre." : "No fue posible guardar el medio de pago.");
    } finally { setSaving(false); }
  }

  return <section aria-label="Medios de pago" className="space-y-3">
    <p className="text-sm font-semibold text-gray-900">Medio de pago</p>
    {loading && <p role="status" className="text-sm text-gray-500">Cargando medios de pago...</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {options.map((option) => {
        const Icon = option.code === "QR_BREB" ? QrCode : option.kind === "CASH" ? Banknote : option.kind === "CARD" ? CreditCard : ArrowLeftRight;
        return <button key={option.id} type="button" aria-pressed={selected?.id === option.id} onClick={() => onSelect(option)}
          className={`flex min-h-20 min-w-0 flex-col items-center justify-center gap-2 rounded-lg border px-2 py-3 text-center text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 ${selected?.id === option.id ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}><Icon className="h-5 w-5 shrink-0" /><span className="w-full break-words">{option.name}</span></button>;
      })}
    </div>
    {role === "ADMIN" && <button type="button" onClick={() => setAdding((value) => !value)} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-emerald-700"><Plus className="h-4 w-4" />Añadir medio de pago</button>}
    {adding && <div className="grid gap-3 border-t border-gray-200 pt-3 sm:grid-cols-2">
      <label className="text-sm">Nombre<input autoFocus maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-3" /></label>
      <label className="text-sm">Tipo<select value={kind} onChange={(event) => setKind(event.target.value === "CASH" ? "CASH" : event.target.value === "CARD" ? "CARD" : "TRANSFER")} className="mt-1 w-full rounded-lg border border-gray-300 p-3"><option value="TRANSFER">Otro / confirmacion manual</option><option value="CASH">Efectivo</option><option value="CARD">Tarjeta</option></select></label>
      <button type="button" disabled={saving || !name.trim()} onClick={() => void addOption()} className="rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Guardando..." : "Guardar medio de pago"}</button>
    </div>}
    {selected && selected.kind !== "CASH" && <p className="rounded-lg bg-sky-50 p-3 text-xs text-sky-900">Confirma que recibiste el dinero. MeynaPOS no verifica automaticamente tarjetas, transferencias ni pagos QR Bre-B.</p>}
  </section>;
}
