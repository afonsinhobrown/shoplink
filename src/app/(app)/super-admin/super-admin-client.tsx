"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ShieldAlert, CheckCircle2, XCircle, Store, Users, ShoppingBag } from "lucide-react";
import { formatarData } from "@/lib/format";

interface LojaAdmin {
  loja_id: string;
  loja_nome: string;
  loja_ativa: boolean;
  loja_data_criacao: string;
  tenant_id: string;
  empresa_nome: string;
  empresa_email: string;
  telefone: string | null;
  nuit: string | null;
  plano: string;
  total_utilizadores: number;
  total_vendas: number;
}

export function SuperAdminClient({ lojas: initialLojas }: { lojas: LojaAdmin[] }) {
  const [lojas, setLojas] = useState(initialLojas);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const lojasFiltradas = lojas.filter((l) =>
    l.loja_nome.toLowerCase().includes(busca.toLowerCase()) ||
    l.empresa_nome.toLowerCase().includes(busca.toLowerCase()) ||
    l.empresa_email.toLowerCase().includes(busca.toLowerCase())
  );

  async function toggleStatus(lojaId: string, currentStatus: boolean) {
    if (!confirm(`Tem a certeza que deseja ${currentStatus ? 'BLOQUEAR' : 'ATIVAR'} esta loja?`)) return;
    
    setLoading(lojaId);
    try {
      const res = await fetch(`/api/super-admin/lojas/${lojaId}/toggle`, {
        method: "POST",
      });
      if (res.ok) {
        setLojas(lojas.map(l => l.loja_id === lojaId ? { ...l, loja_ativa: !currentStatus } : l));
      } else {
        alert("Erro ao alterar estado da loja.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro de comunicação.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Procurar loja, empresa ou email..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Store className="h-4 w-4" />
          <span>{lojas.length} lojas registadas</span>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/50">
            <tr>
              <th className="p-4 text-left font-medium text-zinc-400">Loja / Empresa</th>
              <th className="p-4 text-left font-medium text-zinc-400">Plano</th>
              <th className="p-4 text-center font-medium text-zinc-400">Utilizadores</th>
              <th className="p-4 text-center font-medium text-zinc-400">Vendas</th>
              <th className="p-4 text-center font-medium text-zinc-400">Criada em</th>
              <th className="p-4 text-center font-medium text-zinc-400">Estado</th>
              <th className="p-4 text-right font-medium text-zinc-400">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {lojasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-zinc-500">
                  Nenhuma loja encontrada.
                </td>
              </tr>
            ) : (
              lojasFiltradas.map((loja) => (
                <tr key={loja.loja_id} className="hover:bg-zinc-900/30 transition-colors">
                  <td className="p-4">
                    <div className="font-semibold text-zinc-100">{loja.loja_nome}</div>
                    <div className="text-xs text-zinc-500">{loja.empresa_nome} • {loja.empresa_email}</div>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400 uppercase tracking-wider">
                      {loja.plano}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1 text-zinc-300">
                      <Users className="h-4 w-4 text-zinc-500" />
                      {loja.total_utilizadores}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1 text-zinc-300">
                      <ShoppingBag className="h-4 w-4 text-zinc-500" />
                      {loja.total_vendas}
                    </div>
                  </td>
                  <td className="p-4 text-center text-zinc-400" suppressHydrationWarning>
                    {formatarData(loja.loja_data_criacao)}
                  </td>
                  <td className="p-4 text-center">
                    {loja.loja_ativa ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Ativa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400">
                        <XCircle className="h-3.5 w-3.5" /> Bloqueada
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <Button
                      variant={loja.loja_ativa ? "danger" : "primary"}
                      size="sm"
                      disabled={loading === loja.loja_id}
                      onClick={() => toggleStatus(loja.loja_id, loja.loja_ativa)}
                      className={loja.loja_ativa ? "bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-400 border-none" : "bg-emerald-500 text-white hover:bg-emerald-600"}
                    >
                      {loading === loja.loja_id ? "Aguarde..." : (loja.loja_ativa ? "Bloquear" : "Ativar")}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
