"use client";

import Link from "next/link";
import { useEffect, useRef, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  ReceiptText,
  ClipboardList,
  Users,
  Banknote,
  Truck,
  Tags,
  Settings,
  KeyRound,
  Bell,
  BarChart3,
  Wallet,
  Plus,
  Minus,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { rotuloTipoLoja } from "@/lib/format";
import { ThemeToggle } from "./theme-toggle";

type Papel = "dono" | "gestor" | "caixa" | "stock";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Papel[];
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard, roles: ["dono", "gestor", "caixa", "stock"] },
  { href: "/pos", label: "PDV", icon: ShoppingCart, roles: ["dono", "gestor", "caixa", "stock"] },
  { href: "/produtos", label: "Produtos", icon: Package, roles: ["dono", "gestor", "caixa", "stock"] },
  { href: "/stock", label: "Stock", icon: Boxes, roles: ["dono", "gestor", "stock"] },
  { href: "/vendas", label: "Vendas", icon: ReceiptText, roles: ["dono", "gestor", "caixa"] },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, roles: ["dono", "gestor"] },
  { href: "/pedidos", label: "Pedidos", icon: ClipboardList, roles: ["dono", "gestor", "caixa"] },
  { href: "/alertas", label: "Alertas", icon: Bell, roles: ["dono", "gestor", "caixa", "stock"] },
  { href: "/clientes", label: "Clientes", icon: Users, roles: ["dono", "gestor", "caixa"] },
  { href: "/caixa", label: "Caixa", icon: Banknote, roles: ["dono", "gestor", "caixa"] },
  { href: "/financeiro", label: "Financeiro", icon: Wallet, roles: ["dono", "gestor"] },
  { href: "/fornecedores", label: "Fornecedores", icon: Truck, roles: ["dono", "gestor", "stock"] },
  { href: "/categorias", label: "Categorias", icon: Tags, roles: ["dono", "gestor"] },
  { href: "/licenca", label: "Licença", icon: KeyRound, roles: ["dono"] },
  { href: "/configuracoes", label: "Configurações", icon: Settings, roles: ["dono"] },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      </div>
      <div className="leading-tight">
        <p className="text-base font-bold tracking-tight text-zinc-50">ShopLink</p>
        <p className="text-[10px] uppercase tracking-widest text-zinc-500">POS para mercearias</p>
      </div>
    </div>
  );
}

export function AppShell({
  children,
  sessao,
}: {
  children: React.ReactNode;
  sessao: {
    papel: Papel;
    nome: string;
    lojaNome: string;
    tipoLoja: string;
    moeda: string;
    tempo_inatividade: number;
  };
}) {
  const pathname = usePathname();
  const router = useRouter();

  const itens = useMemo(() => {
    const defaultItens = NAV.filter((i) => i.roles.includes(sessao.papel));
    if (sessao.email === "afonsinhobrown@gmail.com" || sessao.email === "afonso@example.com" || (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL && sessao.email === process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL)) {
      defaultItens.push({
        href: "/super-admin",
        label: "Super Admin",
        icon: ShieldAlert,
        roles: ["dono"],
      });
    }
    return defaultItens;
  }, [sessao.papel, sessao.email]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const resetTimer = () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(() => {
        logout();
      }, sessao.tempo_inatividade * 1000);
    };

    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("click", resetTimer);
    window.addEventListener("scroll", resetTimer);
    
    resetTimer();
    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      window.removeEventListener("click", resetTimer);
      window.removeEventListener("scroll", resetTimer);
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [sessao.tempo_inatividade]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 print:bg-white print:text-black">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        {/* Sidebar - desktop */}
        <aside className="fixed bottom-0 left-0 top-0 z-40 hidden w-64 flex-col border-r border-zinc-800/80 bg-zinc-950 px-4 py-6 lg:flex print:hidden">
          <div className="px-2">
            <Logo />
          </div>
          <nav className="mt-6 flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
            {itens.map((item) => {
              const ativo =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                    ativo
                      ? "bg-emerald-500/12 text-emerald-400"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-[18px] w-[18px] transition-colors",
                      ativo ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-300"
                    )}
                  />
                  {item.label}
                  {item.href === "/pos" && (
                    <span
                      className={cn(
                        "ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-bold",
                        ativo
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-zinc-800 text-zinc-500"
                      )}
                    >
                      PDV
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-600 text-sm font-bold text-white">
                {sessao.nome.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-medium text-zinc-100">{sessao.nome}</p>
                <p className="truncate text-xs capitalize text-zinc-500">{sessao.papel}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="mt-3 w-full rounded-xl border border-zinc-800 py-2 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white"
            >
              Terminar sessão
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col lg:pl-64 print:pl-0">
          {/* Topbar */}
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-zinc-800/80 bg-zinc-950/80 px-4 backdrop-blur-xl sm:px-6 print:hidden">
            <div className="flex items-center gap-3 lg:hidden">
              <Logo />
            </div>
            <div className="hidden items-center gap-2 lg:flex">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <p className="text-sm font-medium text-zinc-300">{sessao.lojaNome}</p>
              <span className="rounded-lg border border-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
                {rotuloTipoLoja(sessao.tipoLoja)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                onClick={logout}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 transition-colors hover:text-rose-400 lg:hidden"
                aria-label="Sair"
                title="Sair"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="m16 17 5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
              </button>
            </div>
          </header>

          {/* Mobile FAB - nova venda */}
          <div className="lg:hidden print:hidden">
            <button
              onClick={() => {
                if (pathname !== "/pos") router.push("/pos");
              }}
              className={cn(
                "fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl shadow-xl shadow-emerald-500/30 transition-all active:scale-95",
                pathname === "/pos"
                  ? "bg-zinc-800 text-zinc-300"
                  : "bg-emerald-500 text-white"
              )}
              aria-label="Abrir PDV"
            >
              {pathname === "/pos" ? <Minus size={22} /> : <Plus size={22} />}
            </button>
          </div>

          <main className="flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-10">{children}</main>

          {/* Bottom nav - mobile */}
          <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur-xl lg:hidden print:hidden">
            <div className="mx-auto grid max-w-lg grid-cols-5">
              {[
                { href: "/dashboard", label: "Início", icon: LayoutDashboard },
                { href: "/pos", label: "PDV", icon: ShoppingCart },
                { href: "/vendas", label: "Vendas", icon: ReceiptText },
                { href: "/stock", label: "Stock", icon: Boxes },
                { href: "/clientes", label: "Clientes", icon: Users },
              ]
                .filter((i) => itens.some((n) => n.href === i.href))
                .map((item) => {
                  const ativo = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                        ativo ? "text-emerald-400" : "text-zinc-500"
                      )}
                    >
                      <item.icon className={cn("h-5 w-5", ativo && "text-emerald-400")} />
                      {item.label}
                    </Link>
                  );
                })}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}