import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Building2, Save, Upload } from "lucide-react";

import logoImg from "../assets/logo.png";
import { getSettings, updateSettings, uploadBusinessLogo, type BusinessSettings } from "../services/settingService";
import { resolveMediaUrl } from "../utils/media";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "../utils/money";

function resolveLogoUrl(logoUrl?: string | null): string {
  return resolveMediaUrl(logoUrl) ?? logoImg;
}

export function SettingsPage() {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings).catch(() => setError("No fue posible cargar la configuración."));
  }, []);

  const logoUrl = useMemo(() => resolveLogoUrl(settings?.logo_url), [settings?.logo_url]);

  function updateField<K extends keyof BusinessSettings>(key: K, value: BusinessSettings[K]) {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  }

  async function save() {
    if (!settings) return;
    setError(null);
    if (!settings.business_name.trim()) {
      setError("El nombre del negocio es obligatorio.");
      return;
    }
    if (!SUPPORTED_CURRENCIES.includes(settings.currency)) {
      setError("Selecciona una moneda válida.");
      return;
    }
    const taxPercentage = Number(settings.tax_percentage);
    if (Number.isNaN(taxPercentage) || taxPercentage < 0 || taxPercentage > 100) {
      setError("El porcentaje de impuesto debe estar entre 0 y 100.");
      return;
    }

    setSaving(true);
    try {
      setSettings(await updateSettings(settings));
      setMessage("Configuración actualizada.");
    } catch {
      setError("No fue posible guardar la configuración.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      setSettings(await uploadBusinessLogo(file));
      setMessage("Logo del negocio actualizado.");
    } catch {
      setError("No fue posible subir el logo del negocio.");
    }
  }

  if (!settings) return <section className="p-8">Cargando...</section>;

  return (
    <section className="space-y-5 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Configuración</h2>
          <p className="text-sm text-gray-500">Datos fiscales del negocio e impuesto aplicado en ventas.</p>
        </div>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#1B8A5A] px-4 py-3 font-semibold text-white hover:bg-[#156b46] disabled:opacity-70">
          <Save className="h-4 w-4" /> {saving ? "Guardando..." : "Guardar configuración"}
        </button>
      </div>

      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <aside className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#1B8A5A]" />
            <h3 className="font-semibold text-gray-900">Logo del negocio</h3>
          </div>
          <div className="mt-5 flex aspect-square items-center justify-center rounded-xl border border-gray-200 bg-gray-50 p-6">
            <img src={logoUrl} alt="Logo del negocio" className="max-h-full max-w-full object-contain" />
          </div>
          <label className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50">
            <Upload className="h-4 w-4" /> Subir logo
            <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
          </label>
        </aside>

        <div className="grid gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium text-gray-700">Nombre del negocio</span>
            <input value={settings.business_name} onChange={(e) => updateField("business_name", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-gray-700">NIT o documento</span>
            <input value={settings.tax_id} onChange={(e) => updateField("tax_id", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-gray-700">Dirección</span>
            <input value={settings.address} onChange={(e) => updateField("address", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-gray-700">Teléfono</span>
            <input value={settings.phone} onChange={(e) => updateField("phone", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-gray-700">Correo</span>
            <input value={settings.email} onChange={(e) => updateField("email", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-gray-700">Ciudad</span>
            <input value={settings.city} onChange={(e) => updateField("city", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-gray-700">Moneda</span>
            <select
              value={settings.currency}
              onChange={(e) => updateField("currency", e.target.value as CurrencyCode)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="COP">COP - Peso colombiano</option>
              <option value="USD">USD - Dólar estadounidense</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-gray-700">Porcentaje de impuesto</span>
            <input value={settings.tax_percentage} type="number" min="0" max="100" step="0.01" onChange={(e) => updateField("tax_percentage", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
        </div>
      </div>
    </section>
  );
}
