import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";

// GET /api/alertas -> stock baixo, lotes a expirar, fiado vencido, pedidos pendentes
export async function GET() {
  const r = await apiPapel("dono", "gestor", "caixa", "stock");
  if (r.response) return r.response;
  const lojaId = r.sessao.lojaId;

  const [stockBaixo, lotes, fiado, pedidos] = await Promise.all([
    pool.query(
      `SELECT p.id, p.nome, p.unidade_medida, p.stock_minimo,
              COALESCE(s.quantidade_atual, 0) AS quantidade_atual
       FROM produto p
       LEFT JOIN vw_stock_atual s ON s.produto_id = p.id
       WHERE p.loja_id = $1 AND p.ativo = true AND p.controla_stock = true
         AND COALESCE(s.quantidade_atual, 0) <= p.stock_minimo
       ORDER BY COALESCE(s.quantidade_atual, 0) - p.stock_minimo ASC
       LIMIT 100`,
      [lojaId]
    ),
    pool.query(
      `SELECT ls.id, p.nome AS produto, ls.numero_lote, ls.data_validade, ls.quantidade,
              (ls.data_validade - CURRENT_DATE) AS dias
       FROM lote_stock ls
       JOIN produto p ON p.id = ls.produto_id
       WHERE p.loja_id = $1 AND ls.data_validade IS NOT NULL AND ls.quantidade > 0
         AND ls.data_validade <= CURRENT_DATE + interval '30 days'
       ORDER BY ls.data_validade ASC
       LIMIT 100`,
      [lojaId]
    ),
    pool.query(
      `SELECT cr.id, c.nome AS cliente, cr.descricao, cr.valor_total, cr.data_vencimento,
              (CURRENT_DATE - cr.data_vencimento) AS dias_atraso
       FROM conta_receber cr
       JOIN cliente c ON c.id = cr.cliente_id
       WHERE cr.loja_id = $1 AND cr.status IN ('pendente','recebido_parcial','atrasado')
         AND cr.data_vencimento < CURRENT_DATE
       ORDER BY cr.data_vencimento ASC
       LIMIT 100`,
      [lojaId]
    ),
    pool.query(
      `SELECT id, numero_pedido, tipo, status, total, data_criacao
       FROM pedido_online
       WHERE loja_id = $1 AND status = 'aguardando_confirmacao'
       ORDER BY data_criacao DESC LIMIT 100`,
      [lojaId]
    ),
  ]);

  return NextResponse.json({
    stockBaixo: stockBaixo.rows,
    lotesAExpirar: lotes.rows,
    fiadoVencido: fiado.rows,
    pedidosPendentes: pedidos.rows,
    resumo: {
      stockBaixo: stockBaixo.rows.length,
      lotesAExpirar: lotes.rows.length,
      fiadoVencido: fiado.rows.length,
      pedidosPendentes: pedidos.rows.length,
      total:
        stockBaixo.rows.length +
        lotes.rows.length +
        fiado.rows.length +
        pedidos.rows.length,
    },
  });
}