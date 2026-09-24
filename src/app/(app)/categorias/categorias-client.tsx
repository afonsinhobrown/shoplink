"use client";

import { useEffect, useState } from "react";
import { Plus, Tags, Pencil, Trash2, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Loading, EmptyState } from "@/components/ui/feedback";
import type { CategoriaDTO } from "@/lib/types";

export function CategoriasClient({ podeEditar }: { podeEditar: boolean }) {
  const [itens, setItens] = useState<CategoriaDTO[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const cores = [
    "from-emerald-500/20 to-emerald-600/10 text-emerald-300",
    "from-sky-500/20 to-sky-600/10 text-sky-300",
    "from-violet-500/20 to-violet-600/10 text-violet-300",
    "from-amber-500/20 to-amber-600/10 text-amber-300",
    "from-rose-500/20 to-rose-600/10 text-rose-300",
  ];

  function carregar() {
    apiFetch<CategoriaDTO[]>("/api/categorias")
      .then(setItens)
      .catch(() => {})
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
  }, []);

  function abrir(c?: CategoriaDTO) {
    setEditandoId(c?.id ?? null);
    setNome(c?.nome ?? "");
    setErro("");
    setModal(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      if (editandoId) {
        await apiFetch("/api/categorias", { method: "PUT", body: JSON.stringify({ id: editandoId, nome }) });
      } else {
        await apiFetch("/api/categorias", { method: "POST", body: JSON.stringify({ nome }) });
      }
      setModal(false);
      carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao guardar");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando && itens.length === 0)
    return <Loading className="min-h-[50vh]" label="A carregar categorias…" />;

  return (
    <div className="animate-fade-in mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Categorias</h1>
          <p className="mt-1 text-sm text-zinc-500">Organize os produtos da loja</p>
        </div>
        {podeEditar && (
          <Button onClick={() => abrir()}>
            <Plus className="h-4 w-4" /> Nova categoria
          </Button>
        )}
      </div>

      {itens.length === 0 ? (
        <EmptyState icon={Tags} title="Sem categorias" description="Crie categorias para organizar o catálogo" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {itens.map((c, i) => (
            <div
              key={c.id}
              className="rounded-2xl border border-zinc-800 p-1.5 transition-colors hover:border-zinc-700"
            >
              <div className={`flex items-center justify-between gap-2 rounded-[12px] bg-gradient-to-br px-3.5 py-3 ${cores[i % cores.length]}`}>
                <div className="flex items-center gap-3">
                  <Tags className="h-4 w-4 opacity-70" />
                  <div>
                    <p className="font-semibold">{c.nome}</p>
                    <p className="text-xs opacity-70">{c.produtos} produtos</p>
                  </div>
                </div>
                {podeEditar && (
                  <div className="flex gap-1">
                    <button onClick={() => abrir(c)} className="rounded-lg bg-black/10 p-2 hover:bg-black/20">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Apagar a categoria "${c.nome}"?`)) return;
                        try {
                          await apiFetch(`/api/categorias/${c.id}`, { method: "DELETE" });
                          carregar();
                        } catch {
                          alert("Não é possível apagar: a categoria tem produtos associados.");
                        }
                      }}
                      className="rounded-lg bg-black/10 p-2 hover:bg-rose-500/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editandoId ? "Editar categoria" : "Nova categoria"}>
        <form onSubmit={salvar} className="space-y-4">
          <Field label="Nome *">
            <Input required autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Bebidas, Lacticínios…" />
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