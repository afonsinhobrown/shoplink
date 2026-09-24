import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";

// POST /api/financeiro/lancamentos -> cria receita/despesa
export async function POST(req: Request) {
  const r = await apiPapel("dono", "gestor");
  if (r.response) return r.response;
  const lojaId = r.sessao.lojaId;

  const body = await req.json();
  const { tipo, conta_financeira_id, categoria_financeira_id, valor, descricao, data_competencia } =
    body ?? {};

  if (!["receita", "despesa"].includes(tipo)) {
    return NextResponse.json({ error: "Tipo inválido (receita ou despesa)." }, { status: 400 });
  }
  const v = Number(valor);
  if (!Number.isFinite(v) || v <= 0) {
    return NextResponse.json({ error: "Informe um valor válido." }, { status: 400 });
  }
  if (!conta_financeira_id || !categoria_financeira_id) {
    return NextResponse.json({ error: "Escolha a conta e a categoria." }, { status: 400 });
  }

  const cat = await pool.query(
    `SELECT tipo FROM categoria_financeira WHERE id = $1 AND loja_id = $2`,
    [categoria_financeira_id, lojaId]
  );
  if (cat.rows.length === 0) {
    return NextResponse.json({ error: "Categoria inválida." }, { status: 400 });
  }
  if (cat.rows[0].tipo !== tipo) {
    return NextResponse.json(
      { error: `A categoria escolhida é de ${cat.rows[0].tipo}.` },
      { status: 400 }
    );
  }
  const conta = await pool.query(
    `SELECT id FROM conta_financeira WHERE id = $1 AND loja_id = $2`,
    [conta_financeira_id, lojaId]
  );
  if (conta.rows.length === 0) {
    return NextResponse.json({ error: "Conta inválida." }, { status: 400 });
  }

  const ins = await pool.query(
    `INSERT INTO lancamento_financeiro
       (loja_id, conta_financeira_id, categoria_financeira_id, tipo, valor, descricao,
        origem_tipo, status, utilizador_id, data_competencia)
     VALUES ($1,$2,$3,$4,$5,$6,'manual','confirmado',$7, COALESCE($8::date, CURRENT_DATE))
     RETURNING id`,
    [
      lojaId,
      conta_financeira_id,
      categoria_financeira_id,
      tipo,
      v,
      descricao ?? null,
      r.sessao.uid,
      data_competencia ?? null,
    ]
  );

  return NextResponse.json({ ok: true, id: ins.rows[0].id }, { status: 201 });
}