import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";

export async function GET() {
  const r = await apiPapel("dono", "gestor", "caixa");
  if (r.response) return r.response;

  const [ultima, historico, aberta] = await Promise.all([
    pool.query(
      `SELECT s.id, s.valor_abertura, s.valor_fecho, s.valor_esperado, s.diferenca,
              s.data_abertura, s.data_fecho, s.status, u.nome AS utilizador_nome,
              (SELECT COALESCE(SUM(valor),0) FROM caixa_movimento cm
                WHERE cm.caixa_sessao_id = s.id AND cm.tipo = 'venda') AS total_vendas,
              (SELECT COALESCE(SUM(valor),0) FROM caixa_movimento cm
                WHERE cm.caixa_sessao_id = s.id AND cm.tipo = 'sangria') AS sangrias,
              (SELECT COALESCE(SUM(valor),0) FROM caixa_movimento cm
                WHERE cm.caixa_sessao_id = s.id AND cm.tipo = 'suprimento') AS suprimentos
       FROM caixa_sessao s JOIN utilizador u ON u.id = s.utilizador_id
       WHERE s.loja_id = $1 ORDER BY s.data_abertura DESC LIMIT 1`,
      [r.sessao.lojaId]
    ),
    pool.query(
      `SELECT s.id, s.valor_abertura, s.valor_esperado, s.valor_fecho, s.diferenca,
              s.data_abertura, s.data_fecho, s.status, u.nome AS utilizador_nome
       FROM caixa_sessao s JOIN utilizador u ON u.id = s.utilizador_id
       WHERE s.loja_id = $1 ORDER BY s.data_abertura DESC LIMIT 30`,
      [r.sessao.lojaId]
    ),
    pool.query(
      `SELECT id FROM caixa_sessao WHERE loja_id = $1 AND status = 'aberta'
       ORDER BY data_abertura DESC LIMIT 1`,
      [r.sessao.lojaId]
    ),
  ]);

  const sessaoId = aberta.rows[0]?.id ?? ultima.rows[0]?.id ?? null;
  let movimentos: unknown[] = [];
  if (sessaoId) {
    const m = await pool.query(
      `SELECT cm.id, cm.tipo, cm.valor, cm.observacao, cm.data_movimento
       FROM caixa_movimento cm WHERE cm.caixa_sessao_id = $1
       ORDER BY cm.data_movimento DESC LIMIT 200`,
      [sessaoId]
    );
    movimentos = m.rows;
  }

  return NextResponse.json({
    sessaoAtual: ultima.rows[0] ?? null,
    historico: historico.rows,
    movimentos,
    temAberta: aberta.rows.length > 0,
  });
}

export async function POST(req: Request) {
  const r = await apiPapel("dono", "gestor", "caixa");
  if (r.response) return r.response;
  const { acao, valor, observacao, valor_fecho } = await req.json();

  const aberta = await pool.query(
    `SELECT id, valor_abertura FROM caixa_sessao
     WHERE loja_id = $1 AND status = 'aberta' ORDER BY data_abertura DESC LIMIT 1`,
    [r.sessao.lojaId]
  );

  if (acao === "abrir") {
    if (aberta.rows.length > 0) {
      return NextResponse.json({ error: "Já existe uma caixa aberta" }, { status: 409 });
    }
    const result = await pool.query(
      `INSERT INTO caixa_sessao (loja_id, utilizador_id, valor_abertura)
       VALUES ($1, $2, $3) RETURNING id`,
      [r.sessao.lojaId, r.sessao.uid, Number(valor) || 0]
    );
    return NextResponse.json({ ok: true, id: result.rows[0].id }, { status: 201 });
  }

  if (["sangria", "suprimento"].includes(acao)) {
    if (aberta.rows.length === 0) {
      return NextResponse.json(
        { error: "Abra a caixa antes de registar movimentos" },
        { status: 409 }
      );
    }
    const v = Number(valor);
    if (!(v > 0)) {
      return NextResponse.json(
        { error: "Indique um valor maior que zero" },
        { status: 400 }
      );
    }
    await pool.query(
      `INSERT INTO caixa_movimento (caixa_sessao_id, tipo, valor, observacao)
       VALUES ($1, $2, $3, $4)`,
      [aberta.rows[0].id, acao, v, observacao ?? null]
    );
    return NextResponse.json({ ok: true });
  }

  if (acao === "fechar") {
    if (aberta.rows.length === 0) {
      return NextResponse.json({ error: "Não há caixa aberta" }, { status: 409 });
    }
    const id = aberta.rows[0].id;
    const agg = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN tipo='venda' THEN valor ELSE 0 END),0) AS vendas,
         COALESCE(SUM(CASE WHEN tipo='suprimento' THEN valor ELSE 0 END),0) AS suprimentos,
         COALESCE(SUM(CASE WHEN tipo='sangria' THEN valor ELSE 0 END),0) AS sangrias
       FROM caixa_movimento WHERE caixa_sessao_id = $1`,
      [id]
    );
    const esperado =
      Number(aberta.rows[0].valor_abertura) +
      Number(agg.rows[0].vendas) +
      Number(agg.rows[0].suprimentos) -
      Number(agg.rows[0].sangrias);
    const fecho = Number(valor_fecho);
    if (!(fecho >= 0)) {
      return NextResponse.json(
        { error: "Indique o valor em caixa no fecho" },
        { status: 400 }
      );
    }
    const diferenca = Number((fecho - esperado).toFixed(2));
    await pool.query(
      `UPDATE caixa_sessao SET valor_fecho = $1, valor_esperado = $2, diferenca = $3, status = 'fechada', data_fecho = now()
       WHERE id = $4`,
      [fecho, Number(esperado.toFixed(2)), diferenca, id]
    );
    return NextResponse.json({ ok: true, esperado: Number(esperado.toFixed(2)), diferenca });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}