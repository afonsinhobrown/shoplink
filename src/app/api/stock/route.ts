import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";

export async function GET(req: Request) {
  const r = await apiPapel("dono", "gestor", "caixa", "stock");
  if (r.response) return r.response;
  const { searchParams } = new URL(req.url);
  const baixos = searchParams.get("baixos") === "true";

  let sql = `
    SELECT p.id, p.nome, p.unidade_medida, p.stock_minimo, p.controla_stock,
           c.nome AS categoria,
           COALESCE(v.quantidade_atual, 0) AS quantidade_atual,
           CASE WHEN COALESCE(v.quantidade_atual,0) <= p.stock_minimo AND p.stock_minimo > 0
                THEN true ELSE false END AS abaixo_minimo
    FROM produto p
    LEFT JOIN categoria c ON c.id = p.categoria_id
    LEFT JOIN vw_stock_atual v ON v.produto_id = p.id
    WHERE p.loja_id = $1 AND p.ativo = true AND (p.controla_stock = true OR COALESCE(v.quantidade_atual,0) > 0)`;
  const params: unknown[] = [r.sessao.lojaId];
  if (baixos) {
    sql += ` AND COALESCE(v.quantidade_atual,0) <= p.stock_minimo AND p.stock_minimo > 0`;
  }
  sql += ` ORDER BY COALESCE(v.quantidade_atual,0) ASC`;
  const result = await pool.query(sql, params);
  return NextResponse.json(result.rows);
}