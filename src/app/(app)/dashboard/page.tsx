import Link from "next/link";
import {
  ShoppingCart,
  TrendingUp,
  Clock,
  PackageX,
  ArrowRight,
  AlertTriangle,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { requireSessao } from "@/lib/auth";
import { getDashboard } from "@/lib/queries";
import { formatarMoeda, formatarDataHora } from "@/lib/format";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";

export default async function DashboardPage() {
  const sessao = await requireSessao();
  const d = await getDashboard(sessao);
  const moeda = sessao.moeda;

  return (
    <div className="animate-fade-in mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
          Olá, {sessao.nome.split(" ")[0]} 👋
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Resumo de hoje em {sessao.lojaNome}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          label="Vendas hoje"
          value={formatarMoeda(d.vendasHojeTotal, moeda)}
          hint={`${d.vendasHojeCount} vendas`}
          icon={<ShoppingCart className="h-5 w-5" />}
          accent="emerald"
        />
        <KpiCard
          label="Este mês"
          value={formatarMoeda(d.vendasMes, moeda)}
          hint="Totais de vendas concluídas"
          icon={<TrendingUp className="h-5 w-5" />}
          accent="sky"
        />
        <KpiCard
          label="Fiado pendente"
          value={formatarMoeda(d.fiadoPendente, moeda)}
          hint="A receber dos clientes"
          icon={<Wallet className="h-5 w-5" />}
          accent="amber"
        />
        <KpiCard
          label="Reposições"
          value={String(d.stockBaixo.length)}
          hint="Produtos abaixo do mínimo"
          icon={<PackageX className="h-5 w-5" />}
          accent={d.stockBaixo.length > 0 ? "rose" : "emerald"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Últimas vendas */}
        <Card className="lg:col-span-3">
          <CardHeader
            title="Últimas vendas"
            subtitle="Movimento mais recente na loja"
            action={
              <Link
                href="/vendas"
                className="flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300"
              >
                Ver todas <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="p-5 pt-0">
            {d.ultimasVendas.length === 0 ? (
              <EmptyState
                icon={ReceiptText}
                title="Sem vendas ainda"
                description="Registe a primeira venda no PDV"
                action={
                  <Link
                    href="/pos"
                    className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
                  >
                    Abrir PDV
                  </Link>
                }
              />
            ) : (
              <div className="divide-y divide-zinc-800/70">
                {d.ultimasVendas.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800/80">
                      <Clock className="h-4 w-4 text-zinc-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-200">
                        {v.numero_recibo}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {v.cliente_nome ?? v.utilizador_nome}
                        {" · "}
                        {formatarDataHora(v.data_venda)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-zinc-100">
                      {formatarMoeda(Number(v.total), moeda)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Stock baixo */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Stock a repor"
            subtitle="Abaixo do mínimo definido"
          />
          <div className="p-5 pt-0">
            {d.stockBaixo.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                  <PackageX className="h-6 w-6 text-emerald-400" />
                </div>
                <p className="text-sm text-zinc-400">Sempre em stock, tudo certo</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {d.stockBaixo.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-zinc-200">{p.nome}</p>
                      <p className="text-xs text-zinc-500">
                        Mínimo: {p.stock_minimo}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                      <span className="text-sm font-semibold text-rose-400">
                        {p.quantidade_atual}
                      </span>
                    </div>
                  </div>
                ))}
                <Link
                  href="/stock"
                  className="mt-2 flex items-center justify-center gap-1 rounded-xl border border-zinc-800 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  Gerir stock <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Top produtos */}
      {d.topProdutos.length > 0 && (
        <Card>
          <CardHeader title="Produtos mais vendidos hoje" />
          <div className="grid gap-3 p-5 pt-0 sm:grid-cols-2 lg:grid-cols-5">
            {d.topProdutos.map((p, i) => (
              <div
                key={p.nome}
                className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-black text-zinc-700">
                    {i + 1}
                  </span>
                  <Badge color="green">{p.qtd} vendidos</Badge>
                </div>
                <p className="mt-2 truncate text-sm font-medium text-zinc-200">
                  {p.nome}
                </p>
                <p className="text-xs text-zinc-500">
                  {formatarMoeda(Number(p.total), moeda)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}