import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface ReusableModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export function ReusableModal({ open, title, children, onClose }: ReusableModalProps) {
  const titleId = useId();
  const panel = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) {
      return;
    }
    const focusable = () => Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]') ?? []);
    if (!panel.current?.contains(document.activeElement)) focusable()[0]?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeRef.current();
      }
      if (event.key === "Tab") {
        const elements = focusable();
        if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements[elements.length - 1]?.focus(); }
        else if (!event.shiftKey && document.activeElement === elements[elements.length - 1]) { event.preventDefault(); elements[0]?.focus(); }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4">
      <section ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <h2 id={titleId} className="min-w-0 break-words text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100" aria-label="Cerrar modal">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto p-5">{children}</div>
      </section>
    </div>
  );
}
