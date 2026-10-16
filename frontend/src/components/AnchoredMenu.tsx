import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

interface MenuItem { label: string; icon: LucideIcon; danger?: boolean; onSelect: () => void }

export function AnchoredMenu({ label, disabled, items }: { label: string; disabled?: boolean; items: MenuItem[] }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8 });

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      const panel = menu.current?.getBoundingClientRect();
      if (!anchor || !panel) return;
      const left = Math.max(8, Math.min(anchor.right - panel.width, window.innerWidth - panel.width - 8));
      const top = anchor.bottom + panel.height + 6 <= window.innerHeight - 8
        ? anchor.bottom + 6 : Math.max(8, anchor.top - panel.height - 6);
      setPosition({ left, top });
    };
    place();
    menu.current?.querySelector<HTMLButtonElement>('button[role="menuitem"]')?.focus();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target) && !trigger.current?.contains(event.target)) setOpen(false);
    };
    const scroll = () => setOpen(false);
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
      if (event.key === "Tab") setOpen(false);
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
      const current = buttons.findIndex((button) => button === document.activeElement);
      const index = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
        : (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[index]?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", scroll, true);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", key); window.removeEventListener("scroll", scroll, true); };
  }, [open]);

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

  return <>
    <button ref={trigger} type="button" disabled={disabled} title={label} aria-label={label} aria-haspopup="menu"
      aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen((value) => !value)}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50"><MoreHorizontal className="h-5 w-5" /></button>
    {open && createPortal(<div ref={menu} id={id} role="menu" aria-label={label}
      style={position} className="fixed z-30 max-h-[calc(100dvh-1rem)] w-56 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl">
      {items.map(({ label: itemLabel, icon: Icon, danger, onSelect }) => <button key={itemLabel} role="menuitem" type="button"
        onClick={() => { setOpen(false); trigger.current?.focus(); onSelect(); }}
        className={`flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 ${danger ? "text-red-700 hover:bg-red-50" : "text-gray-700 hover:bg-gray-50"}`}><Icon className="h-4 w-4 shrink-0" />{itemLabel}</button>)}
    </div>, document.body)}
  </>;
}
