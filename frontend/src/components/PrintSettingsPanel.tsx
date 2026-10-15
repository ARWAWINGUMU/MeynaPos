import { useEffect, useMemo, useState } from "react";
import { Eye, Printer, Save } from "lucide-react";
import { updateSettings, type BusinessSettings } from "../services/settingService";
import logoImg from "../assets/logo.png";
import { ReusableModal } from "./ReusableModal";
import { createReceiptPdf, printReceiptPdf, type ReceiptData } from "../utils/receipt";
import { getBusinessPrintPreferences, PAPER_FORMATS, savePrintPreferences, type PaperFormat } from "../utils/printPreferences";

export function PrintSettingsPanel({ settings, onSettingsSaved }: { settings: BusinessSettings; onSettingsSaved: (settings: BusinessSettings) => void }) {
  const [preferences, setPreferences] = useState(() => getBusinessPrintPreferences(settings));
  const [saving, setSaving] = useState(false);
  useEffect(() => { setPreferences(getBusinessPrintPreferences(settings)); }, [settings.id, settings.print_preferences]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const sample = useMemo<ReceiptData>(() => ({
    sale: { id: 0, invoice_number: "PRUEBA-NO-VALIDA", created_at: new Date().toISOString() },
    customer: { id: 0, name: "Cliente de prueba" }, cashierName: "Impresión de prueba",
    paymentMethod: "CASH", receivedAmount: 30000, changeAmount: 7000,
    subtotal: 25000, tax: 0, discount: 2000, total: 23000, businessSettings: settings, logoUrl: logoImg,
    items: [{ quantity: 2, product: { id: 0, name: "Producto de prueba con nombre largo para comprobar el ajuste de texto",
      sku: "TEST", price: "12500", cost: "0", is_active: true } }],
  }), [settings]);

  useEffect(() => {
    if (!previewOpen) return;
    let cancelled = false;
    let url: string | null = null;
    setPreviewUrl(null);
    setError(null);
    void createReceiptPdf(sample, preferences).then((pdf) => {
      if (cancelled) return;
      url = URL.createObjectURL(pdf.output("blob"));
      setPreviewUrl(url);
    }).catch(() => { if (!cancelled) setError("No fue posible generar la vista previa."); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [previewOpen, preferences, sample]);

  async function save(): Promise<void> {
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      const updated = await updateSettings({ print_preferences: preferences });
      onSettingsSaved(updated);
      try { savePrintPreferences(updated.id, getBusinessPrintPreferences(updated)); } catch { /* The database is authoritative. */ }
      setMessage("Preferencias de impresión guardadas para el negocio.");
    } catch { setError("No fue posible guardar las preferencias del negocio."); }
    finally { setSaving(false); }
  }

  async function testPrint(): Promise<void> {
    setError(null);
    setPrinting(true);
    try { await printReceiptPdf(sample, preferences); }
    catch { setError("No fue posible abrir la impresión de prueba."); }
    finally { setPrinting(false); }
  }

  return (
    <section className="space-y-4 border-t border-gray-200 pt-6">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900"><Printer className="h-5 w-5 text-emerald-700" />Impresión del negocio</h3>
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-gray-700">Formato predeterminado
          <select value={preferences.format} onChange={(event) => {
            const format = event.target.value as PaperFormat;
            setPreferences((current) => ({ ...current, format, margin: PAPER_FORMATS[format].margin }));
          }} className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2">
            {Object.entries(PAPER_FORMATS).map(([value, paper]) => <option key={value} value={value}>{paper.label}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-gray-700">Margen por lado (mm)
          <input type="number" min="0" max={PAPER_FORMATS[preferences.format].maxMargin} step="0.5" value={preferences.margin}
            onChange={(event) => setPreferences((current) => ({ ...current,
              margin: Math.max(0, Math.min(PAPER_FORMATS[current.format].maxMargin, Number(event.target.value) || 0)) }))}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2" />
        </label>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {([ ["showLogo", "Logo"], ["showContact", "Contacto del negocio"], ["showCustomer", "Cliente"],
          ["showCashier", "Cajero"] ] as const).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={preferences[key]} onChange={(event) =>
              setPreferences((current) => ({ ...current, [key]: event.target.checked }))} className="accent-emerald-700" />{label}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={saving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-lg bg-[#1B8A5A] px-4 py-2 font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "Guardando..." : "Guardar preferencias"}</button>
        <button type="button" onClick={() => setPreviewOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2"><Eye className="h-4 w-4" />Vista previa</button>
        <button type="button" disabled={printing} onClick={() => void testPrint()} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 disabled:opacity-50"><Printer className="h-4 w-4" />Impresión de prueba</button>
      </div>
      <ReusableModal open={previewOpen} title={`Vista previa · ${PAPER_FORMATS[preferences.format].label}`} onClose={() => setPreviewOpen(false)}>
        {previewUrl ? <iframe title="Vista previa del comprobante" src={previewUrl} className="h-[55vh] w-full border-0" />
          : <p role="status">{error ?? "Generando vista previa..."}</p>}
      </ReusableModal>
    </section>
  );
}
