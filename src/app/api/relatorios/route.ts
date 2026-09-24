import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";

// GET /api/relatorios?dias=30 -> vendas por dia, top produtos, métodos de pagamento
export async function GET(req: Request) {
  const r = await apiPapel("dono", "gestor");
  if (r.response) return r.response;
  const lojaId = r.sessao.lojaId;

  const url = new URL(req.url);
  const dias = Math.min(365, Math.max(1, Number(url.searchParams.get("dias")) || 30));
  const intervalo = String(dias);

  const [porDia, topProdutos, porMetodo, resumo] = await Promise.all([
    pool.query(
      `SELECT date_trunc('day', data_venda)::date AS dia,
              SUM(total) AS total, COUNT(*)::int AS n
       FROM venda
       WHERE loja_id = $1 AND status <> 'cancelada'
         AND data_venda >= now() - ($2 || ' days')::interval
       GROUP BY 1 ORDER BY 1`,
      [lojaId, intervalo]
    ),
    pool.query(
      `SELECT p.nome, SUM(vi.quantidade) AS qtd, SUM(vi.subtotal_linha) AS total
       FROM venda_item vi
       JOIN venda v ON v.id = vi.venda_id
       JOIN produto p ON p.id = vi.produto_id
       WHERE v.loja_id = $1 AND v.status <> 'cancelada'
         AND v.data_venda >= now() - ($2 || ' days')::interval
       GROUP BY p.nome ORDER BY total DESC LIMIT 10`,
      [lojaId, intervalo]
    ),
    pool.query(
      `SELECT vp.metodo, SUM(vp.valor) AS total
       FROM venda_pagamento vp
       JOIN venda v ON v.id = vp.venda_id
       WHERE v.loja_id = $1 AND v.status <> 'cancelada'
         AND v.data_venda >= now() - ($2 || ' days')::interval
       GROUP BY vp.metodo ORDER BY total DESC`,
      [lojaId, intervalo]
    ),
    pool.query(
      `SELECT COALESCE(SUM(total),0) AS total, COUNT(*)::int AS n,
              COALESCE(AVG(total),0) AS ticket
       FROM venda
       WHERE loja_id = $1 AND status <> 'cancelada'
         AND data_venda >= now() - ($2 || ' days')::interval`,
      [lojaId, intervalo]
    ),
  ]);

  return NextResponse.json({
    dias,
    resumo: {
      total: Number(resumo.rows[0].total),
      n: resumo.rows[0].n,
      ticket: Number(resumo.rows[0].ticket),
    },
    porDia: porDia.rows.map((d) => ({ dia: d.dia, total: Number(d.total), n: d.n })),
    topProdutos: topProdutos.rows.map((p) => ({ nome: p.nome, qtd: Number(p.qtd), total: Number(p.total) })),
    porMetodo: porMetodo.rows.map((m) => ({ metodo: m.metodo, total: Number(m.total) })),
  });
}