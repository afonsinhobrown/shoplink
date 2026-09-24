"use client";

import { useEffect, useState } from "react";
import {
  Search,
  ReceiptText,
  Eye,
  XCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatarMoeda, formatarDataHora } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Loading, EmptyState, Alert } from "@/components/ui/feedback";
import type { VendaDTO } from "@/lib/types";

interface VendaDetalhe extends VendaDTO {
  itens: {
    id: string;
    quantidade: number;
    preco_unitario: number;
    desconto_linha: number;
    subtotal_linha: number;
    produto_nome: string;
  }[];
  pagamentos: { metodo: string; valor: number }[];
  cliente_nome: string | null;
}

export function VendasClient({
  moeda,
  podeCancelar,
}: {
  moeda: string;
  podeCancelar: boolean;
}) {
  const [vendas, setVendas] = useState<VendaDTO[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [q, setQ] = useState("");
  const [detalhe, setDetalhe] = useState<VendaDetalhe | null>(null);
  const [erro, setErro] = useState("");

  function carregar(termo = "") {
    const params = new URLSearchParams();
    params.set("limit", "50");
    if (termo) params.set("q", termo);
    apiFetch<VendaDTO[]>(`/api/vendas?${params.toString()}`)
      .then(setVendas)
      .catch(() => {})
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
  }, []);

  async function verDetalhe(id: string) {
    setErro("");
    try {
      const d = await apiFetch<VendaDetalhe>(`/api/vendas/${id}`);
      setDetalhe(d);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar venda");
    }
  }

  async function cancelar() {
    if (!detalhe) return;
    if (!confirm(`Cancelar a venda ${detalhe.numero_recibo}? O stock será reposto.`)) return;
    try {
      await apiFetch(`/api/vendas/${detalhe.id}`, { method: "POST" });
      setDetalhe(null);
      carregar(q);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao cancelar");
    }
  }

  if (carregando && vendas.length === 0)
    return <Loading className="min-h-[50vh]" label="A carregar vendas…" />;

  return (
    <div className="animate-fade-in mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Vendas</h1>
          <p className="mt-1 text-sm text-zinc-500">Histórico de transações da loja</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input
          className="pl-10"
          placeholder="Procurar recibo ou cliente…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            const t = e.target.value;
            if (!t || t.length >= 2) carregar(t);
          }}
        />
      </div>

      {erro && <Alert tone="error">{erro}</Alert>}

      {vendas.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="Sem vendas ainda"
          description="As vendas feitas no PDV aparecem aqui"
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-800">
          <div className="hidden grid-cols-[1.2fr_1fr_1fr_auto_auto] gap-3 border-b border-zinc-800 bg-zinc-950/60 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500 sm:grid">
            <span>Recibo</span>
            <span>Cliente</span>
            <span className="text-right">Total</span>
            <span>Estado</span>
            <span />
          </div>
          <div className="divide-y divide-zinc-800/70">
            {vendas.map((v) => (
              <div
                key={v.id}
                className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-900/50 sm:grid-cols-[1.2fr_1fr_1fr_auto_auto]"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-100">{v.numero_recibo}</p>
                  <p className="text-xs text-zinc-500">
                    {formatarDataHora(v.data_venda)}
                    {v.origem === "offline" && <span> · offline</span>}
                  </p>
                </div>
                <span className="hidden truncate text-sm text-zinc-400 sm:block">
                  {v.cliente_nome ?? "—"}
                </span>
                <span className="hidden text-right text-sm font-bold text-zinc-100 sm:block">
                  {formatarMoeda(Number(v.total), moeda)}
                </span>
                <span>
                  <StatusPill status={v.status} />
                </span>
                <button
                  onClick={() => verDetalhe(v.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={detalhe !== null}
        onClose={() => setDetalhe(null)}
        title={detalhe ? `Venda ${detalhe.numero_recibo}` : ""}
        size="md"
      >
        {detalhe && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={detalhe.status} />
              <Badge color={detalhe.origem === "offline" ? "violet" : "blue"}>
                {detalhe.origem}
              </Badge>
              <span className="ml-auto text-xs text-zinc-500">
                {formatarDataHora(detalhe.data_venda)}
              </span>
            </div>

            <div className="space-y-2">
              {detalhe.itens.map((i) => (
                <div key={i.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/40 px-3.5 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{i.produto_nome}</p>
                    <p className="text-xs text-zinc-500">
                      {i.quantidade} × {formatarMoeda(Number(i.preco_unitario), moeda)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-zinc-100">
                    {formatarMoeda(Number(i.subtotal_linha), moeda)}
                  </span>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-zinc-950/60 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal</span>
                <span>{formatarMoeda(Number(detalhe.subtotal), moeda)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Desconto</span>
                <span>− {formatarMoeda(Number(detalhe.desconto_total), moeda)}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-800 pt-2 text-base font-bold text-zinc-50">
                <span>Total</span>
                <span>{formatarMoeda(Number(detalhe.total), moeda)}</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {detalhe.pagamentos.map((p, i) => (
                  <span key={i} className="rounded-lg bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
                    {p.metodo}: {formatarMoeda(Number(p.valor), moeda)}
                  </span>
                ))}
              </div>
            </div>

            {detalhe.cliente_nome && (
              <p className="text-sm text-zinc-400">
                Cliente: <span className="font-medium text-zinc-200">{detalhe.cliente_nome}</span>
              </p>
            )}

            {podeCancelar && detalhe.status !== "cancelada" && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                <p className="text-xs text-zinc-400">
                  Cancelar repõe automaticamente o stock dos produtos desta venda.
                </p>
                <Button variant="danger" size="sm" className="mt-2" onClick={cancelar}>
                  <XCircle className="h-4 w-4" /> Cancelar venda
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}