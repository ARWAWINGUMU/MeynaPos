import { Barcode } from "lucide-react";
import { FormEvent, useState } from "react";

import { useBarcodeScanner } from "../hooks/useBarcodeScanner";

interface BarcodeScannerInputProps {
  onScan: (code: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  minLength?: number;
  scanIntervalMs?: number;
  className?: string;
}

export function BarcodeScannerInput({
  onScan,
  label = "Escáner USB",
  placeholder = "Escanea código de barras o QR",
  disabled = false,
  minLength,
  scanIntervalMs,
  className = "",
}: BarcodeScannerInputProps) {
  const [manualCode, setManualCode] = useState("");

  useBarcodeScanner({
    onScan,
    enabled: !disabled,
    minLength,
    scanIntervalMs,
    ignoreWhenInputFocused: true,
  });

  function submitManualCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = manualCode.trim();
    if (!code) {
      return;
    }
    onScan(code);
    setManualCode("");
  }

  return (
    <form onSubmit={submitManualCode} className={`relative ${className}`}>
      <Barcode className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
      <input
        data-scanner-input="true"
        value={manualCode}
        onChange={(event) => setManualCode(event.target.value)}
        className="h-12 w-full rounded-lg border border-gray-300 bg-white pl-11 pr-4 outline-none focus:ring-2 focus:ring-[#1B8A5A]"
        placeholder={placeholder}
        aria-label={label}
        disabled={disabled}
      />
    </form>
  );
}
