"use client";

import { useEffect, useState } from "react";
import {
  Banknote,
  Lock,
  Unlock,
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  Loader2,
  Wallet,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatarMoeda, formatarDataHora, relativo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Loading, EmptyState, Alert } from "@/components/ui/feedback";
import type { SessaoCaixaDTO } from "@/lib/types";

interface SessaoHistorico extends SessaoCaixaDTO {
  valor_esperado: number | null;
  valor_fecho: number | null;
  diferenca: number | null;
  data_fecho: string | null;
}

interface CaixaData {
  sessaoAtual: (SessaoCaixaDTO & { valor_abertura: number }) | null;
  historico: SessaoHistorico[];
  movimentos: { id: string; tipo: string; valor: number; observacao: string | null; data_movimento: string }[];
  temAberta: boolean;
}

export function CaixaClient({ moeda, papel }: { moeda: string; papel: string }) {
  const [data, setData] = useState<CaixaData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState<"" | "abrir" | "movimento" | "fechar" | "fecho_resumo">("");
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [resumoFecho, setResumoFecho] = useState<{ esperado: number; diferenca: number } | null>(null);

  function carregar() {
    apiFetch<CaixaData>("/api/caixa")
      .then(setData)
      .catch(() => {})
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
  }, []);

  async function acao(tipo: string) {
    setSalvando(true);
    setErro("");
    try {
      const body: Record<string, unknown> = { acao: tipo };
      if (tipo === "abrir") body.valor = Number(valor) || 0;
      if (tipo === "fechar") body.valor_fecho = Number(valor) || 0;
      if (["sangria", "suprimento"].includes(tipo)) {
        body.valor = Number(valor) || 0;
        body.observacao = obs || null;
      }
      const res = await apiFetch<{ esperado: number; diferenca: number }>("/api/caixa", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (tipo === "fechar") {
        setResumoFecho(res);
        setModal("fecho_resumo");
      } else {
        setModal("");
      }
      setValor("");
      setObs("");
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha na operação");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando && !data) return <Loading className="min-h-[50vh]" label="A carregar caixa…" />;
  if (!data) return null;

  const sessao = data.sessaoAtual;
  const podeAbrir = ["dono", "gestor"].includes(papel) || papel === "caixa";

  return (
    <div className="animate-fade-in mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Caixa</h1>
          <p className="mt-1 text-sm text-zinc-500">Sessões de caixa, sangrias e fecho</p>
        </div>
        <Badge color={data.temAberta ? "green" : "zinc"}>
          {data.temAberta ? "Caixa aberta" : "Caixa fechada"}
        </Badge>
      </div>

      {erro && <Alert tone="error">{erro}</Alert>}

      {/* Estado atual */}
      {sessao ? (
        <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-2xl" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-500/15 p-3">
                <Wallet className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-zinc-50">
                  {data.temAberta ? "Sessão aberta" : "Última sessão"}
                </p>
                <p className="text-sm text-zinc-500">
                  Aberta por {sessao.utilizador_nome} · {relativo(sessao.data_abertura)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">Total no caixa</p>
              <p className="text-2xl font-black text-zinc-50">
                {formatarMoeda(Number(sessao.valor_abertura) + Number(sessao.total_vendas ?? 0) + Number(sessao.suprimentos ?? 0) - Number(sessao.sangrias ?? 0), moeda)}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-zinc-950/50 p-3.5">
              <p className="text-[11px] uppercase text-zinc-500">Abertura</p>
              <p className="mt-0.5 font-semibold text-zinc-200">
                {formatarMoeda(Number(sessao.valor_abertura), moeda)}
              </p>
            </div>
            <div className="rounded-2xl bg-zinc-950/50 p-3.5">
              <p className="text-[11px] uppercase text-zinc-500">Vendas</p>
              <p className="mt-0.5 font-semibold text-emerald-400">
                {formatarMoeda(Number(sessao.total_vendas ?? 0), moeda)}
              </p>
            </div>
            <div className="rounded-2xl bg-zinc-950/50 p-3.5">
              <p className="text-[11px] uppercase text-zinc-500">Sangrias</p>
              <p className="mt-0.5 font-semibold text-rose-400">
                {formatarMoeda(Number(sessao.sangrias ?? 0), moeda)}
              </p>
            </div>
            <div className="rounded-2xl bg-zinc-950/50 p-3.5">
              <p className="text-[11px] uppercase text-zinc-500">Suprimentos</p>
              <p className="mt-0.5 font-semibold text-sky-400">
                {formatarMoeda(Number(sessao.suprimentos ?? 0), moeda)}
              </p>
            </div>
          </div>

          {data.temAberta && (
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setValor("");
                  setObs("");
                  setModal("movimento");
                }}
              >
                <ArrowUpCircle className="h-4 w-4" /> Sangria
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setValor("");
                  setObs("");
                  setModal("movimento");
                }}
              >
                <ArrowDownCircle className="h-4 w-4" /> Suprimento
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setValor("");
                  setModal("fechar");
                }}
              >
                <Lock className="h-4 w-4" /> Fechar caixa
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-10 text-center">
          <div className="rounded-2xl bg-zinc-800/60 p-4">
            <Lock className="h-7 w-7 text-zinc-500" />
          </div>
          <div>
            <p className="font-semibold text-zinc-200">Nenhuma caixa aberta</p>
            <p className="mt-1 text-sm text-zinc-500">
              Abra a caixa antes de fechar o dia
            </p>
          </div>
          {podeAbrir && (
            <Button onClick={() => { setModal("abrir"); setValor(""); }}>
              <Unlock className="h-4 w-4" /> Abrir caixa
            </Button>
          )}
        </div>
      )}

      {/* Movimentos */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-300">
          <History className="h-4 w-4" /> Movimentos da sessão
        </h2>
        {data.movimentos.length === 0 ? (
          <EmptyState title="Sem movimentos" description="Vendas e sangrias aparecem aqui" />
        ) : (
          <div className="divide-y divide-zinc-800/70 overflow-hidden rounded-2xl border border-zinc-800">
            {data.movimentos.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    m.tipo === "sangria"
                      ? "bg-rose-500/15 text-rose-400"
                      : m.tipo === "suprimento"
                        ? "bg-sky-500/15 text-sky-400"
                        : "bg-emerald-500/15 text-emerald-400"
                  }`}
                >
                  {m.tipo === "sangria" ? (
                    <ArrowUpCircle className="h-4 w-4" />
                  ) : m.tipo === "suprimento" ? (
                    <ArrowDownCircle className="h-4 w-4" />
                  ) : (
                    <Banknote className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium capitalize text-zinc-200">{m.tipo}</p>
                  <p className="text-xs text-zinc-500">
                    {formatarDataHora(m.data_movimento)}
                    {m.observacao ? ` · ${m.observacao}` : ""}
                  </p>
                </div>
                <span
                  className={`text-sm font-bold ${
                    m.tipo === "sangria" ? "text-rose-400" : "text-zinc-100"
                  }`}
                >
                  {m.tipo === "sangria" ? "−" : "+"}
                  {formatarMoeda(Number(m.valor), moeda)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Histórico */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Sessões anteriores</h2>
        {data.historico.length === 0 ? (
          <EmptyState title="Sem histórico" />
        ) : (
          <div className="divide-y divide-zinc-800/70 overflow-hidden rounded-2xl border border-zinc-800">
            {data.historico.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-200">
                    {formatarDataHora(s.data_abertura)}
                  </p>
                  <p className="text-xs text-zinc-500">por {s.utilizador_nome}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-zinc-100">
                    {formatarMoeda(Number(s.valor_esperado ?? 0), moeda)}
                  </p>
                  {s.diferenca != null && s.diferenca !== 0 && (
                    <p className={`text-xs font-medium ${Number(s.diferenca) < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                      quebra {Number(s.diferenca) < 0 ? "−" : "+"}
                      {formatarMoeda(Math.abs(Number(s.diferenca)), moeda)}
                    </p>
                  )}
                </div>
                <StatusPill status={s.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal abrir */}
      <Modal open={modal === "abrir"} onClose={() => setModal("")} title="Abrir caixa">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            acao("abrir");
          }}
          className="space-y-4"
        >
          <Field label="Valor de abertura">
            <Input
              type="number"
              min={0}
              autoFocus
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0.00"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setModal("")}>Cancelar</Button>
            <Button type="submit" disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Abrir
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal sangria/suprimento */}
      <Modal open={modal === "movimento"} onClose={() => setModal("")} title="Movimento de caixa">
        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" onClick={() => acao("sangria")} variant="danger" disabled={salvando}>
              <ArrowUpCircle className="h-4 w-4" /> Sangria
            </Button>
            <Button type="button" onClick={() => acao("suprimento")} variant="secondary" disabled={salvando}>
              <ArrowDownCircle className="h-4 w-4" /> Suprimento
            </Button>
          </div>
          <Field label="Valor">
            <Input
              type="number"
              min={0}
              required
              autoFocus
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </Field>
          <Field label="Observação">
            <Input
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Motivo da sangria/suprimento"
            />
          </Field>
          <p className="text-xs text-zinc-500">Toque em Sangria ou Suprimento para confirmar.</p>
        </form>
      </Modal>

      {/* Modal fechar */}
      <Modal
        open={modal === "fechar"}
        onClose={() => setModal("")}
        title="Fechar caixa"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal("")}>Cancelar</Button>
            <Button onClick={() => acao("fechar")} disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar fecho
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {resumoFecho && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
              <p className="text-emerald-400">
                Valores: esperado {formatarMoeda(resumoFecho.esperado, moeda)} · quebra{" "}
                {formatarMoeda(resumoFecho.diferenca, moeda)}
              </p>
            </div>
          )}
          <Field label="Valor em caixa (contagem)" hint="Confirme o valor real no fecho">
            <Input
              type="number"
              min={0}
              step="0.01"
              autoFocus
              required
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0.00"
            />
          </Field>
        </div>
      </Modal>

      {/* Modal resumo fecho */}
      <Modal open={modal === "fecho_resumo"} onClose={() => setModal("")} title="Resumo do Fecho">
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
            <p className="mb-3 text-lg font-bold text-emerald-400">Caixa fechado com sucesso!</p>
            <div className="flex flex-col gap-1 text-sm text-zinc-300">
              <p>Valor esperado no sistema: <span className="font-bold text-zinc-100">{formatarMoeda(resumoFecho?.esperado || 0, moeda)}</span></p>
              <p>Quebra / Sobra: <span className={`font-bold ${(resumoFecho?.diferenca || 0) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{formatarMoeda(resumoFecho?.diferenca || 0, moeda)}</span></p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setModal("")}>Concluir</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}