import * as React from "react";
import { cn } from "@/lib/cn";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
}) {
  const variants: Record<string, string> = {
    primary:
      "bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/25 font-semibold",
    secondary:
      "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700 font-medium",
    ghost: "text-zinc-300 hover:bg-zinc-800 hover:text-white",
    outline:
      "border border-zinc-700 text-zinc-200 hover:bg-zinc-800 font-medium",
    danger:
      "bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 font-medium",
  };
  const sizes: Record<string, string> = {
    sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
    md: "h-10 px-4 text-sm rounded-xl gap-2",
    lg: "h-12 px-6 text-base rounded-xl gap-2",
    icon: "h-10 w-10 rounded-xl",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}