"use client";

import { useEffect, useState } from "react";
import { Search, Plus, Building2, Pencil, Trash2, Loader2, Phone, MapPin } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/feedback";
import type { FornecedorDTO } from "@/lib/types";

export function FornecedoresClient({
  papel,
  podeEditar,
}: {
  papel: string;
  podeEditar: boolean;
}) {
  const [itens, setItens] = useState<FornecedorDTO[]>([]);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", contacto: "", email: "", endereco: "" });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  function carregar() {
    apiFetch<FornecedorDTO[]>("/api/fornecedores")
      .then(setItens)
      .catch(() => {});
  }

  useEffect(() => {
    carregar();
  }, []);

  const filtrados = itens.filter((f) => {
    const t = q.trim().toLowerCase();
    return !t || f.nome.toLowerCase().includes(t) || (f.email ?? "").toLowerCase().includes(t);
  });

  function abrir(f?: FornecedorDTO) {
    setEditandoId(f?.id ?? null);
    setForm({
      nome: f?.nome ?? "",
      contacto: f?.contacto ?? "",
      email: f?.email ?? "",
      endereco: f?.endereco ?? "",
    });
    setErro("");
    setModal(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      const body = { ...form, contacto: form.contacto || null, email: form.email || null, endereco: form.endereco || null };
      if (editandoId) {
        await apiFetch("/api/fornecedores", { method: "PUT", body: JSON.stringify({ id: editandoId, ...body }) });
      } else {
        await apiFetch("/api/fornecedores", { method: "POST", body: JSON.stringify(body) });
      }
      setModal(false);
      carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao guardar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="animate-fade-in mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Fornecedores</h1>
          <p className="mt-1 text-sm text-zinc-500">{itens.length} fornecedores registados</p>
        </div>
        {podeEditar && (
          <Button onClick={() => abrir()}>
            <Plus className="h-4 w-4" /> Novo fornecedor
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input className="pl-10" placeholder="Procurar fornecedor…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {filtrados.length === 0 ? (
        <EmptyState icon={Building2} title="Sem fornecedores" description="Adicione os seus fornecedores" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtrados.map((f) => (
            <div key={f.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-zinc-800 p-2.5">
                    <Building2 className="h-5 w-5 text-zinc-400" />
                  </div>
                  <div>
                    <p className="font-medium text-zinc-100">{f.nome}</p>
                    <div className="mt-0.5 space-y-0.5 text-xs text-zinc-500">
                      {f.contacto && (
                        <p className="flex items-center gap-1"><Phone className="h-3 w-3" /> {f.contacto}</p>
                      )}
                      {f.endereco && (
                        <p className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {f.endereco}</p>
                      )}
                      {f.email && <p>{f.email}</p>}
                    </div>
                  </div>
                </div>
                {podeEditar && (
                  <div className="flex gap-1">
                    <button onClick={() => abrir(f)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white">
                      <Pencil className="h-4 w-4" />
                    </button>
                    {["dono", "gestor"].includes(papel) && (
                      <button
                        onClick={async () => {
                          // fornecimento (compra) mantém histórico; só apagar se nunca tiver compras
                          if (!confirm(`Remover "${f.nome}"?`)) return;
                          try {
                            await apiFetch(`/api/fornecedores/${f.id}`, { method: "DELETE" });
                            carregar();
                          } catch {
                            alert("Não é possível remover: o fornecedor tem compras registadas.");
                          }
                        }}
                        className="rounded-lg p-2 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editandoId ? "Editar fornecedor" : "Novo fornecedor"}>
        <form onSubmit={salvar} className="space-y-4">
          <Field label="Nome *">
            <Input required value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
          </Field>
          <Field label="Telefone">
            <Input value={form.contacto} onChange={(e) => setForm((f) => ({ ...f, contacto: e.target.value }))} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="Morada">
            <Input value={form.endereco} onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))} />
          </Field>
          {erro && <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">{erro}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setModal(false)}>Cancelar</Button>
            <Button type="submit" disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}