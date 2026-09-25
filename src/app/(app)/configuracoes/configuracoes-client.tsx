"use client";

import { useEffect, useState } from "react";
import { Save, Loader2, Store, Users, Shield, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Field, Switch } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loading, Alert } from "@/components/ui/feedback";
import { rotuloTipoLoja } from "@/lib/format";

interface LojaConfig {
  id: string;
  nome: string;
  tipo_loja: string;
  provincia: string | null;
  cidade: string | null;
  endereco: string | null;
  moeda: string;
  modo_pos: string;
  permite_venda_granel: boolean;
  permite_venda_fiado: boolean;
  controla_lote_validade: boolean;
  stock_minimo_ativo: boolean;
  empresa: string;
  email_empresa: string | null;
  telefone: string | null;
  nuit: string | null;
  plano: string;
  imposto_padrao: number;
  logotipo_url: string | null;
  tempo_inatividade: number;
}

interface Utilizador { id: string; papel: string; nome: string; email: string; ativo: boolean }

export function ConfiguracoesClient({ ehDono }: { ehDono: boolean }) {
  const [form, setForm] = useState<LojaConfig | null>(null);
  const [utilizadores, setUtilizadores] = useState<Utilizador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    apiFetch<{ loja: LojaConfig; utilizadores: Utilizador[] }>("/api/configuracoes")
      .then((r) => {
        setForm(r.loja);
        setUtilizadores(r.utilizadores);
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSalvando(true);
    setErro("");
    setMsg("");
    try {
      await apiFetch("/api/configuracoes", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setMsg("Configurações guardadas com sucesso.");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao guardar");
    } finally {
      setSalvando(false);
    }
  }

  const set = (k: keyof LojaConfig, v: unknown) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const flip = (k: keyof LojaConfig) => setForm((f) => (f ? { ...f, [k]: !f[k] } : f));

  if (carregando && !form) return <Loading className="min-h-[50vh]" label="A carregar configurações…" />;
  if (!form) return null;

  return (
    <div className="animate-fade-in mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Configurações</h1>
        <p className="mt-1 text-sm text-zinc-500">Prefeências da loja e da subscrição</p>
      </div>

      {msg && <Alert tone="success">{msg}</Alert>}
      {erro && <Alert tone="error">{erro}</Alert>}

      <form onSubmit={guardar} className="space-y-6">
        {/* Empresa */}
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            <Store className="h-4 w-4" /> Tenancy · plano {form.plano}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Empresa">
              <Input value={form.empresa} disabled />
            </Field>
            <Field label="Loja">
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} disabled={!ehDono} />
            </Field>
            <Field label="Logotipo (URL da imagem)">
              <Input value={form.logotipo_url ?? ""} onChange={(e) => set("logotipo_url", e.target.value)} disabled={!ehDono} placeholder="https://exemplo.com/logo.png" />
            </Field>
            <Field label="Imposto Padrão (IVA %)">
              <Input type="number" min="0" step="0.01" value={form.imposto_padrao ?? 0} onChange={(e) => set("imposto_padrao", parseFloat(e.target.value) || 0)} disabled={!ehDono} />
            </Field>
            <Field label="Tipo de loja">
              <Input value={rotuloTipoLoja(form.tipo_loja)} disabled />
            </Field>
            <Field label="Moeda">
              <Input value={form.moeda} disabled />
            </Field>
            <Field label="Telefone">
              <Input value={form.telefone ?? ""} disabled />
            </Field>
            <Field label="NUIT">
              <Input value={form.nuit ?? ""} disabled />
            </Field>
          </div>
          <div className="mt-1 flex items-center justify-between rounded-xl bg-zinc-950/50 px-3.5 py-2.5 text-sm">
            <span className="text-zinc-500">Email da empresa</span>
            <span className="text-zinc-300">{form.email_empresa ?? "—"}</span>
          </div>
        </section>

        {/* Segurança */}
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Segurança da Sessão
          </h2>
          <div className="space-y-4">
            <Field label="Tempo máximo de inatividade (segundos)">
              <Input
                type="number"
                min="30"
                step="1"
                value={form.tempo_inatividade ?? 60}
                onChange={(e) => set("tempo_inatividade", parseInt(e.target.value) || 60)}
                disabled={!ehDono}
              />
              <p className="mt-1 text-xs text-zinc-500">
                Se não houver atividade (movimento de rato, cliques ou teclado) durante este tempo, a sessão será encerrada.
              </p>
            </Field>
          </div>
        </section>

        {/* Vendas */}
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Comportamento de vendas e stock
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-200">Modo POS</p>
                <p className="text-xs text-zinc-500">Rápido (sem cliente) ou completo (fiado e notas)</p>
              </div>
              <SelectModo value={form.modo_pos} onChange={(v) => set("modo_pos", v)} />
            </div>
            <Row label="Permitir vendas a fiado" hint="Permite pagamento fiado no PDV" value={form.permite_venda_fiado} onChange={() => flip("permite_venda_fiado")} disabled={!ehDono} />
            <Row label="Permitir venda a granel" hint="Quantidades com vírgula (0.5 kg)" value={form.permite_venda_granel} onChange={() => flip("permite_venda_granel")} disabled={!ehDono} />
            <Row label="Controlar lote/validade" hint="Usar lotes e datas de validade no stock" value={form.controla_lote_validade} onChange={() => flip("controla_lote_validade")} disabled={!ehDono} />
            <Row label="Avisos de stock mínimo" hint="Alertas nos produtos abaixo do mínimo" value={form.stock_minimo_ativo} onChange={() => flip("stock_minimo_ativo")} disabled={!ehDono} />
          </div>
        </section>

        {ehDono && (
          <div className="flex justify-end">
            <Button type="submit" disabled={salvando}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
            </Button>
          </div>
        )}
      </form>

      {/* Utilizadores */}
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          <Users className="h-4 w-4" /> Utilizadores da loja
        </h2>
        <p className="mb-4 text-xs text-zinc-500">
          Gestão de novos utilizadores e papéis será disponibilizada em breve.
        </p>
        <div className="space-y-2">
          {utilizadores.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/40 px-3.5 py-2.5">
              <div>
                <p className="text-sm font-medium text-zinc-200">{u.nome}</p>
                <p className="text-xs text-zinc-500">{u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {!u.ativo && <Badge color="red">inativo</Badge>}
                <Badge color={u.papel === "dono" ? "violet" : "blue"}>
                  {u.papel === "dono" ? (
                    <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> dono</span>
                  ) : (
                    <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> {u.papel}</span>
                  )}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Row({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-zinc-200">{label}</p>
        <p className="text-xs text-zinc-500">{hint}</p>
      </div>
      <div className={disabled ? "pointer-events-none opacity-40" : ""}>
        <Switch checked={value} onChange={onChange} label={label} />
      </div>
    </div>
  );
}

function SelectModo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-lg border border-zinc-700 bg-zinc-950/60 p-0.5">
      {["rapido", "completo"].map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
            value === m ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}