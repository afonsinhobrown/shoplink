"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, Loader2, TrendingUp } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Loading, EmptyState, Alert } from "@/components/ui/feedback";
import { formatarMoeda, formatarData } from "@/lib/format";

interface Dados {
  dias: number;
  resumo: { total: number; n: number; ticket: number };
  porDia: { dia: string; total: number; n: number }[];
  topProdutos: { nome: string; qtd: number; total: number }[];
  porMetodo: { metodo: string; total: number }[];
}

const PERIODOS = [
  { dias: 7, label: "7 dias" },
  { dias: 30, label: "30 dias" },
  { dias: 90, label: "90 dias" },
];

const METODO_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  mpesa: "M-Pesa",
  emola: "e-Mola",
  cartao: "Cartão",
  fiado: "Fiado",
};

export function RelatoriosClient({ moeda }: { moeda: string }) {
  const [dias, setDias] = useState(30);
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/relatorios?dias=${dias}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao carregar relatórios.");
      setD(data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setCarregando(false);
    }
  }, [dias]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  const maxDia = d ? Math.max(1, ...d.porDia.map((x) => x.total)) : 1;
  const totalMetodos = d ? Math.max(1, d.porMetodo.reduce((s, m) => s + m.total, 0)) : 1;

  return (
    <div className="animate-fade-in mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-50">
            <BarChart3 className="h-6 w-6 text-emerald-400" /> Relatórios
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Desempenho de vendas do período.</p>
        </div>
        <div className="flex gap-2">
          {PERIODOS.map((p) => (
            <button
              key={p.dias}
              onClick={() => setDias(p.dias)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                dias === p.dias
                  ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {erro && <Alert tone="error">{erro}</Alert>}

      {!d ? (
        <Loading label="A carregar relatórios…" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <p className="text-sm font-medium text-zinc-400">Vendas no período</p>
              <p className="mt-2 text-2xl font-bold text-zinc-50">
                {formatarMoeda(d.resumo.total, moeda)}
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-sm font-medium text-zinc-400">Nº de vendas</p>
              <p className="mt-2 text-2xl font-bold text-zinc-50">{d.resumo.n}</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm font-medium text-zinc-400">Ticket médio</p>
              <p className="mt-2 text-2xl font-bold text-emerald-400">
                {formatarMoeda(d.resumo.ticket, moeda)}
              </p>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Vendas por dia"
              subtitle={`Últimos ${d.dias} dias`}
              action={carregando ? <Loader2 className="h-4 w-4 animate-spin text-zinc-500" /> : undefined}
            />
            <div className="p-5 pt-3">
              {d.porDia.length === 0 ? (
                <EmptyState icon={TrendingUp} title="Sem vendas no período" />
              ) : (
                <div className="flex h-52 items-end gap-1.5 overflow-x-auto">
                  {d.porDia.map((x) => (
                    <div key={x.dia} className="group flex min-w-[18px] flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all group-hover:from-emerald-500 group-hover:to-emerald-300"
                        style={{ height: `${Math.max(2, (x.total / maxDia) * 100)}%` }}
                        title={`${formatarData(x.dia)}: ${formatarMoeda(x.total, moeda)} (${x.n})`}
                      />
                      <span className="hidden text-[9px] text-zinc-600 sm:block">
                        {new Date(x.dia).getDate()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Top produtos" subtitle="Por valor vendido" />
              <div className="p-5 pt-2">
                {d.topProdutos.length === 0 ? (
                  <EmptyState icon={TrendingUp} title="Sem dados" />
                ) : (
                  <div className="divide-y divide-zinc-800/70">
                    {d.topProdutos.map((p, i) => (
                      <div key={p.nome} className="flex items-center justify-between py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-800 text-xs font-bold text-zinc-400">
                            {i + 1}
                          </span>
                          <span className="text-sm text-zinc-200">{p.nome}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-zinc-100">
                            {formatarMoeda(p.total, moeda)}
                          </p>
                          <p className="text-xs text-zinc-500">{p.qtd} un.</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Métodos de pagamento" subtitle="Distribuição no período" />
              <div className="space-y-4 p-5 pt-2">
                {d.porMetodo.length === 0 ? (
                  <EmptyState icon={TrendingUp} title="Sem dados" />
                ) : (
                  d.porMetodo.map((m) => (
                    <div key={m.metodo}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="text-zinc-300">
                          {METODO_LABEL[m.metodo] ?? m.metodo}
                        </span>
                        <span className="text-zinc-100">{formatarMoeda(m.total, moeda)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                          style={{ width: `${(m.total / totalMetodos) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Detalhe diário" subtitle="Vendas e nº de transações por dia" />
            <div className="overflow-x-auto p-5 pt-2">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                    <th className="pb-2 pr-4 font-medium">Dia</th>
                    <th className="pb-2 pr-4 font-medium">Vendas</th>
                    <th className="pb-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {d.porDia
                    .slice()
                    .reverse()
                    .map((x) => (
                      <tr key={x.dia} className="border-b border-zinc-800/60">
                        <td className="py-2.5 pr-4 text-zinc-300">{formatarData(x.dia)}</td>
                        <td className="py-2.5 pr-4 text-zinc-500">{x.n}</td>
                        <td className="py-2.5 font-medium text-zinc-100">
                          {formatarMoeda(x.total, moeda)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}