import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { X } from "lucide-react";

interface ResponsiveSidebarProps {
  open: boolean;
  isDesktop: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement>;
  children: ReactNode;
}

export function ResponsiveSidebar({ open, isDesktop, onClose, triggerRef, children }: ResponsiveSidebarProps) {
  const panelRef = useRef<HTMLElement>(null);
  const wasMobileOpen = useRef(false);

  useEffect(() => {
    if (panelRef.current) panelRef.current.inert = !open;
    const mobileOpen = open && !isDesktop;
    if (wasMobileOpen.current && !mobileOpen) triggerRef.current?.focus();
    wasMobileOpen.current = mobileOpen;
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex="0"]') ?? []);
    focusable()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", handleKey); };
  }, [open, isDesktop, onClose, triggerRef]);

  return <>
    {open && !isDesktop && <button type="button" aria-label="Cerrar menu" tabIndex={-1}
      onClick={onClose} className="fixed inset-0 z-30 bg-gray-950/45" />}
    <aside ref={panelRef} id="main-navigation" aria-label="Menu principal" aria-hidden={!open}
      role={isDesktop ? undefined : "dialog"} aria-modal={!isDesktop && open ? true : undefined}
      className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-64 max-w-[calc(100vw-3rem)] flex-col bg-gradient-to-b from-[#047857] to-[#065f46] text-white transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? "translate-x-0" : "-translate-x-full"}`}>
      {!isDesktop && <button type="button" onClick={onClose} aria-label="Cerrar menu" title="Cerrar menu"
        className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><X className="h-5 w-5" /></button>}
      {children}
    </aside>
  </>;
}
