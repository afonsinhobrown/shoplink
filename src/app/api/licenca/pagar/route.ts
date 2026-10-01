import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";
import {
  buildLicencaReference,
  aplicarPagamentoLicenca,
  garantirLicenca,
} from "@/lib/licenca";
import { createPaySuiteCharge } from "@/lib/paysuite";

// POST /api/licenca/pagar
// Licença mensal (2.500,00 MZN) paga via PaySuite — o cliente escolhe o método no checkout
export async function POST(req: Request) {
  try {
    const r = await apiPapel("dono");
    if (r.response) return r.response;

    await garantirLicenca(r.sessao.lojaId);

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
       VALUES ($1, $2, $3, $4, $5, 'pendente')
       RETURNING id`,
      [licencaId, r.sessao.lojaId, "card", valor, reference]
    );
    const pagamentoId = pag.rows[0].id;

    const host = req.headers.get("host") || "shoplink-iota.vercel.app";
    const proto = host.includes("localhost") ? "http" : "https";
    const base = (process.env.APP_URL || `${proto}://${host}`).replace(/\/$/, "");
    const returnUrl = `${base}/licenca?recibo=1`;

    let charge;
    try {
      charge = await createPaySuiteCharge({
        amountMZN: valor,
        reference,
        description: `Licença ShopLink - ${reference}`,
        returnUrl,
        // sem `method` → cliente escolhe no checkout da PaySuite (M-Pesa, e-Mola, Cartão)
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

    const st = String(charge.status).toLowerCase();

    if (st === "paid" || st === "succeeded") {
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
        return NextResponse.json(
          { error: "Pagamento aprovado mas a renovação falhou. Contacte-nos." },
          { status: 500 }
        );
      } finally {
        client.release();
      }
    }

    if (st === "failed") {
      await pool.query(
        `UPDATE licenca_pagamento SET status = 'falhou' WHERE id = $1`,
        [pagamentoId]
      );
      return NextResponse.json(
        { error: "A PaySuite recusou o pagamento. Tente novamente." },
        { status: 502 }
      );
    }

    // pendente → redirecionar para o checkout da PaySuite
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