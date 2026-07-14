export type CurrencyCode = "COP" | "USD";

export const DEFAULT_CURRENCY: CurrencyCode = "COP";
export const SUPPORTED_CURRENCIES: CurrencyCode[] = ["COP", "USD"];

export function normalizeCurrency(currency?: string | null): CurrencyCode {
  return currency === "USD" ? "USD" : "COP";
}

export function formatMoney(value: string | number, currency?: string | null): string {
  const amount = Number(value);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const normalizedCurrency = normalizeCurrency(currency);

  if (normalizedCurrency === "COP") {
    return `$ ${Math.round(safeAmount).toLocaleString("es-CO")}`;
  }

  return `US$ ${safeAmount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function parseMoneyInput(value: string): string {
  const sanitized = value.replace(/[^\d.,]/g, "");
  if (!sanitized) {
    return "";
  }

  const commaIndex = sanitized.lastIndexOf(",");
  const dotIndex = sanitized.lastIndexOf(".");
  const decimalIndex = Math.max(commaIndex, dotIndex);
  const decimalPart = decimalIndex >= 0 ? sanitized.slice(decimalIndex + 1).replace(/\D/g, "") : "";

  if (decimalIndex >= 0 && decimalPart.length > 0 && decimalPart.length <= 2) {
    const integerPart = sanitized.slice(0, decimalIndex).replace(/\D/g, "");
    return `${integerPart || "0"}.${decimalPart}`;
  }

  if (decimalIndex >= 0 && decimalPart.length === 0) {
    return sanitized.slice(0, decimalIndex).replace(/\D/g, "");
  }

  return sanitized.replace(/\D/g, "");
}

export function formatMoneyInput(value: string | number, currency?: string | null): string {
  if (value === "") {
    return "";
  }
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "";
  }
  const normalizedCurrency = normalizeCurrency(currency);

  if (normalizedCurrency === "COP") {
    return Math.round(amount).toLocaleString("es-CO");
  }

  return amount.toLocaleString("en-US", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}
