import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";
import { appBaseUrl } from "@/lib/app-url";
import {
  buildLicencaReference,
  aplicarPagamentoLicenca,
  garantirLicenca,
} from "@/lib/licenca";
import {
  createPaySuiteCharge,
  classificarEstado,
  getPaySuiteCharge,
} from "@/lib/paysuite";

/**
 * Verifica o estado do pagamento pendente mais recente na PaySuite.
 * NÃO aplica alterações — só lê. O webhook é a fonte de verdade para aplicar.
 */
async function verificarPendente(lojaId: string): Promise<{
  status: "pago" | "falhou" | "pendente" | null;
  metodo?: string | null;
  cobrancaId?: string;
}> {
  const pag = await pool.query(
    `SELECT id, licenca_id, cobranca_id, metodo
     FROM licenca_pagamento
     WHERE loja_id = $1 AND status = 'pendente'
     ORDER BY data_criacao DESC LIMIT 1`,
    [lojaId]
  );
  if (pag.rows.length === 0) return { status: null };

  const { cobranca_id: cobrancaId, metodo } = pag.rows[0];
  if (!cobrancaId) return { status: "pendente", metodo };

  const check = await getPaySuiteCharge(cobrancaId);
  if (!check.paid && !check.failed) return { status: "pendente", metodo, cobrancaId };

  return {
    status: check.paid ? "pago" : "falhou",
    metodo: check.paid ? (metodo === "paysuite" ? null : metodo) : metodo,
    cobrancaId,
  };
}

// GET /api/licenca/pagar -> verifica estado do pagamento pendente (fallback do webhook)
// NÃO aplica — só informa. O webhook aplica.
export async function GET() {
  try {
    const r = await apiPapel("dono");
    if (r.response) return r.response;

    const estado = await verificarPendente(r.sessao.lojaId);
    return NextResponse.json({ ok: true, ...estado });
  } catch (e) {
    console.error("licenca/pagar GET erro:", e);
    return NextResponse.json({ error: "Falha ao verificar o pagamento." }, { status: 500 });
  }
}

// POST /api/licenca/pagar
// Licença mensal (2.500,00 MZN) via PaySuite — sem `method` = checkout hospedado.
export async function POST(req: Request) {
  try {
    const r = await apiPapel("dono");
    if (r.response) return r.response;

    await garantirLicenca(r.sessao.lojaId);

    // Idempotência: se já há pagamento pendente, reusa a cobrança existente
    const existente = await pool.query(
      `SELECT id, cobranca_id, checkout_url FROM licenca_pagamento
       WHERE loja_id = $1 AND status = 'pendente'
       ORDER BY data_criacao DESC LIMIT 1`,
    [r.sessao.lojaId]);
    if (existente.rows.length > 0 && existente.rows[0].checkout_url) {
      return NextResponse.json({
        ok: true,
        status: "pendente",
        checkout_url: existente.rows[0].checkout_url,
        pagamento_id: existente.rows[0].id,
        reusado: true,
      });
    }

    const lic = await pool.query(
      `SELECT lc.id, lc.valor_mensal FROM licenca lc WHERE lc.loja_id = $1`,
      [r.sessao.lojaId]
    );
    if (lic.rows.length === 0) {
      return NextResponse.json({ error: "Licença não encontrada." }, { status: 404 });
    }

    const licencaId: string = lic.rows[0].id;
    const valor: number = Number(lic.rows[0].valor_mensal) || 2500;
    const reference = buildLicencaReference();

    const pag = await pool.query(
      `INSERT INTO licenca_pagamento (licenca_id, loja_id, metodo, valor, referencia_pagamento, status)
       VALUES ($1, $2, 'paysuite', $3, $4, 'pendente')
       RETURNING id`,
      [licencaId, r.sessao.lojaId, valor, reference]
    );
    const pagamentoId = pag.rows[0].id;

    const base = appBaseUrl(req);
    const returnUrl = `${base}/licenca?pagamento_id=${pagamentoId}`;
    const webhookUrl = `${base}/api/webhooks/paysuite`;

    let charge;
    try {
      charge = await createPaySuiteCharge({
        amountMZN: valor,
        reference,
        returnUrl,
        webhookUrl,
        description: `Licença ShopLink - ${reference}`,
      });
    } catch (chargeErr) {
      const motivo = chargeErr instanceof Error ? chargeErr.message : "erro ao contactar a PaySuite";
      await pool
        .query(`UPDATE licenca_pagamento SET status = 'falhou', observacao = $2 WHERE id = $1`, [
          pagamentoId,
          motivo.slice(0, 250),
        ])
        .catch(() => {});
      return NextResponse.json(
        { error: `Não foi possível criar o pagamento: ${motivo}` },
        { status: 502 }
      );
    }

    await pool.query(
      `UPDATE licenca_pagamento SET cobranca_id = $1, checkout_url = $2, observacao = $3 WHERE id = $4`,
      [charge.id, charge.checkoutUrl ?? null, `PaySuite ${charge.status}`.slice(0, 250), pagamentoId]
    );

    const { paid, failed } = classificarEstado(charge.status);

    if (paid) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const periodo = await aplicarPagamentoLicenca(client, licencaId, pagamentoId);
        await client.query("COMMIT");
        return NextResponse.json({
          ok: true,
          status: "pago",
          recibo: `Período: ${pt(periodo.períodoInicio)} → ${pt(periodo.períodoFim)}`,
        });
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("licenca/pagar: pagamento aprovado mas renovação falhou:", e);
        return NextResponse.json(
          { error: "Pagamento aprovado mas a renovação falhou. Contacte-nos." },
          { status: 500 }
        );
      } finally {
        client.release();
      }
    }

    if (failed) {
      await pool.query(`UPDATE licenca_pagamento SET status = 'falhou' WHERE id = $1`, [pagamentoId]);
      return NextResponse.json(
        { error: "A PaySuite recusou o pagamento. Tente novamente." },
        { status: 502 }
      );
    }

    // pendente -> redirecionar para o checkout hospedado da PaySuite
    return NextResponse.json({
      ok: true,
      status: "pendente",
      checkout_url: charge.checkoutUrl ?? null,
      pagamento_id: pagamentoId,
    });
  } catch (e) {
    console.error("licenca/pagar erro:", e);
    const motivo = e instanceof Error ? e.message : "erro interno";
    return NextResponse.json({ error: motivo }, { status: 500 });
  }
}

function pt(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}