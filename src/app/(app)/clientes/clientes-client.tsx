"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Users, Pencil, Trash2, Loader2, Phone } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatarMoeda } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Loading, EmptyState } from "@/components/ui/feedback";
import type { ClienteDTO } from "@/lib/types";

export function ClientesClient({
  moeda,
  papel: _papel,
  podeEditar,
}: {
  moeda: string;
  papel: string;
  podeEditar: boolean;
}) {
  const [clientes, setClientes] = useState<ClienteDTO[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", telefone: "", limite_fiado: "" });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  function carregar() {
    apiFetch<ClienteDTO[]>("/api/clientes")
      .then(setClientes)
      .catch(() => {})
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
  }, []);

  const filtrados = useMemo(() => {
    const termo = q.trim().toLowerCase();
    if (!termo) return clientes;
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(termo) ||
        (c.telefone ?? "").toLowerCase().includes(termo)
    );
  }, [clientes, q]);

  function abrir(c?: ClienteDTO) {
    setEditandoId(c?.id ?? null);
    setForm({
      nome: c?.nome ?? "",
      telefone: c?.telefone ?? "",
      limite_fiado: c ? String(c.limite_fiado) : "",
    });
    setErro("");
    setModal(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      const body = {
        nome: form.nome,
        telefone: form.telefone || null,
        limite_fiado: Number(form.limite_fiado) || 0,
      };
      if (editandoId) {
        await apiFetch("/api/clientes", { method: "PUT", body: JSON.stringify({ id: editandoId, ...body }) });
      } else {
        await apiFetch("/api/clientes", { method: "POST", body: JSON.stringify(body) });
      }
      setModal(false);
      carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao guardar");
    } finally {
      setSalvando(false);
    }
  }

  async function apagar(c: ClienteDTO) {
    if (!confirm(`Remover "${c.nome}"?`)) return;
    await apiFetch(`/api/clientes/${c.id}`, { method: "DELETE" });
    carregar();
  }

  if (carregando && clientes.length === 0)
    return <Loading className="min-h-[50vh]" label="A carregar clientes…" />;

  const fiados = clientes.filter((c) => c.saldo_fiado > 0);

  return (
    <div className="animate-fade-in mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Clientes</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {clientes.length} clientes · {fiados.length} com fiado pendente
          </p>
        </div>
        {podeEditar && (
          <Button onClick={() => abrir()}>
            <Plus className="h-4 w-4" /> Novo cliente
          </Button>
        )}
      </div>

      {fiados.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fiados.slice(0, 5).map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
              <span className="text-amber-300">{c.nome}</span>
              <Badge color="amber">deve {formatarMoeda(c.saldo_fiado, moeda)}</Badge>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input
          className="pl-10"
          placeholder="Procurar cliente…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {filtrados.length === 0 ? (
        <EmptyState icon={Users} title="Sem clientes" description="Cadastre clientes para vendas a fiado" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtrados.map((c) => (
            <div key={c.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 text-sm font-bold text-zinc-200">
                    {c.nome.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-zinc-100">{c.nome}</p>
                    {c.telefone && (
                      <p className="flex items-center gap-1 text-xs text-zinc-500">
                        <Phone className="h-3 w-3" /> {c.telefone}
                      </p>
                    )}
                  </div>
                </div>
                {podeEditar && (
                  <div className="flex gap-1">
                    <button onClick={() => abrir(c)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white">
                      <Pencil className="h-4 w-4" />
                    </button>
                    {["dono", "gestor"].includes(_papel) && (
                      <button onClick={() => apagar(c)} className="rounded-lg p-2 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">Fiado atual</p>
                  <p className={`text-lg font-bold ${c.saldo_fiado > 0 ? "text-amber-400" : "text-zinc-300"}`}>
                    {formatarMoeda(c.saldo_fiado, moeda)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">Limite</p>
                  <p className="text-sm font-medium text-zinc-200">
                    {c.limite_fiado > 0 ? formatarMoeda(c.limite_fiado, moeda) : "Sem limite"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editandoId ? "Editar cliente" : "Novo cliente"}
      >
        <form onSubmit={salvar} className="space-y-4">
          <Field label="Nome *">
            <Input
              required
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            />
          </Field>
          <Field label="Telefone">
            <Input
              value={form.telefone}
              onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
              placeholder="+258…"
            />
          </Field>
          <Field label="Limite de fiado" hint="0 = sem venda a fiado para este cliente">
            <Input
              type="number"
              min={0}
              value={form.limite_fiado}
              onChange={(e) => setForm((f) => ({ ...f, limite_fiado: e.target.value }))}
            />
          </Field>
          {erro && (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
              {erro}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setModal(false)}>
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