import { pool } from "./db";
import type { Sessao } from "./auth";

export async function getLojaConfig(sessao: Sessao) {
  const r = await pool.query(
    `SELECT modo_pos, permite_venda_granel, permite_venda_fiado,
            controla_lote_validade, stock_minimo_ativo, moeda
     FROM loja WHERE id = $1`,
    [sessao.lojaId]
  );
  return r.rows[0] ?? null;
}

export async function getDashboard(sessao: Sessao) {
  const lojaId = sessao.lojaId;
  const hoje = new Date().toISOString();

  const [vendasHoje, vendasMes, fiado, stockBaixo, top, ultimas] =
    await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS count
         FROM venda WHERE loja_id=$1 AND status='concluida' AND data_venda >= $2`,
        [lojaId, hoje]
      ),
      pool.query(
        `SELECT COALESCE(SUM(total),0) AS total FROM venda
         WHERE loja_id=$1 AND status='concluida' AND data_venda >= date_trunc('month', now())`,
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
         ORDER BY COALESCE(v.quantidade_atual,0) ASC LIMIT 10`,
        [lojaId]
      ),
      pool.query(
        `SELECT p.nome, SUM(vi.quantidade)::numeric AS qtd, SUM(vi.subtotal_linha) AS total
         FROM venda_item vi
         JOIN venda v ON v.id = vi.venda_id
         JOIN produto p ON p.id = vi.produto_id
         WHERE v.loja_id=$1 AND v.status='concluida' AND v.data_venda >= $2
         GROUP BY p.nome ORDER BY total DESC LIMIT 5`,
        [lojaId, hoje]
      ),
      pool.query(
        `SELECT v.id, v.numero_recibo, v.total, v.status, v.origem, v.data_venda,
                u.nome AS utilizador_nome, c.nome AS cliente_nome
         FROM venda v
         JOIN utilizador u ON u.id = v.utilizador_id
         LEFT JOIN cliente c ON c.id = v.cliente_id
         WHERE v.loja_id=$1 ORDER BY v.data_venda DESC LIMIT 5`,
        [lojaId]
      ),
    ]);

  return {
    vendasHojeTotal: Number(vendasHoje.rows[0]?.total ?? 0),
    vendasHojeCount: Number(vendasHoje.rows[0]?.count ?? 0),
    vendasMes: Number(vendasMes.rows[0]?.total ?? 0),
    fiadoPendente: Number(fiado.rows[0]?.total ?? 0),
    stockBaixo: stockBaixo.rows,
    topProdutos: top.rows,
    ultimasVendas: ultimas.rows,
  };
}