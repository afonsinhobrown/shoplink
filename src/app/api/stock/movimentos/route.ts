import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";

export async function GET() {
  const r = await apiPapel("dono", "gestor", "caixa", "stock");
  if (r.response) return r.response;
  const result = await pool.query(
    `SELECT m.id, m.tipo, m.quantidade, m.custo_unitario, m.observacao, m.data_movimento,
            p.nome AS produto_nome, u.nome AS utilizador_nome
     FROM movimento_stock m
     JOIN produto p ON p.id = m.produto_id
     LEFT JOIN utilizador u ON u.id = m.utilizador_id
     WHERE m.loja_id = $1
     ORDER BY m.data_movimento DESC
     LIMIT 100`,
    [r.sessao.lojaId]
  );
  return NextResponse.json(result.rows);
}