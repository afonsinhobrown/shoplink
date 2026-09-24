import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await apiPapel("dono", "gestor", "caixa");
  if (r.response) return r.response;
  const { id } = await params;

  const venda = await pool.query(
    `SELECT v.*, u.nome AS utilizador_nome, c.nome AS cliente_nome
     FROM venda v
     JOIN utilizador u ON u.id = v.utilizador_id
     LEFT JOIN cliente c ON c.id = v.cliente_id
     WHERE v.id = $1 AND v.loja_id = $2`,
    [id, r.sessao.lojaId]
  );
  if (venda.rows.length === 0) {
    return NextResponse.json({ error: "Venda não encontrada" }, { status: 404 });
  }

  const [itens, pagamentos] = await Promise.all([
    pool.query(
      `SELECT vi.id, vi.quantidade, vi.preco_unitario, vi.desconto_linha, vi.subtotal_linha,
              p.id AS produto_id, p.nome AS produto_nome
       FROM venda_item vi JOIN produto p ON p.id = vi.produto_id
       WHERE vi.venda_id = $1`,
      [id]
    ),
    pool.query(
      `SELECT metodo, valor FROM venda_pagamento WHERE venda_id = $1 ORDER BY valor DESC`,
      [id]
    ),
  ]);

  return NextResponse.json({ ...venda.rows[0], itens: itens.rows, pagamentos: pagamentos.rows });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await apiPapel("dono", "gestor");
  if (r.response) return r.response;
  const { id } = await params;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const venda = await client.query(
      `SELECT id, status FROM venda WHERE id = $1 AND loja_id = $2`,
      [id, r.sessao.lojaId]
    );
    if (venda.rows.length === 0) {
      return NextResponse.json({ error: "Venda não encontrada" }, { status: 404 });
    }
    if (venda.rows[0].status === "cancelada") {
      return NextResponse.json({ error: "Venda já cancelada" }, { status: 409 });
    }

    const itens = await client.query(
      `SELECT produto_id, quantidade FROM venda_item WHERE venda_id = $1`,
      [id]
    );
    for (const item of itens.rows) {
      await client.query(
        `INSERT INTO movimento_stock (loja_id, produto_id, utilizador_id, tipo, quantidade, referencia_id, observacao)
         VALUES ($1, $2, $3, 'devolucao', $4, $5, 'Venda cancelada')`,
        [r.sessao.lojaId, item.produto_id, r.sessao.uid, item.quantidade, id]
      );
    }

    await client.query(`UPDATE venda SET status = 'cancelada' WHERE id = $1`, [id]);
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}