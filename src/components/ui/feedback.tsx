"use client";

import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export function Loading({
  className,
  label = "A carregar…",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-zinc-500",
        className
      )}
    >
      <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <Icon className="h-7 w-7 text-zinc-500" />
      </div>
      <div>
        <p className="font-medium text-zinc-300">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Alert({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "error" | "success";
}) {
  const tones = {
    info: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    error: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  };
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm",
        tones[tone]
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}