"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Loading } from "@/components/ui/feedback";
import { formatarDataHora, relativo } from "@/lib/format";

interface Pedido {
  id: string;
  numero_pedido: string;
  tipo: "compra_online" | "reserva";
  status: string;
  status_pagamento: string;
  metodo_pagamento: string | null;
  tipo_entrega: string;
  endereco_entrega: string | null;
  subtotal: number;
  total: number;
  data_criacao: string;
  data_expiracao: string | null;
  venda_id: string | null;
  cliente_nome: string;
  cliente_telefone: string;
  num_itens: string;
}

const STATYS: Record<string, { label: string; color: "green" | "red" | "amber" | "blue" | "violet" | "zinc" }> = {
  aguardando_confirmacao: { label: "A aguardar confirmação", color: "amber" },
  confirmado: { label: "Confirmado", color: "blue" },
  pronto_levantamento: { label: "Pronto a levantar", color: "blue" },
  concluido: { label: "Concluído", color: "green" },
  cancelado: { label: "Cancelado", color: "red" },
  expirado: { label: "Expirado", color: "zinc" },
};

const PAGAMENTO: Record<string, { label: string; color: "green" | "red" | "amber" | "blue" | "violet" | "zinc" }> = {
  pago: { label: "Pago", color: "green" },
  pendente: { label: "Pendente", color: "amber" },
  falhou: { label: "Falhou", color: "red" },
  reembolsado: { label: "Reembolsado", color: "zinc" },
};

export function PedidosClient() {
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [filtro, setFiltro] = useState<string>("");
  const [erro, setErro] = useState<string | null>(null);
  const [aCarregar, setACarregar] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const q = filtro ? `?status=${encodeURIComponent(filtro)}` : "";
      const res = await fetch(`/api/pedidos${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao carregar pedidos.");
      setPedidos(data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
      setPedidos([]);
    }
  }, [filtro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function acao(p: Pedido, acao: string) {
    if (acao === "concluir") {
      const ok = confirm(
        `Confirmar a conclusão do pedido ${p.numero_pedido}?\nIsto regista a venda no sistema.`
      );
      if (!ok) return;
    }
    setACarregar(true);
    setErro(null);
    try {
      const res = await fetch(`/api/pedidos/${p.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha na ação.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setACarregar(false);
    }
  }

  const fichas: { chave: string; label: string }[] = [
    { chave: "", label: "Todos" },
    { chave: "aguardando_confirmacao", label: "A aguardar" },
    { chave: "confirmado", label: "Confirmados" },
    { chave: "concluido", label: "Concluídos" },
    { chave: "cancelado", label: "Cancelados" },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Pedidos online</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Encomendas da sua loja online. Conclua para gerar a venda.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {fichas.map((f) => (
          <button
            key={f.chave}
            onClick={() => setFiltro(f.chave)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              filtro === f.chave
                ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={carregar}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-zinc-800 px-3.5 py-1.5 text-xs font-medium text-zinc-400 hover:border-zinc-700"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </button>
      </div>

      {erro && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {erro}
        </div>
      )}

      {pedidos === null ? (
        <Loading label="A carregar pedidos…" />
      ) : pedidos.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Sem pedidos"
          description={
            filtro
              ? "Nenhum pedido neste estado."
              : "Ainda não recebeu pedidos. Os clientes encomendam pelo seu link público da loja."
          }
        />
      ) : (
        <ul className="space-y-3">
          {pedidos.map((p) => {
            const st = STATYS[p.status] ?? { label: p.status, color: "zinc" as const };
            const pg = PAGAMENTO[p.status_pagamento] ?? { label: p.status_pagamento, color: "zinc" as const };
            return (
              <li
                key={p.id}
                className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-zinc-100">{p.numero_pedido}</span>
                    <Badge color={p.tipo === "compra_online" ? "blue" : "violet"}>
                      {p.tipo === "compra_online" ? "Compra online" : "Reserva"}
                    </Badge>
                    <Badge color={st.color}>{st.label}</Badge>
                    <Badge color={pg.color}>{pg.label}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-zinc-400">
                    {p.cliente_nome} · {p.cliente_telefone}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
                    {formatarDataHora(p.data_criacao)} ({relativo(p.data_criacao)}) · {p.num_itens} itens ·{" "}
                    {p.metodo_pagamento ?? "—"} ·{" "}
                    {p.tipo_entrega === "levantamento" ? "Levantamento" : "Entrega ao domicílio"}
                  </p>
                  {p.tipo_entrega === "entrega_domicilio" && p.endereco_entrega && (
                    <p className="mt-0.5 text-xs text-zinc-500">→ {p.endereco_entrega}</p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                  <span className="text-lg font-semibold text-emerald-400">
                    {new Intl.NumberFormat("pt-PT", {
                      style: "currency",
                      currency: "MZN",
                      minimumFractionDigits: 2,
                    }).format(Number(p.total))}
                  </span>
                  <div className="flex gap-2">
                    {p.status === "aguardando_confirmacao" && (
                      <Button size="sm" variant="secondary" onClick={() => acao(p, "confirmar")}>
                        Confirmar
                      </Button>
                    )}
                    {["aguardando_confirmacao", "confirmado", "pronto_levantamento"].includes(p.status) && (
                      <>
                        <Button size="sm" onClick={() => acao(p, "concluir")}>
                          <CheckCircle2 className="h-4 w-4" /> Concluir
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => acao(p, "cancelar")} disabled={aCarregar}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {p.status === "concluido" && p.venda_id && (
                      <Badge color="green">Venda #{p.venda_id.slice(0, 8)}</Badge>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
          {aCarregar && (
            <p className="flex items-center justify-center gap-2 py-4 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" /> A processar…
            </p>
          )}
        </ul>
      )}
    </div>
  );
}