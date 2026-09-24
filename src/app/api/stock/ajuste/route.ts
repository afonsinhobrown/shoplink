import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";

export async function POST(req: Request) {
  const r = await apiPapel("dono", "gestor", "stock");
  if (r.response) return r.response;
  const { produto_id, quantidade, tipo = "ajuste", observacao } = await req.json();

  const qtd = Number(quantidade);
  if (!produto_id || !qtd || Number.isNaN(qtd)) {
    return NextResponse.json(
      { error: "Indique o produto e a quantidade (positiva ou negativa)" },
      { status: 400 }
    );
  }
  if (!["ajuste", "quebra", "devolucao"].includes(tipo)) {
    return NextResponse.json({ error: "Tipo de movimento inválido" }, { status: 400 });
  }

  const produto = await pool.query(
    `SELECT p.id, COALESCE(v.quantidade_atual,0) AS stock_atual
     FROM produto p LEFT JOIN vw_stock_atual v ON v.produto_id = p.id
     WHERE p.id = $1 AND p.loja_id = $2`,
    [produto_id, r.sessao.lojaId]
  );
  if (produto.rows.length === 0) {
    return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  }
  if (qtd < 0 && produto.rows[0].stock_atual + qtd < 0) {
    return NextResponse.json(
      { error: "O stock não pode ficar negativo" },
      { status: 409 }
    );
  }

  await pool.query(
    `INSERT INTO movimento_stock (loja_id, produto_id, utilizador_id, tipo, quantidade, observacao)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [r.sessao.lojaId, produto_id, r.sessao.uid, tipo, qtd, observacao ?? null]
  );
  return NextResponse.json({ ok: true }, { status: 201 });
}