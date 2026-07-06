import type { LucideIcon } from "lucide-react";

interface MetricTileProps {
  label: string;
  value: string;
  icon: LucideIcon;
}

export function MetricTile({ label, value, icon: Icon }: MetricTileProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <Icon className="h-5 w-5 text-teal-600" />
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

