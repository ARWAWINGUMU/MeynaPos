import { useState } from "react";
import { Pause, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { AnchoredMenu } from "./AnchoredMenu";
import { ReusableModal } from "./ReusableModal";
import type { OpenSale } from "../types/openSale";
import type { useOpenSales } from "../hooks/useOpenSales";

export function OpenSalesBar({ workspace, onCancel, onReload }: {
  workspace: ReturnType<typeof useOpenSales>; onCancel: () => void; onReload: () => void;
}) {
  const disabled = workspace.loading || workspace.busy;
  const [editing, setEditing] = useState<OpenSale | null>(null);
  const [deleting, setDeleting] = useState<OpenSale | null>(null);
  const [name, setName] = useState("");
  return <div className="relative min-w-0 space-y-2 border-b border-gray-200 bg-white px-4 py-3">
    <div className="flex items-center gap-2">
      <div role="tablist" aria-label="Ventas abiertas" className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
        {workspace.sales.map((sale) => <div key={sale.id} className={`flex w-52 shrink-0 items-center rounded-lg border ${workspace.active?.id === sale.id ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "border-gray-200 text-gray-600"}`}><button type="button" role="tab"
          aria-selected={workspace.active?.id === sale.id} disabled={disabled}
          title={`${sale.customer_name ?? "Sin cliente"} · ${sale.cashier_name}`}
          onClick={() => { if (sale.id !== workspace.active?.id) void workspace.select(sale.id).catch(() => undefined); }}
          className="flex min-h-14 min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50">
          {sale.status === "HELD" && <Pause className="h-4 w-4 shrink-0 text-amber-600" />}
          <span className="min-w-0"><span className="block truncate font-semibold">{sale.name}</span><span className="block truncate text-xs">{sale.customer_name ?? "Sin cliente"}</span></span>
        </button><AnchoredMenu label={`Opciones de ${sale.name}`} disabled={disabled} items={[
          { label: "Cambiar nombre", icon: Pencil, onSelect: () => { setEditing(sale); setName(sale.name); } },
          { label: "Eliminar venta", icon: Trash2, danger: true, onSelect: () => setDeleting(sale) },
        ]} /></div>)}
      </div>
      <button type="button" title="Nueva venta" aria-label="Nueva venta" disabled={disabled}
        onClick={() => void workspace.create().catch(() => undefined)} className="rounded-lg bg-emerald-700 p-2.5 text-white disabled:opacity-50"><Plus className="h-5 w-5" /></button>
      <button type="button" title="Cancelar venta" aria-label="Cancelar venta" disabled={disabled || !workspace.active}
        onClick={onCancel} className="rounded-lg border border-gray-200 p-2.5 text-red-600 disabled:opacity-40"><Trash2 className="h-5 w-5" /></button>
    </div>
    <ReusableModal open={editing !== null} title="Cambiar nombre" onClose={() => setEditing(null)}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (editing && name.trim()) void workspace.rename(editing.id, name.trim()).then(() => setEditing(null)).catch(() => undefined); }}>
        <label className="block text-sm font-medium">Nombre<input autoFocus required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 p-3" /></label>
        {workspace.error && <p role="alert" className="text-sm text-red-700">{workspace.error}</p>}
        <button disabled={disabled || !name.trim()} className="rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">Guardar</button>
      </form>
    </ReusableModal>
    <ReusableModal open={deleting !== null} title="Eliminar venta abierta" onClose={() => setDeleting(null)}>
      <p className="text-sm text-gray-600">Eliminar {deleting?.name}{deleting?.lines.length ? " y sus productos pendientes" : ""}. Esta operacion no registra una venta ni modifica existencias.</p>
      {workspace.error && <p role="alert" className="mt-3 text-sm text-red-700">{workspace.error}</p>}
      <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setDeleting(null)} className="rounded-lg border px-4 py-2">Volver</button><button type="button" disabled={disabled} onClick={() => { if (deleting) void workspace.cancel(deleting.id).then(() => setDeleting(null)).catch(() => undefined); }} className="rounded-lg bg-red-600 px-4 py-2 text-white">Eliminar</button></div>
    </ReusableModal>
    <div className="flex items-center justify-between gap-3 text-xs" aria-live="polite">
      <span className={workspace.dirty ? "text-amber-700" : "text-gray-500"}>
        {workspace.loading ? "Cargando ventas..." : workspace.saving ? "Guardando..." : workspace.dirty ? "Cambios pendientes de guardar" : "Guardado"}
      </span>
      <button type="button" disabled={disabled} onClick={onReload} className="inline-flex items-center gap-1 text-gray-600"><RefreshCw className="h-3.5 w-3.5" />Recargar ventas</button>
    </div>
    {workspace.error && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
      <span>{workspace.error}</span>
      <button type="button" disabled={disabled || workspace.saving} onClick={() => void workspace.flush().catch(() => undefined)} className="font-semibold underline">Reintentar guardado</button>
    </div>}
  </div>;
}
