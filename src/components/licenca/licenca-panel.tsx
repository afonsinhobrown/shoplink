"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  KeyRound,
  Loader2,
  Lock,
  Printer,
  Send,
  ShieldCheck,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Loading, Alert, EmptyState } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { formatarMoeda, formatarData, formatarDataHora } from "@/lib/format";

interface Pagamento {
  id: string;
  metodo: "bci" | "bim" | "manual";
  valor: number;
  status: string;
  referencia_pagamento: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  recibo_numero: string | null;
  recibo_enviado: boolean;
  data_envio_recibo: string | null;
  data_pagamento: string | null;
  data_criacao: string;
  observacao: string | null;
}

interface Dados {
  loja: { nome: string; empresa: string | null; email: string | null };
  licenca: {
    id: string;
    estado: string;
    plano: string;
    valor_mensal: number;
    data_inicio: string | null;
    data_fim: string | null;
    dias_restantes: number;
    efetivamente_ativa: boolean;
  };
  pagamentos: Pagamento[];
}

const METODO_LABEL: Record<string, string> = {
  bci: "Cartão BCI",
  bim: "Cartão BIM",
  manual: "Manual",
};

const BETADO: Record<
  string,
  { label: string; color: "green" | "amber" | "red" | "blue" | "violet" | "zinc" }
> = {
  ativa: { label: "Ativa", color: "green" },
  expirada: { label: "Expirada", color: "red" },
  bloqueada: { label: "Bloqueada", color: "amber" },
};

const BPAG: Record<string, { label: string; color: "green" | "amber" | "red" | "blue" | "violet" | "zinc" }> = {
  pago: { label: "Pago", color: "green" },
  pendente: { label: "Pendente", color: "amber" },
  falhou: { label: "Falhou", color: "red" },
  reembolsado: { label: "Reembolsado", color: "zinc" },
};

export function LicencaPanel({ papel = "dono" }: { papel?: string }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aPagar, setAPagar] = useState<string | null>(null);
  const [aAcao, setAAcao] = useState<string | null>(null);
  const [recibo, setRecibo] = useState<Pagamento | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const res = await fetch("/api/licenca");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao carregar a licença.");
      setDados(data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function pagar(metodo: "bci" | "bim") {
    setAPagar(metodo);
    setAviso(null);
    setErro(null);
    try {
      const res = await fetch("/api/licenca/pagar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metodo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao pagar.");
      if (data.status === "pago") {
        setAviso("Pagamento confirmado: " + data.recibo);
        await carregar();
        setTimeout(() => window.location.reload(), 1200);
        return;
      }
      if (data.checkout_url) {
        window.location.assign(data.checkout_url);
        return;
      }
      setAviso(
        "Pagamento iniciado. Confirme o pagamento no meio que escolheu e verifique depois o estado aqui."
      );
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setAPagar(null);
    }
  }

  async function acao(acao: "bloquear" | "reativar") {
    const ok = confirm(
      acao === "bloquear"
        ? "Bloquear a licença impede a utilização do ShopLink nesta loja. Continuar?"
        : "Reativar a licença manualmente. Continuar?"
    );
    if (!ok) return;
    setAAcao(acao);
    setErro(null);
    try {
      const res = await fetch("/api/licenca", {
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
      setAAcao(null);
    }
  }

  async function enviarRecibo(p: Pagamento) {
    setErro(null);
    try {
      const res = await fetch(`/api/licenca/recibos/${p.id}/enviar`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao enviar o recibo.");
      await carregar();
      alert(`Recibo ${data.recibo_numero} marcado como enviado.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
    }
  }

  function imprimirRecibo() {
    if (!recibo || !dados) return;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Recibo ${recibo.recibo_numero}</title>
<style>body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:32px;max-width:520px;margin:auto}
h2{margin:4px 0 0}.wallet{border:1px solid #e5e7eb;border-radius:12px;padding:20px}
table{width:100%;border-collapse:collapse;margin-top:16px}th,td{text-align:left;padding:8px 4px;border-bottom:1px solid #e5e7eb}
.total{font-size:18px;font-weight:700}</style></head><body>
<div class="wallet">
<h2>ShopLink</h2><p style="color:#666">Recibo de pagamento da licença</p>
<table>
<tr><th>N.º recibo</th><td>${recibo.recibo_numero ?? "—"}</td></tr>
<tr><th>Loja</th><td>${dados.loja.nome}</td></tr>
<tr><th>Empresa</th><td>${dados.loja.empresa || "—"}</td></tr>
<tr><th>Plano</th><td>Mensal (30 dias)</td></tr>
<tr><th>Método</th><td>${METODO_LABEL[recibo.metodo] ?? recibo.metodo}</td></tr>
<tr><th>Data pagamento</th><td>${recibo.data_pagamento ? formatarDataHora(recibo.data_pagamento) : "—"}</td></tr>
<tr><th>Período</th><td>${recibo.periodo_inicio ? formatarData(recibo.periodo_inicio) : "—"} → ${recibo.periodo_fim ? formatarData(recibo.periodo_fim) : "—"}</td></tr>
<tr><th>Valor</th><td class="total">${formatarMoeda(recibo.valor)}</td></tr>
</table>
</div>
<p style="color:#999;font-size:11px;margin-top:24px">Documento emitido automaticamente — ShopLink • ${dataAtual()}</p>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  if (!dados && !erro) {
    return (
      <div className="animate-fade-in">
        <Loading label="A carregar a licença…" />
      </div>
    );
  }

  if (erro && !dados) {
    return (
      <div className="animate-fade-in">
        <EmptyState
          icon={AlertTriangle}
          title="Não foi possível carregar a licença"
          description={erro}
          action={<Button onClick={carregar}>Tentar novamente</Button>}
        />
      </div>
    );
  }
  if (!dados) return null;

  const L = dados.licenca;
  const ativa = L.efetivamente_ativa;
  const estadoLbl = BETADO[L.estado]?.label ?? L.estado;
  const estadoCor = BETADO[L.estado]?.color ?? "zinc";
  const podePagar = papel === "dono";

  return (
    <div className="animate-fade-in space-y-6">
      {erro && <Alert tone="error">{erro}</Alert>}
      {aviso && <Alert tone="success">{aviso}</Alert>}

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
          Licença <span className="text-zinc-500">· {dados.loja.nome}</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Assinatura mensal do ShopLink. Renove antes de expirar para manter a loja
          sempre ativa.
        </p>
      </div>

      {!ativa && (
        <Alert tone="error">
          <div>
            <p className="font-semibold">
              {L.estado === "bloqueada"
                ? "A licença desta loja foi bloqueada."
                : "A sua licença expirou."}
            </p>
            <p className="mt-0.5">
              {L.estado === "bloqueada"
                ? "Contacte o apoio ou renove a licença para continuar a usar o ShopLink."
                : "Pague 2.500,00 MZN para renovar a subscrição e continuar a usar o ShopLink."}
            </p>
          </div>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Estado</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge color={estadoCor}>{estadoLbl}</Badge>
            {ativa ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <Lock className="h-4 w-4 text-rose-400" />
            )}
          </div>
          <p className="mt-3 text-xs text-zinc-500">Plano mensal · renovação automática de 30 dias</p>
        </Card>

        <Card className="p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Válida até</p>
          <p className="mt-2 text-xl font-bold text-zinc-50">
            {L.data_fim ? formatarData(L.data_fim) : "—"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {ativa
              ? `${L.dias_restantes} dias restantes`
              : "Sem validade (licença não ativa)"}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Mensalidade</p>
          <p className="mt-2 text-xl font-bold text-emerald-400">
            {formatarMoeda(L.valor_mensal)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">via NetShop · cartão BCI ou BIM</p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Renovar licença"
          subtitle="Escolha o método de pagamento. Após o pagamento a validade é renovada por 30 dias."
        />
        <div className="p-5">
          {podePagar ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                variant="secondary"
                size="lg"
                disabled={aPagar !== null}
                onClick={() => pagar("bci")}
                className="justify-start"
              >
                {aPagar === "bci" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <KeyRound className="h-5 w-5 text-sky-400" />
                )}
                <span className="text-left">
                  <span className="block">Cartão BCI</span>
                  <span className="block text-xs font-normal text-zinc-500">
                    {formatarMoeda(L.valor_mensal)} · Visa/Bancário
                  </span>
                </span>
              </Button>
              <Button
                variant="secondary"
                size="lg"
                disabled={aPagar !== null}
                onClick={() => pagar("bim")}
                className="justify-start"
              >
                {aPagar === "bim" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CreditCard className="h-5 w-5 text-amber-400" />
                )}
                <span className="text-left">
                  <span className="block">Cartão BIM</span>
                  <span className="block text-xs font-normal text-zinc-500">
                    {formatarMoeda(L.valor_mensal)} · Visa Internacional
                  </span>
                </span>
              </Button>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              Peça ao dono da loja para gerir a licença.
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Controlo administrativo"
          subtitle="Ativar, bloquear e emitir recibos da licença."
        />
        <div className="flex flex-wrap gap-2 p-5">
          {podePagar ? (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={aAcao !== null}
                onClick={() => acao("reativar")}
              >
                {aAcao === "reativar" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unlock className="h-4 w-4" />
                )}
                Ativar
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={aAcao !== null}
                onClick={() => acao("bloquear")}
              >
                {aAcao === "bloquear" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                Bloquear
              </Button>
            </>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Histórico de pagamentos e recibos"
          subtitle="Registos de pagamento da licença e emissão de recibos."
        />
        <div className="overflow-x-auto p-5 pt-2">
          {dados.pagamentos.length === 0 ? (
            <EmptyState
              icon={KeyRound}
              title="Sem pagamentos registados"
              description="Quando pagar a licença, os recibos aparecerão aqui."
            />
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                  <th className="pb-2 pr-4 font-medium">Data</th>
                  <th className="pb-2 pr-4 font-medium">Método</th>
                  <th className="pb-2 pr-4 font-medium">Período</th>
                  <th className="pb-2 pr-4 font-medium">Valor</th>
                  <th className="pb-2 pr-4 font-medium">Estado</th>
                  <th className="pb-2 pr-4 font-medium">Recibo</th>
                  <th className="pb-2 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {dados.pagamentos.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-800/60">
                    <td className="py-3 pr-4 align-top">
                      <p className="text-zinc-100">{formatarDataHora(p.data_criacao)}</p>
                      {p.referencia_pagamento && (
                        <p className="mt-0.5 font-mono text-[10px] text-zinc-600">
                          {p.referencia_pagamento}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-4 align-top text-zinc-300">
                      {METODO_LABEL[p.metodo] ?? p.metodo}
                    </td>
                    <td className="py-3 pr-4 align-top text-zinc-500">
                      {p.periodo_inicio && p.periodo_fim
                        ? `${formatarData(p.periodo_inicio)} → ${formatarData(p.periodo_fim)}`
                        : "—"}
                    </td>
                    <td className="py-3 pr-4 align-top text-zinc-100">
                      {formatarMoeda(p.valor)}
                    </td>
                    <td className="py-3 pr-4 align-top">
                      <Badge color={BPAG[p.status]?.color ?? "zinc"}>
                        {BPAG[p.status]?.label ?? p.status}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 align-top">
                      {p.recibo_numero && (
                        <div>
                          <p className="font-mono text-xs text-zinc-300">{p.recibo_numero}</p>
                          <p className="mt-0.5 text-[10px] text-zinc-600">
                            {p.recibo_enviado
                              ? `Enviado ${p.data_envio_recibo ? formatarDataHora(p.data_envio_recibo) : ""}`
                              : "Não enviado"}
                          </p>
                        </div>
                      )}
                    </td>
                    <td className="py-3 text-right align-top">
                      {p.status === "pago" && (
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setRecibo(p)}>
                            <Printer className="h-3.5 w-3.5" />
                            Ver
                          </Button>
                          {podePagar && !p.recibo_enviado && (
                            <Button variant="outline" size="sm" onClick={() => enviarRecibo(p)}>
                              <Send className="h-3.5 w-3.5" />
                              Enviar
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Modal open={recibo !== null} onClose={() => setRecibo(null)}>
        {recibo && dados && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-zinc-50">Recibo de licença</h3>
                <p className="font-mono text-xs text-zinc-500">{recibo.recibo_numero}</p>
              </div>
              <Button size="sm" onClick={imprimirRecibo}>
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-sm">
              <p className="text-lg font-bold text-zinc-50">ShopLink</p>
              <p className="text-xs text-zinc-500">Recibo de pagamento da licença mensal</p>
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-8 gap-y-2">
                <dt className="text-zinc-500">Loja</dt>
                <dd className="text-zinc-100">{dados.loja.nome}</dd>
                <dt className="text-zinc-500">Empresa</dt>
                <dd className="text-zinc-100">{dados.loja.empresa || "—"}</dd>
                <dt className="text-zinc-500">Método</dt>
                <dd className="text-zinc-100">{METODO_LABEL[recibo.metodo] ?? recibo.metodo}</dd>
                <dt className="text-zinc-500">Data pagamento</dt>
                <dd className="text-zinc-100">
                  {recibo.data_pagamento ? formatarDataHora(recibo.data_pagamento) : "—"}
                </dd>
                <dt className="text-zinc-500">Período</dt>
                <dd className="text-zinc-100">
                  {recibo.periodo_inicio && recibo.periodo_fim
                    ? `${formatarData(recibo.periodo_inicio)} → ${formatarData(recibo.periodo_fim)}`
                    : "—"}
                </dd>
                <dt className="text-zinc-500">Valor</dt>
                <dd className="font-bold text-emerald-400">{formatarMoeda(recibo.valor)}</dd>
                <dt className="text-zinc-500">Referência</dt>
                <dd className="font-mono text-xs text-zinc-400">{recibo.referencia_pagamento || "—"}</dd>
              </dl>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function dataAtual(): string {
  return new Date().toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}