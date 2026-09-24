import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";
import { licencaEfetivamenteAtiva, diasRestantes } from "@/lib/licenca";

// GET /api/licenca  -> estado da licença + histórico de pagamentos da loja
export async function GET() {
  const r = await apiPapel("dono", "gestor");
  if (r.response) return r.response;

  const lic = await pool.query(
    `SELECT lc.id, lc.estado, lc.plano, lc.valor_mensal, lc.data_inicio, lc.data_fim,
            l.nome AS loja_nome, t.nome AS empresa, t.email AS email_empresa
     FROM licenca lc
     JOIN loja l ON l.id = lc.loja_id
     LEFT JOIN tenant t ON t.id = l.tenant_id
     WHERE lc.loja_id = $1`,
    [r.sessao.lojaId]
  );
  if (lic.rows.length === 0) {
    return NextResponse.json(
      { error: "Esta loja não tem licença atribuída." },
      { status: 404 }
    );
  }
  const L = lic.rows[0];

  const pags = await pool.query(
    `SELECT id, metodo, valor, status, referencia_pagamento, cobranca_id,
            periodo_inicio, periodo_fim, recibo_numero, recibo_enviado,
            data_envio_recibo, data_pagamento, data_criacao, observacao
     FROM licenca_pagamento
     WHERE licenca_id = $1
     ORDER BY data_criacao DESC
     LIMIT 50`,
    [L.id]
  );

  return NextResponse.json({
    loja: { nome: L.loja_nome, empresa: L.empresa, email: L.email_empresa },
    licenca: {
      id: L.id,
      estado: L.estado,
      plano: L.plano,
      valor_mensal: Number(L.valor_mensal),
      data_inicio: L.data_inicio,
      data_fim: L.data_fim,
      dias_restantes: diasRestantes(L.data_fim),
      efetivamente_ativa: licencaEfetivamenteAtiva(L.estado, L.data_fim),
    },
    pagamentos: pags.rows.map((p) => ({
      ...p,
      valor: Number(p.valor),
    })),
  });
}

// POST /api/licenca  body: { acao: 'bloquear' | 'reativar' }  (apenas dono)
export async function POST(req: Request) {
  const r = await apiPapel("dono");
  if (r.response) return r.response;

  const body = await req.json();
  const acao = body?.acao;
  if (!["bloquear", "reativar"].includes(acao)) {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  const lic = await pool.query(
    `SELECT estado, data_fim FROM licenca WHERE loja_id = $1`,
    [r.sessao.lojaId]
  );
  if (lic.rows.length === 0) {
    return NextResponse.json({ error: "Licença não encontrada." }, { status: 404 });
  }
  const L = lic.rows[0];

  let novoEstado: string;
  if (acao === "bloquear") {
    novoEstado = "bloqueada";
  } else {
    novoEstado =
      L.data_fim && new Date(L.data_fim).getTime() > Date.now() ? "ativa" : "expirada";
  }

  await pool.query(
    `UPDATE licenca SET estado = $1, atualizada_em = now() WHERE loja_id = $2`,
    [novoEstado, r.sessao.lojaId]
  );

  return NextResponse.json({ ok: true, estado: novoEstado });
}