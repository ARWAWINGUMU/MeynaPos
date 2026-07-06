import { useEffect, useState } from "react";

interface BarcodeScannerOptions {
  onScan: (barcode: string) => void;
  minLength?: number;
  idleMs?: number;
}

export function useBarcodeScanner({ onScan, minLength = 6, idleMs = 80 }: BarcodeScannerOptions) {
  const [buffer, setBuffer] = useState("");

  useEffect(() => {
    if (!buffer) {
      return;
    }
    const timeout = window.setTimeout(() => {
      if (buffer.length >= minLength) {
        onScan(buffer);
      }
      setBuffer("");
    }, idleMs);
    return () => window.clearTimeout(timeout);
  }, [buffer, idleMs, minLength, onScan]);

  function handleBarcodeChange(value: string) {
    setBuffer(value.trim());
  }

  return { barcodeBuffer: buffer, handleBarcodeChange };
}

