import type { BusinessSettings } from "../services/settingService";

export const PAPER_FORMATS = {
  THERMAL_58: { label: "Térmica 58 mm", width: 58, height: null, margin: 3, maxMargin: 8 },
  THERMAL_80: { label: "Térmica 80 mm", width: 80, height: null, margin: 4, maxMargin: 12 },
  LETTER: { label: "Carta", width: 215.9, height: 279.4, margin: 12, maxMargin: 30 },
  A4: { label: "A4", width: 210, height: 297, margin: 12, maxMargin: 30 },
} as const;

export type PaperFormat = keyof typeof PAPER_FORMATS;
export interface PrintPreferences {
  format: PaperFormat;
  margin: number;
  showLogo: boolean;
  showContact: boolean;
  showCustomer: boolean;
  showCashier: boolean;
  showFooter: boolean;
}

export const DEFAULT_PRINT_PREFERENCES: PrintPreferences = {
  format: "LETTER", margin: 12, showLogo: true, showContact: true,
  showCustomer: true, showCashier: true, showFooter: true,
};

export function normalizePrintPreferences(value: unknown): PrintPreferences {
  if (!value || typeof value !== "object") return { ...DEFAULT_PRINT_PREFERENCES };
  const source = Object.fromEntries(Object.entries(value));
  const format: PaperFormat = Object.prototype.hasOwnProperty.call(PAPER_FORMATS, source.format)
    ? source.format : "LETTER";
  const paper = PAPER_FORMATS[format];
  const result: PrintPreferences = { ...DEFAULT_PRINT_PREFERENCES, format, margin: paper.margin };
  if (typeof source.margin === "number" && Number.isFinite(source.margin)) {
    result.margin = Math.max(0, Math.min(paper.maxMargin, source.margin));
  }
  for (const key of ["showLogo", "showContact", "showCustomer", "showCashier"] as const) {
    if (typeof source[key] === "boolean") result[key] = source[key];
  }
  return result;
}

export function getBusinessPrintPreferences(settings: BusinessSettings): PrintPreferences {
  return normalizePrintPreferences(settings.print_preferences ?? DEFAULT_PRINT_PREFERENCES);
}

function storageKey(businessId: number): string {
  return `meynapos:print-preferences:v1:${businessId}`;
}

export function getPrintPreferences(businessId: number): PrintPreferences {
  try {
    return normalizePrintPreferences(JSON.parse(localStorage.getItem(storageKey(businessId)) ?? "null"));
  } catch {
    return { ...DEFAULT_PRINT_PREFERENCES };
  }
}

export function savePrintPreferences(businessId: number, preferences: PrintPreferences): void {
  localStorage.setItem(storageKey(businessId), JSON.stringify(normalizePrintPreferences(preferences)));
}
