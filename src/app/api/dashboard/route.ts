import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiSessao } from "@/lib/api-auth";

export async function GET() {
  const r = await apiSessao();
  if (r.response) return r.response;
  const { sessao } = r;
  const lojaId = sessao.lojaId;
  const hoje = new Date().toISOString();

  try {
    const [vendasHoje, vendasMes, fiado, stockBaixo, top, ultimas] =
      await Promise.all([
        pool.query(
          `SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS count
           FROM venda WHERE loja_id=$1 AND status='concluida' AND data_venda >= CURRENT_DATE`,
          [lojaId]
        ),
        pool.query(
          `SELECT DATE_TRUNC('month', data_venda) AS mes, COALESCE(SUM(total),0) AS total
           FROM venda WHERE loja_id=$1 AND status='concluida' AND data_venda >= date_trunc('month', now())
           GROUP BY mes`,
          [lojaId]
        ),
        pool.query(
          `SELECT COALESCE(SUM(total),0) AS total FROM venda
           WHERE loja_id=$1 AND status='pendente_fiado'`,
          [lojaId]
        ),
        pool.query(
          `SELECT p.id, p.nome, p.stock_minimo, COALESCE(v.quantidade_atual,0) AS quantidade_atual
           FROM produto p
           LEFT JOIN vw_stock_atual v ON v.produto_id = p.id
           WHERE p.loja_id=$1 AND p.ativo AND p.controla_stock
             AND COALESCE(v.quantidade_atual,0) <= p.stock_minimo
           ORDER BY COALESCE(v.quantidade_atual,0) ASC
           LIMIT 12`,
          [lojaId]
        ),
        pool.query(
          `SELECT p.nome, SUM(vi.quantidade) AS qtd, SUM(vi.subtotal_linha) AS total
           FROM venda_item vi
           JOIN venda v ON v.id = vi.venda_id
           JOIN produto p ON p.id = vi.produto_id
           WHERE v.loja_id=$1 AND v.status='concluida' AND v.data_venda >= CURRENT_DATE
           GROUP BY p.nome ORDER BY total DESC LIMIT 5`,
          [lojaId]
        ),
        pool.query(
          `SELECT v.id, v.numero_recibo, v.total, v.status, v.origem, v.data_venda,
                  u.nome AS utilizador_nome, c.nome AS cliente_nome
           FROM venda v
           JOIN utilizador u ON u.id = v.utilizador_id
           LEFT JOIN cliente c ON c.id = v.cliente_id
           WHERE v.loja_id=$1
           ORDER BY v.data_venda DESC LIMIT 6`,
          [lojaId]
        ),
      ]);

    return NextResponse.json({
      vendasHoje: {
        total: Number(vendasHoje.rows[0]?.total ?? 0),
        count: Number(vendasHoje.rows[0]?.count ?? 0),
      },
      vendasMes: Number(vendasMes.rows[0]?.total ?? 0),
      fiadoPendente: Number(fiado.rows[0]?.total ?? 0),
      stockBaixo: stockBaixo.rows,
      topProdutos: top.rows,
      ultimasVendas: ultimas.rows,
    });
  } catch (e) {
    console.error("dashboard erro:", e);
    return NextResponse.json({ error: "Erro ao carregar dashboard" }, { status: 500 });
  }
}