"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpCircle,
  History,
  Boxes,
  Search,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatarDataHora } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Loading, EmptyState } from "@/components/ui/feedback";
import type { ProdutoDTO, MovimentoDTO } from "@/lib/types";

interface StockRow {
  id: string;
  nome: string;
  unidade_medida: string;
  stock_minimo: number;
  categoria?: string | null;
  quantidade_atual: number;
  abaixo_minimo: boolean;
}

export function StockClient({
  permiteEditar,
  controlaLote,
}: {
  permiteEditar: boolean;
  controlaLote: boolean;
}) {
  const [stock, setStock] = useState<StockRow[]>([]);
  const [movimentos, setMovimentos] = useState<MovimentoDTO[]>([]);
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState<"stock" | "movimentos">("stock");
  const [q, setQ] = useState("");
  const [soBaixos, setSoBaixos] = useState(false);

  const [modal, setModal] = useState<"" | "entrada" | "ajuste">("");
  const [form, setForm] = useState({
    produto_id: "",
    quantidade: "",
    custo_unitario: "",
    numero_lote: "",
    data_validade: "",
    tipo: "ajuste" as "ajuste" | "quebra" | "devolucao",
    observacao: "",
  });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  function carregar() {
    Promise.all([
      apiFetch<StockRow[]>("/api/stock"),
      apiFetch<MovimentoDTO[]>("/api/stock/movimentos"),
      apiFetch<ProdutoDTO[]>("/api/produtos?ativos=true"),
    ])
      .then(([s, m, p]) => {
        setStock(s);
        setMovimentos(m);
        setProdutos(p);
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
  }, []);

  const filtrados = useMemo(() => {
    const termo = q.trim().toLowerCase();
    return stock.filter((s) => {
      const okTermo = !termo || s.nome.toLowerCase().includes(termo);
      const okBaixo = !soBaixos || s.abaixo_minimo;
      return okTermo && okBaixo;
    });
  }, [stock, q, soBaixos]);

  function resetForm() {
    setForm({
      produto_id: "",
      quantidade: "",
      custo_unitario: "",
      numero_lote: "",
      data_validade: "",
      tipo: "ajuste",
      observacao: "",
    });
    setErro("");
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      if (modal === "entrada") {
        await apiFetch("/api/stock/entrada", {
          method: "POST",
          body: JSON.stringify({
            produto_id: form.produto_id,
            quantidade: Number(form.quantidade),
            custo_unitario: form.custo_unitario ? Number(form.custo_unitario) : null,
            numero_lote: form.numero_lote || null,
            data_validade: form.data_validade || null,
            observacao: form.observacao || null,
          }),
        });
      } else {
        const sinal = form.quantidade.startsWith("-") ? Number(form.quantidade) : Number(form.quantidade);
        await apiFetch("/api/stock/ajuste", {
          method: "POST",
          body: JSON.stringify({
            produto_id: form.produto_id,
            quantidade: sinal,
            tipo: form.tipo,
            observacao: form.observacao || null,
          }),
        });
      }
      setModal("");
      carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao guardar");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando && stock.length === 0)
    return <Loading className="min-h-[50vh]" label="A carregar stock…" />;

  const baixos = stock.filter((s) => s.abaixo_minimo).length;

  return (
    <div className="animate-fade-in mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Stock</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Níveis atuais e movimentações da loja
          </p>
        </div>
        {permiteEditar && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                resetForm();
                setModal("ajuste");
              }}
            >
              <ArrowUpCircle className="h-4 w-4" /> Ajuste
            </Button>
            <Button
              onClick={() => {
                resetForm();
                setModal("entrada");
              }}
            >
              <ArrowDownToLine className="h-4 w-4" /> Entrada
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm">
        <button
          onClick={() => setAba("stock")}
          className={`rounded-xl px-3 py-1.5 font-medium ${aba === "stock" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}
        >
          <span className="flex items-center gap-1.5">
            <Boxes className="h-4 w-4" /> Stock atual
          </span>
        </button>
        <button
          onClick={() => setAba("movimentos")}
          className={`rounded-xl px-3 py-1.5 font-medium ${aba === "movimentos" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}
        >
          <span className="flex items-center gap-1.5">
            <History className="h-4 w-4" /> Movimentos
          </span>
        </button>
        {aba === "stock" && (
          <span className="ml-auto flex items-center gap-2">
            {baixos > 0 && (
              <Badge color="red">
                <AlertTriangle className="h-3 w-3" /> {baixos} a repor
              </Badge>
            )}
            <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={soBaixos}
                onChange={(e) => setSoBaixos(e.target.checked)}
                className="h-4 w-4 rounded accent-emerald-500"
              />
              Só abaixo do mínimo
            </label>
          </span>
        )}
      </div>

      {aba === "stock" ? (
        <>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              className="pl-10"
              placeholder="Procurar produto…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {filtrados.length === 0 ? (
            <EmptyState icon={Boxes} title="Sem produtos em stock" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtrados.map((s) => {
                const perigo = s.abaixo_minimo;
                return (
                  <div
                    key={s.id}
                    className={`rounded-2xl border p-4 transition-colors ${
                      perigo
                        ? "border-rose-500/30 bg-rose-500/[0.04]"
                        : "border-zinc-800 bg-zinc-900/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-100">{s.nome}</p>
                        <p className="text-xs text-zinc-500">
                          {s.categoria ?? "Sem categoria"} · min {s.stock_minimo}
                        </p>
                      </div>
                      <Badge color={perigo ? "red" : "green"}>
                        {perigo && <AlertTriangle className="h-3 w-3" />}
                        {perigo ? "Falta" : "OK"}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span
                        className={`text-3xl font-black tracking-tight ${
                          perigo ? "text-rose-400" : "text-zinc-50"
                        }`}
                      >
                        {s.quantidade_atual}
                      </span>
                      <span className="text-sm text-zinc-500">{s.unidade_medida}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-800">
          <div className="divide-y divide-zinc-800/70">
            {movimentos.length === 0 ? (
              <EmptyState icon={History} title="Sem movimentos" description="Regista entrada e saídas de stock" />
            ) : (
              movimentos.map((m) => {
                const tipo = m.tipo;
                const positivo =
                  tipo === "entrada" || tipo === "devolucao";
                return (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        positivo ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {positivo ? (
                        <ArrowDownToLine className="h-4 w-4" />
                      ) : (
                        <ArrowUpCircle className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-200">{m.nome_produto}</p>
                      <p className="text-xs text-zinc-500">
                        {tipo.replace("_", " ")} · {formatarDataHora(m.data_movimento)}
                        {m.observacao ? ` · ${m.observacao}` : ""}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-bold ${positivo ? "text-emerald-400" : "text-zinc-300"}`}
                    >
                      {positivo ? "+" : ""}
                      {m.quantidade}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <Modal
        open={modal !== ""}
        onClose={() => setModal("")}
        title={modal === "entrada" ? "Entrada de mercadoria" : "Ajuste / Quebra de stock"}
      >
        <form onSubmit={enviar} className="space-y-4">
          <Field label="Produto *">
            <Select
              required
              value={form.produto_id}
              onChange={(e) => setForm((f) => ({ ...f, produto_id: e.target.value }))}
            >
              <option value="">Selecione…</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </Select>
          </Field>

          {modal === "entrada" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Quantidade *">
                <Input
                  type="number"
                  step="0.001"
                  min={0}
                  required
                  value={form.quantidade}
                  onChange={(e) => setForm((f) => ({ ...f, quantidade: e.target.value }))}
                />
              </Field>
              <Field label="Custo unitário">
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.custo_unitario}
                  onChange={(e) => setForm((f) => ({ ...f, custo_unitario: e.target.value }))}
                />
              </Field>
              {controlaLote && (
                <>
                  <Field label="Nº de lote">
                    <Input
                      value={form.numero_lote}
                      onChange={(e) => setForm((f) => ({ ...f, numero_lote: e.target.value }))}
                    />
                  </Field>
                  <Field label="Data de validade">
                    <Input
                      type="date"
                      value={form.data_validade}
                      onChange={(e) => setForm((f) => ({ ...f, data_validade: e.target.value }))}
                    />
                  </Field>
                </>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tipo">
                <Select
                  value={form.tipo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tipo: e.target.value as typeof form.tipo }))
                  }
                >
                  <option value="ajuste">Ajuste</option>
                  <option value="quebra">Quebra</option>
                  <option value="devolucao">Devolução (reposição)</option>
                </Select>
              </Field>
              <Field label="Quantidade *" hint="Use negativo para saída, positivo para reposição">
                <Input
                  type="number"
                  step="0.001"
                  required
                  value={form.quantidade}
                  onChange={(e) => setForm((f) => ({ ...f, quantidade: e.target.value }))}
                />
              </Field>
            </div>
          )}

          <Field label="Observação">
            <Input
              value={form.observacao}
              onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
            />
          </Field>

          {erro && (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setModal("")}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}