import { cn } from "@/lib/cn";

export function KpiCard({
  label,
  value,
  hint,
  icon,
  accent = "emerald",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  accent?: "emerald" | "sky" | "violet" | "amber" | "rose";
}) {
  const accents: Record<string, string> = {
    emerald: "bg-emerald-500/15 text-emerald-400",
    sky: "bg-sky-500/15 text-sky-400",
    violet: "bg-violet-500/15 text-violet-400",
    amber: "bg-amber-500/15 text-amber-400",
    rose: "bg-rose-500/15 text-rose-400",
  };
  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-zinc-400">{label}</p>
        <div className={cn("rounded-xl p-2", accents[accent])}>{icon}</div>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-zinc-50">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}