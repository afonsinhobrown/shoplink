"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Plus, Pencil, Trash2, Shield, User, Calculator, Package } from "lucide-react";

interface Utilizador {
  id: string;
  nome: string;
  email: string;
  papel: string;
}

const PAPEIS = [
  { id: "dono", label: "Dono", icon: Shield, desc: "Acesso total ao sistema." },
  { id: "gestor", label: "Gestor", icon: User, desc: "Pode ver relatórios e gerir produtos." },
  { id: "caixa", label: "Operador de Caixa", icon: Calculator, desc: "Apenas PDV e histórico de vendas." },
  { id: "stock", label: "Gestor de Stock", icon: Package, desc: "Pode adicionar e gerir produtos/stock." },
];

export function UtilizadoresClient({
  utilizadoresIniciais,
  papelLogado,
  idLogado,
}: {
  utilizadoresIniciais: Utilizador[];
  papelLogado: string;
  idLogado: string;
}) {
  const [utilizadores, setUtilizadores] = useState<Utilizador[]>(utilizadoresIniciais);
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  const [form, setForm] = useState({ nome: "", email: "", papel: "caixa", senha: "" });
  const [loading, setLoading] = useState(false);

  const podeGerir = papelLogado === "dono" || papelLogado === "gestor";

  function openNew() {
    setForm({ nome: "", email: "", papel: "caixa", senha: "" });
    setEditId(null);
    setIsOpen(true);
  }

  function openEdit(u: Utilizador) {
    setForm({ nome: u.nome, email: u.email, papel: u.papel, senha: "" });
    setEditId(u.id);
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (editId) {
        const res = await fetch(`/api/utilizadores/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error);
        }
        setUtilizadores((prev) => prev.map((u) => (u.id === editId ? { ...u, ...form } : u)));
      } else {
        const res = await fetch(`/api/utilizadores`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error);
        }
        const data = await res.json();
        setUtilizadores((prev) => [...prev, { id: data.id, nome: form.nome, email: form.email, papel: form.papel }]);
      }
      setIsOpen(false);
    } catch (error: any) {
      alert(error.message || "Erro ao guardar utilizador.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem a certeza que deseja apagar este utilizador?")) return;
    try {
      const res = await fetch(`/api/utilizadores/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao apagar");
      setUtilizadores((prev) => prev.filter((u) => u.id !== id));
    } catch (e) {
      alert("Erro ao apagar o utilizador.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {podeGerir && (
        <div className="flex justify-end">
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Utilizador
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/50">
            <tr>
              <th className="p-4 text-left font-medium text-zinc-400">Nome</th>
              <th className="p-4 text-left font-medium text-zinc-400">Email</th>
              <th className="p-4 text-left font-medium text-zinc-400">Perfil / Papel</th>
              {podeGerir && <th className="p-4 text-right font-medium text-zinc-400">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {utilizadores.map((u) => {
              const pInfo = PAPEIS.find(p => p.id === u.papel);
              const isMe = u.id === idLogado;
              return (
                <tr key={u.id} className="hover:bg-zinc-900/30 transition-colors">
                  <td className="p-4">
                    <div className="font-semibold text-zinc-100 flex items-center gap-2">
                      {u.nome}
                      {isMe && <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase text-zinc-400">Tu</span>}
                    </div>
                  </td>
                  <td className="p-4 text-zinc-400">{u.email}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-zinc-300">
                      {pInfo?.icon && <pInfo.icon className="h-4 w-4 text-zinc-500" />}
                      {pInfo?.label || u.papel}
                    </div>
                  </td>
                  {podeGerir && (
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(u.id)}
                          disabled={isMe} // Não pode apagar-se a si próprio
                          className={isMe ? "opacity-50 cursor-not-allowed" : "text-red-400 hover:text-red-300 hover:bg-red-500/10"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {utilizadores.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-zinc-500">
                  Nenhum utilizador encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={isOpen} onClose={() => setIsOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-50">{editId ? "Editar Utilizador" : "Novo Utilizador"}</h2>
            <p className="text-sm text-zinc-400">Preencha os dados de acesso do funcionário.</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-400">Nome Completo</label>
              <Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-zinc-400">Email de Acesso</label>
              <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-zinc-400">Senha {editId && "(Deixe em branco para não alterar)"}</label>
              <Input type="password" required={!editId} minLength={6} value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-2">Perfil de Acesso</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {PAPEIS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setForm({ ...form, papel: p.id })}
                    className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${
                      form.papel === p.id
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                        : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <p.icon className="h-4 w-4" />
                      {p.label}
                    </div>
                    <p className="text-[10px] opacity-80 leading-snug">{p.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "A guardar..." : "Guardar Utilizador"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
