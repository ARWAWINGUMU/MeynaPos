import { useEffect, useRef } from "react";

interface BarcodeScannerOptions {
  onScan: (code: string) => void;
  minLength?: number;
  scanIntervalMs?: number;
  resetAfterMs?: number;
  enabled?: boolean;
  ignoreWhenInputFocused?: boolean;
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
}

export function useBarcodeScanner({
  onScan,
  minLength = 4,
  scanIntervalMs = 45,
  resetAfterMs = 120,
  enabled = true,
  ignoreWhenInputFocused = true,
}: BarcodeScannerOptions) {
  const bufferRef = useRef("");
  const intervalsRef = useRef<number[]>([]);
  const lastKeyAtRef = useRef<number | null>(null);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function clearBuffer() {
      bufferRef.current = "";
      intervalsRef.current = [];
      lastKeyAtRef.current = null;
    }

    function isScannerSpeed(): boolean {
      if (bufferRef.current.length < minLength || intervalsRef.current.length === 0) {
        return false;
      }
      const average = intervalsRef.current.reduce((sum, value) => sum + value, 0) / intervalsRef.current.length;
      const maxInterval = Math.max(...intervalsRef.current);
      return average <= scanIntervalMs && maxInterval <= resetAfterMs;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (ignoreWhenInputFocused && isEditableElement(event.target)) {
        return;
      }
      if (event.ctrlKey || event.altKey || event.metaKey) {
        return;
      }

      if (event.key === "Enter") {
        const code = bufferRef.current.trim();
        if (code && isScannerSpeed()) {
          onScanRef.current(code);
        }
        clearBuffer();
        return;
      }

      if (event.key.length !== 1) {
        return;
      }

      const now = performance.now();
      const lastKeyAt = lastKeyAtRef.current;
      if (lastKeyAt !== null) {
        const interval = now - lastKeyAt;
        if (interval > resetAfterMs) {
          clearBuffer();
        } else {
          intervalsRef.current.push(interval);
        }
      }

      bufferRef.current += event.key;
      lastKeyAtRef.current = now;
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, ignoreWhenInputFocused, minLength, resetAfterMs, scanIntervalMs]);
}

export function useManualBarcodeBuffer(onScan: (code: string) => void) {
  const valueRef = useRef("");

  function setValue(value: string) {
    valueRef.current = value;
  }

  function submit() {
    const code = valueRef.current.trim();
    if (code) {
      onScan(code);
      valueRef.current = "";
    }
    return valueRef.current;
  }

  return { setValue, submit };
}
