"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Loader2, Plus, Wallet } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Loading, EmptyState, Alert } from "@/components/ui/feedback";
import { formatarMoeda, formatarData } from "@/lib/format";

interface Dados {
  contas: { id: string; nome: string; saldo_inicial: number; saldo_atual: number }[];
  saldoTotal: number;
  resumoMes: { receitas: number; despesas: number; saldo: number };
  lancamentos: {
    id: string;
    tipo: string;
    valor: number;
    descricao: string | null;
    data_competencia: string;
    categoria: string;
    conta: string;
  }[];
  dre: { mes_referencia: string; tipo_categoria: string; categoria: string; total: number }[];
  aPagar: { id: string; descricao: string; valor_total: number; data_vencimento: string; status: string; fornecedor: string | null }[];
  aReceber: { id: string; descricao: string | null; valor_total: number; data_vencimento: string; status: string; cliente: string }[];
  categorias: { id: string; nome: string; tipo: string }[];
}

export function FinanceiroClient({ moeda }: { moeda: string }) {
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [aGravar, setAGravar] = useState(false);
  const [form, setForm] = useState({
    tipo: "despesa",
    categoria_financeira_id: "",
    conta_financeira_id: "",
    valor: "",
    descricao: "",
  });

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const res = await fetch("/api/financeiro");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao carregar o financeiro.");
      setD(data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  const categoriasFiltradas = useMemo(
    () => (d?.categorias ?? []).filter((c) => c.tipo === form.tipo),
    [d, form.tipo]
  );

  function abrirModal() {
    if (!d) return;
    setForm({
      tipo: "despesa",
      categoria_financeira_id: d.categorias.find((c) => c.tipo === "despesa")?.id ?? "",
      conta_financeira_id: d.contas[0]?.id ?? "",
      valor: "",
      descricao: "",
    });
    setModal(true);
  }

  async function gravar(e: React.FormEvent) {
    e.preventDefault();
    setAGravar(true);
    setErro(null);
    try {
      const res = await fetch("/api/financeiro/lancamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, valor: Number(form.valor) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao gravar.");
      setModal(false);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setAGravar(false);
    }
  }

  if (!d && !erro) return <Loading label="A carregar o financeiro…" />;
  if (!d) return <Alert tone="error">{erro}</Alert>;

  const drePorMes = Object.entries(
    d.dre.reduce<Record<string, { receita: number; despesa: number }>>((acc, r) => {
      const k = r.mes_referencia;
      acc[k] = acc[k] || { receita: 0, despesa: 0 };
      if (r.tipo_categoria === "receita") acc[k].receita += r.total;
      else acc[k].despesa += r.total;
      return acc;
    }, {})
  ).slice(0, 6);

  return (
    <div className="animate-fade-in mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-50">
            <Wallet className="h-6 w-6 text-emerald-400" /> Gestão financeira
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Contas, lançamentos e resultado do mês.</p>
        </div>
        <Button onClick={abrirModal}>
          <Plus className="h-4 w-4" /> Novo lançamento
        </Button>
      </div>

      {erro && <Alert tone="error">{erro}</Alert>}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm font-medium text-zinc-400">Saldo total</p>
          <p className="mt-2 text-2xl font-bold text-zinc-50">{formatarMoeda(d.saldoTotal, moeda)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-zinc-400">Receitas (mês)</p>
          <p className="mt-2 text-2xl font-bold text-emerald-400">{formatarMoeda(d.resumoMes.receitas, moeda)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-zinc-400">Despesas (mês)</p>
          <p className="mt-2 text-2xl font-bold text-rose-400">{formatarMoeda(d.resumoMes.despesas, moeda)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-zinc-400">Resultado (mês)</p>
          <p className={`mt-2 text-2xl font-bold ${d.resumoMes.saldo >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {formatarMoeda(d.resumoMes.saldo, moeda)}
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader title="Contas" subtitle="Saldo atual por conta financeira" />
        <div className="grid gap-3 p-5 pt-2 sm:grid-cols-2 lg:grid-cols-4">
          {d.contas.length === 0 ? (
            <EmptyState icon={Wallet} title="Sem contas" />
          ) : (
            d.contas.map((c) => (
              <div key={c.id} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                <p className="text-sm text-zinc-300">{c.nome}</p>
                <p className="mt-1 text-lg font-bold text-zinc-50">{formatarMoeda(c.saldo_atual, moeda)}</p>
              </div>
            ))
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Lançamentos recentes" />
          <div className="p-5 pt-2">
            {d.lancamentos.length === 0 ? (
              <EmptyState icon={Wallet} title="Sem lançamentos" description="Registe receitas e despesas" />
            ) : (
              <div className="divide-y divide-zinc-800/70">
                {d.lancamentos.map((l) => (
                  <div key={l.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      {l.tipo === "receita" ? (
                        <ArrowUpCircle className="h-5 w-5 text-emerald-400" />
                      ) : (
                        <ArrowDownCircle className="h-5 w-5 text-rose-400" />
                      )}
                      <div>
                        <p className="text-sm text-zinc-200">{l.descricao || l.categoria}</p>
                        <p className="text-xs text-zinc-500">
                          {l.categoria} · {l.conta} · {formatarData(l.data_competencia)}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ${l.tipo === "receita" ? "text-emerald-400" : "text-rose-400"}`}>
                      {l.tipo === "receita" ? "+" : "-"}
                      {formatarMoeda(l.valor, moeda)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Resultado mensal (DRE)" subtitle="Receitas vs despesas por mês" />
          <div className="p-5 pt-2">
            {drePorMes.length === 0 ? (
              <EmptyState icon={Wallet} title="Sem dados" />
            ) : (
              <div className="space-y-3">
                {drePorMes.map(([mes, v]) => (
                  <div key={mes} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-300">
                        {new Date(mes).toLocaleDateString("pt-PT", { month: "long", year: "numeric" })}
                      </span>
                      <span className={`text-sm font-semibold ${v.receita - v.despesa >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {formatarMoeda(v.receita - v.despesa, moeda)}
                      </span>
                    </div>
                    <div className="mt-1 flex gap-3 text-xs text-zinc-500">
                      <span>Receitas: {formatarMoeda(v.receita, moeda)}</span>
                      <span>Despesas: {formatarMoeda(v.despesa, moeda)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Contas a pagar" />
          <div className="p-5 pt-2">
            {d.aPagar.length === 0 ? (
              <EmptyState icon={ArrowDownCircle} title="Nada a pagar" />
            ) : (
              <div className="divide-y divide-zinc-800/70">
                {d.aPagar.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm text-zinc-200">{c.descricao}</p>
                      <p className="text-xs text-zinc-500">
                        {c.fornecedor || "—"} · vence {formatarData(c.data_vencimento)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-rose-400">
                      {formatarMoeda(c.valor_total, moeda)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Contas a receber" />
          <div className="p-5 pt-2">
            {d.aReceber.length === 0 ? (
              <EmptyState icon={ArrowUpCircle} title="Nada a receber" />
            ) : (
              <div className="divide-y divide-zinc-800/70">
                {d.aReceber.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm text-zinc-200">{c.cliente}</p>
                      <p className="text-xs text-zinc-500">
                        {c.descricao || "Fiado"} · vence {formatarData(c.data_vencimento)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-emerald-400">
                      {formatarMoeda(c.valor_total, moeda)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Novo lançamento">
        <form onSubmit={gravar} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["despesa", "receita"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    tipo: t,
                    categoria_financeira_id:
                      d.categorias.find((c) => c.tipo === t)?.id ?? "",
                  }))
                }
                className={`rounded-xl border px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
                  form.tipo === t
                    ? t === "receita"
                      ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                      : "border-rose-500 bg-rose-500/15 text-rose-300"
                    : "border-zinc-800 bg-zinc-900 text-zinc-400"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <Field label="Categoria *">
            <Select
              required
              value={form.categoria_financeira_id}
              onChange={(e) => setForm((f) => ({ ...f, categoria_financeira_id: e.target.value }))}
            >
              <option value="">Selecione…</option>
              {categoriasFiltradas.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
          </Field>

          <Field label="Conta *">
            <Select
              required
              value={form.conta_financeira_id}
              onChange={(e) => setForm((f) => ({ ...f, conta_financeira_id: e.target.value }))}
            >
              <option value="">Selecione…</option>
              {d.contas.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
          </Field>

          <Field label="Valor (MZN) *">
            <Input
              type="number"
              min="0"
              step="0.01"
              required
              value={form.valor}
              onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
            />
          </Field>

          <Field label="Descrição">
            <Input
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              placeholder="Ex.: Renda do mês"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={aGravar}>
              {aGravar ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gravar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}