"use client";

import { formatarDataHora } from "@/lib/format";
import { Activity, ShieldAlert, DollarSign, Package, User } from "lucide-react";

interface AuditoriaLog {
  id: string;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  detalhes: any;
  data_criacao: string;
  utilizador_nome: string | null;
}

function getIconForEntidade(entidade: string) {
  switch (entidade) {
    case "VENDA":
    case "FINANCEIRO":
      return DollarSign;
    case "STOCK":
    case "PRODUTO":
      return Package;
    case "UTILIZADOR":
      return User;
    case "SISTEMA":
      return ShieldAlert;
    default:
      return Activity;
  }
}

export function AuditoriaClient({ logs }: { logs: AuditoriaLog[] }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b border-zinc-800 bg-zinc-900/50">
          <tr>
            <th className="p-4 text-left font-medium text-zinc-400">Data e Hora</th>
            <th className="p-4 text-left font-medium text-zinc-400">Utilizador</th>
            <th className="p-4 text-left font-medium text-zinc-400">Ação</th>
            <th className="p-4 text-left font-medium text-zinc-400">Entidade</th>
            <th className="p-4 text-left font-medium text-zinc-400">Detalhes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {logs.map((log) => {
            const Icon = getIconForEntidade(log.entidade);
            return (
              <tr key={log.id} className="hover:bg-zinc-900/30 transition-colors">
                <td className="p-4 text-zinc-400 whitespace-nowrap" suppressHydrationWarning>
                  {formatarDataHora(log.data_criacao)}
                </td>
                <td className="p-4 font-medium text-zinc-200">
                  {log.utilizador_nome || "Sistema"}
                </td>
                <td className="p-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300">
                    <Icon className="h-3.5 w-3.5" />
                    {log.acao}
                  </span>
                </td>
                <td className="p-4 text-zinc-400">
                  {log.entidade}
                  {log.entidade_id && (
                    <span className="text-zinc-600 block text-[10px]">ID: {log.entidade_id.substring(0,8)}...</span>
                  )}
                </td>
                <td className="p-4 text-zinc-400 max-w-xs truncate" title={log.detalhes ? JSON.stringify(log.detalhes) : ""}>
                  {log.detalhes ? (
                    <div className="text-xs font-mono bg-zinc-900 p-1.5 rounded border border-zinc-800 truncate">
                      {JSON.stringify(log.detalhes).substring(0, 50)}
                      {JSON.stringify(log.detalhes).length > 50 ? "..." : ""}
                    </div>
                  ) : "-"}
                </td>
              </tr>
            );
          })}
          {logs.length === 0 && (
            <tr>
              <td colSpan={5} className="p-8 text-center text-zinc-500">
                Nenhum registo de auditoria encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
