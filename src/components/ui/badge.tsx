import { cn } from "@/lib/cn";

export function Badge({
  children,
  color = "zinc",
  className,
}: {
  children: React.ReactNode;
  color?: "zinc" | "green" | "red" | "amber" | "blue" | "violet";
  className?: string;
}) {
  const colors: Record<string, string> = {
    zinc: "bg-zinc-800 text-zinc-300 border-zinc-700",
    green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    red: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    amber: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    blue: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    violet: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        colors[color],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; color: "green" | "red" | "amber" | "blue" | "violet" | "zinc" }> = {
    concluida: { label: "Concluída", color: "green" },
    cancelada: { label: "Cancelada", color: "red" },
    pendente_fiado: { label: "Fiado", color: "amber" },
    aberta: { label: "Aberta", color: "green" },
    fechada: { label: "Fechada", color: "zinc" },
    recebida: { label: "Recebida", color: "green" },
    pendente: { label: "Pendente", color: "amber" },
    online: { label: "Online", color: "blue" },
    offline: { label: "Offline", color: "violet" },
  };
  const s = map[status] ?? { label: status, color: "zinc" as const };
  return <Badge color={s.color}>{s.label}</Badge>;
}