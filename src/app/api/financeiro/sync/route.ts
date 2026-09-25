import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";

export async function GET() {
  const r = await apiPapel("dono");
  if (r.response) return r.response;
  
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // Garantir categoria
    let catFinanceira = await client.query(
      `SELECT id FROM categoria_financeira WHERE loja_id = $1 AND nome = 'Vendas' LIMIT 1`,
      [r.sessao.lojaId]
    );
    if (catFinanceira.rows.length === 0) {
      catFinanceira = await client.query(
        `INSERT INTO categoria_financeira (loja_id, nome, tipo, sistema) VALUES ($1, 'Vendas', 'receita', true) RETURNING id`,
        [r.sessao.lojaId]
      );
    }
    const categoriaVendasId = catFinanceira.rows[0].id;

    // Garantir conta financeira principal
    let contasFin = await client.query(
      `SELECT id FROM conta_financeira WHERE loja_id = $1 AND ativo = true`,
      [r.sessao.lojaId]
    );
    if (contasFin.rows.length === 0) {
      await client.query(
        `INSERT INTO conta_financeira (loja_id, nome, tipo, saldo_inicial, padrao, sistema) VALUES ($1, 'Caixa Principal', 'numerario', 0, true, true)`,
        [r.sessao.lojaId]
      );
      contasFin = await client.query(
        `SELECT id FROM conta_financeira WHERE loja_id = $1 AND ativo = true`,
        [r.sessao.lojaId]
      );
    }
    const contaDestino = contasFin.rows[0].id;

    // Buscar vendas concluidas que não estão no lancamento_financeiro
    const vendas = await client.query(
      `SELECT v.id, v.total, v.data_venda, v.numero_recibo, v.utilizador_id 
       FROM venda v 
       LEFT JOIN lancamento_financeiro lf ON lf.origem_id = v.id AND lf.origem_tipo = 'venda'
       WHERE v.loja_id = $1 AND v.status = 'concluida' AND lf.id IS NULL`,
      [r.sessao.lojaId]
    );

    let count = 0;
    for (const venda of vendas.rows) {
      await client.query(
        `INSERT INTO lancamento_financeiro 
         (loja_id, conta_financeira_id, categoria_financeira_id, tipo, valor, descricao, origem_tipo, origem_id, status, utilizador_id, data_competencia)
         VALUES ($1, $2, $3, 'receita', $4, $5, 'venda', $6, 'confirmado', $7, $8)`,
        [
          r.sessao.lojaId, 
          contaDestino, 
          categoriaVendasId, 
          venda.total, 
          `Venda sincronizada ${venda.numero_recibo}`, 
          venda.id, 
          venda.utilizador_id,
          venda.data_venda
        ]
      );
      count++;
    }

    await client.query("COMMIT");
    return NextResponse.json({ success: true, count });
  } catch (e: any) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    client.release();
  }
}
