import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";

// GET /api/financeiro -> contas/saldos, resumo do mês, lançamentos, DRE, a pagar/receber
export async function GET() {
  const r = await apiPapel("dono", "gestor");
  if (r.response) return r.response;
  const lojaId = r.sessao.lojaId;

  const [contas, resumo, lancamentos, dre, aPagar, aReceber, categorias] =
    await Promise.all([
      pool.query(
        `SELECT cf.id, cf.nome, cf.saldo_inicial, COALESCE(v.saldo_atual, cf.saldo_inicial) AS saldo_atual
         FROM conta_financeira cf
         LEFT JOIN vw_saldo_contas v ON v.conta_financeira_id = cf.id
         WHERE cf.loja_id = $1 ORDER BY cf.nome`,
        [lojaId]
      ),
      pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN tipo='receita' THEN valor END),0) AS receitas,
           COALESCE(SUM(CASE WHEN tipo='despesa' THEN valor END),0) AS despesas
         FROM lancamento_financeiro
         WHERE loja_id = $1 AND status='confirmado'
           AND date_trunc('month', data_competencia) = date_trunc('month', CURRENT_DATE)`,
        [lojaId]
      ),
      pool.query(
        `SELECT l.id, l.tipo, l.valor, l.descricao, l.data_competencia,
                cf.nome AS categoria, c.nome AS conta
         FROM lancamento_financeiro l
         JOIN categoria_financeira cf ON cf.id = l.categoria_financeira_id
         JOIN conta_financeira c ON c.id = l.conta_financeira_id
         WHERE l.loja_id = $1
         ORDER BY l.data_lancamento DESC LIMIT 40`,
        [lojaId]
      ),
      pool.query(
        `SELECT mes_referencia, tipo_categoria, categoria, total
         FROM vw_dre_mensal WHERE loja_id = $1
         ORDER BY mes_referencia DESC, tipo_categoria`,
        [lojaId]
      ),
      pool.query(
        `SELECT cp.id, cp.descricao, cp.valor_total, cp.data_vencimento, cp.status,
                f.nome AS fornecedor
         FROM conta_pagar cp LEFT JOIN fornecedor f ON f.id = cp.fornecedor_id
         WHERE cp.loja_id = $1 AND cp.status IN ('pendente','pago_parcial','atrasado')
         ORDER BY cp.data_vencimento ASC LIMIT 50`,
        [lojaId]
      ),
      pool.query(
        `SELECT cr.id, cr.descricao, cr.valor_total, cr.data_vencimento, cr.status,
                c.nome AS cliente
         FROM conta_receber cr JOIN cliente c ON c.id = cr.cliente_id
         WHERE cr.loja_id = $1 AND cr.status IN ('pendente','recebido_parcial','atrasado')
         ORDER BY cr.data_vencimento ASC LIMIT 50`,
        [lojaId]
      ),
      pool.query(
        `SELECT id, nome, tipo FROM categoria_financeira WHERE loja_id = $1 ORDER BY tipo, ordem, nome`,
        [lojaId]
      ),
    ]);

  const receitas = Number(resumo.rows[0].receitas);
  const despesas = Number(resumo.rows[0].despesas);
  const saldoTotal = contas.rows.reduce((s, c) => s + Number(c.saldo_atual), 0);

  return NextResponse.json({
    contas: contas.rows.map((c) => ({
      id: c.id,
      nome: c.nome,
      saldo_inicial: Number(c.saldo_inicial),
      saldo_atual: Number(c.saldo_atual),
    })),
    saldoTotal,
    resumoMes: { receitas, despesas, saldo: receitas - despesas },
    lancamentos: lancamentos.rows.map((l) => ({ ...l, valor: Number(l.valor) })),
    dre: dre.rows.map((d) => ({ ...d, total: Number(d.total) })),
    aPagar: aPagar.rows.map((x) => ({ ...x, valor_total: Number(x.valor_total) })),
    aReceber: aReceber.rows.map((x) => ({ ...x, valor_total: Number(x.valor_total) })),
    categorias: categorias.rows,
  });
}