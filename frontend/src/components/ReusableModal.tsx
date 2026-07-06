import type { ReactNode } from "react";
import { X } from "lucide-react";

interface ReusableModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export function ReusableModal({ open, title, children, onClose }: ReusableModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4">
      <section className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100" aria-label="Cerrar modal">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </header>
        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}

