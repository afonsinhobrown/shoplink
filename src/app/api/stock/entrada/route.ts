import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";

export async function POST(req: Request) {
  const r = await apiPapel("dono", "gestor", "stock");
  if (r.response) return r.response;
  const body = await req.json();
  const {
    produto_id,
    quantidade,
    custo_unitario,
    numero_lote,
    data_validade,
    localizacao,
    observacao,
  } = body;

  const qtd = Number(quantidade);
  if (!produto_id || !(qtd > 0)) {
    return NextResponse.json(
      { error: "Selecione o produto e indique uma quantidade maior que zero" },
      { status: 400 }
    );
  }

  const produto = await pool.query(
    "SELECT id, nome FROM produto WHERE id = $1 AND loja_id = $2",
    [produto_id, r.sessao.lojaId]
  );
  if (produto.rows.length === 0) {
    return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let loteId: string | null = null;

    const loja = await client.query(
      "SELECT controla_lote_validade FROM loja WHERE id = $1",
      [r.sessao.lojaId]
    );
    if (loja.rows[0]?.controla_lote_validade && numero_lote) {
      const lote = await client.query(
        `INSERT INTO lote_stock (produto_id, numero_lote, data_validade, quantidade, localizacao)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [produto_id, numero_lote, data_validade ?? null, qtd, localizacao ?? null]
      );
      loteId = lote.rows[0].id;
    }

    await client.query(
      `INSERT INTO movimento_stock (loja_id, produto_id, lote_id, utilizador_id, tipo, quantidade, custo_unitario, observacao)
       VALUES ($1, $2, $3, $4, 'entrada', $5, $6, $7)`,
      [
        r.sessao.lojaId, produto_id, loteId, r.sessao.uid,
        qtd, custo_unitario ? Number(custo_unitario) : null, observacao ?? null,
      ]
    );

    if (custo_unitario && Number(custo_unitario) > 0) {
      await client.query(
        "UPDATE produto SET preco_custo = $1 WHERE id = $2",
        [Number(custo_unitario), produto_id]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}