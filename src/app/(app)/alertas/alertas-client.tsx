"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  ClipboardList,
  PackageX,
  RefreshCw,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loading, EmptyState, Alert } from "@/components/ui/feedback";
import { formatarMoeda, formatarDataHora, formatarData } from "@/lib/format";

interface Dados {
  stockBaixo: {
    id: string;
    nome: string;
    unidade_medida: string;
    stock_minimo: number;
    quantidade_atual: number;
  }[];
  lotesAExpirar: {
    id: string;
    produto: string;
    numero_lote: string | null;
    data_validade: string;
    quantidade: number;
    dias: number;
  }[];
  fiadoVencido: {
    id: string;
    cliente: string;
    descricao: string | null;
    valor_total: number;
    data_vencimento: string;
    dias_atraso: number;
  }[];
  pedidosPendentes: {
    id: string;
    numero_pedido: string;
    tipo: string;
    total: number;
    data_criacao: string;
  }[];
  resumo: Record<string, number>;
}

export function AlertasClient({ moeda }: { moeda: string }) {
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const res = await fetch("/api/alertas");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao carregar alertas.");
      setD(data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  if (!d && !erro) return <Loading label="A carregar alertas…" />;
  if (!d) return <Alert tone="error">{erro}</Alert>;

  const cartoes = [
    { label: "Stock a repor", valor: d.resumo.stockBaixo, icon: PackageX, cor: "text-rose-400" },
    { label: "Lotes a expirar", valor: d.resumo.lotesAExpirar, icon: CalendarClock, cor: "text-amber-400" },
    { label: "Fiado vencido", valor: d.resumo.fiadoVencido, icon: AlertTriangle, cor: "text-rose-400" },
    { label: "Pedidos pendentes", valor: d.resumo.pedidosPendentes, icon: ClipboardList, cor: "text-sky-400" },
  ];

  return (
    <div className="animate-fade-in mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-50">
            <Bell className="h-6 w-6 text-emerald-400" /> Alertas
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Tudo o que precisa da sua atenção, num só lugar.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={carregar}>
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      {erro && <Alert tone="error">{erro}</Alert>}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {cartoes.map((c) => (
          <Card key={c.label} className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-400">{c.label}</p>
              <c.icon className={`h-5 w-5 ${c.cor}`} />
            </div>
            <p className="mt-2 text-2xl font-bold text-zinc-50">{c.valor}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Stock a repor"
          subtitle="Produtos abaixo do mínimo definido"
          action={<Link href="/stock" className="text-xs font-medium text-emerald-400">Gerir stock</Link>}
        />
        <div className="p-5 pt-2">
          {d.stockBaixo.length === 0 ? (
            <EmptyState icon={PackageX} title="Sem ruturas de stock" />
          ) : (
            <div className="divide-y divide-zinc-800/70">
              {d.stockBaixo.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3">
                  <span className="text-sm text-zinc-200">{p.nome}</span>
                  <span className="text-sm text-rose-400">
                    {p.quantidade_atual} / mínimo {p.stock_minimo} {p.unidade_medida}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Lotes a expirar" subtitle="Validade nos próximos 30 dias" />
          <div className="p-5 pt-2">
            {d.lotesAExpirar.length === 0 ? (
              <EmptyState icon={CalendarClock} title="Sem lotes a expirar" />
            ) : (
              <div className="divide-y divide-zinc-800/70">
                {d.lotesAExpirar.map((l) => (
                  <div key={l.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm text-zinc-200">{l.produto}</p>
                      <p className="text-xs text-zinc-500">
                        Lote {l.numero_lote || "—"} · {l.quantidade} un.
                      </p>
                    </div>
                    <Badge color={l.dias <= 0 ? "red" : "amber"}>
                      {l.dias <= 0 ? "Expirado" : `${l.dias} dias`} · {formatarData(l.data_validade)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Fiado vencido" subtitle="Contas a receber em atraso" />
          <div className="p-5 pt-2">
            {d.fiadoVencido.length === 0 ? (
              <EmptyState icon={AlertTriangle} title="Nada em atraso" />
            ) : (
              <div className="divide-y divide-zinc-800/70">
                {d.fiadoVencido.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm text-zinc-200">{c.cliente}</p>
                      <p className="text-xs text-zinc-500">
                        {c.descricao || "Fiado"} · venceu {formatarData(c.data_vencimento)}
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
      </div>

      <Card>
        <CardHeader title="Pedidos online por confirmar" subtitle="Aguardam confirmação na loja" />
        <div className="p-5 pt-2">
          {d.pedidosPendentes.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Sem pedidos pendentes" />
          ) : (
            <div className="divide-y divide-zinc-800/70">
              {d.pedidosPendentes.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm text-zinc-200">{p.numero_pedido}</p>
                    <p className="text-xs text-zinc-500">
                      {p.tipo} · {formatarDataHora(p.data_criacao)}
                    </p>
                  </div>
                  <span className="text-sm text-zinc-100">{formatarMoeda(p.total, moeda)}</span>
                </div>
              ))}
              <Link href="/pedidos" className="mt-2 inline-block text-xs font-medium text-emerald-400">
                Ir para pedidos
              </Link>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}