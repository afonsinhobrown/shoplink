import { requireSessao } from "@/lib/auth";
import { UtilizadoresClient } from "./utilizadores-client";
import { pool } from "@/lib/db";

export default async function UtilizadoresPage() {
  const sessao = await requireSessao();

  const res = await pool.query(
    `SELECT u.id, u.nome, u.email, ul.papel 
     FROM utilizador u
     JOIN utilizador_loja ul ON ul.utilizador_id = u.id
     WHERE ul.loja_id = $1
     ORDER BY u.nome ASC`,
    [sessao.lojaId]
  );

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Equipa</h1>
        <p className="text-sm text-zinc-400">
          Faça a gestão dos perfis e acessos dos funcionários da sua loja.
        </p>
      </div>
      <UtilizadoresClient utilizadoresIniciais={res.rows} papelLogado={sessao.papel} idLogado={sessao.uid} />
    </div>
  );
}
