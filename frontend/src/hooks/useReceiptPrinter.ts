import { useRef, useState } from "react";
import { downloadReceiptPdf, printReceiptPdf, type ReceiptData } from "../utils/receipt";

export function useReceiptPrinter() {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(data: ReceiptData, action: "print" | "download"): Promise<void> {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      if (action === "print") await printReceiptPdf(data);
      else await downloadReceiptPdf(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible generar el comprobante.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return { busy, error, run };
}
