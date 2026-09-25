import { requireSessao } from "@/lib/auth";
import { AuditoriaClient } from "./auditoria-client";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";
import { redirect } from "next/navigation";

export default async function AuditoriaPage() {
  const sessao = await requireSessao();
  
  if (sessao.papel !== "dono" && sessao.papel !== "gestor") {
    redirect("/dashboard");
  }

  const res = await pool.query(
    `SELECT a.*, u.nome as utilizador_nome 
     FROM auditoria a
     LEFT JOIN utilizador u ON u.id = a.utilizador_id
     WHERE a.loja_id = $1
     ORDER BY a.data_criacao DESC
     LIMIT 100`,
    [sessao.lojaId]
  );

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Auditoria</h1>
        <p className="text-sm text-zinc-400">
          Acompanhe todas as atividades, vendas e edições feitas na sua loja.
        </p>
      </div>
      <AuditoriaClient logs={res.rows} />
    </div>
  );
}
