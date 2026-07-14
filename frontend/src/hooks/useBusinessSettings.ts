import { useEffect, useState } from "react";

import { getSettings, type BusinessSettings } from "../services/settingService";
import { DEFAULT_CURRENCY, normalizeCurrency, type CurrencyCode } from "../utils/money";

export function useBusinessSettings() {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getSettings()
      .then((data) => {
        if (!active) return;
        setSettings(data);
        setError(null);
      })
      .catch(() => {
        if (!active) return;
        setError("No fue posible cargar la configuración del negocio.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const currency: CurrencyCode = settings ? normalizeCurrency(settings.currency) : DEFAULT_CURRENCY;

  return { settings, currency, loading, error };
}
